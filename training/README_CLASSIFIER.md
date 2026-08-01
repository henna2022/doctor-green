# 닥터그린 2단계 파이프라인 — ② 크롭 기반 파인그레인드 병명 분류

기존 1단계(YOLO 탐지) 파이프라인 위에 얹는 **박스 크롭 재분류** 단계입니다.
탐지기가 잡은 박스마다 크롭을 떠서 전용 분류기로 병명을 다시 판정해 **병명 정확도**를 높입니다.

## 1. 왜 2단계인가 (아키텍처)

```
사진 → [1단계 YOLO 탐지기] → 박스(위치)·개수·심각도(severity)
                              └→ 각 박스 크롭 → [2단계 분류기] → 병명(name)·신뢰도(confidence)
                                                                     ↓
                              HF Space(Gradio)가 기존 응답 스키마로 조립 → app/api/diagnose
```

- **역할 분담**
  - 1단계 YOLO: "어디에 병징이 있는가"(box), "몇 개"(count), "얼마나 심한가"(severity)에 강함 → **그대로 유지**.
  - 2단계 분류기(timm): 크롭 하나의 미세한 병명 구분(파인그레인드)에 강함 → **name/confidence만 교체**.
- **응답 스키마 불변**: HF Space는 지금과 동일한 JSON을 반환합니다.
  `app/diagnose/result/lib.ts`의 `Detection { name, name_en, confidence, box{x1,y1,x2,y2} }`,
  `DiagnosisResult { disease_name, disease_name_en, confidence, severity, count, detections[], all[] }`.
  분류기는 각 detection의 `name`/`name_en`/`confidence`만 바꾸고, `box`·`severity`·`count`는 1단계 값을 유지합니다.
- **판단보류 게이트**: 앱은 신뢰도 컷오프 **0.75**(`CONFIDENCE_THRESHOLD`)를 씁니다.
  `eval_classifier.py`의 임계값 스윕이 분류기 confidence 기준 커버리지 vs 정확도를 표로 뽑아 이 컷오프 재조정을 돕습니다.

## 2. 고정 클래스 순서 → 앱 라벨 매핑 (절대 변경 금지)

`prep_win.py`·`data.yaml`·배포 모델 `model.names`가 모두 같아야 앱이 안 깨집니다.

| index | 클래스(한글) | 비고 |
|---|---|---|
| 0 | 정상 | healthy |
| 1 | 역병 | |
| 2 | 시들음병 | |
| 3 | 잎끝마름 | |
| 4 | 황화 | |

> 주의: `crop_dataset.py`는 폴더명을 클래스명으로 쓰고, `train_classifier.py`의 `ImageFolder`는
> 폴더명을 **유니코드 정렬**해 인덱스를 매깁니다(배포 0~4 순서와 다를 수 있음). 그래서 학습이 쓴
> 실제 `class_to_idx`를 `best.pt`/`classes.json`/`export_meta.json`에 저장하고, eval·export·서빙이
> 이 매핑을 그대로 씁니다. **서빙 코드는 반드시 export_meta.json의 classes 리스트로 인덱스→한글명을
> 매핑**하세요(정렬 순서를 가정하지 말 것).

## 3. 전체 실행 순서

```
[윈도우/국내망]  python prep_win.py                     # ① YOLO 데이터셋(images/labels/data.yaml)
      │
      ▼
[어디서나]      python crop_dataset.py --src dataset --out crops      # ② 박스 크롭 데이터셋
      │  (crops를 zip → Google Drive 업로드)
      ▼
[Colab GPU]     python train_classifier.py --data crops --out runs/cls   # ③ 학습
      │
      ▼
[Colab/로컬]    python eval_classifier.py --data crops --ckpt runs/cls/best.pt --out runs/cls/eval  # ④ 평가
      │
      ▼
[Colab/로컬]    python export_classifier.py --ckpt runs/cls/best.pt --out runs/cls/export           # ⑤ export
```

### split 상속 (데이터 누수 방지 유지)
`crop_dataset.py`는 크롭의 split을 **원본 이미지의 split 그대로** 물려줍니다.
`prep_win.py`가 개체(그룹) 단위 8:1:1로 이미 누수를 막았으므로, 크롭을 다시 섞지 않고
상속만 하면 같은 개체 크롭이 train/val/test에 걸치지 않는 성질이 그대로 보존됩니다.
**절대 크롭 단계에서 재분할하지 마세요.**

## 4. 스크립트별 요점

| 스크립트 | 입력 | 출력 | 핵심 옵션 |
|---|---|---|---|
| `crop_dataset.py` | YOLO 데이터셋 | `crops/{split}/{class}/*.jpg` + `manifest.json` | `--margin`(기본 0.15), `--min-size`(기본 24px) |
| `train_classifier.py` | crops | `best.pt`, `last.pt`, `results.csv`, `classes.json` | `--model`(convnext_tiny / tf_efficientnetv2_s), `--img-size`(384), `--epochs` |
| `eval_classifier.py` | crops + best.pt | per_class_metrics.csv, confusion_matrix.(csv/png), threshold_sweep.csv, summary.json | `--split test` |
| `export_classifier.py` | best.pt | classifier_ts.pt(TorchScript), classifier.onnx(dynamic batch), export_meta.json | `--opset`(17) |

**설계 결정**
- **margin 0.15**: 박스만 딱 자르면 병징 주변 맥락(잎맥·경계)이 사라져 파인그레인드 구분이 어려워집니다.
  사방 15% 패딩 후 이미지 경계로 클램프. 필요시 `--margin`으로 조정.
- **min-size 24px**: 너무 작은(퇴화) 박스는 리사이즈 시 뭉개져 노이즈가 되므로 건너뜁니다.
- **클래스 가중치**: train 크롭 개수의 **역빈도**(평균 1로 정규화)를 CrossEntropy weight로 사용 → 클래스 불균형 보정.
- **증강**: 수평뒤집기 + 약한 컬러지터 + 소폭 RandomResizedCrop(scale 하한 0.7).
  **강한 회전/원근 왜곡은 넣지 않습니다**(병징 형태가 진단 단서라 왜곡하면 해로움).
- **스케줄/최적화**: AdamW + 코사인 LR + 워밍업, CUDA일 때 AMP, val loss 기준 조기종료.

## 5. Colab GPU 실행

### 의존성 셀
```python
!pip -q install torch torchvision timm scikit-learn matplotlib onnx
```
(Colab은 torch/torchvision 기본 탑재 — timm·onnx만 설치해도 대개 충분합니다.)

### 데이터 올리기
1. 로컬에서 `python crop_dataset.py --src dataset --out crops` 실행.
2. `crops` 폴더를 zip → Google Drive 업로드 → Colab에서 마운트 후 해제.
3. 학습:
```python
!python train_classifier.py \
    --data /content/crops --out /content/drive/MyDrive/doctor_green_training/cls_convnext \
    --model convnext_tiny --img-size 384 --epochs 40 --batch-size 32
```
Drive 아래에 두면 세션이 끊겨도 `best.pt`/`results.csv`가 보존됩니다.

### 예상 런타임 (실데이터 ≈ 5,000 크롭, 5클래스, 8:1:1)
클래스당 1,000장 × 박스≈1개 가정 ≈ 4,000 train 크롭 기준.

| GPU | 모델 | img 384 | 1 epoch | 40 epoch(조기종료 전) |
|---|---|---|---|---|
| L4 | convnext_tiny | | ~1.5~2.5분 | ~1~1.5시간 |
| A100 | convnext_tiny | | ~40~60초 | ~30~45분 |
| L4 | tf_efficientnetv2_s | | ~2~3분 | ~1.5~2시간 |

조기종료(patience 8)로 대개 15~30 epoch에서 멈춥니다. img-size를 256으로 낮추면 ~1.5~2배 빠릅니다.
(CPU/MPS에서도 동작하지만 매우 느리므로 스모크 검증용으로만.)

## 6. export & tfjs (edu 앱 통합용 — 문서만)

`export_classifier.py`가 TorchScript + ONNX(dynamic batch)를 만듭니다. HF Space 서빙은
TorchScript 또는 onnxruntime로 크롭을 재분류하면 됩니다.

브라우저(tfjs) 변환은 **구현하지 않고 경로만** 남깁니다:
- **경로 A(권장)**: `onnx → onnx-tf(SavedModel) → tensorflowjs_converter(tfjs graph model)`
  ```
  pip install onnx onnx-tf tensorflowjs
  onnx-tf convert -i classifier.onnx -o tf_saved_model
  tensorflowjs_converter --input_format=tf_saved_model tf_saved_model web_model
  ```
- **경로 B(대안)**: timm 모델을 keras/tf로 재구현 후 가중치 이식 → tfjs (수작업 많음, 비권장).
- opset 13~17을 바꿔가며 변환 성공 조합을 찾습니다. 브라우저 경량화가 목적이면
  `tf_efficientnetv2_s` 쪽이 변환/성능 균형이 낫습니다. 전처리(mean/std/img_size)는 `export_meta.json` 참조.

## 7. 출력물 경로 주의 (커밋 금지)

`crops/`, `runs/`, 대용량 산출물은 **레포에 커밋하지 마세요**. 스크립트의 `--out`을 레포 밖 경로나
`.gitignore` 대상으로 지정하세요. (`training/dataset_sample/`은 이미 gitignore됨 — 같은 선례를 따릅니다.
필요하면 `training/crops/`, `training/runs/`를 `.gitignore`에 추가하세요.)

## 8. k-fold 교차검증 (cross_validate.py)

성능 수치를 공식으로 보고하기 전에 1회 돌려, 단일 split 운으로 생긴 수치가 아닌지
평균 ± 편차로 확인하는 용도입니다. 일상 실험 루프에는 필요 없습니다.

무엇을 하는가:
- `crops/`의 train+val을 합쳐 그룹(개체, prep_win.py의 group_key와 동일 키) 인식
  층화 k-fold를 만들고, fold마다 `train_classifier.py` + `eval_classifier.py`를
  자동 실행해 집계합니다. **test/는 읽지도 않습니다** — 최종 홀드아웃으로 보존.
- 같은 개체의 크롭이 fold를 걸치지 않으므로 누수 없는 추정치가 나옵니다.
  클래스별 그룹 수가 k 미만이면 즉시 실패합니다(실데이터는 클래스당 수십 그룹이라 통과.
  `dataset_sample`은 클래스당 1그룹이라 정당하게 실패 — 스모크는 `--group-key image` 사용).

실행(Colab, 학습과 동일 인자를 그대로 넘김):
```python
!python cross_validate.py \
    --data /content/crops --out /content/drive/MyDrive/doctor_green_training/cv \
    --model convnext_tiny --img-size 384 --epochs 40 --batch-size 32
```
- `--dry-run`: fold 구성과 클래스×그룹 분포만 출력(학습 없음). 본 실행 전 확인 권장.
- `--folds`: 기본 5.
- 중단돼도 같은 명령을 다시 실행하면 완료된 fold(eval/summary.json 존재)는 건너뛰고
  이어서 돕니다. `--out`을 Drive 아래에 두면 세션이 끊겨도 재개됩니다.

비용(Colab): 학습 k회 = 단일 학습의 k배. L4 기준 k=5면 대략 2.5~5시간이고,
조기종료가 걸리므로 보통 그 이하입니다. 시간이 부담이면 `--img-size 256`으로 낮춰
경향만 먼저 확인하는 방법도 있습니다.

보고 방법:
- `cv_summary.json` / `cv_summary.csv`의 **전체 정확도 mean ± std**(min/max 포함)와
  클래스별 F1 mean ± std로 보고합니다. fold별 val 그룹 수도 함께 기록돼 있어
  불균형 여부를 같이 보여줄 수 있습니다.
- test 홀드아웃은 교차검증과 별도로, 최종 모델 1개에 대해
  `eval_classifier.py`(기본 `--split test`) 1회로 확인해 병기합니다.
  교차검증 평균과 test 수치가 크게 어긋나면 split 구성부터 의심하세요.
