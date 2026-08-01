#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
닥터그린 2단계 파이프라인 — ② 크롭 기반 파인그레인드 분류: k-fold 교차검증
================================================================================

무엇을 하는가
  - crop_dataset.py 결과(crops/{train,val,test}/{클래스}/*.jpg)에서 train+val 을 합쳐
    "그룹(개체) 인식 + 클래스 층화" k-fold 를 만들고, fold 마다 train_classifier.py 와
    eval_classifier.py 를 서브프로세스로 돌린 뒤 정확도/F1 을 집계한다.
  - test/ 는 절대 건드리지 않는다(읽지도 않음) — 최종 홀드아웃으로 남겨 둔다.
    교차검증은 "모델·하이퍼파라미터의 평균 성능과 편차"를 보는 용도이고,
    공식 최종 수치는 여전히 test 홀드아웃 1회 평가로 보고한다.

그룹(개체) 키 — prep_win.py 의 group_key() 와 동일 로직
  - 크롭 파일명은 crop_dataset.py 규칙대로 "{원본stem}__b{박스번호}.jpg" 이다.
    (예: 딸기_설향_시들음병_07_021_220720062855__b3.jpg)
  - 먼저 "__b{숫자}" 접미사를 떼어 원본 이미지 stem 을 복원하고,
    그 stem 에 prep_win.py 의 group_key() 를 그대로 적용한다:
      * GROUP_ID_REGEX 가 비어 있으므로 자동 추정 — 끝의 연속 숫자(타임스탬프 등)를
        re.sub(r"[_\\-]?\\d+$", "", stem) 으로 1회 제거.
      * 예: 딸기_설향_시들음병_07_021_220720062855 -> 딸기_설향_시들음병_07_021
        (= 병명까지 포함되지만 실질 식별자는 {농가}_{개체}. 같은 개체의 연속 촬영
        프레임이 서로 다른 fold 에 걸치는 누수를 막는다.)
  - 로직을 바꾸면 prep_win.py / doctorgreen_aihub_data_prep.ipynb 셀 16과 함께
    세 곳을 모두 맞출 것.

fold 배정 방법 (greedy, 결정적)
  - 클래스별 "그룹 수가 적은 클래스"부터 처리하고, 각 클래스 안에서는 크롭 수가 많은
    그룹부터(LPT) 다음 기준의 fold 에 배정한다:
      (1) 아직 그 클래스 그룹이 없는 fold 우선  ->  모든 fold 의 val 에 모든 클래스가
          최소 1그룹씩 들어가도록 보장(train_classifier 의 train/val 클래스 일치 요건)
      (2) 그 클래스 크롭 수가 가장 적은 fold
      (3) 전체 크롭 수가 가장 적은 fold, (4) fold 번호
  - 한 그룹은 정확히 한 fold 에만 들어간다(그룹이 fold 를 걸치지 않음).
    원본 이미지에 여러 클래스 박스가 있으면 그룹이 여러 클래스에 걸칠 수 있는데,
    그룹은 처음 배정될 때 한 번만 배정되고 이후 클래스 순회에서는 건너뛴다.
  - 무작위성이 없어(정렬 기반) 같은 입력이면 항상 같은 배정이 나온다. 배정 결과는
    folds.json 으로 저장되며, 재실행(resume) 시 folds.json 이 있으면 그대로 재사용한다.

클래스별 그룹 수 < k 이면 즉시 실패한다(누수 없는 k-fold 가 불가능하므로).
  - 실데이터는 클래스당 수십 개 농가/개체 그룹이 있어 문제없지만, 37장짜리
    dataset_sample 은 클래스당 그룹이 1개뿐이라 정당하게 실패한다.
    스모크/초소형 데이터 전용으로 --group-key image (원본 이미지 stem 을 그룹으로 사용,
    같은 이미지의 크롭이 fold 를 걸치지 않는 약한 보장만 제공)를 열어 두었다.
    실데이터 성능 보고에는 절대 쓰지 말 것.

fold 데이터 구성
  - {out}/fold{i}/data/{train,val}/{클래스}/ 에 절대경로 심볼릭 링크로 구성한다.
    val = fold i 의 그룹, train = 나머지 fold 전부. 복사가 아니라 링크이므로 가볍다.
  - eval_classifier.py 는 --split 인자를 지원하므로 fold 의 val 을 --split val 로
    직접 평가한다(test/ 심볼릭 링크 우회 불필요).

재개(resume)
  - fold 의 평가 요약({out}/fold{i}/eval/summary.json)이 이미 있으면 그 fold 는
    건너뛴다. 중단됐다면 같은 명령을 다시 실행하면 이어서 돈다.

사용법(실사용 예):
    python cross_validate.py --data /path/to/crops --out runs/cv \
        --model convnext_tiny --img-size 384 --epochs 40 --batch-size 32

    # 배정/분포만 확인(학습 없이):
    python cross_validate.py --data /path/to/crops --out runs/cv --dry-run

스모크(맥/CPU, dataset_sample 크롭)용 예:
    python cross_validate.py --data crops_smoke --out runs/cv_smoke \
        --folds 2 --group-key image --img-size 96 --epochs 1 --batch-size 16 \
        --workers 0 --device cpu --warmup-epochs 0 --no-pretrained
"""

import argparse
import csv
import json
import math
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

# 윈도우 리다이렉트 시 cp949 인코딩 오류 방지(crop_dataset.py 와 동일한 완화)
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="replace")
    except Exception:
        pass

IMG_SUFFIXES = {".jpg", ".jpeg", ".png"}
SCRIPT_DIR = Path(__file__).resolve().parent

# prep_win.py 와 동일 — 비워두면 파일명 끝의 연속 숫자를 떼어 자동 추정
GROUP_ID_REGEX = ""


def log(msg=""):
    print(msg, flush=True)


# ----------------------------------------------------------------------------
#  그룹 키 (prep_win.py group_key() 복제)
# ----------------------------------------------------------------------------
def group_key(stem: str) -> str:
    """prep_win.py 의 group_key() 와 동일 로직(원본 이미지 stem 에 적용)."""
    if GROUP_ID_REGEX:
        m = re.search(GROUP_ID_REGEX, stem)
        if m:
            return m.group(1) if m.groups() else m.group(0)
    # 자동 추정: 끝의 _0001 / -12 / 타임스탬프 같은 연속 숫자를 제거
    return re.sub(r"[_\-]?\d+$", "", stem)


def source_stem_from_crop(crop_stem: str) -> str:
    """
    crop_dataset.py 파일명 규칙 "{원본stem}__b{박스번호}" 에서 원본 stem 복원.
    "__b{숫자}" 꼴이 아니면(규칙이 바뀐 파일) 그대로 반환하되 경고 대상.
    """
    head, sep, tail = crop_stem.rpartition("__b")
    if sep and tail.isdigit():
        return head
    return crop_stem


# ----------------------------------------------------------------------------
#  크롭 수집
# ----------------------------------------------------------------------------
def collect_pool(data: Path):
    """
    crops/{train,val}/{클래스}/*.jpg 를 합쳐(pool) 목록화. test/ 는 열지 않는다.
    반환: items = [(경로, 클래스, 그룹키_plant, 그룹키_image)], classes = 정렬된 클래스 목록
    """
    items = []
    classes = set()
    odd_names = 0
    for split in ("train", "val"):
        split_dir = data / split
        if not split_dir.exists():
            continue
        for cls_dir in sorted(p for p in split_dir.iterdir() if p.is_dir()):
            cls = cls_dir.name
            for f in sorted(cls_dir.iterdir()):
                if not (f.is_file() and f.suffix.lower() in IMG_SUFFIXES):
                    continue
                src = source_stem_from_crop(f.stem)
                if src == f.stem:
                    odd_names += 1
                classes.add(cls)
                items.append((f, cls, group_key(src), src))
    return items, sorted(classes), odd_names


# ----------------------------------------------------------------------------
#  fold 배정 (greedy — 모듈 docstring 의 "fold 배정 방법" 참조)
# ----------------------------------------------------------------------------
def assign_folds(items, classes, k: int, key_index: int):
    """
    items[(path, cls, gkey_plant, gkey_image)] 를 그룹 단위로 k개 fold 에 배정.
    key_index: 2=plant(기본, prep_win 동일), 3=image(스모크 전용).
    반환: fold_of_group {그룹: fold번호}, group_stats {그룹: {클래스: 크롭수}}
    """
    group_stats = defaultdict(lambda: defaultdict(int))
    for it in items:
        group_stats[it[key_index]][it[1]] += 1

    # 클래스별 그룹 수 검사 — k 미만이면 누수 없는 k-fold 불가, 즉시 실패
    groups_per_class = defaultdict(set)
    for g, cc in group_stats.items():
        for cls in cc:
            groups_per_class[cls].add(g)
    short = {cls: len(gs) for cls, gs in groups_per_class.items() if len(gs) < k}
    if short:
        lines = [f"    {cls}: 그룹 {n}개 (필요 최소 {k}개)" for cls, n in sorted(short.items())]
        raise SystemExit(
            "[오류] 클래스별 그룹(개체) 수가 fold 수보다 적어 그룹 누수 없는 "
            f"{k}-fold 를 만들 수 없습니다:\n" + "\n".join(lines) + "\n"
            "  - 실데이터라면 --folds 를 줄이거나 데이터 구성을 확인하세요.\n"
            "  - dataset_sample 같은 초소형 스모크라면 --group-key image 로 이미지 단위\n"
            "    그룹을 쓸 수 있습니다(누수 보장이 약해지므로 성능 보고용으로는 금지)."
        )

    # 클래스는 그룹 수 오름차순(희소 클래스 먼저), 그룹은 크롭 수 내림차순(LPT)
    fold_class = [defaultdict(int) for _ in range(k)]   # fold별 클래스 크롭 수
    fold_gcls = [defaultdict(int) for _ in range(k)]    # fold별 클래스 그룹 수
    fold_total = [0] * k
    fold_of_group = {}

    class_order = sorted(classes, key=lambda c: (len(groups_per_class[c]), c))
    for cls in class_order:
        cls_groups = sorted(
            groups_per_class[cls],
            key=lambda g: (-sum(group_stats[g].values()), g))
        for g in cls_groups:
            if g in fold_of_group:      # 다중 클래스 그룹은 최초 1회만 배정
                continue
            best = min(
                range(k),
                key=lambda i: (0 if fold_gcls[i][cls] else -1,   # 미커버 fold 우선
                               fold_class[i][cls], fold_total[i], i))
            fold_of_group[g] = best
            for c2, n in group_stats[g].items():
                fold_class[best][c2] += n
                fold_gcls[best][c2] += 1
            fold_total[best] += sum(group_stats[g].values())

    # 커버리지 확인 — 모든 fold 의 val 에 모든 클래스가 있어야
    # train_classifier.py 의 train/val 클래스 일치 검사를 통과한다.
    missing = [(i, cls) for i in range(k) for cls in classes if fold_class[i][cls] == 0]
    if missing:
        lines = [f"    fold{i}: {cls} 0개" for i, cls in missing]
        raise SystemExit(
            "[오류] 일부 fold 의 val 에 크롭이 0개인 클래스가 있습니다(층화 실패):\n"
            + "\n".join(lines) + "\n  --folds 를 줄이거나 데이터 구성을 확인하세요.")

    return fold_of_group, {g: dict(cc) for g, cc in group_stats.items()}


def build_folds_manifest(items, classes, k, key_name):
    key_index = 2 if key_name == "plant" else 3
    fold_of_group, group_stats = assign_folds(items, classes, k, key_index)
    folds = []
    for i in range(k):
        val_groups = sorted(g for g, fi in fold_of_group.items() if fi == i)
        by_class = defaultdict(int)
        gcls = defaultdict(int)
        for g in val_groups:
            for cls, n in group_stats[g].items():
                by_class[cls] += n
                gcls[cls] += 1
        folds.append({
            "fold": i,
            "val_groups": val_groups,
            "n_val_groups": len(val_groups),
            "val_crops_by_class": {c: by_class[c] for c in classes},
            "val_groups_by_class": {c: gcls[c] for c in classes},
        })
    return {
        "k": k,
        "group_key": key_name,
        "classes": classes,
        "n_pool_crops": len(items),
        "n_groups": len(fold_of_group),
        "folds": folds,
    }


# ----------------------------------------------------------------------------
#  fold 데이터 materialize (심볼릭 링크)
# ----------------------------------------------------------------------------
def materialize_fold(items, key_index, val_groups: set, fold_dir: Path):
    """fold_dir/data/{train,val}/{클래스}/ 에 절대경로 심볼릭 링크 생성."""
    data_dir = fold_dir / "data"
    counts = {"train": 0, "val": 0}
    for path, cls, *keys in items:
        split = "val" if keys[key_index - 2] in val_groups else "train"
        dst_dir = data_dir / split / cls
        dst_dir.mkdir(parents=True, exist_ok=True)
        dst = dst_dir / path.name
        if dst.is_symlink() or dst.exists():
            dst.unlink()
        dst.symlink_to(path.resolve())
        counts[split] += 1
    return data_dir, counts


# ----------------------------------------------------------------------------
#  학습/평가 서브프로세스
# ----------------------------------------------------------------------------
def run_cmd(cmd, log_path: Path):
    log(f"  $ {' '.join(str(c) for c in cmd)}")
    with open(log_path, "w", encoding="utf-8") as f:
        proc = subprocess.run([str(c) for c in cmd], stdout=f,
                              stderr=subprocess.STDOUT)
    if proc.returncode != 0:
        tail = log_path.read_text(encoding="utf-8", errors="replace").splitlines()[-25:]
        raise SystemExit(
            f"[오류] 서브프로세스 실패(exit={proc.returncode}): {cmd[1]}\n"
            f"  로그: {log_path}\n  --- 로그 끝부분 ---\n  " + "\n  ".join(tail))


def train_args_from(args):
    """train_classifier.py 로 그대로 넘길 하이퍼파라미터 인자."""
    out = ["--model", args.model, "--img-size", args.img_size,
           "--epochs", args.epochs, "--batch-size", args.batch_size,
           "--lr", args.lr, "--weight-decay", args.weight_decay,
           "--warmup-epochs", args.warmup_epochs, "--patience", args.patience,
           "--workers", args.workers, "--device", args.device,
           "--seed", args.seed,
           # fold 하나의 학습 도중(단일 train_classifier.py 실행 자체가) Colab 세션이 끊겨도
           # cross_validate.py 를 같은 --out 으로 재실행하면 그 fold 의 train_run/last.pt 에서
           # 이어서 학습한다(k-fold 는 단일 학습의 k배 시간이 걸려 끊길 위험이 더 크다).
           # last.pt 가 없으면 train_classifier.py 가 알아서 처음부터 시작하므로 항상 붙여도 안전.
           "--resume"]
    if args.no_pretrained:
        out.append("--no-pretrained")
    return out


# ----------------------------------------------------------------------------
#  집계
# ----------------------------------------------------------------------------
def mean_std(values):
    """평균과 표본 표준편차(n-1). n<2 이면 std=0.0."""
    n = len(values)
    mu = sum(values) / n
    if n < 2:
        return mu, 0.0
    var = sum((v - mu) ** 2 for v in values) / (n - 1)
    return mu, math.sqrt(var)


def read_fold_metrics(eval_dir: Path, classes):
    summary = json.loads((eval_dir / "summary.json").read_text(encoding="utf-8"))
    per_f1 = {}
    with open(eval_dir / "per_class_metrics.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["class"] in classes:
                per_f1[row["class"]] = float(row["f1"])
    return {
        "overall_accuracy": float(summary["overall_accuracy"]),
        "macro_f1": float(summary["macro_f1"]),
        "n": int(summary["n"]),
        "per_class_f1": per_f1,
    }


def aggregate(manifest, fold_metrics, out: Path):
    classes = manifest["classes"]
    k = manifest["k"]
    accs = [m["overall_accuracy"] for m in fold_metrics]
    macros = [m["macro_f1"] for m in fold_metrics]
    acc_mu, acc_sd = mean_std(accs)
    mac_mu, mac_sd = mean_std(macros)
    per_cls = {}
    for cls in classes:
        vals = [m["per_class_f1"].get(cls, 0.0) for m in fold_metrics]
        mu, sd = mean_std(vals)
        per_cls[cls] = {"mean": mu, "std": sd, "per_fold": vals}

    summary = {
        "k": k,
        "group_key": manifest["group_key"],
        "classes": classes,
        "folds": [
            {
                "fold": fm["fold"],
                "overall_accuracy": m["overall_accuracy"],
                "macro_f1": m["macro_f1"],
                "n_val_crops": m["n"],
                "n_val_groups": fm["n_val_groups"],
                "val_groups_by_class": fm["val_groups_by_class"],
                "per_class_f1": m["per_class_f1"],
            }
            for fm, m in zip(manifest["folds"], fold_metrics)
        ],
        "overall_accuracy": {"mean": acc_mu, "std": acc_sd,
                             "min": min(accs), "max": max(accs)},
        "macro_f1": {"mean": mac_mu, "std": mac_sd},
        "per_class_f1": per_cls,
    }
    (out / "cv_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    with open(out / "cv_summary.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["fold", "overall_accuracy", "macro_f1", "n_val_crops",
                    "n_val_groups"] + [f"f1_{c}" for c in classes])
        for fm, m in zip(manifest["folds"], fold_metrics):
            w.writerow([fm["fold"], round(m["overall_accuracy"], 4),
                        round(m["macro_f1"], 4), m["n"], fm["n_val_groups"]]
                       + [round(m["per_class_f1"].get(c, 0.0), 4) for c in classes])
        w.writerow(["mean", round(acc_mu, 4), round(mac_mu, 4), "", ""]
                   + [round(per_cls[c]["mean"], 4) for c in classes])
        w.writerow(["std", round(acc_sd, 4), round(mac_sd, 4), "", ""]
                   + [round(per_cls[c]["std"], 4) for c in classes])

    # 표 출력
    log("")
    log("=" * 72)
    log(f"교차검증 요약 (k={k}, group_key={manifest['group_key']})")
    log("=" * 72)
    log(f"  {'fold':>4} | {'acc':>7} | {'macroF1':>7} | {'val크롭':>6} | {'val그룹':>6}")
    log("  " + "-" * 46)
    for fm, m in zip(manifest["folds"], fold_metrics):
        log(f"  {fm['fold']:>4} | {m['overall_accuracy']:>7.4f} | "
            f"{m['macro_f1']:>7.4f} | {m['n']:>7} | {fm['n_val_groups']:>7}")
    log("  " + "-" * 46)
    log(f"  전체 정확도: {acc_mu:.4f} ± {acc_sd:.4f}  "
        f"(min {min(accs):.4f} / max {max(accs):.4f})")
    log(f"  macro F1  : {mac_mu:.4f} ± {mac_sd:.4f}")
    log("  클래스별 F1 (mean ± std):")
    for cls in classes:
        log(f"    {cls:>8}: {per_cls[cls]['mean']:.4f} ± {per_cls[cls]['std']:.4f}")
    log("")
    log(f"  cv_summary.json / cv_summary.csv -> {out}")


def print_fold_distribution(manifest):
    classes = manifest["classes"]
    log("")
    log("fold 분포 (val 기준: 크롭수[그룹수])")
    header = "  fold |" + "".join(f" {c:>10}" for c in classes) + " |   합계"
    log(header)
    log("  " + "-" * (len(header) - 2))
    for f in manifest["folds"]:
        cells = "".join(
            f" {f['val_crops_by_class'][c]:>7}[{f['val_groups_by_class'][c]}]"
            for c in classes)
        total = sum(f["val_crops_by_class"].values())
        log(f"  {f['fold']:>4} |{cells} | {total:>6}")


# ----------------------------------------------------------------------------
#  메인
# ----------------------------------------------------------------------------
def main(argv=None):
    p = argparse.ArgumentParser(
        description="크롭 분류기 k-fold 교차검증 (그룹 인식 + 층화, test 홀드아웃 불변)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--data", required=True, help="crops 폴더(crop_dataset.py 결과)")
    p.add_argument("--out", required=True,
                   help="CV 결과 폴더(fold{i}/ + cv_summary.*). 레포 밖 권장")
    p.add_argument("--folds", type=int, default=5, help="fold 수 k(기본 5)")
    p.add_argument("--group-key", choices=("plant", "image"), default="plant",
                   help="그룹 단위. plant=prep_win.py 와 동일한 개체 키(기본). "
                        "image=원본 이미지 단위 — 초소형 스모크 전용, 성능 보고 금지")
    p.add_argument("--dry-run", action="store_true",
                   help="fold 구성/분포만 만들고 학습·평가는 하지 않음")
    # train_classifier.py 패스스루 하이퍼파라미터 (기본값도 동일하게 유지)
    p.add_argument("--model", default="convnext_tiny")
    p.add_argument("--img-size", type=int, default=384)
    p.add_argument("--epochs", type=int, default=40)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--weight-decay", type=float, default=0.05)
    p.add_argument("--warmup-epochs", type=int, default=3)
    p.add_argument("--patience", type=int, default=8)
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--device", default="auto")
    p.add_argument("--no-pretrained", action="store_true")
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args(argv if argv is not None else sys.argv[1:])

    data = Path(args.data).resolve()
    out = Path(args.out).resolve()
    k = args.folds
    if k < 2:
        log("[오류] --folds 는 2 이상이어야 합니다.")
        return 2
    if not (data / "train").exists():
        log(f"[오류] {data / 'train'} 없음 — crop_dataset.py 를 먼저 실행하세요.")
        return 2

    items, classes, odd_names = collect_pool(data)
    if not items:
        log(f"[오류] {data} 의 train/val 에서 크롭을 찾지 못했습니다.")
        return 2
    if odd_names:
        log(f"[경고] '__b숫자' 규칙에 맞지 않는 파일명 {odd_names}개 — "
            "stem 전체를 원본 stem 으로 간주했습니다. crop_dataset.py 규칙 변경 여부를 확인하세요.")

    log("닥터그린 크롭 분류기 k-fold 교차검증")
    log(f"  DATA : {data} (train+val 풀링, test 홀드아웃 불변)")
    log(f"  OUT  : {out}")
    log(f"  k={k} | group_key={args.group_key} | 풀 크롭 {len(items)}개 | 클래스 {classes}")

    out.mkdir(parents=True, exist_ok=True)
    folds_path = out / "folds.json"
    if folds_path.exists():
        manifest = json.loads(folds_path.read_text(encoding="utf-8"))
        if manifest.get("k") != k or manifest.get("group_key") != args.group_key:
            log(f"[오류] {folds_path} 의 기존 배정(k={manifest.get('k')}, "
                f"group_key={manifest.get('group_key')})과 인자가 다릅니다. "
                "--out 을 바꾸거나 folds.json 을 지우고 다시 실행하세요.")
            return 2
        log(f"  기존 fold 배정 재사용: {folds_path}")
    else:
        manifest = build_folds_manifest(items, classes, k, args.group_key)
        folds_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2),
                              encoding="utf-8")
        log(f"  fold 배정 저장: {folds_path}")

    print_fold_distribution(manifest)

    key_index = 2 if args.group_key == "plant" else 3
    if args.dry_run:
        log("\n[dry-run] fold 데이터만 구성하고 종료합니다.")
        for f in manifest["folds"]:
            fold_dir = out / f"fold{f['fold']}"
            _, counts = materialize_fold(items, key_index,
                                         set(f["val_groups"]), fold_dir)
            log(f"  fold{f['fold']}: train {counts['train']} / val {counts['val']} "
                f"-> {fold_dir / 'data'}")
        return 0

    python = sys.executable
    fold_metrics = []
    for f in manifest["folds"]:
        i = f["fold"]
        fold_dir = out / f"fold{i}"
        eval_dir = fold_dir / "eval"
        if (eval_dir / "summary.json").exists():
            log(f"\n[fold {i}] 평가 요약이 이미 있음 — 건너뜀(resume): "
                f"{eval_dir / 'summary.json'}")
            fold_metrics.append(read_fold_metrics(eval_dir, classes))
            continue

        log(f"\n[fold {i}] {k}개 중 {i + 1}번째")
        data_dir, counts = materialize_fold(items, key_index,
                                            set(f["val_groups"]), fold_dir)
        log(f"  데이터: train {counts['train']} / val {counts['val']} ({data_dir})")

        run_dir = fold_dir / "train_run"
        run_cmd([python, SCRIPT_DIR / "train_classifier.py",
                 "--data", data_dir, "--out", run_dir] + train_args_from(args),
                fold_dir / "train.log")
        run_cmd([python, SCRIPT_DIR / "eval_classifier.py",
                 "--data", data_dir, "--ckpt", run_dir / "best.pt",
                 "--out", eval_dir, "--split", "val",
                 "--batch-size", args.batch_size, "--workers", args.workers,
                 "--device", args.device],
                fold_dir / "eval.log")
        fold_metrics.append(read_fold_metrics(eval_dir, classes))
        log(f"  fold {i} 완료: acc={fold_metrics[-1]['overall_accuracy']:.4f}")

    aggregate(manifest, fold_metrics, out)
    log("주의: 위 수치는 교차검증 평균입니다. 공식 최종 수치는 test 홀드아웃 1회 평가로 확인하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
