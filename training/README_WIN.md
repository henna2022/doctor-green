# 닥터그린 학습 데이터 준비 (윈도우 실행 가이드)

AI Hub(딸기 병해 71451)는 **해외 IP 다운로드를 차단**하므로 Colab에서 받을 수 없습니다. 그래서 국내망 윈도우 데스크톱에서 이 스크립트로 직접 받습니다.

- **스크립트:** `prep_win.py` (파이썬 표준 라이브러리만 사용, 별도 설치 불필요)
- **하는 일:** AI Hub 다운로드 API 직접 호출 → tar 해제 → 분할파일 병합 → zip 해제(한글 파일명 복원) → JSON 라벨을 YOLO 형식으로 변환 → 클래스당 1000장 샘플 → 8:1:1 분할 + `data.yaml` 생성
- **결과:** `dataset/` 폴더(이미지 + YOLO 라벨 + data.yaml). 이걸 zip으로 묶어 Google Drive에 올리면 Colab 학습 노트북이 그대로 읽습니다.

> 기존 Colab용 데이터준비 노트북(`doctorgreen_aihub_data_prep.ipynb`)은 해외 IP 차단으로 **사용 불가**이며, 이 스크립트가 그 역할을 대체합니다.

---

## 1. 준비물

### (1) 파이썬 설치
1. https://www.python.org/downloads/windows/ 접속 → 최신 Python 3 설치 파일 다운로드.
2. 설치 프로그램 실행 시 **맨 아래 "Add python.exe to PATH" 체크**(중요!) 후 "Install Now".
3. 설치 확인: 시작 메뉴에서 "명령 프롬프트"(cmd) 실행 후
   ```
   python --version
   ```
   → `Python 3.x.x` 가 나오면 성공. (pip 설치나 추가 패키지는 필요 없습니다.)

### (2) AI Hub 준비
- AI Hub(aihub.or.kr) 로그인 → 해당 데이터셋(딸기 병해) **다운로드 신청·승인 완료** 상태여야 합니다.
- 마이페이지에서 **API 키**를 발급받아 둡니다(실행 중 키 입력을 요구합니다).

### (3) prep_win.py 를 윈도우로 옮기기
맥/이 저장소에 있는 `training/prep_win.py` 파일을 윈도우 데스크톱으로 옮깁니다. 방법 아무거나:
- Google Drive에 올린 뒤 윈도우에서 내려받기, 또는
- USB로 복사, 또는
- 자신에게 메일로 첨부해 윈도우에서 저장.

예: `C:\doctorgreen\prep_win.py` 에 두겠습니다.

### (4) 디스크 여유
- 원천 데이터가 큽니다(가장 큰 **정상 클래스만 약 76GB**, 5개 클래스 합계 약 **194GB** 다운로드). 다운로드→해제→변환은 한 클래스씩 처리하고 끝나면 임시폴더를 지워 공간을 회수합니다.
- **여유 공간 200GB 이상 권장.** 부족하면 그 클래스는 자동으로 건너뜁니다(경고 출력).
- **최종 결과 `dataset/`** 는 클래스당 1000장(총 약 5000장) → 수 GB 정도로 작습니다.

---

## 2. 실행

명령 프롬프트(cmd)에서 스크립트가 있는 폴더로 이동한 뒤 실행합니다.

```
cd C:\doctorgreen
python prep_win.py
```

1. `AI Hub API 키 입력(화면 표시 안 됨):` 가 뜨면 API 키를 붙여넣고 Enter.
   - **보안상 입력 글자는 화면에 보이지 않습니다**(정상입니다). 키는 메모리에만 쓰이고 저장/출력되지 않습니다.
2. **작은 클래스부터 자동으로** 진행합니다: 황화 → 잎끝마름 → 역병 → 시들음병 → 정상.
3. 각 클래스마다 다운로드 진행률(%), 해제/병합/변환 상황, 디스크 여유가 한국어로 출력됩니다.
4. 전부 끝나면 `dataset/` 아래에 최종 8:1:1 분할과 `data.yaml`이 만들어지고, 다음 단계 안내가 출력됩니다.

### 중간에 멈춰도 됩니다
- `Ctrl + C` 로 언제든 중단 가능. **이미 받아 확보한 클래스는 보존**됩니다.
- 다시 `python prep_win.py` 를 실행하면 **이미 1000장 채운 클래스는 건너뛰고 남은 것부터** 이어서 진행합니다.

### 자주 쓰는 옵션
- 특정 클래스만:
  ```
  python prep_win.py --classes 황화,역병
  ```
- 클래스당 장수 변경(예: 500장):
  ```
  python prep_win.py --per-class 500
  ```
- 다운로드 없이, 이미 모아둔 것으로 최종 분할만 다시 만들기:
  ```
  python prep_win.py --only-build
  ```
- 결과/작업 폴더 위치 바꾸기:
  ```
  python prep_win.py --out-dir D:\dg_dataset --work-dir D:\dg_tmp
  ```

### 잘 안 될 때
- `해외에서 / 제한 / 승인 / 신청` 같은 문구가 뜨면 → 국내망(해외 VPN 끄기)에서 실행 중인지, AI Hub에서 이 데이터셋 신청·승인이 끝났는지 확인.
- `HTTP 5xx` → AI Hub 서버 일시 오류. 잠시 후 재실행(이어서 진행됨).
- 특정 클래스만 실패하면 스크립트가 실패목록에 기록하고 나머지는 계속 진행합니다. 원인 해결 후 그 클래스만 다시 실행하세요.

---

## 3. 결과를 Colab 학습으로 넘기기

1. 만들어진 `dataset` 폴더를 zip으로 압축합니다.
   - 윈도우 탐색기에서 `dataset` 폴더 우클릭 → **보내기 → 압축(ZIP) 폴더**.
2. 그 `dataset.zip` 을 **Google Drive에 업로드**합니다.
3. Colab에서 Drive 마운트 후 압축을 풉니다. 예:
   ```
   /content/drive/MyDrive/doctor_green_dataset/
       images/{train,val,test}/...
       labels/{train,val,test}/...
       data.yaml
   ```
4. 학습 노트북 `doctorgreen_yolo_map_boost.ipynb` 의 CONFIG 셀을 다음처럼 지정:
   ```python
   DATASET_DIR  = '/content/drive/MyDrive/doctor_green_dataset'   # 압축 푼 경로
   LABEL_FORMAT = 'yolo'
   DATA_YAML    = '/content/drive/MyDrive/doctor_green_dataset/data.yaml'  # 아래 경고 참고
   ```
   → 노트북이 `images/`, `labels/`, `data.yaml` 을 그대로 읽어 학습을 시작합니다.

   > **[경고] `DATA_YAML`을 반드시 지정하세요.** 이 스크립트(`prep_win.py`)는 같은 개체(같은 딸기
   > 포기)를 연속 촬영한 프레임이 train/val/test에 걸치지 않도록 개체 단위로 분할한 `data.yaml`을
   > 이미 만들어 둡니다. `DATA_YAML`을 비워두면(`''`) 노트북의 3장(데이터 준비)이 이 분할을 무시하고
   > **자체적으로 재분할**합니다 — 노트북도 그룹 인식 분할을 적용하지만, 이미 만들어진 좋은 분할을
   > 굳이 다시 만들 이유가 없으므로 `prep_win.py`가 만든 `data.yaml` 경로를 그대로 지정해 재사용하세요.

> 클래스 순서는 배포 모델과 동일하게 **0:정상, 1:역병, 2:시들음병, 3:잎끝마름, 4:황화** 로 고정되어 있습니다. 앱 스키마 유지를 위해 이 순서를 바꾸지 마세요.
