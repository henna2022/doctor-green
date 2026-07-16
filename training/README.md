# 닥터그린 YOLO mAP 향상 학습 가이드

`doctorgreen_yolo_map_boost.ipynb`는 Hugging Face Space(`henna22/doctor-green-strawberry`)에
배포된 딸기 병해 YOLO 모델의 mAP를 **측정 → 데이터 감사 → 재학습 → 비교 → 재배포**까지
한 번에 진행하는 Google Colab Pro용 노트북입니다.

## 1. 준비물

- Google Colab Pro 계정 (L4 또는 A100 GPU 권장)
- Google Drive에 올려 둔 학습 데이터셋 (이미지 + 라벨, 약 1,000~5,000장)
  - 라벨은 YOLO txt / AI Hub식 이미지별 JSON / COCO 통합 JSON 모두 지원
- Hugging Face 계정 (Space가 private이거나 업로드까지 할 경우 write 토큰)

## 2. 코랩에 올리는 방법

1. https://colab.research.google.com 접속 → **파일 > 노트 업로드** → `doctorgreen_yolo_map_boost.ipynb` 선택
   (또는 이 파일을 Drive에 올린 뒤 더블클릭 → Colab으로 열기)
2. **런타임 > 런타임 유형 변경 > GPU (L4/A100)** 선택
3. 데이터셋 폴더를 Drive에 올리고, 노트북 첫 코드 셀(CONFIG)의 `DATASET_DIR` 등 경로를 수정

## 3. 셀 실행 순서와 예상 소요시간

위에서 아래로 순서대로 실행하면 됩니다. (L4 GPU, 이미지 3천 장 기준)

| 순서 | 섹션 | 하는 일 | 예상 시간 |
|---|---|---|---|
| 0 | 설정(CONFIG) | 경로·라벨 형식·프리셋 지정 (유일하게 수정하는 셀) | 1분 |
| 1 | 환경 준비 | ultralytics 설치, GPU 확인, Drive 마운트 | 2~3분 |
| 2 | 기존 모델 | Space에서 .pt 자동 다운로드, YOLO 버전·클래스 자동 감지 | 1~2분 |
| 3 | 데이터 준비 | 라벨을 YOLO txt로 통일, 층화 분할 8:1:1, data.yaml 생성 | 5~15분 |
| 4 | 베이스라인 평가 | 기존 모델의 mAP50/mAP50-95 + conf=0.75 지표 측정 | 3~5분 |
| 5 | 데이터 감사 | 클래스 분포, 깨진 파일, 중복(누수), 박스 크기, 라벨 시각화 | 5~10분 |
| 6 | 재학습 | 프리셋 A(~1시간) / B(2~4시간) / C(반나절) | 프리셋에 따름 |
| 7 | 비교 평가 | 새 모델 vs 베이스라인 (Δ표, 혼동행렬, PR곡선, TTA) | 5~10분 |
| 8 | 오류 분석 | FN/FP 상위 이미지 시각화 → 데이터 보강 방향 결정 | 3~5분 |
| 9 | 배포 | 클래스 이름/순서 검증 후 Space에 업로드 | 5분 |

첫 회차는 프리셋 **A**로 파이프라인 전체를 검증하고, 5장의 박스 크기 분포에서
작은 병반 비율이 높게 나오면 **B**(imgsz=896)로 재실행하는 순서를 권장합니다.

## 4. 세션이 끊겼을 때

- 학습 결과·가중치·CSV는 전부 Drive의 `PROJECT_DIR`(기본: `doctor_green_training/`)에 저장되므로 유실되지 않습니다.
- 0~1장과 3장 셀만 다시 실행하면 SEED 고정으로 **동일한 분할이 재현**됩니다.
- 학습 도중 끊겼다면 6장 마크다운의 resume 안내대로
  `YOLO(f'{PROJECT_DIR}/train_A/weights/last.pt').train(resume=True)` 로 이어서 학습하세요.

## 5. 배포 시 주의 (앱 연동)

- 닥터그린 앱은 신뢰도 컷오프 **0.75**를 사용합니다. 노트북의 conf=0.75 지표가 실제 체감 성능입니다.
- Space의 app.py가 `model.names`를 기준으로 `disease_name` 등 응답 스키마를 만들기 때문에,
  **클래스 이름·순서가 바뀐 가중치를 올리면 앱이 깨집니다.**
  반드시 노트북 9-1 검증 셀에서 "일치"를 확인한 뒤 업로드하세요.
- 업로드 후 Space 재시작(1~2분)을 기다렸다가 앱의 `/api/diagnose/ping`으로 워밍업 후 실제 사진으로 테스트하세요.

---

# 데이터 준비 노트북 → 학습 노트북 실행 순서

새 학습 데이터를 AI Hub 딸기 데이터셋에서 처음부터 만들려면, 먼저
`doctorgreen_aihub_data_prep.ipynb`(데이터 준비)를 돌려 데이터셋을 만든 뒤
`doctorgreen_yolo_map_boost.ipynb`(학습)를 실행합니다. 이미 YOLO 데이터셋이 있으면
준비 노트북은 건너뛰고 학습 노트북만 실행하면 됩니다.

## A. 데이터 준비 노트북 (`doctorgreen_aihub_data_prep.ipynb`)

AI Hub "시설작물(딸기) 개체/질병 이미지"(dataSetSn=71451)를
**다운로드 → YOLO 변환 → 클래스당 1,000장 균형 샘플링 → 8:1:1 층화 분할 → data.yaml 생성**까지
자동 처리하는 Colab Pro용 노트북입니다.

사전 준비(수동, 시간 소요):

1. AI Hub(aihub.or.kr) **내국인 회원가입 + 로그인**
2. 위 데이터셋 **활용 신청 → 승인**(수동 심사라 수 시간~수일 걸릴 수 있음)
3. 마이페이지에서 **API Key** 발급 (노트북에서 `getpass`로 입력하며, 화면·로그·Drive에 저장하지 않음)

실행 순서:

1. Colab에 업로드 → GPU 불필요(다운로드/변환만) → 위에서 아래로 실행
2. **0. CONFIG** 셀에서 `DATASET_KEY`(2번 섹션의 `-mode l`로 찾음), `CLASS_NAMES`(배포 모델 순서),
   필요 시 `FILE_KEYS`(클래스별 선택 다운로드)만 조정
3. 4번 섹션에서 출력되는 **샘플 JSON**을 보고 `AIHUB_JSON_KEYS`/`AIHUB_BBOX_ORDER`를 실제 키에 맞춤
4. 끝까지 실행하면 `OUT_DIR`(기본 `/content/drive/MyDrive/doctor_green_training/dataset`)에
   `images/{train,val,test}`, `labels/{train,val,test}`, `data.yaml`이 생성됨(Drive에 영구 보존)

## B. 학습 노트북으로 연결

준비 노트북의 **`OUT_DIR`가 그대로 학습 노트북의 `DATASET_DIR`** 입니다.
학습 노트북 0번 CONFIG 셀을 다음처럼 설정하세요.

```python
DATASET_DIR  = '<준비 노트북의 OUT_DIR>'   # 예: /content/drive/MyDrive/doctor_green_training/dataset
LABEL_FORMAT = 'yolo'                        # 준비 노트북이 이미 YOLO txt로 변환해 둠
DATA_YAML    = '<OUT_DIR>/data.yaml'         # 준비 노트북의 분할을 그대로 재사용(권장)
                                             #  ''로 두면 학습 노트북이 자체 재분할(동작은 동일)
```

## C. 클래스 순서 주의 (두 노트북 공통)

`data.yaml`의 `names` 순서 = 준비 노트북 `CLASS_NAMES` = 배포 모델 `model.names`가
**모두 같아야** 앱이 깨지지 않습니다. 준비 노트북 CONFIG의 `CLASS_NAMES`는 학습 노트북 2번 셀에서
확인되는 `baseline_names`(= 배포 모델 클래스 순서)와 반드시 일치시키세요.
기본값은 `['정상','역병','시들음병','잎끝마름','황화']`이며, 영문 병명 모델이면
CONFIG의 `CLASS_NAMES`를 영문으로 바꾸고 `KOR_TO_MODEL` 매핑을 채웁니다.
