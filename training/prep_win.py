#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
닥터그린 딸기 병해 YOLO 학습용 데이터 준비 스크립트 (윈도우/국내망 우선, 크로스플랫폼)
================================================================================

이 스크립트가 필요한 이유
  - AI Hub(71451 딸기 병해 데이터)는 해외 IP에서의 다운로드를 차단합니다.
  - Google Colab은 해외 IP라 받을 수 없고, 공식 aihubshell은 bash 스크립트라 윈도우에서 안 돕니다.
  - 그래서 aihubshell을 쓰지 않고, AI Hub 다운로드 API를 파이썬 "표준 라이브러리"만으로 직접 호출합니다.
  - 사용자의 국내 윈도우 데스크톱에서 실행 -> 결과 dataset/ 폴더를 zip으로 묶어 Google Drive 업로드
    -> Colab 학습 노트북(doctorgreen_yolo_map_boost.ipynb)에서 그대로 사용.

사용법(간단):
    python prep_win.py                # 5개 클래스 전부, 작은 것부터 자동 다운로드+변환+분할
    python prep_win.py --classes 황화,역병      # 특정 클래스만
    python prep_win.py --per-class 500          # 클래스당 장수 변경(기본 1000)
    python prep_win.py --only-build             # 다운로드 없이 이미 모아둔 _accum 으로 최종 분할만

표준 라이브러리만 사용 — pip 설치 불필요(PIL 불필요; 이미지 크기는 JSON에서 읽음).
"""

import argparse
import getpass
import json
import os
import random
import re
import shutil
import ssl
import sys
import tarfile
import time
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

# 윈도우에서 출력을 파일/파이프로 리다이렉트하면 인코딩이 cp949가 되어 일부 문자(— 등)에서
# UnicodeEncodeError로 중단될 수 있다. 문자가 깨지더라도 실행은 계속되도록 완화한다.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="replace")
    except Exception:
        pass

# AI Hub 서버 인증서 체인이 Python 기본 CA로 검증되지 않는 경우가 있어(자체서명 포함),
# 검증을 완화한 SSL 컨텍스트를 준비해 둔다. 정상 검증을 먼저 시도하고 실패할 때만 사용한다.
_SSL_UNVERIFIED = ssl._create_unverified_context()
_ssl_warned = False

# ============================================================================
#  CONFIG — 여기 값들은 실제 데이터로 검증된 값입니다. 함부로 바꾸지 마세요.
# ============================================================================
BASE_DIR = Path(__file__).resolve().parent

DATASET_KEY = "71451"
DOWN_BASE = "https://api.aihub.or.kr/down/0.6"

# 클래스별 원천(ts) / 라벨(tl) filekey
FILE_KEYS_BY_CLASS = {
    "정상":    {"ts": "475380", "tl": "475385"},
    "역병":    {"ts": "475381", "tl": "475386"},
    "시들음병": {"ts": "475382", "tl": "475387"},
    "잎끝마름": {"ts": "475383", "tl": "475388"},
    "황화":    {"ts": "475384", "tl": "475389"},
}

# 인덱스 0~4 고정 — 배포 모델(앱 스키마) 정렬용. 절대 순서 변경 금지.
CLASS_NAMES = ["정상", "역병", "시들음병", "잎끝마름", "황화"]

# 다운로드 순서 = 작은 클래스부터(중간에 멈춰도 작은 것부터 확보). 인덱스는 CLASS_NAMES 위치로 부여.
DOWNLOAD_ORDER = ["황화", "잎끝마름", "역병", "시들음병", "정상"]

# 클래스별 대략적인 원천 용량(GB) — 다운로드 전 디스크 여유 경고에만 사용(정확치 아님).
APPROX_GB_BY_CLASS = {
    "황화": 20, "잎끝마름": 25, "역병": 30, "시들음병": 43, "정상": 76,
}

PER_CLASS = 1000
SPLIT = (0.8, 0.1, 0.1)
SEED = 42

# 개체ID(누수 방지 그룹) 정규식. 파일명(확장자 제외)에서 개체 식별자를 뽑아 같은 개체가
# 여러 split(train/val/test)에 걸치지 않게 한다. AI Hub 딸기 데이터 파일명 규칙:
#   딸기_설향_{병명}_{농가}_{개체}_{타임스탬프}   (예: 딸기_설향_황화_23_006_220924173503)
# 비워두면 파일명 끝의 프레임/일련번호(타임스탬프 등, 연속된 숫자)를 떼어 자동 추정한다.
# 파일명 규칙이 다른 데이터로 바뀌면 이 정규식을 조정할 것(그룹 1개 캡처 그룹 사용).
GROUP_ID_REGEX = ""

WORK_DIR = BASE_DIR / "_dl"       # 다운로드/해제 임시 작업폴더(클래스마다 비웠다 씀)
ACCUM_DIR = BASE_DIR / "_accum"   # 클래스별 최종 샘플(이미지+라벨) 누적 보관 -> 재실행시 보존
OUT_DIR = BASE_DIR / "dataset"    # 최종 8:1:1 분할 결과 + data.yaml

DOWNLOAD_TIMEOUT = 60             # 소켓 타임아웃(초)
MAX_RETRY = 2                     # 다운로드 실패 시 추가 재시도 횟수
MIN_TAR_BYTES = 10 * 1024        # 이보다 작으면 에러 본문일 가능성 -> 텍스트로 검사

IMG_SUFFIXES = {".jpg", ".jpeg"}  # 규칙: *.jpg(대소문자 무시). jpeg도 관대하게 포함.


# ============================================================================
#  유틸
# ============================================================================
def log(msg=""):
    print(msg, flush=True)


def human_bytes(n):
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


def fix_name(nm):
    """zip 항목명이 cp437로 저장돼 한글이 깨진 경우 복원."""
    try:
        raw = nm.encode("cp437")
    except Exception:
        return nm
    for enc in ("cp949", "euc-kr", "utf-8"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return nm


def safe_join(base: Path, *paths) -> Path:
    """경로 이탈(zip-slip / path traversal) 방지: 결과가 base 밖이면 예외."""
    base = base.resolve()
    target = base
    for p in paths:
        # 절대경로/드라이브 문자/상위 참조 무력화
        p = str(p).replace("\\", "/")
        for part in p.split("/"):
            if part in ("", "."):
                continue
            if part == "..":
                raise ValueError(f"경로 이탈 시도 차단: {p}")
            target = target / part
    target = (base / target.relative_to(base)) if target != base else base
    resolved = target.resolve()
    if base != resolved and base not in resolved.parents:
        raise ValueError(f"경로 이탈 시도 차단(base 밖): {resolved}")
    return resolved


def disk_free_gb(path: Path) -> float:
    try:
        path.mkdir(parents=True, exist_ok=True)
        return shutil.disk_usage(str(path)).free / (1024 ** 3)
    except Exception:
        return -1.0


def print_disk(path: Path, tag=""):
    free = disk_free_gb(path)
    if free >= 0:
        log(f"  [디스크] 여유 공간: {free:.1f} GB {tag}")


# ============================================================================
#  다운로드 (AI Hub 다운로드 API 직접 호출 — aihubshell v0.6 재현)
# ============================================================================
def build_download_url(filekeys: str) -> str:
    # GET https://api.aihub.or.kr/down/0.6/{datasetkey}.do?fileSn={filekeys}
    return f"{DOWN_BASE}/{DATASET_KEY}.do?fileSn={filekeys}"


ERROR_HINTS = [
    "해외에서",          # "AI 허브는 해외에서의 데이터 다운로드를 제한..."
    "제한",
    "승인",              # "신청 및 승인 후 이용 가능"
    "신청",
    "Download failed",
    "HTTP status",
    "권한",
    "로그인",
]


def looks_like_error_body(path: Path) -> str:
    """
    받은 파일이 tar 바이너리가 아니라 한국어/영문 에러 텍스트면 그 내용을 돌려준다(성공이면 "").
    판별: tar로 열리면 성공. 안 열리고 크기가 아주 작으면(<MIN_TAR_BYTES) 텍스트로 읽어 에러로 처리.
    """
    try:
        size = path.stat().st_size
    except Exception:
        return "다운로드 파일이 없습니다."

    if size == 0:
        return "다운로드 파일 크기가 0입니다(빈 응답)."

    # tar로 열리면 성공으로 간주
    try:
        with tarfile.open(str(path), "r:*") as tf:
            tf.next()  # 최소 한 멤버 확인
        return ""
    except Exception:
        pass

    # tar가 아니고 작으면 -> 에러 본문일 가능성
    if size < MIN_TAR_BYTES:
        try:
            data = path.read_bytes()
        except Exception:
            return "다운로드 파일을 읽을 수 없습니다."
        text = ""
        for enc in ("utf-8", "cp949", "euc-kr"):
            try:
                text = data.decode(enc)
                break
            except Exception:
                continue
        text = text.strip()
        if text:
            return text[:500]
        return f"tar가 아니며 파일이 매우 작습니다({human_bytes(size)})."

    # tar가 아니지만 큰 파일 -> 손상/형식오류로 처리
    return f"받은 파일이 tar로 열리지 않습니다(손상 가능, {human_bytes(size)})."


def download_to(filekeys: str, dst: Path, apikey: str) -> None:
    """
    filekeys(콤마구분)에 해당하는 파일을 스트리밍으로 dst(download.tar)에 저장.
    성공/실패 판별은 저장 후 looks_like_error_body()로 호출측에서 수행.
    네트워크 예외 시 재시도.
    """
    url = build_download_url(filekeys)
    last_err = None
    for attempt in range(1, MAX_RETRY + 2):  # 최초 1회 + 재시도 MAX_RETRY회
        try:
            req = urllib.request.Request(url, method="GET")
            req.add_header("apikey", apikey)  # 인증 헤더 (URL/로그에 키 노출 금지)
            req.add_header("User-Agent", "doctorgreen-prep/1.0 (python-urllib)")

            if dst.exists():
                dst.unlink()

            log(f"  [다운로드] 시도 {attempt}/{MAX_RETRY + 1} ... (대용량일 수 있습니다)")
            try:
                resp = urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT)
            except urllib.error.URLError as e:
                # SSL 인증서 검증 실패 → 검증 완화 컨텍스트로 재시도 (curl/aihubshell은 통과하지만 Python 기본 CA로는 막히는 이슈)
                reason = getattr(e, "reason", e)
                if isinstance(reason, ssl.SSLError) or "CERTIFICATE_VERIFY_FAILED" in str(reason):
                    global _ssl_warned
                    if not _ssl_warned:
                        log("  [안내] SSL 인증서 검증에 실패해 검증을 완화하고 진행합니다(AI Hub 서버 인증서 이슈, 연결은 여전히 암호화됨).")
                        _ssl_warned = True
                    resp = urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT, context=_SSL_UNVERIFIED)
                else:
                    raise
            with resp:
                total = resp.headers.get("Content-Length")
                total = int(total) if (total and total.isdigit()) else 0
                read = 0
                last_pct = -5
                last_time = time.time()
                chunk = 1024 * 1024  # 1MB
                with open(dst, "wb") as f:
                    while True:
                        buf = resp.read(chunk)
                        if not buf:
                            break
                        f.write(buf)
                        read += len(buf)
                        now = time.time()
                        if total:
                            pct = read * 100 // total
                            if pct - last_pct >= 5:
                                log(f"    진행 {pct:3d}%  ({human_bytes(read)}/{human_bytes(total)})")
                                last_pct = pct
                        elif now - last_time >= 5:
                            log(f"    받는 중 ... {human_bytes(read)}")
                            last_time = now
            log(f"  [다운로드] 완료: {human_bytes(dst.stat().st_size)}")
            return
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code} {e.reason}"
            log(f"  [경고] 다운로드 HTTP 오류: {last_err}")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            last_err = str(e)
            log(f"  [경고] 다운로드 네트워크 오류: {last_err}")
        if attempt <= MAX_RETRY:
            wait = 5 * attempt
            log(f"  {wait}초 후 재시도합니다 ...")
            time.sleep(wait)
    raise RuntimeError(f"다운로드 실패(재시도 소진): {last_err}")


# ============================================================================
#  후처리: tar 해제 -> part 병합 -> zip 해제  (aihubshell 후처리 순서 재현)
# ============================================================================
def extract_tar(tar_path: Path, dest: Path) -> None:
    """download.tar를 dest에 안전하게 해제(경로 이탈 방지)."""
    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(str(tar_path), "r:*") as tf:
        for member in tf.getmembers():
            if member.isdev() or member.islnk() or member.issym():
                continue  # 특수/링크 항목 무시(보안)
            target = safe_join(dest, member.name)  # 이탈 검사
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            src = tf.extractfile(member)
            if src is None:
                continue
            with src, open(target, "wb") as out:
                shutil.copyfileobj(src, out)


_PART_RE = re.compile(r"^(?P<prefix>.+)\.part(?P<num>\d+)$", re.IGNORECASE)


def merge_parts(root: Path) -> int:
    """
    분할 병합: 트리에서 '이름.part0, 이름.part1, ...'를 prefix별로 모아
    part 번호 오름차순(숫자정렬)으로 바이너리 이어붙여 '이름' 복원 후 part 삭제.
    반환: 병합해 만든 파일 수.
    """
    groups = {}  # prefix(str, 절대경로) -> list[(num, Path)]
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        m = _PART_RE.match(p.name)
        if m:
            prefix_path = p.with_name(m.group("prefix"))
            groups.setdefault(str(prefix_path), []).append((int(m.group("num")), p))

    made = 0
    for prefix_str, parts in groups.items():
        parts.sort(key=lambda t: t[0])  # 숫자정렬
        out_path = Path(prefix_str)
        try:
            with open(out_path, "wb") as out:
                for _, pp in parts:
                    with open(pp, "rb") as src:
                        shutil.copyfileobj(src, out, length=8 * 1024 * 1024)
            for _, pp in parts:
                try:
                    pp.unlink()
                except Exception:
                    pass
            made += 1
            log(f"    [병합] {out_path.name}  <- {len(parts)}개 조각")
        except Exception as e:
            log(f"    [경고] part 병합 실패({out_path.name}): {e}")
    return made


def extract_one_zip(zip_path: Path) -> int:
    """
    zip_path를 같은 폴더에 해제(한글 파일명 fix_name 복원, 경로 이탈 방지).
    성공 시 원본 zip 삭제. 반환: 해제한 항목 수.
    """
    dest = zip_path.parent
    count = 0
    try:
        with zipfile.ZipFile(str(zip_path)) as zf:
            for info in zf.infolist():
                name = fix_name(info.filename)
                if name.endswith("/") or info.is_dir():
                    try:
                        safe_join(dest, name).mkdir(parents=True, exist_ok=True)
                    except ValueError as e:
                        log(f"    [경고] {e}")
                    continue
                try:
                    target = safe_join(dest, name)
                except ValueError as e:
                    log(f"    [경고] {e}")
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(info) as src, open(target, "wb") as out:
                    shutil.copyfileobj(src, out)
                count += 1
    except zipfile.BadZipFile as e:
        log(f"    [경고] 손상된 zip 건너뜀({zip_path.name}): {e}")
        return 0
    try:
        zip_path.unlink()
    except Exception:
        pass
    return count


def unzip_recursive(root: Path, max_rounds: int = 3) -> None:
    """중첩 zip 대비: 새 zip이 안 나올 때까지 최대 max_rounds회 반복 해제."""
    for rnd in range(1, max_rounds + 1):
        zips = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() == ".zip"]
        if not zips:
            break
        log(f"    [zip 해제] {rnd}회차: {len(zips)}개")
        for zp in zips:
            n = extract_one_zip(zp)
            if n:
                log(f"      {zp.name} -> {n}개 항목")


def cleanup_archives(root: Path) -> None:
    """해제 끝난 아카이브/part 잔여물 삭제로 디스크 회수."""
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        low = p.suffix.lower()
        if low in (".tar", ".zip") or _PART_RE.match(p.name):
            try:
                p.unlink()
            except Exception:
                pass


# ============================================================================
#  JSON -> YOLO 변환 (검증된 규칙)
# ============================================================================
def find_images(root: Path):
    return [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in IMG_SUFFIXES]


def find_jsons(root: Path):
    return [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() == ".json"]


def convert_class(root: Path, class_name: str):
    """
    root(해제된 트리) 안에서 rglob로 이미지/JSON을 모두 찾아 매칭 후 YOLO 변환.
    이 클래스(class_name)의 disease_class를 가진 이미지만 대상.
    반환: list[(img_path: Path, yolo_lines: list[str])]  (라벨 있는 것만),
          그리고 통계 dict.
    """
    cls_idx = CLASS_NAMES.index(class_name)

    # fname(basename) -> 이미지 경로 (대소문자/중복 대비: 소문자 stem+suffix 키)
    imgs = find_images(root)
    img_by_name = {}
    for ip in imgs:
        img_by_name.setdefault(ip.name, ip)          # 정확 파일명
        img_by_name.setdefault(ip.name.lower(), ip)  # 소문자 폴백

    jsons = find_jsons(root)

    results = []
    stat = {"json_total": len(jsons), "img_total": len(imgs),
            "class_mismatch": 0, "no_image": 0, "bad_json": 0,
            "no_box": 0, "converted": 0}

    for jp in jsons:
        try:
            with open(jp, "r", encoding="utf-8") as f:
                d = json.load(f)
        except Exception:
            # utf-8-sig / cp949 폴백
            ok = False
            for enc in ("utf-8-sig", "cp949", "euc-kr"):
                try:
                    with open(jp, "r", encoding=enc) as f:
                        d = json.load(f)
                    ok = True
                    break
                except Exception:
                    continue
            if not ok:
                stat["bad_json"] += 1
                continue

        try:
            images_meta = d["images"]
            fname = images_meta["fname"]
            W = float(images_meta["width"])
            H = float(images_meta["height"])
            disease = images_meta["disease_class"]
        except (KeyError, TypeError, ValueError):
            stat["bad_json"] += 1
            continue

        if disease not in CLASS_NAMES:
            stat["class_mismatch"] += 1
            continue
        if disease != class_name:
            # 이 아카이브에 다른 클래스가 섞여 있으면 그 클래스는 각자 처리(여기선 스킵)
            continue

        # fname과 같은 이름의 .jpg 찾기
        img_path = img_by_name.get(fname) or img_by_name.get(fname.lower())
        if img_path is None:
            # 확장자만 .jpg로 교체해 재시도(라벨 fname이 .JPG 등일 때)
            stem = Path(fname).stem
            for cand in (stem + ".jpg", stem + ".JPG", stem + ".jpeg"):
                img_path = img_by_name.get(cand) or img_by_name.get(cand.lower())
                if img_path:
                    break
        if img_path is None:
            stat["no_image"] += 1
            continue

        if W <= 0 or H <= 0:
            stat["bad_json"] += 1
            continue

        lines = []
        for a in d.get("annotations", []):
            try:
                bbox = a["bbox"]
                x, y, w, h = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
            except (KeyError, TypeError, ValueError, IndexError):
                continue
            if w <= 0 or h <= 0:
                continue
            # 이미지 경계로 클램프 후 퇴화 박스(1px 미만) 스킵
            # (doctorgreen_aihub_data_prep.ipynb 의 변환 규칙과 동일 — 경계에 걸친 박스를
            #  버리지 않고 잘라내며, 0~1 밖 좌표가 라벨에 남지 않게 한다)
            x1 = max(0.0, x)
            y1 = max(0.0, y)
            x2 = min(W, x + w)
            y2 = min(H, y + h)
            if x2 - x1 < 1 or y2 - y1 < 1:
                continue
            cx = (x1 + x2) / 2 / W
            cy = (y1 + y2) / 2 / H
            bw = (x2 - x1) / W
            bh = (y2 - y1) / H
            lines.append(f"{cls_idx} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")

        if not lines:
            stat["no_box"] += 1
            continue

        results.append((img_path, lines))
        stat["converted"] += 1

    return results, stat


# ============================================================================
#  클래스별 파이프라인
# ============================================================================
def count_accum_images(class_name: str) -> int:
    d = ACCUM_DIR / class_name / "images"
    if not d.exists():
        return 0
    return sum(1 for p in d.iterdir() if p.is_file() and p.suffix.lower() in IMG_SUFFIXES)


def reset_work_dir(work: Path):
    if work.exists():
        shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True, exist_ok=True)


def process_class(class_name: str, per_class: int, work_dir: Path, apikey: str,
                  rng: random.Random) -> str:
    """
    한 클래스 전체 파이프라인. 반환: "ok" | "skip" | 실패사유 문자열.
    """
    log("")
    log("=" * 70)
    log(f"[클래스] {class_name}  (인덱스 {CLASS_NAMES.index(class_name)})")
    log("=" * 70)

    have = count_accum_images(class_name)
    if have >= per_class:
        log(f"  이미 {have}장 확보됨(>= {per_class}) -> 건너뜁니다.")
        return "skip"

    keys = FILE_KEYS_BY_CLASS[class_name]
    filekeys = f"{keys['ts']},{keys['tl']}"

    # 디스크 여유 경고
    approx = APPROX_GB_BY_CLASS.get(class_name, 30)
    free = disk_free_gb(work_dir)
    print_disk(work_dir, f"(이 클래스 예상 원천 ~{approx}GB, 해제분 추가 필요)")
    if 0 <= free < approx:
        log(f"  [경고] 디스크 여유({free:.1f}GB) < 예상 용량({approx}GB). 이 클래스를 건너뜁니다.")
        return f"디스크 부족(여유 {free:.1f}GB < {approx}GB)"

    # 1) WORK_DIR 비우고 다운로드
    reset_work_dir(work_dir)
    tar_path = work_dir / "download.tar"
    try:
        download_to(filekeys, tar_path, apikey)
    except Exception as e:
        return f"다운로드 실패: {e}"

    # 2) 성공/실패(에러본문) 판별
    err = looks_like_error_body(tar_path)
    if err:
        log(f"  [실패] 다운로드 응답이 데이터가 아닙니다:\n    {err}")
        return f"에러본문/HTTP: {err[:120]}"

    # 3) tar 해제
    extract_root = work_dir / "extracted"
    try:
        log("  [해제] download.tar 해제 중 ...")
        extract_tar(tar_path, extract_root)
        try:
            tar_path.unlink()
        except Exception:
            pass
    except Exception as e:
        return f"tar 해제 실패: {e}"

    # 4) part 병합
    try:
        merged = merge_parts(extract_root)
        if merged:
            log(f"  [병합] 분할 파일 {merged}건 복원")
    except Exception as e:
        log(f"  [경고] part 병합 중 오류(계속 진행): {e}")

    # 5) 중첩 zip 해제
    try:
        unzip_recursive(extract_root, max_rounds=3)
    except Exception as e:
        log(f"  [경고] zip 해제 중 오류(계속 진행): {e}")

    # 6) 잔여 아카이브 정리
    cleanup_archives(extract_root)

    # 해제 후 파일 0 검사
    any_file = any(p.is_file() for p in extract_root.rglob("*"))
    if not any_file:
        return "해제 후 파일 0개"

    # 7) JSON -> YOLO 변환
    log("  [변환] JSON -> YOLO 라벨 변환 중 ...")
    try:
        results, stat = convert_class(extract_root, class_name)
    except Exception as e:
        return f"변환 실패: {e}"

    log(f"    이미지 {stat['img_total']}장 / JSON {stat['json_total']}개 발견")
    log(f"    변환 성공 {stat['converted']}장 | 클래스불일치 {stat['class_mismatch']} "
        f"| 이미지없음 {stat['no_image']} | JSON오류 {stat['bad_json']} | 박스없음 {stat['no_box']}")

    if not results:
        return "변환 결과 0장(이 클래스로 매핑된 이미지 없음)"

    # 8) per_class 무작위 샘플(부족분만 채우도록)
    #    이미 _accum 에 있는 파일명(stem)은 제외 — 중단 후 재실행 시 같은 이미지가
    #    "_1" 접미사로 중복 저장되면 그룹 키가 달라져 train/val/test 분할 누수가 생긴다.
    acc_img = ACCUM_DIR / class_name / "images"
    acc_lbl = ACCUM_DIR / class_name / "labels"
    acc_img.mkdir(parents=True, exist_ok=True)
    acc_lbl.mkdir(parents=True, exist_ok=True)
    used_stems = set(p.stem for p in acc_img.iterdir() if p.is_file())

    need = per_class - have
    rng.shuffle(results)
    sample = [r for r in results if r[0].stem not in used_stems][:need]
    log(f"    누적 목표 {per_class}장 중 현재 {have}장 -> 이번에 {len(sample)}장 추가")

    # 9) ACCUM_DIR/{클래스}/{images,labels}로 복사
    copied = 0
    for img_path, lines in sample:
        stem = img_path.stem
        k = 1
        while stem in used_stems:
            stem = f"{img_path.stem}_{k}"
            k += 1
        used_stems.add(stem)
        try:
            shutil.copy2(img_path, acc_img / (stem + ".jpg"))
            (acc_lbl / (stem + ".txt")).write_text("\n".join(lines), encoding="utf-8")
            copied += 1
        except Exception as e:
            log(f"    [경고] 복사 실패({img_path.name}): {e}")

    log(f"  [저장] {copied}장 -> {acc_img.parent}")
    log(f"  현재 '{class_name}' 누적: {count_accum_images(class_name)}장")

    # 10) WORK_DIR 삭제로 회수
    shutil.rmtree(work_dir, ignore_errors=True)
    print_disk(BASE_DIR, "(작업폴더 정리 후)")
    return "ok"


# ============================================================================
#  최종 분할 + data.yaml
# ============================================================================
def collect_accum(class_name: str):
    """ACCUM_DIR/{클래스}에서 (이미지, 라벨경로) 쌍 목록."""
    acc_img = ACCUM_DIR / class_name / "images"
    acc_lbl = ACCUM_DIR / class_name / "labels"
    pairs = []
    if not acc_img.exists():
        return pairs
    for ip in sorted(acc_img.iterdir()):
        if not (ip.is_file() and ip.suffix.lower() in IMG_SUFFIXES):
            continue
        lp = acc_lbl / (ip.stem + ".txt")
        pairs.append((ip, lp if lp.exists() else None))
    return pairs


def group_key(stem: str) -> str:
    """
    파일명(확장자 제외)에서 "개체(그룹)" 키를 뽑는다 — 같은 개체를 연속 촬영한 프레임이
    train/val/test에 걸치는 데이터 누수를 막기 위함.
    (doctorgreen_aihub_data_prep.ipynb 셀 16의 group_key()와 동일 로직 — 두 파이프라인의
    분할 방식을 일치시켜야 하므로 로직을 바꾸려면 두 곳 모두 수정할 것.)
    """
    if GROUP_ID_REGEX:
        m = re.search(GROUP_ID_REGEX, stem)
        if m:
            return m.group(1) if m.groups() else m.group(0)
    # 자동 추정: 끝의 _0001 / -12 / 타임스탬프 같은 연속 숫자를 제거
    return re.sub(r"[_\-]?\d+$", "", stem)


def split_class_pairs(class_name: str, pairs: list, rng: random.Random, split: tuple):
    """
    한 클래스의 (이미지, 라벨) 쌍 목록을 그룹(개체) 인식 분할로 train/val/test에 배정한다.
    그룹 키가 사실상 전부 유니크(그룹 수 >= 샘플 수의 95%)면 그룹 정보가 없다고 보고
    기존 이미지 단위 랜덤 분할로 폴백한다.
    반환: (train_items, val_items, test_items, info: dict)
    """
    tr_r, va_r, te_r = split
    n = len(pairs)

    groups_map = defaultdict(list)
    for img, lbl in pairs:
        groups_map[group_key(img.stem)].append((img, lbl))
    gkeys = list(groups_map.keys())
    use_group = len(gkeys) < 0.95 * max(1, n)

    if use_group:
        rng.shuffle(gkeys)
        n_g = len(gkeys)
        if n_g >= 3:
            n_val_g = max(1, round(n_g * va_r))
            n_test_g = max(1, round(n_g * te_r))
            if n_val_g + n_test_g >= n_g:
                n_val_g = 1
                n_test_g = 1 if n_g >= 2 else 0
        else:
            n_val_g = 0
            n_test_g = 0

        val_g = gkeys[:n_val_g]
        test_g = gkeys[n_val_g:n_val_g + n_test_g]
        train_g = gkeys[n_val_g + n_test_g:]

        val_items = [it for gk in val_g for it in groups_map[gk]]
        test_items = [it for gk in test_g for it in groups_map[gk]]
        train_items = [it for gk in train_g for it in groups_map[gk]]
        info = {"use_group": True, "n_groups": n_g,
                "train_groups": len(train_g), "val_groups": len(val_g), "test_groups": len(test_g)}
    else:
        pairs_shuffled = list(pairs)
        rng.shuffle(pairs_shuffled)
        if n >= 3:
            n_val = max(1, round(n * va_r))
            n_test = max(1, round(n * te_r))
            if n_val + n_test >= n:
                n_val = 1
                n_test = 1 if n >= 2 else 0
        else:
            n_val = 0
            n_test = 0
        val_items = pairs_shuffled[:n_val]
        test_items = pairs_shuffled[n_val:n_val + n_test]
        train_items = pairs_shuffled[n_val + n_test:]
        info = {"use_group": False, "n_groups": len(gkeys)}

    return train_items, val_items, test_items, info


def write_data_yaml(out_dir: Path):
    """
    학습 노트북(doctorgreen_yolo_map_boost.ipynb)이 그대로 읽는 형식:
        train: images/train
        val: images/val
        test: images/test
        names:
          0: 정상
          ...
    path: 는 일부러 쓰지 않는다 — 윈도우 절대경로(C:\\...)를 적어 두면 zip을 Colab(리눅스)로
    옮겼을 때 ultralytics가 그 경로를 찾지 못해 실패한다. path 가 없으면 ultralytics는
    data.yaml 이 있는 폴더를 데이터셋 루트로 쓰므로(공식 폴백) 어디로 옮겨도 그대로 동작한다.
    (표준 라이브러리만 쓰므로 yaml을 직접 문자열로 생성)
    """
    yaml_path = out_dir / "data.yaml"
    lines = []
    lines.append("train: images/train")
    lines.append("val: images/val")
    lines.append("test: images/test")
    lines.append("names:")
    for i, n in enumerate(CLASS_NAMES):
        lines.append(f"  {i}: {n}")
    yaml_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return yaml_path


def build_final(out_dir: Path, seed: int):
    log("")
    log("=" * 70)
    log("[최종 분할] 클래스균형 8:1:1 분할 + data.yaml 생성")
    log("=" * 70)

    if out_dir.exists():
        shutil.rmtree(out_dir, ignore_errors=True)
    for s in ("train", "val", "test"):
        (out_dir / "images" / s).mkdir(parents=True, exist_ok=True)
        (out_dir / "labels" / s).mkdir(parents=True, exist_ok=True)

    rng = random.Random(seed)
    used_stems = set()
    grand = {"train": 0, "val": 0, "test": 0}
    per_class_report = {}
    # 그룹(개체) 교차 검증용: split별로 실제 배정된 그룹 키를 전 클래스에 걸쳐 누적
    all_split_groups = {"train": set(), "val": set(), "test": set()}
    leak_total = 0

    total_found = 0
    for class_name in CLASS_NAMES:
        pairs = collect_accum(class_name)
        total_found += len(pairs)

    if total_found == 0:
        log("[오류] _accum 에 이미지가 없습니다. 먼저 다운로드를 실행하세요(--only-build 없이).")
        return None

    for class_name in CLASS_NAMES:
        pairs = collect_accum(class_name)
        n = len(pairs)
        if n == 0:
            log(f"  [주의] 클래스 '{class_name}' 이미지 0장 — 이 클래스는 최종셋에서 빠집니다.")
            per_class_report[class_name] = (0, 0, 0)
            continue

        # 개체(그룹) 단위 분할 — 같은 개체를 연속 촬영한 프레임이 train/val/test에 걸치는
        # 데이터 누수를 막는다. 그룹 키가 사실상 전부 유니크하면 이미지 단위 분할로 폴백한다.
        train_items, val_items, test_items, info = split_class_pairs(class_name, pairs, rng, SPLIT)
        if info["use_group"]:
            log(f"    [{class_name}] 개체(그룹) 단위 분할: 그룹 {info['n_groups']}개 / 이미지 {n}장 "
                f"(train그룹 {info['train_groups']} / val그룹 {info['val_groups']} / test그룹 {info['test_groups']})")
        else:
            log(f"    [{class_name}] [경고] 그룹 키가 대부분 유니크해(그룹 {info['n_groups']}개 / 이미지 {n}장) "
                f"이미지 단위로 분할합니다. 연속 프레임이 있다면 group_key()/GROUP_ID_REGEX를 점검하세요.")

        # 이 클래스 안에서 같은 group_key가 두 split에 걸치면 즉시 경고(그룹 분할이 올바로
        # 동작했다면 항상 교차 0건이어야 한다. 폴백 시에는 교차가 발생할 수 있다).
        split_groups = {
            "train": {group_key(img.stem) for img, _ in train_items},
            "val": {group_key(img.stem) for img, _ in val_items},
            "test": {group_key(img.stem) for img, _ in test_items},
        }
        for a, b in (("train", "val"), ("train", "test"), ("val", "test")):
            overlap = split_groups[a] & split_groups[b]
            if overlap:
                leak_total += len(overlap)
                sample = sorted(overlap)[:5]
                log(f"    [경고] '{class_name}' {a}/{b} 간 그룹 교차 {len(overlap)}건: "
                    f"{sample}{' ...' if len(overlap) > 5 else ''}")
        for split_name, gset in split_groups.items():
            all_split_groups[split_name] |= gset

        for split, items in (("train", train_items), ("val", val_items), ("test", test_items)):
            for img, lbl in items:
                stem = img.stem
                k = 1
                while stem in used_stems:
                    stem = f"{img.stem}_{k}"
                    k += 1
                used_stems.add(stem)
                try:
                    shutil.copy2(img, out_dir / "images" / split / (stem + ".jpg"))
                    dst_lbl = out_dir / "labels" / split / (stem + ".txt")
                    if lbl is not None and lbl.exists():
                        shutil.copy2(lbl, dst_lbl)
                    else:
                        dst_lbl.write_text("", encoding="utf-8")
                    grand[split] += 1
                except Exception as e:
                    log(f"    [경고] 복사 실패({img.name}): {e}")

        per_class_report[class_name] = (len(train_items), len(val_items), len(test_items))
        log(f"  {class_name:>6}: train {len(train_items)} / val {len(val_items)} / test {len(test_items)}  (총 {n})")

    yaml_path = write_data_yaml(out_dir)

    log("")
    log("  === 그룹(개체) 교차 검증 (train/val/test 간 같은 개체 유무) ===")
    for a, b in (("train", "val"), ("train", "test"), ("val", "test")):
        overlap = all_split_groups[a] & all_split_groups[b]
        log(f"    {a} ∩ {b}: {len(overlap)}건")
    if leak_total == 0:
        log("    -> train/val/test 간 그룹 교차 0건 (그룹 분할로 데이터 누수 방지 확인됨)")
    else:
        log(f"    [경고] 총 {leak_total}건의 그룹 교차 발견 — 위 경고 내역을 확인하세요.")

    log("")
    log("  === 최종 클래스별 · split별 장수 ===")
    for class_name in CLASS_NAMES:
        tr, va, te = per_class_report.get(class_name, (0, 0, 0))
        log(f"    {class_name:>6}:  train {tr:4d} | val {va:4d} | test {te:4d}")
    log(f"    {'합계':>6}:  train {grand['train']:4d} | val {grand['val']:4d} | test {grand['test']:4d}")
    log("")
    log(f"  data.yaml 생성 완료: {yaml_path}")
    return yaml_path


# ============================================================================
#  안내
# ============================================================================
def print_next_steps(out_dir: Path):
    log("")
    log("=" * 70)
    log("다음 단계 (Colab 학습으로 넘기기)")
    log("=" * 70)
    log(f"1) 결과 폴더를 zip으로 묶으세요:  {out_dir}")
    log("   (윈도우 탐색기: dataset 폴더 우클릭 -> '압축(ZIP) 폴더로 보내기')")
    log("2) 그 zip을 Google Drive에 업로드하고, Colab에서 Drive 마운트 후 압축을 풉니다.")
    log("   (예: /content/drive/MyDrive/doctor_green_dataset 아래에 풀기)")
    log("3) 학습 노트북 doctorgreen_yolo_map_boost.ipynb 의 CONFIG를 이렇게 지정:")
    log("     DATASET_DIR  = '<위에서 압축 푼 Drive 경로>'")
    log("     LABEL_FORMAT = 'yolo'")
    log("   -> 노트북이 images/{train,val,test}, labels/{...}, data.yaml 을 그대로 읽습니다.")
    log("")
    log("* 기존 Colab용 데이터준비 노트북은 해외 IP 차단으로 사용 불가이며,")
    log("  이 스크립트가 그 역할을 대체합니다.")


# ============================================================================
#  main
# ============================================================================
def parse_args(argv):
    p = argparse.ArgumentParser(
        description="닥터그린 딸기 병해 YOLO 데이터 준비(윈도우/국내망). AI Hub API 직접 호출.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--classes", default="",
                   help="처리할 클래스(콤마구분). 예: 황화,역병 (미지정=전체, 작은 것부터)")
    p.add_argument("--per-class", type=int, default=PER_CLASS,
                   help=f"클래스당 목표 장수(기본 {PER_CLASS})")
    p.add_argument("--only-build", action="store_true",
                   help="다운로드 없이 이미 모아둔 _accum 으로 최종 분할만 수행")
    p.add_argument("--work-dir", default=str(WORK_DIR), help="작업(임시) 폴더 경로 override")
    p.add_argument("--out-dir", default=str(OUT_DIR), help="최종 결과 폴더 경로 override")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[1:])

    work_dir = Path(args.work_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    per_class = max(1, args.per_class)

    log("닥터그린 딸기 병해 데이터 준비 스크립트")
    log(f"  BASE_DIR : {BASE_DIR}")
    log(f"  WORK_DIR : {work_dir}")
    log(f"  ACCUM_DIR: {ACCUM_DIR}")
    log(f"  OUT_DIR  : {out_dir}")
    log(f"  클래스당 목표: {per_class}장 | SEED={SEED} | 분할 {SPLIT}")
    print_disk(BASE_DIR)

    if args.only_build:
        log("\n[--only-build] 다운로드를 건너뛰고 _accum 으로 최종 분할만 수행합니다.")
        if build_final(out_dir, SEED):
            print_next_steps(out_dir)
        return 0

    # 처리할 클래스 결정
    if args.classes.strip():
        requested = [c.strip() for c in args.classes.split(",") if c.strip()]
        invalid = [c for c in requested if c not in CLASS_NAMES]
        if invalid:
            log(f"[오류] 알 수 없는 클래스: {invalid}")
            log(f"       사용 가능: {CLASS_NAMES}")
            return 2
        # 작은 것부터 순서 유지
        classes = [c for c in DOWNLOAD_ORDER if c in requested]
    else:
        classes = list(DOWNLOAD_ORDER)

    log(f"\n처리 대상(작은 클래스부터): {classes}")

    # API 키 입력 (메모리에만 보관, 화면 표시 안 됨)
    apikey = getpass.getpass("AI Hub API 키 입력(화면 표시 안 됨): ").strip()
    if not apikey:
        log("[오류] API 키가 비어 있습니다. 다시 실행하세요.")
        return 2

    ACCUM_DIR.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)  # 클래스 샘플링에 재사용

    results = {}
    failures = []
    for class_name in classes:
        try:
            status = process_class(class_name, per_class, work_dir, apikey, rng)
        except KeyboardInterrupt:
            log("\n[중단] 사용자가 Ctrl+C로 중단했습니다. 받은 클래스는 보존됩니다.")
            log("       재실행하면 남은 클래스부터 이어서 진행합니다.")
            shutil.rmtree(work_dir, ignore_errors=True)
            break
        except Exception as e:
            status = f"예외: {e}"
        results[class_name] = status
        if status not in ("ok", "skip"):
            failures.append((class_name, status))
            log(f"  [실패목록 기록] {class_name}: {status}")

    # 작업폴더 정리
    shutil.rmtree(work_dir, ignore_errors=True)

    log("\n" + "=" * 70)
    log("클래스별 처리 결과")
    log("=" * 70)
    for class_name in classes:
        log(f"  {class_name:>6}: {results.get(class_name, '(미처리)')}  "
            f"[누적 {count_accum_images(class_name)}장]")
    if failures:
        log("\n[실패한 클래스] (해결 후 재실행하면 이어서 진행됩니다)")
        for c, why in failures:
            log(f"  - {c}: {why}")
        log("  힌트: '해외에서/제한/승인' 문구면 -> 국내망에서 실행 중인지, AI Hub에서 이 데이터셋")
        log("        신청·승인이 완료됐는지 확인하세요. HTTP 5xx면 잠시 후 재시도하세요.")

    # 최종 분할(모을 게 있으면)
    if any(count_accum_images(c) > 0 for c in CLASS_NAMES):
        try:
            if build_final(out_dir, SEED):
                print_next_steps(out_dir)
        except Exception as e:
            log(f"[오류] 최종 분할 실패: {e}")
            log("       나중에 'python prep_win.py --only-build' 로 다시 시도할 수 있습니다.")
    else:
        log("\n확보된 이미지가 없어 최종 분할을 건너뜁니다.")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("\n[중단] 사용자가 중단했습니다.")
        sys.exit(130)
