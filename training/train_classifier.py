#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
닥터그린 2단계 파이프라인 — ② 크롭 기반 파인그레인드 분류: 학습
================================================================================

입력 : crop_dataset.py 가 만든 crops/{split}/{class_name}/*.jpg (ImageFolder 규약)
출력 : results.csv(에폭별 train/val loss·acc), best.pt(최고 val loss), last.pt

모델 : timm 사전학습(ImageNet) — 기본 convnext_tiny, 대안 tf_efficientnetv2_s
학습 :
  - 클래스 가중치 교차엔트로피(train 개수 역빈도 → 불균형 보정)
  - 증강: 수평뒤집기 + 약한 컬러지터 + 소폭 RandomResizedCrop (강한 회전은 금지 — 병징 형태 왜곡 방지)
  - AdamW + 코사인 LR + 워밍업, CUDA일 때 혼합정밀(AMP)
  - val loss 기준 조기종료(early stopping)
  - CPU/MPS(느리지만 동작)/CUDA 모두 지원

클래스 순서는 ImageFolder 가 폴더명을 알파벳/유니코드 정렬하므로, 배포 스키마 순서
(0:정상 1:역병 2:시들음병 3:잎끝마름 4:황화)와 다를 수 있다. 그래서 best.pt 에는
학습이 쓴 실제 class_to_idx 를 함께 저장하고, eval/export 가 이를 그대로 사용한다.
앱 배포 매핑은 export 단계에서 이 class 이름 리스트로 처리한다(README 참조).

사용법(실사용 예):
    python train_classifier.py --data /path/to/crops --out runs/cls_convnext \
        --model convnext_tiny --img-size 384 --epochs 40 --batch-size 32

스모크(맥/CPU)용 예:
    python train_classifier.py --data crops_smoke --out runs/smoke \
        --model convnext_tiny --img-size 128 --epochs 2 --batch-size 8 --warmup-epochs 0
"""

import argparse
import csv
import json
import math
import sys
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
import timm
from timm.data import resolve_data_config
from torchvision import datasets, transforms


def log(msg=""):
    print(msg, flush=True)


def pick_device(prefer: str = "auto") -> torch.device:
    if prefer != "auto":
        return torch.device(prefer)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def build_transforms(img_size: int, mean, std):
    train_tf = transforms.Compose([
        # 소폭 RandomResizedCrop — 병징이 크롭 밖으로 잘리지 않도록 scale 하한을 높게(0.7)
        transforms.RandomResizedCrop(img_size, scale=(0.7, 1.0), ratio=(0.85, 1.18)),
        transforms.RandomHorizontalFlip(p=0.5),
        # 약한 컬러지터(조명/촬영 편차 보정). 강한 회전/원근은 넣지 않음.
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.02),
        transforms.ToTensor(),
        transforms.Normalize(mean, std),
    ])
    eval_tf = transforms.Compose([
        transforms.Resize(int(img_size * 1.15)),
        transforms.CenterCrop(img_size),
        transforms.ToTensor(),
        transforms.Normalize(mean, std),
    ])
    return train_tf, eval_tf


def class_weights_from_counts(dataset, num_classes: int) -> torch.Tensor:
    """train ImageFolder 의 클래스별 샘플 수 역빈도 가중치(평균 1로 정규화)."""
    counts = [0] * num_classes
    for _, label in dataset.samples:
        counts[label] += 1
    counts_t = torch.tensor(counts, dtype=torch.float32)
    counts_t = torch.clamp(counts_t, min=1.0)
    inv = 1.0 / counts_t
    inv = inv * (num_classes / inv.sum())  # 평균 가중치 1
    return inv, counts


def cosine_warmup_lambda(warmup_epochs: int, total_epochs: int):
    """에폭 단위 LR 스케일: 워밍업(선형) 후 코사인 감쇠(하한 0.01)."""
    def fn(epoch):
        if warmup_epochs > 0 and epoch < warmup_epochs:
            return (epoch + 1) / warmup_epochs
        progress = (epoch - warmup_epochs) / max(1, total_epochs - warmup_epochs)
        return 0.01 + 0.99 * 0.5 * (1 + math.cos(math.pi * min(1.0, progress)))
    return fn


def run_epoch(model, loader, criterion, device, optimizer=None, scaler=None, amp=False):
    train = optimizer is not None
    model.train(train)
    total_loss, correct, total = 0.0, 0, 0
    for images, labels in loader:
        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)
        with torch.set_grad_enabled(train):
            if amp and train:
                with torch.autocast(device_type="cuda", dtype=torch.float16):
                    logits = model(images)
                    loss = criterion(logits, labels)
                optimizer.zero_grad(set_to_none=True)
                scaler.scale(loss).backward()
                scaler.step(optimizer)
                scaler.update()
            else:
                logits = model(images)
                loss = criterion(logits, labels)
                if train:
                    optimizer.zero_grad(set_to_none=True)
                    loss.backward()
                    optimizer.step()
        total_loss += loss.item() * images.size(0)
        correct += (logits.argmax(1) == labels).sum().item()
        total += images.size(0)
    return total_loss / max(1, total), correct / max(1, total)


def main(argv=None):
    p = argparse.ArgumentParser(
        description="크롭 파인그레인드 분류기 학습 (timm)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--data", required=True, help="crops 폴더(train/val/test 하위에 클래스 폴더)")
    p.add_argument("--out", required=True, help="결과 폴더(best.pt/last.pt/results.csv). 레포 밖 권장")
    p.add_argument("--model", default="convnext_tiny",
                   help="timm 모델명(기본 convnext_tiny, 대안 tf_efficientnetv2_s)")
    p.add_argument("--img-size", type=int, default=384)
    p.add_argument("--epochs", type=int, default=40)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--weight-decay", type=float, default=0.05)
    p.add_argument("--warmup-epochs", type=int, default=3)
    p.add_argument("--patience", type=int, default=8, help="val loss 미개선 조기종료 인내 에폭")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--device", default="auto", help="auto|cpu|cuda|mps")
    p.add_argument("--no-pretrained", action="store_true", help="사전학습 가중치 미사용(스모크/디버그)")
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args(argv if argv is not None else sys.argv[1:])

    torch.manual_seed(args.seed)
    data = Path(args.data).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)

    device = pick_device(args.device)
    use_amp = device.type == "cuda"
    log(f"[환경] device={device} | AMP={use_amp} | torch={torch.__version__}")

    # 모델 먼저 만들어 timm 권장 정규화(mean/std)를 가져온다.
    train_dir = data / "train"
    val_dir = data / "val"
    if not train_dir.exists():
        log(f"[오류] {train_dir} 없음 — crop_dataset.py 를 먼저 실행하세요.")
        return 2

    # 클래스 수 파악용으로 임시 폴더 스캔
    class_dirs = sorted([d.name for d in train_dir.iterdir() if d.is_dir()])
    num_classes = len(class_dirs)
    if num_classes < 2:
        log(f"[오류] train 클래스가 {num_classes}개뿐입니다: {class_dirs}")
        return 2

    model = timm.create_model(args.model, pretrained=not args.no_pretrained,
                              num_classes=num_classes)
    cfg = resolve_data_config({}, model=model)
    mean = cfg.get("mean", (0.485, 0.456, 0.406))
    std = cfg.get("std", (0.229, 0.224, 0.225))
    model = model.to(device)

    train_tf, eval_tf = build_transforms(args.img_size, mean, std)
    train_ds = datasets.ImageFolder(str(train_dir), transform=train_tf)
    val_ds = datasets.ImageFolder(str(val_dir), transform=eval_tf) if val_dir.exists() else None

    # class_to_idx 저장 — eval/export 가 동일 매핑을 써야 함.
    class_to_idx = train_ds.class_to_idx
    idx_to_class = {v: k for k, v in class_to_idx.items()}
    (out / "classes.json").write_text(
        json.dumps({"class_to_idx": class_to_idx,
                    "classes": [idx_to_class[i] for i in range(num_classes)]},
                   ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"[클래스] {[idx_to_class[i] for i in range(num_classes)]}")

    weights, counts = class_weights_from_counts(train_ds, num_classes)
    log(f"[클래스 가중치] counts={counts} -> weights={[round(w, 3) for w in weights.tolist()]}")

    pin = device.type == "cuda"
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=args.workers, pin_memory=pin, drop_last=False)
    val_loader = (DataLoader(val_ds, batch_size=args.batch_size, shuffle=False,
                             num_workers=args.workers, pin_memory=pin)
                  if val_ds is not None else None)

    criterion = nn.CrossEntropyLoss(weight=weights.to(device))
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr,
                                  weight_decay=args.weight_decay)
    scheduler = torch.optim.lr_scheduler.LambdaLR(
        optimizer, cosine_warmup_lambda(args.warmup_epochs, args.epochs))
    scaler = torch.amp.GradScaler("cuda") if use_amp else None

    results_path = out / "results.csv"
    with open(results_path, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow(
            ["epoch", "lr", "train_loss", "train_acc", "val_loss", "val_acc"])

    best_val = float("inf")
    best_epoch = -1
    no_improve = 0
    log("")
    for epoch in range(args.epochs):
        lr_now = optimizer.param_groups[0]["lr"]
        tr_loss, tr_acc = run_epoch(model, train_loader, criterion, device,
                                    optimizer=optimizer, scaler=scaler, amp=use_amp)
        if val_loader is not None:
            with torch.no_grad():
                va_loss, va_acc = run_epoch(model, val_loader, criterion, device)
        else:
            va_loss, va_acc = float("nan"), float("nan")
        scheduler.step()

        log(f"[epoch {epoch + 1:>3}/{args.epochs}] lr={lr_now:.2e} "
            f"train loss {tr_loss:.4f} acc {tr_acc:.3f} | "
            f"val loss {va_loss:.4f} acc {va_acc:.3f}")
        with open(results_path, "a", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(
                [epoch + 1, f"{lr_now:.6e}", f"{tr_loss:.6f}", f"{tr_acc:.6f}",
                 f"{va_loss:.6f}", f"{va_acc:.6f}"])

        ckpt = {
            "model": args.model,
            "state_dict": model.state_dict(),
            "class_to_idx": class_to_idx,
            "classes": [idx_to_class[i] for i in range(num_classes)],
            "img_size": args.img_size,
            "mean": mean,
            "std": std,
            "epoch": epoch + 1,
        }
        torch.save(ckpt, out / "last.pt")

        # 조기종료 기준: val loss (val 없으면 train loss)
        monitor = va_loss if val_loader is not None and not math.isnan(va_loss) else tr_loss
        if monitor < best_val - 1e-4:
            best_val = monitor
            best_epoch = epoch + 1
            no_improve = 0
            torch.save(ckpt, out / "best.pt")
            log(f"    -> best 갱신(monitor={monitor:.4f}) best.pt 저장")
        else:
            no_improve += 1
            if no_improve >= args.patience:
                log(f"    -> {args.patience}에폭 미개선, 조기종료")
                break

    log("")
    log(f"[완료] best epoch {best_epoch} (monitor={best_val:.4f})")
    log(f"  best.pt   : {out / 'best.pt'}")
    log(f"  last.pt   : {out / 'last.pt'}")
    log(f"  results   : {results_path}")
    log(f"  classes   : {out / 'classes.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
