#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
닥터그린 2단계 파이프라인 — ② 크롭 기반 파인그레인드 분류: 평가
================================================================================

test split 크롭에 대해:
  - 전체 정확도(overall accuracy)
  - 클래스별 precision/recall/F1  -> per_class_metrics.csv
  - 혼동행렬  -> confusion_matrix.csv, confusion_matrix.png
  - 신뢰도 임계값 스윕(0.50~0.95) 정확도 vs 커버리지  -> threshold_sweep.csv
    (배포 '판단보류' 게이트 설계용. 현재 프로덕션 conf 컷오프 0.75와 비교 참고)

사용법:
    python eval_classifier.py --data /path/to/crops --ckpt runs/cls/best.pt --out runs/cls/eval
"""

import argparse
import csv
import json
import sys
from pathlib import Path

import numpy as np
import torch
import timm
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

import matplotlib
matplotlib.use("Agg")  # 헤드리스 저장용
import matplotlib.pyplot as plt


def log(msg=""):
    print(msg, flush=True)


def pick_device(prefer="auto"):
    if prefer != "auto":
        return torch.device(prefer)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) is not None and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def main(argv=None):
    p = argparse.ArgumentParser(description="크롭 분류기 평가 (test split)")
    p.add_argument("--data", required=True, help="crops 폴더(test 하위 클래스 폴더 필요)")
    p.add_argument("--ckpt", required=True, help="best.pt 경로")
    p.add_argument("--out", required=True, help="평가 결과 폴더")
    p.add_argument("--split", default="test", help="평가 split(기본 test)")
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--device", default="auto")
    args = p.parse_args(argv if argv is not None else sys.argv[1:])

    data = Path(args.data).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    device = pick_device(args.device)

    ckpt = torch.load(args.ckpt, map_location="cpu", weights_only=False)
    classes = ckpt["classes"]            # 학습이 쓴 인덱스 순서 그대로
    num_classes = len(classes)
    img_size = ckpt.get("img_size", 384)
    mean = ckpt.get("mean", (0.485, 0.456, 0.406))
    std = ckpt.get("std", (0.229, 0.224, 0.225))

    model = timm.create_model(ckpt["model"], pretrained=False, num_classes=num_classes)
    model.load_state_dict(ckpt["state_dict"])
    model.to(device).eval()

    eval_tf = transforms.Compose([
        transforms.Resize(int(img_size * 1.15)),
        transforms.CenterCrop(img_size),
        transforms.ToTensor(),
        transforms.Normalize(mean, std),
    ])
    split_dir = data / args.split
    if not split_dir.exists():
        log(f"[오류] {split_dir} 없음")
        return 2
    ds = datasets.ImageFolder(str(split_dir), transform=eval_tf)

    # ImageFolder 의 클래스 순서가 ckpt 순서와 같은지 확인(폴더명 정렬은 동일해야 함)
    if list(ds.classes) != list(classes):
        log(f"[경고] test 클래스 순서({list(ds.classes)}) != ckpt 순서({list(classes)}). "
            "ckpt 인덱스로 재매핑합니다.")
    ck_idx = {c: i for i, c in enumerate(classes)}
    remap = {ds.class_to_idx[c]: ck_idx[c] for c in ds.classes if c in ck_idx}

    loader = DataLoader(ds, batch_size=args.batch_size, shuffle=False,
                        num_workers=args.workers)

    all_true, all_pred, all_conf = [], [], []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            probs = torch.softmax(model(images), dim=1)
            conf, pred = probs.max(1)
            true = torch.tensor([remap.get(int(l), int(l)) for l in labels])
            all_true.append(true.numpy())
            all_pred.append(pred.cpu().numpy())
            all_conf.append(conf.cpu().numpy())

    y_true = np.concatenate(all_true)
    y_pred = np.concatenate(all_pred)
    y_conf = np.concatenate(all_conf)
    n = len(y_true)
    if n == 0:
        log("[오류] test 샘플 0개")
        return 1

    overall = float((y_true == y_pred).mean())
    log(f"[전체 정확도] {overall:.4f}  (n={n})")

    # 혼동행렬 (행=정답, 열=예측)
    cm = np.zeros((num_classes, num_classes), dtype=int)
    for t, pr in zip(y_true, y_pred):
        cm[t, pr] += 1

    # 클래스별 precision/recall/f1
    per_class_rows = []
    for i, cls in enumerate(classes):
        tp = cm[i, i]
        fp = cm[:, i].sum() - tp
        fn = cm[i, :].sum() - tp
        support = cm[i, :].sum()
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        per_class_rows.append([cls, int(support), round(prec, 4), round(rec, 4), round(f1, 4)])
        log(f"  {cls:>8}: P={prec:.3f} R={rec:.3f} F1={f1:.3f} (n={support})")

    macro_f1 = float(np.mean([r[4] for r in per_class_rows]))
    log(f"[macro F1] {macro_f1:.4f}")

    # CSV 저장
    with open(out / "per_class_metrics.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["class", "support", "precision", "recall", "f1"])
        w.writerows(per_class_rows)
        w.writerow(["overall_accuracy", n, "", "", round(overall, 4)])
        w.writerow(["macro_f1", "", "", "", round(macro_f1, 4)])

    with open(out / "confusion_matrix.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["true\\pred"] + list(classes))
        for i, cls in enumerate(classes):
            w.writerow([cls] + [int(x) for x in cm[i]])

    # 혼동행렬 PNG
    fig, ax = plt.subplots(figsize=(1.4 * num_classes + 2, 1.4 * num_classes + 2))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(num_classes))
    ax.set_yticks(range(num_classes))
    ax.set_xticklabels(classes, rotation=45, ha="right")
    ax.set_yticklabels(classes)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(f"Confusion Matrix (acc={overall:.3f}, n={n})")
    thresh = cm.max() / 2 if cm.max() else 0
    for i in range(num_classes):
        for j in range(num_classes):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                    color="white" if cm[i, j] > thresh else "black")
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(out / "confusion_matrix.png", dpi=130)
    plt.close(fig)

    # 신뢰도 임계값 스윕 — 배포 판단보류 게이트 설계용
    log("")
    log("[임계값 스윕] threshold | coverage | acc@covered | (판단보류율)")
    sweep_rows = []
    for thr in [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95]:
        keep = y_conf >= thr
        cov = float(keep.mean())
        acc_cov = float((y_true[keep] == y_pred[keep]).mean()) if keep.any() else 0.0
        abstain = 1.0 - cov
        sweep_rows.append([thr, round(cov, 4), round(acc_cov, 4), round(abstain, 4)])
        log(f"    {thr:.2f}     |  {cov:.3f}  |   {acc_cov:.3f}    |  {abstain:.3f}")
    with open(out / "threshold_sweep.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["threshold", "coverage", "accuracy_at_covered", "abstain_rate"])
        w.writerows(sweep_rows)

    # 요약 JSON
    (out / "summary.json").write_text(json.dumps({
        "overall_accuracy": overall,
        "macro_f1": macro_f1,
        "n": int(n),
        "classes": list(classes),
        "prod_threshold": 0.75,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    log("")
    log(f"[저장] {out}")
    log("  per_class_metrics.csv / confusion_matrix.csv / confusion_matrix.png")
    log("  threshold_sweep.csv / summary.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
