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
    python prep_win.py --dry-run                # 실제 다운로드 없이 환경/키 목록/디스크/경로만 점검
    python prep_win.py --peek                    # 라벨 파일만 받아 JSON 구조·API 키를 먼저 확인(강력 권장)
    python prep_win.py                            # 5개 클래스 전부, 작은 것부터 자동 다운로드+변환+분할
    python prep_win.py --classes 황화,역병        # 특정 클래스만
    python prep_win.py --per-class 500            # 클래스당 장수 변경(기본 1000)
    python prep_win.py --only-build               # 다운로드 없이 이미 모아둔 _accum 으로 최종 분할만

권장 순서: 처음 실행하는 PC/키라면 반드시 ① --dry-run -> ② --peek -> ③ 본 실행 순으로 진행하세요.
'정상' 클래스처럼 병징 bbox가 없는 이미지는 기본적으로 빈 라벨(배경) 이미지로 포함됩니다
(--no-allow-background 로 과거 동작으로 되돌릴 수 있습니다).

표준 라이브러리만 사용 — pip 설치 불필요(PIL 불필요; 이미지 크기는 JSON에서 읽음).
"""

import argparse
import getpass
import http.client
import json
import os
import platform
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

# AI Hub 서버 인증서 자체는 정상 상용 인증서다(체인: *.aihub.or.kr <- Sectigo <- USERTrust,
# 확인 완료). 검증 실패는 대개 로컬 파이썬의 CA 저장소가 비어있거나 낡은 문제이며, 그렇다고
# 자동으로 검증을 꺼서는 안 된다 — 실제로 중간자가 있는 경우 API 키가 그대로 노출된다.
# 검증 완화는 사용자에게 명시적으로 확인받은 뒤에만 사용한다(_confirm_ssl_fallback 참고).
_SSL_UNVERIFIED = ssl._create_unverified_context()
_ssl_fallback_confirmed = None  # None=미확인, True/False=사용자 응답 캐시(중복 질문 방지)

# ============================================================================
#  CONFIG — 여기 값들은 실제 데이터로 검증된 값입니다. 함부로 바꾸지 마세요.
# ============================================================================
BASE_DIR = Path(__file__).resolve().parent

DATASET_KEY = "71451"
DOWN_BASE = "https://api.aihub.or.kr/down/0.6"
INFO_URL = f"https://api.aihub.or.kr/info/{DATASET_KEY}.do"  # API 키 불필요, filekey 목록 조회용

# 클래스별 원천(ts) / 라벨(tl) filekey
# AI Hub가 파일을 재편하면 이 값이 바뀔 수 있습니다. 실행 시 preflight_check_filekeys()가
# https://api.aihub.or.kr/info/71451.do 의 현재 목록과 자동 대조해 다르면 경고합니다.
# 값이 실제로 바뀌었다면 위 주소를 브라우저로 열어 "파일명 | 용량 | filekey" 표를 보고 갱신하세요.
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

# 클래스별 대략적인 원천 용량(GB) — AI Hub info API 실측치(2026-07-30 확인).
# 다운로드 전 디스크 여유 경고에만 사용(정확치 아님 — 디스크 판정은 이 값에 여유배수를 곱해 씀).
APPROX_GB_BY_CLASS = {
    "황화": 20, "잎끝마름": 25, "역병": 26, "시들음병": 47, "정상": 76,
}

# 디스크 여유 판정 배수. 실제 피크는 tar(원천) + 해제된 zip이 동시에 존재하는 구간(약 2배)과,
# zip 해제 직후 zip+이미지가 동시에 존재하는 구간(약 2배)이라 AI Hub 공식 안내(2~3배)를 따른다.
DISK_MARGIN_FACTOR = 2.5

PER_CLASS = 1000
SPLIT = (0.8, 0.1, 0.1)
SEED = 42

# 병징 bbox가 하나도 없는 이미지(예: '정상' 클래스)를 빈 라벨(배경) 이미지로 포함할지 여부.
# 끄면 그런 이미지는 전부 제외되는데, '정상' 클래스처럼 원래 bbox가 없는 데이터라면
# 대용량을 다 받고도 결과가 0장이 되어 배포 모델의 인덱스 0(정상)이 통째로 빠질 수 있다.
# --no-allow-background 로 실행 시 끌 수 있다(과거 동작과 동일).
ALLOW_BACKGROUND_DEFAULT = True

# 개체ID(누수 방지 그룹) 정규식. 파일명(확장자 제외)에서 개체 식별자를 뽑아 같은 개체가
# 여러 split(train/val/test)에 걸치지 않게 한다. AI Hub 딸기 데이터 파일명 규칙:
#   딸기_설향_{병명}_{농가}_{개체}_{타임스탬프}   (예: 딸기_설향_황화_23_006_220924173503)
# 비워두면 파일명 끝의 프레임/일련번호(타임스탬프 등, 연속된 숫자)를 떼어 자동 추정한다.
# 파일명 규칙이 다른 데이터로 바뀌면 이 정규식을 조정할 것(그룹 1개 캡처 그룹 사용).
GROUP_ID_REGEX = ""

WORK_DIR = BASE_DIR / "_dl"       # 다운로드/해제 임시 작업폴더(클래스마다 비웠다 씀)
ACCUM_DIR = BASE_DIR / "_accum"   # 클래스별 최종 샘플(이미지+라벨) 누적 보관 -> 재실행시 보존
OUT_DIR = BASE_DIR / "dataset"    # 최종 8:1:1 분할 결과 + data.yaml

# 요청(응답 헤더 수신 포함) 타임아웃(초). AI Hub는 대용량 아카이브를 서버에서 준비하는 동안
# 첫 바이트를 수 분간 안 보내는 경우가 있어 넉넉히 잡는다(60초는 너무 짧아 시작도 못 하고 실패했다).
DOWNLOAD_TIMEOUT = 600
MAX_RETRY = 5                      # 다운로드 실패 시 추가 재시도 횟수(총 시도 = 1 + MAX_RETRY)
RETRY_WAITS = [5, 15, 45, 120, 300]  # 재시도 대기(초), 지수 백오프. 인증/승인 오류는 재시도하지 않음.
MIN_TAR_BYTES = 10 * 1024          # 이보다 작으면 에러 본문일 가능성 -> 텍스트로 검사

# AI Hub 다운로드 실패 응답 본문에서 "재시도해도 소용없는" 오류를 가리키는 문구.
# 이 문구가 보이면 즉시 중단하고 재시도하지 않는다(재시도해도 결과가 같다).
AUTH_FAIL_MARKERS = ("인증실패", "권한", "승인", "신청", "해외", "제한", "로그인")

IMG_SUFFIXES = {".jpg", ".jpeg"}  # 규칙: *.jpg(대소문자 무시). jpeg도 관대하게 포함.

MIN_PYTHON = (3, 8)


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


def check_python_version() -> bool:
    if sys.version_info < MIN_PYTHON:
        log(f"[오류] 파이썬 {MIN_PYTHON[0]}.{MIN_PYTHON[1]} 이상이 필요합니다"
            f"(현재 {platform.python_version()}).")
        log("       https://www.python.org/downloads/windows/ 에서 최신 버전을 설치하세요"
            "('Add python.exe to PATH' 체크 필수).")
        return False
    log(f"  [확인] 파이썬 버전: {platform.python_version()} (요구 {MIN_PYTHON[0]}.{MIN_PYTHON[1]}+)")
    return True


_WIN_RESERVED = {"CON", "PRN", "AUX", "NUL",
                 *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
_WIN_BAD_CHARS = re.compile(r'[<>:"|?*\x00-\x1f]')


def _sanitize_part(part: str) -> str:
    """윈도우에서 만들 수 없는 파일명(금지문자 `<>:"|?*`, 끝 공백/점, 예약어)을 안전하게 치환.
    safe_join이 경로의 각 조각에 적용해 압축 해제 중 OSError로 전체가 중단되는 것을 막는다."""
    part = _WIN_BAD_CHARS.sub("_", part)
    part = part.rstrip(" .")
    if not part:
        part = "_"
    stem = part.split(".")[0].upper()
    if stem in _WIN_RESERVED:
        part = "_" + part
    return part


def safe_join(base: Path, *paths) -> Path:
    """경로 이탈(zip-slip / path traversal) 방지 + 윈도우 금지 파일명 정규화."""
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
            part = _sanitize_part(part)
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
        log(f"  [디스크] 여유 공간: {free:.1f} GB {tag} ({path})")


_DANGEROUS_DIR_NAMES = {"desktop", "documents", "downloads", "바탕화면", "문서", "다운로드"}


def is_dangerous_delete_target(path: Path) -> bool:
    """드라이브 루트나 사용자 홈/문서/바탕화면 자체처럼 절대 통째로 지우면 안 되는 경로인지 판별.
    --work-dir/--out-dir/--accum-dir 오타(예: D:\\ 또는 Documents)로 인한 대량 삭제 사고 방지."""
    try:
        rp = path.resolve()
    except Exception:
        rp = path
    if str(rp) == str(rp.anchor):  # 드라이브 루트(C:\, /) 자체
        return True
    try:
        if rp == Path.home().resolve():
            return True
    except Exception:
        pass
    if rp.name.lower() in _DANGEROUS_DIR_NAMES:
        return True
    return False


def safe_rmtree(path: Path, label: str) -> bool:
    """작업폴더/결과폴더 삭제 전 위험 경로 가드. 문제 있으면 지우지 않고 False를 반환한다."""
    if not path.exists():
        return True
    if is_dangerous_delete_target(path):
        log(f"[오류] {label} 경로가 삭제하기에 위험해 보입니다: {path}")
        log("       드라이브 루트나 사용자 홈/문서/바탕화면 자체는 지우지 않습니다.")
        log("       --work-dir/--out-dir/--accum-dir 로 전용 하위 폴더(예: C:\\dg\\work)를 지정하세요.")
        return False
    shutil.rmtree(path, ignore_errors=True)
    return True


def warn_path_issues(label: str, path: Path):
    """OneDrive 동기화 폴더 / 너무 긴 경로에 대해 사전 경고(윈도우 MAX_PATH 260자 대응)."""
    s = str(path)
    if "onedrive" in s.lower():
        log(f"  [경고] {label} 경로가 OneDrive 동기화 폴더 안에 있습니다: {path}")
        log("         대용량 임시 파일이 자동 업로드되어 느려지거나 저장공간을 채울 수 있습니다.")
        log("         가능하면 'C:\\dg' 처럼 동기화되지 않는 짧은 경로로 --work-dir/--out-dir/--accum-dir 를 옮기세요.")
    if len(s) > 100:
        log(f"  [경고] {label} 경로가 깁니다({len(s)}자): {path}")
        log("         윈도우 기본 경로 길이 제한(260자)에 걸릴 수 있습니다. 짧은 경로를 쓰거나,")
        log("         관리자 권한 cmd에서 아래를 실행 후 재부팅해 '긴 경로 사용'을 켜세요:")
        log(r"         reg add HKLM\SYSTEM\CurrentControlSet\Control\FileSystem /v LongPathsEnabled /t REG_DWORD /d 1")


def fix_name(info) -> str:
    """zip 항목명 한글 복원.
    info가 zipfile.ZipInfo면 UTF-8 플래그(0x800)부터 확인한다 — 플래그가 있으면 zipfile이
    이미 정확히 UTF-8로 디코딩해 두었으므로 손대지 않는다(잘못 건드리면 오히려 깨진다).
    플래그가 없으면 zipfile이 cp437로 잘못 디코딩한 것을 되돌려 utf-8 -> cp949 -> euc-kr
    순으로 재해석한다(UTF-8을 먼저 시도 — 디코딩 검증이 엄격해 성공하면 오탐이 거의 없다).
    """
    if isinstance(info, zipfile.ZipInfo):
        if info.flag_bits & 0x800:
            return info.filename
        nm = info.filename
    else:
        nm = info
    try:
        raw = nm.encode("cp437")
    except Exception:
        return nm
    for enc in ("utf-8", "cp949", "euc-kr"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return nm


# ============================================================================
#  다운로드 (AI Hub 다운로드 API 직접 호출 — aihubshell v0.6 재현)
# ============================================================================
def build_download_url(filekeys: str) -> str:
    # GET https://api.aihub.or.kr/down/0.6/{datasetkey}.do?fileSn={filekeys}
    return f"{DOWN_BASE}/{DATASET_KEY}.do?fileSn={filekeys}"


def looks_like_error_body(path: Path) -> str:
    """
    받은 파일이 tar 바이너리가 아니라 한국어/영문 에러 텍스트면 그 내용을 돌려준다(성공이면 "").
    판별: tar로 열리면 성공. 안 열리고 크기가 아주 작으면(<MIN_TAR_BYTES) 텍스트로 읽어 에러로 처리.
    (본선은 download_to의 HTTPError 처리에서 이미 잡히지만, 200으로 응답하며 본문에 에러
    텍스트를 실어 보내는 경우에 대한 2차 방어선.)
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


def _confirm_ssl_fallback() -> bool:
    """SSL 검증 실패 시 사용자에게 명시적으로 확인받는다(캐시해 재질문하지 않음).
    자동으로 검증을 끄면, 실제로 중간자가 있는 상황에서 API 키가 그대로 노출될 수 있다."""
    global _ssl_fallback_confirmed
    if _ssl_fallback_confirmed is not None:
        return _ssl_fallback_confirmed
    log("  [안내] 서버 인증서를 검증할 수 없습니다. AI Hub 서버 인증서 자체는 정상이며,")
    log("         대개 이 PC의 파이썬 CA 인증서 저장소가 비어있거나 낡아서입니다.")
    log("         (윈도우: 파이썬을 최신으로 재설치하면 보통 해결됩니다.")
    log("          맥: 'Install Certificates.command' 실행)")
    try:
        ans = input("  검증 없이 계속하면 API 키가 노출될 위험이 있습니다. 계속할까요? (y/N): ").strip().lower()
    except Exception:
        ans = ""
    _ssl_fallback_confirmed = (ans == "y")
    if not _ssl_fallback_confirmed:
        log("  [중단] 검증 완화를 진행하지 않습니다.")
    return _ssl_fallback_confirmed


def download_to(filekeys: str, dst: Path, apikey: str) -> None:
    """
    filekeys(콤마구분)에 해당하는 파일을 스트리밍으로 dst(download.tar)에 저장.
    dst에 이미 부분 다운로드가 남아 있으면 HTTP Range로 이어받기를 시도한다(서버가 Range를
    지원하지 않으면 200 전체 응답으로 자동 폴백). 수신 바이트 수를 Content-Length와 대조해
    중간에 끊긴 다운로드를 '완료'로 오판하지 않는다. 인증/승인 오류(본문에 AUTH_FAIL_MARKERS
    문구 포함)는 재시도해도 결과가 같으므로 즉시 중단한다.
    """
    url = build_download_url(filekeys)
    last_err = None
    for attempt in range(1, MAX_RETRY + 2):  # 최초 1회 + 재시도 MAX_RETRY회
        try:
            resume_from = dst.stat().st_size if dst.exists() else 0
        except Exception:
            resume_from = 0

        req = urllib.request.Request(url, method="GET")
        req.add_header("apikey", apikey)  # 인증 헤더 (URL/로그에 키 노출 금지)
        req.add_header("User-Agent", "doctorgreen-prep/1.0 (python-urllib)")
        if resume_from > 0:
            req.add_header("Range", f"bytes={resume_from}-")

        if attempt == 1:
            log(f"  [다운로드] 준비 중 ... 서버가 대용량 파일을 준비하는 동안 응답이 없을 수 있습니다"
                f"(최대 {DOWNLOAD_TIMEOUT // 60}분 대기).")
        if resume_from > 0:
            log(f"  [다운로드] 시도 {attempt}/{MAX_RETRY + 1} ... 이어받기 시도"
                f"(기존 {human_bytes(resume_from)}부터)")
        else:
            log(f"  [다운로드] 시도 {attempt}/{MAX_RETRY + 1} ... (대용량일 수 있습니다)")

        try:
            try:
                resp = urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT)
            except urllib.error.URLError as e:
                # SSL 인증서 검증 실패 → 사용자 확인 후에만 검증 완화 컨텍스트로 재시도
                reason = getattr(e, "reason", e)
                if isinstance(reason, ssl.SSLError) or "CERTIFICATE_VERIFY_FAILED" in str(reason):
                    if not _confirm_ssl_fallback():
                        raise RuntimeError("사용자가 SSL 검증 완화를 거부해 중단했습니다.")
                    resp = urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT, context=_SSL_UNVERIFIED)
                else:
                    raise

            with resp:
                status = getattr(resp, "status", 200)
                resuming = (status == 206 and resume_from > 0)
                mode = "ab" if resuming else "wb"
                base_read = resume_from if resuming else 0

                total_hdr = resp.headers.get("Content-Length")
                total_hdr = int(total_hdr) if (total_hdr and total_hdr.isdigit()) else 0
                total = (base_read + total_hdr) if total_hdr else 0

                read = base_read
                last_pct = -5
                last_time = time.time()
                chunk = 1024 * 1024  # 1MB
                with open(dst, mode) as f:
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

                # 수신 바이트 수를 Content-Length와 대조 — 서버가 중간에 연결을 끊으면
                # resp.read()가 조용히 b''를 반환할 수 있어 길이 검증 없이는 '완료'로 오판한다.
                if total and read != total:
                    raise OSError(f"전송이 중간에 끊겼습니다({read}/{total} 바이트)")

            log(f"  [다운로드] 완료: {human_bytes(dst.stat().st_size)}")
            return
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", "replace").strip()
            except Exception:
                pass
            last_err = f"HTTP {e.code} {(e.reason or '').strip()} {body}".strip()
            log(f"  [경고] 다운로드 HTTP 오류: HTTP {e.code} — {body or '(본문 없음)'}")
            if body and any(m in body for m in AUTH_FAIL_MARKERS):
                raise RuntimeError(f"인증/승인 오류로 판단되어 재시도하지 않습니다: {body}")
        except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException) as e:
            last_err = str(e)
            log(f"  [경고] 다운로드 네트워크 오류: {last_err}")
        if attempt <= MAX_RETRY:
            wait = RETRY_WAITS[min(attempt - 1, len(RETRY_WAITS) - 1)]
            log(f"  {wait}초 후 재시도합니다 ...")
            time.sleep(wait)
    raise RuntimeError(f"다운로드 실패(재시도 소진): {last_err}")


# ============================================================================
#  사전 점검 (API 키 불필요) — filekey 목록 대조
# ============================================================================
def fetch_info_body() -> str:
    """파일 목록 조회 API(API 키 불필요). 정상 응답도 HTTP 502로 오는 경우가 있어
    상태코드를 보지 않고 본문만 읽는다."""
    req = urllib.request.Request(INFO_URL, method="GET")
    req.add_header("User-Agent", "doctorgreen-prep/1.0 (python-urllib)")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        try:
            return e.read().decode("utf-8", "replace")
        except Exception:
            return ""
    except Exception as e:
        log(f"  [안내] 파일 목록 조회 실패(네트워크 문제일 수 있음, 계속 진행): {e}")
        return ""


def preflight_check_filekeys():
    """다운로드 시작 전, AI Hub가 공개하는 파일 목록에서 filekey를 확인해
    CONFIG의 FILE_KEYS_BY_CLASS 값과 다르면 경고한다(치명적이지 않으면 계속 진행).
    이 엔드포인트는 API 키가 필요 없다 — API 키 자체의 유효성/승인 상태는 이 호출로는
    확인할 수 없으므로(AI Hub의 별도 키검증 엔드포인트는 404로 사용 불가 확인됨),
    큰 클래스를 받기 전에 --peek 로 실제 인증 다운로드를 먼저 해볼 것을 권장한다.
    """
    log("\n[사전 점검] AI Hub 파일 목록 조회 중(API 키 불필요) ...")
    body = fetch_info_body()
    if not body:
        log("  [안내] 파일 목록을 가져오지 못해 filekey 대조를 건너뜁니다.")
        return
    all_keys = {k for pair in FILE_KEYS_BY_CLASS.values() for k in pair.values()}
    missing = sorted(k for k in all_keys if k not in body)
    if missing:
        log(f"  [경고] 스크립트에 저장된 filekey 중 {len(missing)}개가 현재 AI Hub 목록에서 보이지 않습니다: {missing}")
        log(f"         {INFO_URL} 를 브라우저로 열어 실제 filekey를 확인하고 FILE_KEYS_BY_CLASS를 갱신하세요.")
    else:
        log("  [확인] filekey가 현재 AI Hub 목록과 일치합니다.")


# ============================================================================
#  후처리: tar 해제 -> part 병합 -> zip 해제  (aihubshell 후처리 순서 재현)
# ============================================================================
def extract_tar(tar_path: Path, dest: Path) -> int:
    """download.tar를 dest에 안전하게 해제(경로 이탈 방지).
    항목 하나가 OSError(경로 260자 초과, 금지문자 등)를 내도 전체가 중단되지 않도록
    항목 단위로 예외를 잡아 계속 진행한다. 반환: 실패한 항목 수."""
    dest.mkdir(parents=True, exist_ok=True)
    fail = 0
    with tarfile.open(str(tar_path), "r:*") as tf:
        for member in tf.getmembers():
            try:
                if member.isdev() or member.islnk() or member.issym():
                    continue  # 특수/링크 항목 무시(보안)
                target = safe_join(dest, member.name)  # 이탈 검사 + 윈도우 금지문자 정규화
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                src = tf.extractfile(member)
                if src is None:
                    continue
                with src, open(target, "wb") as out:
                    shutil.copyfileobj(src, out)
            except (OSError, ValueError) as e:
                fail += 1
                log(f"    [경고] tar 항목 해제 실패({member.name}): {e}")
    if fail:
        log(f"    [해제 요약] tar 항목 실패 {fail}건(계속 진행)")
    return fail


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


def extract_one_zip(zip_path: Path):
    """
    zip_path를 같은 폴더에 해제(한글 파일명 fix_name 복원, 경로 이탈 방지).
    항목 단위로 예외를 잡아 일부가 실패해도 계속 진행한다. 실패가 하나라도 있으면
    원본 zip을 지우지 않는다(재시도하거나 사용자가 확인할 수 있게 — 지워버리면 미해제
    데이터가 그대로 유실된다). 반환: (해제한 항목 수, 실패한 항목 수).
    """
    dest = zip_path.parent
    count = 0
    fail = 0
    try:
        with zipfile.ZipFile(str(zip_path)) as zf:
            for info in zf.infolist():
                try:
                    name = fix_name(info)
                    if name.endswith("/") or info.is_dir():
                        safe_join(dest, name).mkdir(parents=True, exist_ok=True)
                        continue
                    target = safe_join(dest, name)
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(info) as src, open(target, "wb") as out:
                        shutil.copyfileobj(src, out)
                    count += 1
                except (OSError, ValueError) as e:
                    fail += 1
                    log(f"    [경고] zip 항목 해제 실패({info.filename}): {e}")
    except zipfile.BadZipFile as e:
        log(f"    [경고] 손상된 zip 건너뜀({zip_path.name}): {e}")
        return 0, 1

    if fail == 0:
        try:
            zip_path.unlink()
        except Exception:
            pass
    else:
        log(f"    [경고] {zip_path.name}: 항목 {fail}건 실패 — 원본 zip을 지우지 않았습니다.")
    return count, fail


def unzip_recursive(root: Path, max_rounds: int = 3) -> int:
    """중첩 zip 대비: 새 zip이 안 나올 때까지 최대 max_rounds회 반복 해제.
    반환: 마지막까지 남아 있는(해제 실패로 삭제되지 않은) zip 개수 — 0이면 전부 해제 성공."""
    remaining = 0
    for rnd in range(1, max_rounds + 1):
        zips = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() == ".zip"]
        if not zips:
            remaining = 0
            break
        log(f"    [zip 해제] {rnd}회차: {len(zips)}개")
        for zp in zips:
            n, fail = extract_one_zip(zp)
            if n:
                log(f"      {zp.name} -> {n}개 항목" + (f"(실패 {fail}건)" if fail else ""))
        remaining = sum(1 for p in root.rglob("*") if p.is_file() and p.suffix.lower() == ".zip")
    return remaining


def cleanup_archives(root: Path, zip_remaining: int) -> None:
    """해제 끝난 아카이브/part 잔여물 삭제로 디스크 회수.
    zip_remaining > 0이면(일부 zip이 해제 실패로 남아있으면) zip은 지우지 않는다
    (미해제 데이터를 통째로 잃는 사고 방지) — tar/part만 정리한다."""
    if zip_remaining > 0:
        log(f"    [주의] {zip_remaining}개 zip이 끝내 풀리지 않았습니다 — 삭제하지 않았습니다."
            " 디스크가 부족하면 수동으로 확인하세요.")
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        low = p.suffix.lower()
        if low == ".tar" or _PART_RE.match(p.name):
            try:
                p.unlink()
            except Exception:
                pass
        elif low == ".zip" and zip_remaining == 0:
            try:
                p.unlink()
            except Exception:
                pass


# ============================================================================
#  JSON -> YOLO 변환 (검증된 규칙)
# ============================================================================
def walk_images_and_jsons(root: Path):
    """os.walk로 트리를 한 번만 훑어 이미지 경로 목록과 JSON 경로 목록을 동시에 만든다.
    (이미지용/JSON용으로 각각 rglob을 도는 것보다 윈도우 NTFS의 대용량 트리에서 훨씬 빠르다.)"""
    imgs = []
    jsons = []
    for dirpath, _dirnames, filenames in os.walk(root):
        dp = Path(dirpath)
        for fn in filenames:
            low = fn.lower()
            if low.endswith(".jpg") or low.endswith(".jpeg"):
                imgs.append(dp / fn)
            elif low.endswith(".json"):
                jsons.append(dp / fn)
    return imgs, jsons


def find_images(root: Path):
    return [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in IMG_SUFFIXES]


def find_jsons(root: Path):
    return [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() == ".json"]


def convert_class(root: Path, class_name: str, allow_background: bool = True,
                   rng: random.Random = None, need: int = None):
    """
    root(해제된 트리) 안에서 이미지/JSON을 모두 찾아 매칭 후 YOLO 변환.
    이 클래스(class_name)의 disease_class를 가진 이미지만 대상.
    need가 주어지면(목표 장수) JSON을 무작위 순서로 훑다가 필요량의 3배를 확보하면
    조기 종료한다(그룹 다양성 확보를 위한 여유분, 재현성은 rng 시드로 유지).
    반환: list[(img_path: Path, yolo_lines: list[str])], 통계 dict.
    """
    cls_idx = CLASS_NAMES.index(class_name)

    imgs, jsons = walk_images_and_jsons(root)
    # fname(basename) -> 이미지 경로 (대소문자/중복 대비: 소문자 stem+suffix 키)
    img_by_name = {}
    for ip in imgs:
        img_by_name.setdefault(ip.name, ip)          # 정확 파일명
        img_by_name.setdefault(ip.name.lower(), ip)  # 소문자 폴백

    if rng is not None:
        rng.shuffle(jsons)
    target = (need * 3) if need else None

    results = []
    stat = {"json_total": len(jsons), "img_total": len(imgs), "scanned": 0,
            "class_mismatch": 0, "no_image": 0, "bad_json": 0,
            "no_box": 0, "background": 0, "converted": 0}

    for jp in jsons:
        if target is not None and len(results) >= target:
            break
        stat["scanned"] += 1
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
            if allow_background:
                # 병징 bbox가 없는 이미지도 배경(음성) 이미지로 포함 — '정상' 클래스처럼
                # 원래 bbox가 없는 데이터가 통째로 제외되는 것을 막는다(YOLO의 정식 background
                # 이미지 규약: 빈 라벨 .txt).
                stat["background"] += 1
                results.append((img_path, []))
                stat["converted"] += 1
            continue

        results.append((img_path, lines))
        stat["converted"] += 1

    if stat["scanned"] > 0 and stat["no_box"] > 0.9 * stat["scanned"] and not allow_background:
        log(f"    [안내] 스캔한 JSON {stat['scanned']}개 중 {stat['no_box']}개가 병징 bbox 없이 저장돼 있습니다.")
        log("           이 클래스는 '정상'처럼 원래 bbox가 없는 데이터일 수 있습니다.")
        log("           지금은 --no-allow-background 상태라 이 이미지들이 전부 제외됩니다 —")
        log("           '--allow-background'(기본값) 로 다시 실행하면 배경 이미지로 포함됩니다.")

    return results, stat


# ============================================================================
#  클래스별 파이프라인
# ============================================================================
def count_accum_images(class_name: str) -> int:
    d = ACCUM_DIR / class_name / "images"
    if not d.exists():
        return 0
    return sum(1 for p in d.iterdir() if p.is_file() and p.suffix.lower() in IMG_SUFFIXES)


def reset_work_dir(work: Path, class_name: str = None):
    """작업폴더 초기화. class_name이 주어지고 이전에 중단된 클래스와 같으면(마커 파일로 판별)
    지우지 않고 재사용해 다운로드 이어받기가 가능하게 한다. 다르면 깨끗이 비운다."""
    marker = work / ".doctorgreen_class"
    if class_name is not None and work.exists() and marker.exists():
        try:
            prev = marker.read_text(encoding="utf-8").strip()
        except Exception:
            prev = None
        if prev == class_name:
            log(f"  [이어받기] 이전에 중단된 '{class_name}' 작업폴더를 재사용합니다: {work}")
            return
    if work.exists():
        if not safe_rmtree(work, "작업폴더"):
            raise RuntimeError(f"작업폴더를 안전하게 비울 수 없습니다: {work}")
    work.mkdir(parents=True, exist_ok=True)
    if class_name is not None:
        try:
            marker.write_text(class_name, encoding="utf-8")
        except Exception:
            pass


def process_class(class_name: str, per_class: int, work_dir: Path, apikey: str,
                   rng: random.Random, allow_background: bool = True) -> str:
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
    need = per_class - have

    keys = FILE_KEYS_BY_CLASS[class_name]
    filekeys = f"{keys['ts']},{keys['tl']}"

    # 디스크 여유 판정 — 원천(tar) 용량뿐 아니라 해제 피크(tar+zip, 이후 zip+이미지)까지 감안
    approx = APPROX_GB_BY_CLASS.get(class_name, 30)
    disk_need = approx * DISK_MARGIN_FACTOR
    free = disk_free_gb(work_dir)
    print_disk(work_dir, f"(이 클래스 원천 ~{approx}GB, 해제 피크 포함 필요량 ~{disk_need:.0f}GB)")
    if 0 <= free < disk_need:
        log(f"  [경고] 디스크 여유({free:.1f}GB) < 필요 예상량({disk_need:.0f}GB, 원천 {approx}GB의 "
            f"{DISK_MARGIN_FACTOR}배). 이 클래스를 건너뜁니다.")
        return f"디스크 부족(여유 {free:.1f}GB < 필요 {disk_need:.0f}GB)"

    # 1) 작업폴더 준비(이전 중단 시 같은 클래스면 재사용 -> 다운로드 이어받기)
    reset_work_dir(work_dir, class_name)
    tar_path = work_dir / "download.tar"

    if tar_path.exists() and not looks_like_error_body(tar_path):
        log("  [이어받기] 이미 완전한 download.tar가 있어 다운로드를 건너뜁니다.")
    else:
        try:
            download_to(filekeys, tar_path, apikey)
        except Exception as e:
            return f"다운로드 실패: {e}"
        err = looks_like_error_body(tar_path)
        if err:
            log(f"  [실패] 다운로드 응답이 데이터가 아닙니다:\n    {err}")
            return f"에러본문/HTTP: {err[:120]}"

    # 2) tar 해제
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

    free2 = disk_free_gb(work_dir)
    print_disk(work_dir, "(tar 해제 후, zip 해제 전 재확인)")
    if 0 <= free2 < approx:
        return f"디스크 부족(tar 해제 후 여유 {free2:.1f}GB < 원천 {approx}GB, zip 해제 전 중단)"

    # 3) part 병합
    try:
        merged = merge_parts(extract_root)
        if merged:
            log(f"  [병합] 분할 파일 {merged}건 복원")
    except Exception as e:
        log(f"  [경고] part 병합 중 오류(계속 진행): {e}")

    free3 = disk_free_gb(work_dir)
    if 0 <= free3 < approx:
        return f"디스크 부족(zip 해제 전 여유 {free3:.1f}GB < 원천 {approx}GB)"

    # 4) 중첩 zip 해제
    zip_remaining = 1  # 알 수 없음 -> 기본은 안전하게 "남아있음" 취급(아래에서 예외 시 그대로 유지)
    try:
        zip_remaining = unzip_recursive(extract_root, max_rounds=3)
    except Exception as e:
        log(f"  [경고] zip 해제 중 오류(계속 진행): {e}")

    # 5) 잔여 아카이브 정리(zip이 전부 풀렸을 때만 zip도 삭제)
    cleanup_archives(extract_root, zip_remaining)

    # 해제 후 파일 0 검사(rglob은 지연 평가라 next()로 전수 순회를 피한다)
    any_file = next(extract_root.rglob("*"), None) is not None
    if not any_file:
        return "해제 후 파일 0개"

    # 6) JSON -> YOLO 변환
    log("  [변환] JSON -> YOLO 라벨 변환 중 ...")
    try:
        results, stat = convert_class(extract_root, class_name, allow_background=allow_background,
                                       rng=rng, need=need)
    except Exception as e:
        return f"변환 실패: {e}"

    log(f"    이미지 {stat['img_total']}장 / JSON {stat['json_total']}개 발견(스캔 {stat['scanned']}개)")
    log(f"    변환 성공 {stat['converted']}장(배경 {stat['background']}장 포함) | 클래스불일치 {stat['class_mismatch']} "
        f"| 이미지없음 {stat['no_image']} | JSON오류 {stat['bad_json']} | 박스없음(제외) "
        f"{stat['no_box'] - stat['background']}")

    if not results:
        return "변환 결과 0장(이 클래스로 매핑된 이미지 없음)"

    # 7) per_class 무작위 샘플(부족분만 채우도록)
    #    이미 _accum 에 있는 파일명(stem)은 제외 — 중단 후 재실행 시 같은 이미지가 다시
    #    저장되는 것을 막는다.
    acc_img = ACCUM_DIR / class_name / "images"
    acc_lbl = ACCUM_DIR / class_name / "labels"
    acc_img.mkdir(parents=True, exist_ok=True)
    acc_lbl.mkdir(parents=True, exist_ok=True)
    used_stems = set(p.stem for p in acc_img.iterdir() if p.is_file())

    rng.shuffle(results)
    sample = [r for r in results if r[0].stem not in used_stems][:need]
    log(f"    누적 목표 {per_class}장 중 현재 {have}장 -> 이번에 {len(sample)}장 추가")

    # 8) ACCUM_DIR/{클래스}/{images,labels}로 복사(라벨을 먼저 써서, 중간에 중단돼도
    #    라벨 없는 이미지가 남지 않게 한다 — 이미지가 없으면 collect_accum이 애초에 안 읽는다)
    copied = 0
    for img_path, lines in sample:
        orig_stem = img_path.stem
        gkey = group_key(orig_stem)
        stem = orig_stem
        k = 1
        while stem in used_stems:
            # "~dupN" 처럼 숫자로 끝나지 않는 접미사를 써서 group_key()의 자동 추정
            # 정규식(끝의 연속 숫자 제거)이 오작동하지 않게 한다. 그래도 안전하게 원본
            # stem에서 계산한 gkey를 .gkey 사이드카에 별도로 저장해 그룹 정보를 보존한다.
            stem = f"{orig_stem}~dup{k}n"
            k += 1
        used_stems.add(stem)
        try:
            (acc_lbl / (stem + ".txt")).write_text("\n".join(lines), encoding="utf-8")
            (acc_lbl / (stem + ".gkey")).write_text(gkey, encoding="utf-8")
            shutil.copy2(img_path, acc_img / (stem + ".jpg"))
            copied += 1
        except Exception as e:
            log(f"    [경고] 복사 실패({img_path.name}): {e}")

    log(f"  [저장] {copied}장 -> {acc_img.parent}")
    log(f"  현재 '{class_name}' 누적: {count_accum_images(class_name)}장")

    # 9) WORK_DIR 삭제로 회수(성공적으로 끝났으므로 마커/이어받기 정보도 함께 정리)
    shutil.rmtree(work_dir, ignore_errors=True)
    print_disk(BASE_DIR, "(작업폴더 정리 후)")
    return "ok"


# ============================================================================
#  --peek: 라벨 파일만 받아 JSON 구조·API 키를 확인
# ============================================================================
def peek_class(class_name: str, work_dir: Path, apikey: str) -> int:
    """라벨(tl) 파일만 받아 해제한 뒤 첫 JSON의 스키마(최상위 키, images 타입, annotations[0])를
    출력하고 종료한다. 194GB를 커밋하기 전에 API 키·승인·JSON 스키마 가정을 한 번에 확인한다."""
    log("")
    log("=" * 70)
    log(f"[--peek] '{class_name}' 라벨(tl) 파일만 받아 JSON 구조를 확인합니다")
    log("=" * 70)

    keys = FILE_KEYS_BY_CLASS[class_name]
    reset_work_dir(work_dir, f"peek-{class_name}")
    tar_path = work_dir / "peek.tar"
    try:
        download_to(keys["tl"], tar_path, apikey)
    except Exception as e:
        log(f"[오류] 라벨 다운로드 실패: {e}")
        log("       '인증실패/권한/승인/신청' 문구가 보였다면 AI Hub 마이페이지에서 71451")
        log("       다운로드 신청이 승인됐는지, 키가 정확한지, 국내망에서 실행 중인지 확인하세요.")
        return 1

    err = looks_like_error_body(tar_path)
    if err:
        log(f"[오류] 응답이 데이터가 아닙니다:\n  {err}")
        return 1

    extract_root = work_dir / "extracted"
    try:
        extract_tar(tar_path, extract_root)
    except Exception as e:
        log(f"[오류] tar 해제 실패: {e}")
        return 1
    merge_parts(extract_root)
    unzip_recursive(extract_root, max_rounds=3)

    jsons = find_jsons(extract_root)
    log(f"  발견된 JSON: {len(jsons)}개")
    if not jsons:
        log("[오류] JSON을 하나도 찾지 못했습니다.")
        return 1

    jp = sorted(jsons)[0]
    log(f"  샘플 파일: {jp}")
    try:
        with open(jp, "r", encoding="utf-8") as f:
            d = json.load(f)
    except Exception as e:
        log(f"[오류] JSON 파싱 실패: {e}")
        return 1

    log("")
    log("  === 최상위 키 ===")
    log(f"  {list(d.keys())}")
    images_meta = d.get("images")
    log("")
    log(f"  === images 타입: {type(images_meta).__name__} ===")
    log(f"  {json.dumps(images_meta, ensure_ascii=False, indent=2)[:1000]}")
    anns = d.get("annotations")
    ann_len = len(anns) if isinstance(anns, list) else "?"
    log("")
    log(f"  === annotations 타입: {type(anns).__name__}, 길이: {ann_len} ===")
    if isinstance(anns, list) and anns:
        log(f"  annotations[0]: {json.dumps(anns[0], ensure_ascii=False, indent=2)[:1000]}")

    log("")
    log("  이 출력이 prep_win.py의 파싱 가정과 일치하는지 확인하세요:")
    log("    - d['images']['fname'], d['images']['width'], d['images']['height'], d['images']['disease_class']")
    log("    - d['annotations'][i]['bbox'] = [x, y, w, h]")
    log("  다르면 본 실행 전에 convert_class()의 images_meta/annotations 파싱부를 이 구조에 맞게 고치세요.")
    log("")
    log(f"  [확인] API 키·승인·국내망 상태가 정상입니다(라벨 파일을 정상적으로 받았습니다: "
        f"{human_bytes(tar_path.stat().st_size) if tar_path.exists() else '?'}).")

    shutil.rmtree(work_dir, ignore_errors=True)
    return 0


# ============================================================================
#  최종 분할 + data.yaml
# ============================================================================
def collect_accum(class_name: str):
    """ACCUM_DIR/{클래스}에서 (이미지, 라벨경로, 그룹키) 3-튜플 목록.
    그룹키는 .gkey 사이드카(원본 stem 기준, 충돌 회피 접미사의 영향을 받지 않음)를
    우선 쓰고, 없으면(과거 데이터) 파일명에서 다시 추정한다."""
    acc_img = ACCUM_DIR / class_name / "images"
    acc_lbl = ACCUM_DIR / class_name / "labels"
    pairs = []
    if not acc_img.exists():
        return pairs
    for ip in sorted(acc_img.iterdir()):
        if not (ip.is_file() and ip.suffix.lower() in IMG_SUFFIXES):
            continue
        lp = acc_lbl / (ip.stem + ".txt")
        gp = acc_lbl / (ip.stem + ".gkey")
        if gp.exists():
            try:
                gkey = gp.read_text(encoding="utf-8").strip() or group_key(ip.stem)
            except Exception:
                gkey = group_key(ip.stem)
        else:
            gkey = group_key(ip.stem)
        pairs.append((ip, lp if lp.exists() else None, gkey))
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


def cap_pairs_to_per_class(pairs: list, per_class: int, rng: random.Random) -> list:
    """pairs(3-튜플)가 per_class개를 넘으면 그룹을 최대한 쪼개지 않고 줄인다.
    (--only-build --per-class 를 함께 써도 _accum 전량이 아니라 per_class만 쓰도록 보장)"""
    if per_class is None or len(pairs) <= per_class:
        return pairs
    groups_map = defaultdict(list)
    for img, lbl, gkey in pairs:
        groups_map[gkey].append((img, lbl, gkey))
    gkeys = list(groups_map.keys())
    rng.shuffle(gkeys)
    out = []
    for gk in gkeys:
        if len(out) >= per_class:
            break
        out.extend(groups_map[gk])
    return out[:per_class]


def split_class_pairs(class_name: str, pairs: list, rng: random.Random, split: tuple):
    """
    한 클래스의 (이미지, 라벨, 그룹키) 3-튜플 목록을 그룹(개체) 인식 분할로
    train/val/test에 배정한다. 그룹 키가 사실상 전부 유니크(그룹 수 >= 샘플 수의 95%)면
    그룹 정보가 없다고 보고 기존 이미지 단위 랜덤 분할로 폴백한다.
    반환: (train_items, val_items, test_items, info: dict) — 각 items는 3-튜플 목록.
    """
    tr_r, va_r, te_r = split
    n = len(pairs)

    groups_map = defaultdict(list)
    for img, lbl, gkey in pairs:
        groups_map[gkey].append((img, lbl, gkey))
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
        elif n_g == 2:
            n_val_g = 1
            n_test_g = 0
            log(f"    [경고] '{class_name}' 그룹이 2개뿐이라 val에 1그룹만 배정하고 test는 비웁니다"
                f"(test 평가 불가). 데이터를 더 모으거나 GROUP_ID_REGEX/파일명 규칙을 점검하세요.")
        else:
            n_val_g = 0
            n_test_g = 0
            log(f"    [경고] '{class_name}' 그룹이 {n_g}개뿐이라 val/test를 만들 수 없습니다 "
                f"— 전량이 train으로만 들어갑니다. 이 클래스는 평가가 불가능합니다.")

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


def build_final(out_dir: Path, seed: int, per_class: int = None):
    log("")
    log("=" * 70)
    log("[최종 분할] 클래스균형 8:1:1 분할 + data.yaml 생성")
    log("=" * 70)

    if out_dir.exists():
        if not safe_rmtree(out_dir, "결과폴더"):
            return None
    for s in ("train", "val", "test"):
        (out_dir / "images" / s).mkdir(parents=True, exist_ok=True)
        (out_dir / "labels" / s).mkdir(parents=True, exist_ok=True)

    rng = random.Random(seed)
    used_stems = set()
    grand = {"train": 0, "val": 0, "test": 0}
    per_class_report = {}
    missing_label_count = 0
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
        pairs = cap_pairs_to_per_class(pairs, per_class, rng)
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
            "train": {gk for _, _, gk in train_items},
            "val": {gk for _, _, gk in val_items},
            "test": {gk for _, _, gk in test_items},
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
            for img, lbl, _gkey in items:
                stem = img.stem
                k = 1
                while stem in used_stems:
                    stem = f"{img.stem}~dup{k}n"
                    k += 1
                used_stems.add(stem)
                try:
                    dst_lbl = out_dir / "labels" / split / (stem + ".txt")
                    if lbl is not None and lbl.exists():
                        shutil.copy2(lbl, dst_lbl)
                    else:
                        dst_lbl.write_text("", encoding="utf-8")
                        missing_label_count += 1
                        log(f"    [경고] 라벨 없는 이미지 → 빈 라벨로 처리: {img.name}")
                    shutil.copy2(img, out_dir / "images" / split / (stem + ".jpg"))
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

    if missing_label_count:
        log("")
        log(f"  [경고] 라벨 누락 {missing_label_count}건 — 빈 라벨(배경)로 처리했습니다. 위 상세 내역을 확인하세요.")

    log("")
    log("  === 최종 클래스별 · split별 장수 ===")
    for class_name in CLASS_NAMES:
        tr, va, te = per_class_report.get(class_name, (0, 0, 0))
        log(f"    {class_name:>6}:  train {tr:4d} | val {va:4d} | test {te:4d}")
    log(f"    {'합계':>6}:  train {grand['train']:4d} | val {grand['val']:4d} | test {grand['test']:4d}")

    empty_eval_classes = [c for c, (tr, va, te) in per_class_report.items() if (tr + va + te) > 0 and (va == 0 or te == 0)]
    if empty_eval_classes:
        log("")
        for c in empty_eval_classes:
            log(f"  [경고] '{c}' 클래스가 val/test에 0장 — 이 클래스는 평가가 불가능합니다.")

    log("")
    log(f"  data.yaml 생성 완료: {yaml_path}")
    return yaml_path


# ============================================================================
#  --dry-run: 실제 다운로드 없이 환경만 점검
# ============================================================================
def run_dry_run(work_dir: Path, out_dir: Path, accum_dir: Path) -> int:
    log("\n[--dry-run] 실제 다운로드 없이 환경만 점검합니다(API 키 입력 없음).")
    ok = check_python_version()
    preflight_check_filekeys()
    for label, p in (("작업폴더", work_dir), ("결과폴더", out_dir), ("누적폴더", accum_dir)):
        warn_path_issues(label, p)
        print_disk(p, f"({label})")
    log("")
    if ok:
        log("[--dry-run] 점검 완료. 문제가 없으면 다음으로 'python prep_win.py --peek' 를 실행해")
        log("            API 키·JSON 스키마를 확인한 뒤, 본 실행('python prep_win.py')으로 넘어가세요.")
        return 0
    log("[--dry-run] 위 오류를 해결한 뒤 다시 실행하세요.")
    return 2


# ============================================================================
#  안내
# ============================================================================
def print_next_steps(out_dir: Path):
    log("")
    log("=" * 70)
    log("다음 단계 — 확정 방향: ② 크롭 기반 분류기 (YOLO 탐지기는 병행 트랙)")
    log("=" * 70)
    log(f"방금 만든 {out_dir} 는 아직 '원본 YOLO 데이터셋'입니다. 병명 판정은")
    log("이 데이터셋을 그대로 학습에 넘기는 게 아니라, 먼저 크롭을 뜬 뒤")
    log("크롭 분류기(convnext_tiny 등)로 학습합니다. 아래 [본선]을 따라가세요.")
    log("")
    log("[본선] 크롭 분류기로 넘기기 — 병명(name) 판정, 확정된 방향")
    log("  1) 이 PC에서 바로 크롭을 만드세요(Pillow만 필요, GPU 불필요):")
    log("       pip install pillow")
    log(f"       python crop_dataset.py --src {out_dir} --out <크롭 저장 폴더>")
    log("     -> crops/{train,val,test}/{클래스명}/*.jpg 가 생기고 클래스x분할 요약표가 뜹니다.")
    log("     -> 표에서 5개 클래스('정상' 포함)가 train/val/test 모두 0장이 아닌지 꼭 확인하세요.")
    log("  2) 그 crops 폴더를 zip으로 묶어 Google Drive에 업로드(원본보다 훨씬 작습니다).")
    log("  3) Colab에서 Drive 마운트 후 압축을 풀고 다음 순서로 실행:")
    log("       python train_classifier.py --data <크롭 경로> --out <결과 경로> --model convnext_tiny")
    log("       python eval_classifier.py   --data <크롭 경로> --ckpt <결과 경로>/best.pt --out <평가 경로>")
    log("       python export_classifier.py --ckpt <결과 경로>/best.pt --out <export 경로>")
    log("     자세한 옵션·클래스 매핑은 training/README_CLASSIFIER.md 를 참고하세요.")
    log("")
    log("[병행] YOLO 탐지기로 넘기기 — 위치·개수·심각도용 (병명 판정에는 쓰지 않음)")
    log(f"  1) 이 {out_dir} 폴더를 그대로 zip으로 묶으세요:")
    log("     (윈도우 탐색기: dataset 폴더 우클릭 -> '압축(ZIP) 폴더로 보내기')")
    log("  2) 그 zip을 Google Drive에 업로드하고, Colab에서 Drive 마운트 후 압축을 풉니다.")
    log("     (예: /content/drive/MyDrive/doctor_green_dataset 아래에 풀기)")
    log("  3) 학습 노트북 doctorgreen_yolo_map_boost.ipynb 의 CONFIG를 이렇게 지정:")
    log("       DATASET_DIR  = '<위에서 압축 푼 Drive 경로>'")
    log("       LABEL_FORMAT = 'yolo'")
    log("     -> 노트북이 images/{train,val,test}, labels/{...}, data.yaml 을 그대로 읽습니다.")
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
                   help="다운로드 없이 이미 모아둔 _accum 으로 최종 분할만 수행(--per-class도 적용됨)")
    p.add_argument("--work-dir", default=str(WORK_DIR), help="작업(임시) 폴더 경로 override")
    p.add_argument("--out-dir", default=str(OUT_DIR), help="최종 결과 폴더 경로 override")
    p.add_argument("--accum-dir", default=str(ACCUM_DIR),
                   help="클래스별 누적 샘플 저장 폴더 경로 override(기본: 스크립트 옆 _accum)")
    p.add_argument("--dry-run", action="store_true",
                   help="다운로드 없이 파이썬 버전/디스크/경로/filekey만 점검하고 종료")
    p.add_argument("--peek", action="store_true",
                   help="라벨(tl) 파일만 받아 JSON 구조·API 키·승인 상태를 확인하고 종료(본 실행 전 강력 권장)")
    p.add_argument("--allow-background", dest="allow_background", action="store_true",
                   default=ALLOW_BACKGROUND_DEFAULT,
                   help="병징 bbox가 없는 이미지를 빈 라벨(배경) 이미지로 포함(기본값, '정상' 클래스에 필요)")
    p.add_argument("--no-allow-background", dest="allow_background", action="store_false",
                   help="병징 bbox가 없는 이미지를 제외(과거 동작과 동일)")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv if argv is not None else sys.argv[1:])

    work_dir = Path(args.work_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    per_class = max(1, args.per_class)

    global ACCUM_DIR
    ACCUM_DIR = Path(args.accum_dir).resolve()

    log("닥터그린 딸기 병해 데이터 준비 스크립트")
    log(f"  BASE_DIR : {BASE_DIR}")
    log(f"  WORK_DIR : {work_dir}")
    log(f"  ACCUM_DIR: {ACCUM_DIR}")
    log(f"  OUT_DIR  : {out_dir}")
    log(f"  클래스당 목표: {per_class}장 | SEED={SEED} | 분할 {SPLIT} | 배경이미지 포함: {args.allow_background}")

    if not check_python_version():
        return 2
    for label, p in (("작업폴더", work_dir), ("결과폴더", out_dir), ("누적폴더", ACCUM_DIR)):
        warn_path_issues(label, p)
    print_disk(BASE_DIR)

    if args.dry_run:
        return run_dry_run(work_dir, out_dir, ACCUM_DIR)

    if args.only_build:
        log("\n[--only-build] 다운로드를 건너뛰고 _accum 으로 최종 분할만 수행합니다.")
        if build_final(out_dir, SEED, per_class):
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
    preflight_check_filekeys()

    # API 키 입력 (메모리에만 보관, 화면 표시 안 됨)
    apikey = getpass.getpass("AI Hub API 키 입력(화면 표시 안 됨): ").strip()
    if not apikey:
        log("[오류] API 키가 비어 있습니다. 다시 실행하세요.")
        return 2

    if args.peek:
        target_class = classes[0]
        log(f"\n[--peek] 대상 클래스: {target_class} (--classes 로 다른 클래스도 지정 가능)")
        return peek_class(target_class, work_dir, apikey)

    log("\n[안내] 처음 실행하는 PC/키라면 Ctrl+C로 중단 후 'python prep_win.py --peek' 를")
    log("       먼저 실행해 API 키·JSON 스키마를 확인하는 것을 강력히 권장합니다.")

    ACCUM_DIR.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)  # 클래스 샘플링에 재사용

    results = {}
    failures = []
    interrupted = False
    for class_name in classes:
        try:
            status = process_class(class_name, per_class, work_dir, apikey, rng, args.allow_background)
        except KeyboardInterrupt:
            log("\n[중단] 사용자가 Ctrl+C로 중단했습니다.")
            log(f"       진행 중이던 클래스의 임시 파일을 지우지 않고 남겨 두었습니다: {work_dir}")
            log("       재실행하면 다운로드가 중간까지 진행됐던 경우 이어받기를 시도합니다.")
            log("       공간이 필요하면 이 폴더를 직접 지우세요(단, 그러면 처음부터 다시 받습니다).")
            interrupted = True
            break
        except Exception as e:
            status = f"예외: {e}"
        results[class_name] = status
        if status not in ("ok", "skip"):
            failures.append((class_name, status))
            log(f"  [실패목록 기록] {class_name}: {status}")

    # 작업폴더 정리(중단이 아니었을 때만 — 중단 시에는 이어받기를 위해 보존)
    if not interrupted:
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
        log("  힌트: 위 각 클래스 실패 사유에 표시된 AI Hub 응답 본문을 확인하세요.")
        log("        '인증실패/권한/승인/신청/해외/제한' 문구 -> 국내망(해외 VPN 끄기)에서 실행 중인지,")
        log("        AI Hub 마이페이지에서 71451 다운로드 신청이 승인됐는지, API 키가 정확한지 확인하세요.")
        log("        (휴대폰 본인인증 재인증 후 기존 승인이 취소된 경우가 있어 마이페이지 확인이 필요할 수 있습니다.)")

    # 최종 분할(모을 게 있으면)
    if any(count_accum_images(c) > 0 for c in CLASS_NAMES):
        try:
            if build_final(out_dir, SEED, per_class):
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
