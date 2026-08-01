#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
닥터그린 2단계 파이프라인 — ② 크롭 기반 파인그레인드 분류: 크롭 데이터셋 생성
================================================================================

이 스크립트가 하는 일
  - prep_win.py 가 만든 YOLO 형식 데이터셋(images/{train,val,test} + labels/{...} + data.yaml)을
    입력으로 받아, 각 박스(bbox)를 원본 이미지에서 잘라 "분류용 크롭 데이터셋"을 만든다.
  - 결과는 crops/{split}/{class_name}/xxxx.jpg 형태 (ImageFolder 규약). train_classifier.py 가 그대로 읽음.

왜 필요한가 (2단계 아키텍처)
  - 1단계 YOLO 탐지기는 "어디에 병징이 있는지(박스/개수/심각도)"를 잘 잡지만,
    미세한 병명 구분(파인그레인드)에서는 크롭을 다시 분류하는 전용 모델이 더 정확하다.
  - 그래서 탐지기 박스마다 크롭을 떠서 이 크롭들로 분류기를 학습/평가한다.
    (배포 시: 탐지기가 박스를 주면 그 박스 크롭을 분류기로 재분류 → 병명 정확도 향상)

핵심 설계 — split 상속(누수 방지 유지)
  - 크롭의 split(train/val/test)은 "그 크롭이 나온 원본 이미지의 split"을 그대로 물려받는다.
  - prep_win.py 의 8:1:1 분할은 개체(그룹) 단위로 이미 데이터 누수를 막아 두었다.
    split을 상속하면 같은 개체의 크롭이 train/val/test에 걸치지 않는 성질이 그대로 보존된다.
    (여기서 크롭을 다시 섞어 분할하면 그 방지책이 깨지므로 절대 재분할하지 않는다.)

클래스 순서
  - data.yaml 의 names(0:정상 1:역병 2:시들음병 3:잎끝마름 4:황화)를 그대로 폴더명으로 쓴다.
    이 순서는 배포 모델·앱 스키마와 묶여 있으므로 바꾸지 않는다.

배경(무병징) 이미지 처리 — '정상' 클래스가 사라지지 않게 하는 핵심 로직
  - prep_win.py 는 --allow-background(기본값)로 병징 bbox가 없는 이미지(주로 '정상' 클래스)를
    빈 라벨(.txt 내용 없음)로 최종 트리에 포함시킨다. 하지만 그 시점의 원래 class_name 정보는
    빈 라벨 파일 자체에는 남지 않는다.
  - 그래서 이 스크립트는 빈 라벨 이미지를 만나면 AI Hub 원본 파일명 규칙
    (예: "딸기_설향_정상_13_001_220925111738")에서 data.yaml names 값과 정확히 1개만
    부분 문자열로 매칭되는 클래스명을 찾아 그 클래스로 복구한다(resolve_background_class).
    매칭이 0개/2개 이상이면 저장하지 않고 background_skipped 로 집계해 로그·manifest.json 에 남긴다.
  - 복구된 배경 이미지는 바운딩박스가 없으므로 중앙 정사각형을 크롭해 저장한다(save_background_crop),
    파일명은 "{원본stem}__b0.jpg"(실제 박스 crop과 동일한 명명 규칙, cross_validate.py 의
    group_key 복원 로직과 호환됨 — 빈 라벨 이미지는 애초에 실제 박스가 없으므로 __b0 충돌 없음).
  - main() 끝에서 5개 클래스 각각 train/val 0장이면 exit 1로 강하게 실패한다(과거에는
    전체 합계가 0일 때만 실패해, '정상'만 통째로 빠져도 exit 0로 조용히 통과했다).

사용법:
    python crop_dataset.py --src dataset_sample --out /path/to/crops
    python crop_dataset.py --src dataset --out crops_out --margin 0.15 --min-size 24

필요 패키지: Pillow (이미지 크롭용). numpy 불필요.
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image

# 윈도우에서 출력을 파일/파이프로 리다이렉트하면 인코딩이 cp949가 되어 일부 문자(— 등)에서
# UnicodeEncodeError로 중단될 수 있다. 문자가 깨지더라도 실행은 계속되도록 완화한다.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="replace")
    except Exception:
        pass

IMG_SUFFIXES = {".jpg", ".jpeg", ".png"}


def log(msg=""):
    print(msg, flush=True)


def parse_data_yaml(yaml_path: Path):
    """
    data.yaml 에서 names(인덱스->클래스명)를 읽는다. 표준 라이브러리만으로 파싱
    (prep_win.py 가 yaml 라이브러리 없이 문자열로 생성하므로 형식이 단순하다):
        names:
          0: 정상
          1: 역병
          ...
    반환: {인덱스(int): 이름(str)}
    """
    names = {}
    in_names = False
    for raw in yaml_path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.strip() == "names:" or line.strip().startswith("names:"):
            # "names:" 단독이면 하위 들여쓰기 블록, "names: [..]" 인라인은 아래에서 처리
            rest = line.split("names:", 1)[1].strip()
            if rest.startswith("[") or rest.startswith("{"):
                # 인라인 리스트/딕셔너리 형태는 이 데이터셋에서 나오지 않지만 방어적으로 처리
                inner = rest.strip("[]{} ")
                for i, tok in enumerate(t.strip().strip("'\"") for t in inner.split(",") if t.strip()):
                    names[i] = tok
                in_names = False
            else:
                in_names = True
            continue
        if in_names:
            # "  0: 정상" 형태. 들여쓰기가 없어지면 블록 종료.
            if not raw.startswith((" ", "\t")):
                in_names = False
                continue
            if ":" in line:
                k, v = line.split(":", 1)
                try:
                    idx = int(k.strip())
                except ValueError:
                    in_names = False
                    continue
                names[idx] = v.strip().strip("'\"")
    return names


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def yolo_to_pixel_box(cx, cy, bw, bh, W, H, margin):
    """
    YOLO 정규화 박스(cx,cy,bw,bh, 0~1)를 픽셀 좌표 (x1,y1,x2,y2)로 변환하고
    margin(비율)만큼 사방으로 패딩한 뒤 이미지 경계로 클램프한다.
    """
    x1 = (cx - bw / 2) * W
    y1 = (cy - bh / 2) * H
    x2 = (cx + bw / 2) * W
    y2 = (cy + bh / 2) * H
    # margin: 박스 폭/높이 기준 비율 패딩
    pad_x = (x2 - x1) * margin
    pad_y = (y2 - y1) * margin
    x1 = clamp(x1 - pad_x, 0, W)
    y1 = clamp(y1 - pad_y, 0, H)
    x2 = clamp(x2 + pad_x, 0, W)
    y2 = clamp(y2 + pad_y, 0, H)
    return int(round(x1)), int(round(y1)), int(round(x2)), int(round(y2))


def read_yolo_label(txt_path: Path):
    """YOLO txt 한 줄씩 (cls, cx, cy, bw, bh) 파싱. 형식 오류 줄은 건너뜀."""
    boxes = []
    if not txt_path.exists():
        return boxes
    for line in txt_path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        try:
            cls = int(float(parts[0]))
            cx, cy, bw, bh = (float(parts[1]), float(parts[2]),
                              float(parts[3]), float(parts[4]))
        except ValueError:
            continue
        boxes.append((cls, cx, cy, bw, bh))
    return boxes


def find_images(img_dir: Path):
    if not img_dir.exists():
        return []
    return [p for p in sorted(img_dir.iterdir())
            if p.is_file() and p.suffix.lower() in IMG_SUFFIXES]


def resolve_background_class(stem: str, class_names: list):
    """
    빈 라벨(배경/무병징) 이미지의 실제 클래스를 파일명에서 역추정한다.
    prep_win.py 는 --allow-background(기본값)로 병징 bbox가 없는 이미지(특히 '정상' 클래스)를
    빈 라벨로 최종 트리에 포함시키는데, 그 시점의 class_name 정보가 라벨 파일에는 남지 않는다.
    대신 AI Hub 원본 파일명 규칙(예: "딸기_설향_정상_13_001_220925111738")에 클래스명이
    그대로 들어있으므로, data.yaml 의 클래스명이 파일명에 부분 문자열로 정확히 1개만
    매칭되면 그 클래스로 간주한다.
    반환: (클래스명 또는 None, 사유: "ok"|"no_match"|"ambiguous")
    """
    matches = [c for c in class_names if c in stem]
    if len(matches) == 1:
        return matches[0], "ok"
    if not matches:
        return None, "no_match"
    return None, "ambiguous"


def save_background_crop(img_path: Path, dst: Path):
    """
    무병징(배경) 이미지는 바운딩박스가 없으므로 크롭 기준이 없다. 대신 이미지 중앙의
    정사각형 영역을 저장한다(다른 클래스의 박스+마진 크롭과 스케일 감을 비슷하게 맞추기 위함).
    """
    with Image.open(img_path) as im:
        im = im.convert("RGB")
        W, H = im.size
        side = min(W, H)
        x1 = (W - side) // 2
        y1 = (H - side) // 2
        crop = im.crop((x1, y1, x1 + side, y1 + side))
        dst.parent.mkdir(parents=True, exist_ok=True)
        crop.save(dst, "JPEG", quality=95)


def crop_split(src: Path, out: Path, split: str, names: dict, class_names: list,
               margin: float, min_size: int, stats: dict):
    """한 split(train/val/test)의 모든 이미지에서 박스를 크롭해 저장."""
    img_dir = src / "images" / split
    lbl_dir = src / "labels" / split
    images = find_images(img_dir)
    if not images:
        log(f"  [{split}] 이미지 없음 — 건너뜀")
        return

    n_crop = 0
    for img_path in images:
        txt_path = lbl_dir / (img_path.stem + ".txt")
        boxes = read_yolo_label(txt_path)
        if not boxes:
            # 빈 라벨(배경/무병징) 이미지 — 파일명으로 원래 클래스를 역추정해 살린다.
            # ('정상' 클래스는 애초에 병징 bbox가 없으므로 이 경로를 안 타면 crops/에서
            #  통째로 사라져 5클래스 고정 인덱스 계약이 깨진다.)
            cls_name, reason = resolve_background_class(img_path.stem, class_names)
            if cls_name is None:
                stats["background_skipped"] += 1
                stats["background_skip_reason"][reason] += 1
                continue
            try:
                dst_dir = out / split / cls_name
                dst = dst_dir / f"{img_path.stem}__b0.jpg"
                save_background_crop(img_path, dst)
                n_crop += 1
                stats["by_split"][split] += 1
                stats["by_class"][cls_name][split] += 1
                stats["background_resolved"] += 1
            except Exception as e:  # noqa: BLE001
                stats["read_error"] += 1
                log(f"    [경고] 배경 이미지 처리 실패({img_path.name}): {e}")
            continue
        try:
            with Image.open(img_path) as im:
                im = im.convert("RGB")
                W, H = im.size
                for bi, (cls, cx, cy, bw, bh) in enumerate(boxes):
                    cls_name = names.get(cls)
                    if cls_name is None:
                        stats["unknown_class"] += 1
                        continue
                    x1, y1, x2, y2 = yolo_to_pixel_box(cx, cy, bw, bh, W, H, margin)
                    cw, ch = x2 - x1, y2 - y1
                    if cw < min_size or ch < min_size:
                        stats["too_small"] += 1
                        continue
                    crop = im.crop((x1, y1, x2, y2))
                    dst_dir = out / split / cls_name
                    dst_dir.mkdir(parents=True, exist_ok=True)
                    # 파일명: 원본stem__bIDX.jpg (원본 추적 가능 + 충돌 방지)
                    dst = dst_dir / f"{img_path.stem}__b{bi}.jpg"
                    crop.save(dst, "JPEG", quality=95)
                    n_crop += 1
                    stats["by_split"][split] += 1
                    stats["by_class"][cls_name][split] += 1
        except Exception as e:  # noqa: BLE001 (개별 이미지 실패는 건너뛰고 계속)
            stats["read_error"] += 1
            log(f"    [경고] 이미지 처리 실패({img_path.name}): {e}")
    log(f"  [{split}] 크롭 {n_crop}개 생성")


def main(argv=None):
    p = argparse.ArgumentParser(
        description="YOLO 데이터셋 → 박스 크롭 분류 데이터셋 변환 (split 상속으로 누수 방지 유지)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--src", required=True,
                   help="YOLO 데이터셋 폴더(data.yaml + images/{train,val,test} + labels/{...})")
    p.add_argument("--out", required=True,
                   help="크롭 결과 폴더(crops/{split}/{class_name}/...). 레포 밖 경로 권장(커밋 금지)")
    p.add_argument("--margin", type=float, default=0.15,
                   help="박스 사방 패딩 비율(기본 0.15=15%%). 경계로 클램프됨")
    p.add_argument("--min-size", type=int, default=24,
                   help="최소 크롭 변 길이(px). 이보다 작은 박스는 퇴화 박스로 보고 건너뜀(기본 24)")
    args = p.parse_args(argv if argv is not None else sys.argv[1:])

    src = Path(args.src).resolve()
    out = Path(args.out).resolve()
    yaml_path = src / "data.yaml"

    if not yaml_path.exists():
        log(f"[오류] data.yaml 이 없습니다: {yaml_path}")
        return 2

    names = parse_data_yaml(yaml_path)
    if not names:
        log(f"[오류] data.yaml 에서 names 를 읽지 못했습니다: {yaml_path}")
        return 2

    log("닥터그린 크롭 데이터셋 생성 (2단계 분류용)")
    log(f"  SRC   : {src}")
    log(f"  OUT   : {out}")
    log(f"  margin: {args.margin}  | min-size: {args.min_size}px")
    log(f"  클래스: {[names[i] for i in sorted(names)]}")
    log("")

    out.mkdir(parents=True, exist_ok=True)

    class_names = [names[i] for i in sorted(names)]
    stats = {
        "by_split": defaultdict(int),
        "by_class": defaultdict(lambda: defaultdict(int)),
        "too_small": 0,
        "unknown_class": 0,
        "read_error": 0,
        "background_resolved": 0,
        "background_skipped": 0,
        "background_skip_reason": defaultdict(int),
    }

    for split in ("train", "val", "test"):
        crop_split(src, out, split, names, class_names, args.margin, args.min_size, stats)

    # 매니페스트(JSON) — 클래스×split 카운트 요약. 사람이 보는 참고용이며, 다른 스크립트가
    # 프로그램적으로 읽지는 않는다(train_classifier.py 의 클래스 가중치는 ImageFolder가
    # train 폴더를 직접 센 카운트로 계산한다).
    manifest = {
        "src": str(src),
        "class_order": class_names,
        "margin": args.margin,
        "min_size": args.min_size,
        "counts": {
            cls: dict(splits) for cls, splits in
            ((names[i], stats["by_class"].get(names[i], {})) for i in sorted(names))
        },
        "totals": dict(stats["by_split"]),
        "skipped": {
            "too_small": stats["too_small"],
            "unknown_class": stats["unknown_class"],
            "read_error": stats["read_error"],
            "background_skipped": stats["background_skipped"],
            "background_skip_reason": dict(stats["background_skip_reason"]),
        },
        "background": {
            "resolved": stats["background_resolved"],
            "skipped": stats["background_skipped"],
            "note": "빈 라벨(무병징) 이미지는 파일명에서 클래스명을 역추정해 살렸다 "
                    "(resolve_background_class). 매칭 실패분은 skipped/background_skip_reason 참조.",
        },
    }
    manifest_path = out / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2),
                             encoding="utf-8")

    # 요약 출력
    log("")
    log("=" * 64)
    log("크롭 데이터셋 요약 (클래스 × split)")
    log("=" * 64)
    header = f"  {'클래스':>8} | {'train':>6} {'val':>5} {'test':>5} | {'합계':>6}"
    log(header)
    log("  " + "-" * (len(header) - 2))
    grand = 0
    per_class_totals = {}
    for i in sorted(names):
        cls = names[i]
        sp = stats["by_class"].get(cls, {})
        tr, va, te = sp.get("train", 0), sp.get("val", 0), sp.get("test", 0)
        tot = tr + va + te
        grand += tot
        per_class_totals[cls] = (tr, va, te)
        log(f"  {cls:>8} | {tr:>6} {va:>5} {te:>5} | {tot:>6}")
    log("  " + "-" * (len(header) - 2))
    log(f"  {'합계':>8} | {stats['by_split']['train']:>6} "
        f"{stats['by_split']['val']:>5} {stats['by_split']['test']:>5} | {grand:>6}")
    log("")
    log(f"  건너뜀: 작은박스 {stats['too_small']} | 알수없는클래스 {stats['unknown_class']} "
        f"| 읽기오류 {stats['read_error']}")
    log(f"  배경(무병징) 이미지: 클래스 복구 {stats['background_resolved']}개 | "
        f"복구 실패(건너뜀) {stats['background_skipped']}개"
        + (f" (사유: {dict(stats['background_skip_reason'])})" if stats["background_skipped"] else ""))
    if stats["background_skipped"] > 0:
        log("  [주의] 배경 이미지 일부가 파일명 매칭 실패로 crops/ 에 포함되지 못했습니다. "
            "위 사유별 건수를 확인하고, 필요하면 manifest.json 의 background 섹션을 검토하세요.")
    log(f"  매니페스트: {manifest_path}")

    # 클래스별 0장 검사 — grand(전체 합계)가 0이 아니어도 특정 클래스만 0장이면
    # train_classifier.py 의 ImageFolder 가 그 클래스 폴더를 아예 인식하지 못해
    # 고정 클래스 인덱스(0:정상 1:역병 2:시들음병 3:잎끝마름 4:황화) 계약이 깨진다.
    if grand == 0:
        log("\n[오류] 생성된 크롭이 0개입니다. 라벨/이미지 매칭을 확인하세요.")
        return 1

    empty_train_or_val = [
        (cls, tr, va, te) for cls, (tr, va, te) in per_class_totals.items()
        if tr == 0 or va == 0
    ]
    if empty_train_or_val:
        log("")
        log("[오류] 다음 클래스는 train 또는 val 크롭이 0장입니다 — ImageFolder가 이 클래스")
        log("       폴더 자체를 만들지 않아 학습이 4클래스(또는 그 이하)로 진행되며,")
        log("       0:정상 1:역병 2:시들음병 3:잎끝마름 4:황화 고정 인덱스 계약이 깨집니다:")
        for cls, tr, va, te in empty_train_or_val:
            log(f"    {cls}: train {tr} / val {va} / test {te}")
        log("       원인 점검: --src 데이터셋의 images/labels 매칭, prep_win.py 의 "
            "--allow-background 설정, 파일명이 딸기_설향_<클래스명>_... 규칙을 따르는지.")
        return 1

    empty_test = [cls for cls, (tr, va, te) in per_class_totals.items() if te == 0]
    if empty_test:
        log("")
        log(f"[주의] 다음 클래스는 test 크롭이 0장입니다(학습은 가능하나 eval_classifier.py "
            f"--split test 결과에서 이 클래스 지표가 비어 보일 수 있음): {empty_test}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
