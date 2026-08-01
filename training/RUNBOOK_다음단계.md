# 지금부터 뭘 하면 되나 — 크롭 분류기 런북 (비개발자용)

**지금 상태:** `C:\dg\dataset` 에 AI Hub 71451 YOLO 데이터셋이 완성돼 있습니다
(5클래스 × 1,000장 = 5,000장, 약 6.67GB). 확정된 방향은 **② 크롭 기반 파인그레인드
분류기**(`timm` `convnext_tiny` 또는 `tf_efficientnetv2_s`)로 병명(name)을 판정하는 것이고,
YOLO 탐지기는 위치·개수·심각도(severity)용으로 계속 쓰는 **별도 병행 트랙**입니다.
아래 순서(① → ⑥)만 그대로 따라가면 됩니다.

이 문서에서 `python ...` 명령은 전부 **윈도우 명령 프롬프트(cmd)**, `!python ...` 은
**Colab 노트북 셀**에서 실행하는 명령입니다. 경로의 `<...>` 부분은 본인 환경에 맞게 바꾸세요.

---

## 시작 전에 — 알아두면 좋은 점

이 파이프라인 스크립트들은 감사(코드 점검)와 로컬 end-to-end 실행 검증을 마쳤습니다
(2026-08-01, 커밋 `5ab4598`). 아래는 그 결과와, 각 단계에서 직접 확인할 점입니다.

| 단계 | 알아둘 것 |
|---|---|
| ① 크롭 만들기 | 병징이 없는 '정상' 사진이 크롭 단계에서 통째로 빠지던 버그는 **수정 완료**입니다(파일명에서 클래스를 역추정해 중앙 크롭으로 복구). 게다가 5개 클래스 중 하나라도 train/val이 0장이면 스크립트가 스스로 멈춥니다. 그래도 **요약표에서 5개 클래스 행이 모두 0이 아닌지** 눈으로 한 번 확인하세요. |
| ③ Colab 학습 | Colab 무료 티어는 세션이 끊길 수 있습니다. `--resume`으로 이어 학습하는 기능이 있으니, 끊기면 처음부터 다시 돌리지 말고 같은 명령에 `--resume`만 붙여 재실행하세요(optimizer 상태까지 복원됩니다). 아래 ③에서 절차 안내. |
| ④ 평가 읽는 법 | 혼동행렬 그림의 한글 깨짐은 **해결됐습니다** — 한글 폰트를 자동으로 찾아 쓰고, 없으면 영문 라벨로 자동 폴백합니다. 다만 Colab에서는 `!apt-get -qq install -y fonts-nanum && fc-cache -f` 를 미리 실행해 두면 한글로 나옵니다. |
| ⑤ export | `export_meta.json`에 크롭 여백(margin 0.15)·최소 크기(24px)·리사이즈 방식·한글→영문 클래스명 매핑이 **자동으로 담깁니다**. 서빙 담당자에게 이 파일을 그대로 넘기면 됩니다. |
| ⑥ 앱 통합 | **이 저장소에는 아직 "YOLO 결과 + 분류기 결과를 합쳐 앱 응답으로 조립하는 코드"가 없습니다.** export까지가 이 파이프라인이 지금 해주는 일이고, 그 다음은 별도 개발 작업입니다(아래 ⑥ 참고). |

---

## 크롭을 어디서 만들까 — 로컬(윈도우) 권장

**결론: 지금 이 윈도우 PC에서 바로 크롭을 만드세요(Colab에 원본 6.67GB를 올리지 마세요).**

**근거:**

1. **`crop_dataset.py`는 무거운 게 전혀 필요 없습니다.** GPU 불필요, `pip install pillow`
   한 줄이면 끝입니다(torch·timm 등은 학습 단계부터 필요). 지금 데이터가 이미 `C:\dg\dataset`에
   있으니 그 자리에서 바로 돌리는 게 가장 빠릅니다.
2. **크기 계산:** 6.67GB ÷ 5,000장 ≈ 장당 1.4MB인 원본 사진을, 크롭은 병징 박스 + 여백 15%만
   남기고 잘라냅니다(전체 프레임이 아니라 그 일부). 박스가 프레임 폭의 대략 30~70%를
   차지한다고 가정하면 면적 기준으로 원본의 약 9~50% 픽셀만 남습니다. 다만 크롭은
   JPEG 품질 95(고화질)로 저장되므로 픽셀당 용량은 원본보다 클 수 있어, 정확한 배율은
   실행 전에는 단정할 수 없습니다 — 그래도 대부분의 경우 원본보다 뚜렷이 작아집니다.
   **정확한 값은 ①을 실행한 뒤 폴더 속성으로 실측하세요** (아래 ①의 확인 문구 참고).
3. **어느 쪽이든 크롭은 결국 로컬에서 한 번은 실행해야 합니다** — Colab에서 크롭을 만들려면
   먼저 원본 6.67GB를 통째로 올려야 하는데, 그러면 업로드 시간만 늘어나고 크롭 결과물을
   다시 Drive에 저장하는 것도 똑같이 필요합니다. 반대로 로컬에서 먼저 크롭하면 **업로드는
   한 번, 그것도 원본보다 작은 crops 폴더만** 올리면 됩니다.
4. **가장 중요한 이유: 로컬에서 먼저 돌려야 '정상' 클래스가 빠지는 버그를 즉시 발견합니다.**
   원본 6.67GB를 먼저 Drive에 올리고 Colab에서야 크롭을 만들면, 문제를 발견했을 때
   이미 업로드 시간을 다 써버린 뒤입니다. 로컬에서 몇 분이면 끝나는 크롭 단계에서
   먼저 걸러내는 게 훨씬 안전합니다.

참고로 업로드 시간 감(感)만 잡자면 — 가정 업로드 속도가 30Mbps(초당 3.75MB)일 때
6.67GB는 대략 30분 안팎 걸립니다. crops 폴더가 원본의 절반 정도라면 업로드 시간도
그만큼 줄어듭니다. 본인 회선 속도에 따라 인터넷 "속도 테스트" 사이트에서 업로드 속도를
확인해 직접 계산해도 됩니다(GB × 8000 ÷ 업로드Mbps ≈ 초).

---

## ① 크롭 만들기 (로컬/윈도우)

**명령:** prep_win.py 때와 똑같이, 스크립트를 `C:\dg`로 내려받아 그 자리에서 실행합니다.
```
cd /d C:\dg
curl -L -O https://raw.githubusercontent.com/henna2022/doctor-green/training/aihub-data-prep/training/crop_dataset.py
python -m pip install pillow
python crop_dataset.py --src C:\dg\dataset --out C:\dg\crops
```
학습·평가·export는 Colab에서 돌리므로, 윈도우에 둘 스크립트는 `crop_dataset.py` 하나뿐입니다.

**예상 소요 시간:** 5,000장 기준 5~15분(디스크 속도에 따라 다름). 진행 중 화면에
`[train] 크롭 N개 생성` 같은 줄이 split(train/val/test)마다 하나씩 나옵니다.

**이 화면이 나오면 성공(예시 — 실제로 71451 데이터셋에서 나온 실측값입니다):**
```
================================================================
크롭 데이터셋 요약 (클래스 × split)
================================================================
    클래스 |  train(실측) |  참고: val+test 포함 합계
  ------------------------------------------------------
      정상 |       5,605  |   7,253
      역병 |       4,661  |   6,118
     시들음병 |       5,536  |   (미집계 예시)
    잎끝마름 |       7,877  |   (미집계 예시)
      황화 |       8,476  |  10,075
  ------------------------------------------------------
      합계 |  train 32,155 / val 4,326 / test 3,408 = 전체 39,889
  건너뜀: 작은박스 869 | 알수없는클래스 0 | 배경 클래스 복구 0
  매니페스트: C:\dg\crops\manifest.json
```
(실제 숫자는 실행 환경마다 다를 수 있습니다 — 위는 2026-08-01 실측값 예시입니다. 원본
이미지는 5,000장인데 크롭이 39,889장인 것은 정상입니다 — 사진 한 장에 병징 박스가 여러
개 잡히면 그만큼 크롭도 여러 장 나옵니다, 평균 약 8개/장.) **핵심 확인: 5개 클래스 모두
train/val/test 세 칸이 다 0이 아니어야 합니다.** 특히 `정상` 행이 0이면 — 알려진 버그일
가능성이 높으니 이 단계에서 멈추고 담당자에게 알리거나 `training/README_CLASSIFIER.md`·
최근 수정 내역을 확인한 뒤 다시 실행하세요. (다른 4개 클래스 중 하나가 0이어도 마찬가지로
진행하지 마세요.)

**크롭 폴더 실제 용량 확인(선택, Drive 업로드 전 참고용):**
`C:\dg\crops` 폴더를 윈도우 탐색기에서 우클릭 → **속성**을 보면 실제 크기가 나옵니다.
원본 6.67GB보다 얼마나 작아졌는지 여기서 바로 확인할 수 있습니다.

**실패 시 대처:**
- `ModuleNotFoundError: No module named 'PIL'` → `python -m pip install pillow` 다시 실행.
- `[오류] data.yaml 이 없습니다` → `--src` 경로가 `C:\dg\dataset`(images/labels/data.yaml이
  바로 아래 있는 폴더)를 정확히 가리키는지 확인.
- `[경고] 생성된 크롭이 0개입니다` → `--src` 경로 자체가 잘못됐거나 라벨 파일이 없는
  경우입니다. `dir C:\dg\dataset\images\train` 로 이미지가 실제로 있는지 먼저 확인하세요.
- 특정 클래스만 0장 → 위 "핵심 확인" 문단대로 진행하지 말고 원인부터 확인.

---

## ② Google Drive 업로드

1. `C:\dg\crops` 폴더를 zip으로 압축합니다.
   - 탐색기에서 `crops` 폴더 우클릭 → **보내기 → 압축(ZIP) 폴더**.
2. 생성된 `crops.zip`을 [Google Drive](https://drive.google.com)에 업로드합니다.
   (드라이브 웹사이트를 열고 원하는 폴더로 파일을 드래그 앤 드롭하면 됩니다.)

**예상 소요 시간:** crops.zip 용량 ÷ 본인 업로드 속도. 실측 crops.zip은 828MB이므로,
업로드 30Mbps 가정 시 828×8÷30 ≈ 221초(약 3.5~4분)입니다. 용량이 클수록, 업로드 속도가
느릴수록 오래 걸립니다(계산식: MB × 8 ÷ 업로드Mbps ≈ 초).

**이 화면이 나오면 성공:** Google Drive 웹페이지에서 `crops.zip`이 목록에 뜨고
업로드 진행률 표시가 사라지면 완료입니다(브라우저 우하단 업로드 상태 창 확인).

**실패 시 대처:**
- 업로드가 중간에 끊김 → Drive는 보통 자동 재시도합니다. 계속 실패하면 인터넷 연결
  확인 후 다시 업로드(이어받기 안 되면 처음부터).
- "저장공간이 가득 찼습니다" → Google 계정의 무료 저장공간(15GB)을 다른 파일이 이미
  많이 쓰고 있을 수 있습니다. Drive에서 용량을 확인하고 불필요한 파일을 정리하거나
  용량을 늘리세요.

---

## ③ Colab GPU 학습

1. Colab에서 새 노트북을 열고 **런타임 → 런타임 유형 변경 → GPU**로 설정합니다.
2. Drive를 마운트하고 `crops.zip`을 풉니다:
   ```python
   from google.colab import drive
   drive.mount('/content/drive')
   !unzip -q "/content/drive/MyDrive/crops.zip" -d /content/crops
   ```
3. 이 저장소의 `training` 폴더를 Colab에 올리거나(zip으로 올린 뒤 `!unzip`),
   `!git clone`으로 받습니다. 그다음 의존성 설치:
   ```python
   !pip -q install timm
   ```
4. 학습 실행 — **실측 규모(train 32,155장, 8:1:1)에 맞춘 권장 설정**입니다(기존
   `--epochs 40 --batch-size 32` 그대로 쓰면 L4에서 8~13시간이 걸려 세션이 못 버팁니다.
   근거는 `README_CLASSIFIER.md` 5장 "실측 규모와 권장값" 참조):
   ```python
   # 배정된 GPU가 L4(24GB)일 때
   !python train_classifier.py \
       --data /content/crops \
       --out /content/drive/MyDrive/doctor_green_training/cls_convnext \
       --model convnext_tiny --img-size 384 --epochs 15 --batch-size 48 --lr 4e-4 \
       --warmup-epochs 2 --patience 5
   ```
   ```python
   # 배정된 GPU가 T4(16GB, 무료 티어에서 흔함)일 때 — img-size를 낮춰 속도 보완
   !python train_classifier.py \
       --data /content/crops \
       --out /content/drive/MyDrive/doctor_green_training/cls_convnext \
       --model convnext_tiny --img-size 320 --epochs 12 --batch-size 24 \
       --warmup-epochs 2 --patience 4
   ```
   `--out`을 반드시 **Drive 아래 경로**로 지정하세요 — 그래야 세션이 끊겨도 그때까지
   결과(`best.pt`/`last.pt`/`results.csv`)가 보존되고, 아래 "세션이 끊기면"의 `--resume`
   재개도 이 폴더를 기준으로 동작합니다. 배정된 GPU 종류는 노트북 우측 상단 또는
   `!nvidia-smi` 실행 결과에서 확인할 수 있습니다.

**예상 소요 시간(실측 train 32,155 크롭 기준, 상세 계산은 README_CLASSIFIER.md 참조):**

| GPU | 설정 | 1 epoch | 전체(조기종료 전 상한) |
|---|---|---|---|
| L4 | img384, batch48, epochs15 | 약 10~18분 | 약 2.5~4.5시간 |
| A100 | img384, batch48, epochs15 | 약 4.5~7분 | 약 1.1~1.8시간 |
| T4 | img320, batch24, epochs12 | 약 17~42분 | 약 3.4~8.4시간 |

조기종료(L4/A100: patience 5, T4: patience 4)가 걸리면 위 상한보다 짧게 끝나는 경우가
많습니다. **T4는 편차가 큽니다** — 1 epoch째 로그에 찍히는 실제 소요 시간을 보고 전체
예상 시간을 다시 계산한 뒤, 너무 길면 `--epochs`를 더 줄이거나 `--img-size 256`
((384/256)²≈2.25배 빠름, 다만 미검증이라 정확도 하락을 감수해야 함)까지 낮추는 것도
검토하세요.

**이 화면이 나오면 성공(진행 중, L4 예시 — epochs 값은 실행한 명령에 따라 다름):**
```
[환경] device=cuda | AMP=True | torch=2.x.x
[클래스] ['정상', '역병', '시들음병', '잎끝마름', '황화']
[epoch   1/15] lr=... train_loss=... val_loss=... val_acc=...
    -> best 갱신(monitor=0.xxxx) best.pt 저장
...
```
**최종 성공 화면:**
```
[완료] best epoch NN (monitor=0.xxxx)
  best.pt   : .../best.pt
  last.pt   : .../last.pt
  results   : .../results.csv
  classes   : .../classes.json
```
`[클래스]` 줄에 5개 클래스가 다 나오는지(순서는 상관없음, 개수만) 여기서 한 번 더
확인하면 좋습니다.

**⚠ 세션이 끊기면(무료 티어에서 흔함) — `--resume`으로 이어서 학습하세요:**
`train_classifier.py`는 매 에폭 `last.pt`에 모델·옵티마이저·스케줄러·조기종료 상태를
함께 저장합니다. 세션이 끊긴 뒤 대처법:
1. **`--out`을 그대로 두고, 위 4단계에서 실행했던 것과 완전히 똑같은 명령 끝에 `--resume`만
   붙여 다시 실행하세요.** (`--data`/`--out`/`--model`/`--img-size`/`--batch-size` 등을 바꾸면
   안 됩니다 — 특히 img-size나 batch-size를 바꾸면 재개는 되지만 학습 조건이 달라집니다.)
   ```python
   !python train_classifier.py \
       --data /content/crops \
       --out /content/drive/MyDrive/doctor_green_training/cls_convnext \
       --model convnext_tiny --img-size 384 --epochs 15 --batch-size 48 --lr 4e-4 \
       --warmup-epochs 2 --patience 5 --resume
   ```
2. 로그에 `[재개] .../last.pt 에서 epoch N 부터 이어서 학습합니다`가 뜨면 정상 재개된
   것입니다. 처음부터 다시 도는 것이 아니라 중단된 에폭 다음부터 이어집니다.
3. Drive에 `last.pt`가 없으면(예: 첫 에폭도 끝나기 전에 끊김) `--resume`을 넣어도 자동으로
   처음부터 시작합니다(에러는 아님) — 로그의 `[재개] --resume 이 지정됐지만 ... 가 없어
   처음부터 시작합니다` 문구로 확인하세요.
4. 끊김 자체를 줄이려면: 브라우저 탭을 계속 열어두고, 코드 실행 중 다른 탭 작업을
   최소화하세요(Colab은 일정 시간 비활성 시 세션을 끊습니다). 자주 끊긴다면 Colab
   Pro(유료)로 더 긴 세션을 확보하는 것도 검토하세요.

**실패 시 대처:**
- `CUDA out of memory` → `--batch-size`를 24(L4) 또는 12(T4) 로 낮춰 재실행(그래도 나면
  더 낮추세요). **재실행 시에도 `--resume`을 붙이면 그때까지의 진행이 이어집니다** —
  단, batch-size를 바꾸면 학습 조건이 달라진다는 점은 위 "세션이 끊기면" 1번 참고.
- `[오류] train 클래스가 N개뿐입니다` → crops 폴더에 클래스 하위 폴더가 5개가 아니라는
  뜻입니다. ①의 요약표를 다시 확인하고, zip이 깨지지 않았는지(`unzip` 경고 확인)도 보세요.
- `[오류] val 클래스(...) != train 클래스(...)` → train/val 어느 한쪽에서 특정 클래스
  폴더가 통째로 비어 있다는 뜻입니다. ①에서 만든 crops를 다시 점검하세요.

---

## ④ 평가 결과 읽는 법

```python
!python eval_classifier.py \
    --data /content/crops --ckpt /content/drive/MyDrive/doctor_green_training/cls_convnext/best.pt \
    --out /content/drive/MyDrive/doctor_green_training/cls_convnext/eval
```

**예상 소요 시간:** 실측 test 3,408장 기준 약 3~10분(GPU/배치에 따라 다름, 학습보다 훨씬
짧습니다).

**이 화면이 나오면 성공:**
```
[전체 정확도] 0.8xxx  (n=3408)
    정상: P=0.xxx R=0.xxx F1=0.xxx (n=NNN)
    역병: P=0.xxx R=0.xxx F1=0.xxx (n=NNN)
    ...  (클래스별 n 합계가 위 전체 n=3408이 됩니다)
[macro F1] 0.8xxx
[임계값 스윕] threshold | coverage | acc@covered | (판단보류율)
    0.75     |  0.xxx  |   0.xxx    |  0.xxx
    ...
[저장] .../eval
  per_class_metrics.csv / confusion_matrix.csv / confusion_matrix.png
  threshold_sweep.csv / summary.json
```

**결과 파일 5개, 어떤 걸 봐야 하나:**
- **`summary.json`** — 가장 먼저 열어볼 파일. `overall_accuracy`(전체 정확도),
  `macro_f1`(클래스별 성능 평균), `prod_threshold`(0.75, 앱이 쓰는 판단보류 기준)가 요약돼 있습니다.
- **`per_class_metrics.csv`** — 클래스별(정상/역병/시들음병/잎끝마름/황화) 정밀도(P)·재현율(R)·F1.
  특정 병명만 유난히 낮으면 그 클래스 데이터를 더 늘리거나 재확인해야 합니다.
- **`threshold_sweep.csv`** — 신뢰도 컷오프(0.50~0.95)별로 "얼마나 많이 판단보류하는지(abstain_rate)
  vs 정확도"를 보여줍니다. 앱은 0.75를 씁니다 — 그 줄의 정확도가 만족스러운지 확인.
- **`confusion_matrix.csv`** — 어느 병명을 어느 병명으로 착각하는지 숫자로 확인(예: 시들음병을
  역병으로 오판하는 비율이 높은지 등).
- **⚠ `confusion_matrix.png`(그림)** — Colab 기본 폰트에는 한글이 없어서 클래스명이
  깨진 네모(□□□)로 나올 수 있습니다. 그림 대신 위 `confusion_matrix.csv`(숫자)로 확인하세요.
  그림을 꼭 보고 싶다면 평가 실행 전에 아래를 먼저 실행해보세요(효과는 보장되지 않음, 안 되면
  숫자 파일로 대체):
  ```python
  !apt-get -qq install -y fonts-nanum
  ```

**실패 시 대처:**
- `[오류] ckpt 에 없는 클래스 폴더` → crops의 test 폴더에 학습 때 없던 클래스 폴더 이름이
  섞여 있다는 뜻. 폴더명 오타나 잘못 섞인 크롭이 없는지 확인.
- `[오류] test 샘플 0개` → `--data` 경로 또는 crops 안에 `test` 폴더가 비어 있는지 확인.

---

## ⑤ Export (배포용 파일 만들기)

```python
!pip -q install onnx
!python export_classifier.py \
    --ckpt /content/drive/MyDrive/doctor_green_training/cls_convnext/best.pt \
    --out /content/drive/MyDrive/doctor_green_training/cls_convnext/export
```

**예상 소요 시간:** 1~3분.

**이 화면이 나오면 성공:**
```
[모델] convnext_tiny | classes=['정상', '역병', ...] | img_size=384
[TorchScript] 저장: .../classifier_ts.pt  출력 shape ...
[ONNX] 저장: .../classifier.onnx  (opset=17, dynamic batch)
[ONNX] check 통과. 출력: [...]
[메타] .../export_meta.json
```
`export` 폴더 안에 `classifier_ts.pt`, `classifier.onnx`, `export_meta.json` 세 파일이
생겼으면 성공입니다.

**이 파일들을 어디에 쓰나:** `classifier_ts.pt`/`classifier.onnx`가 실제 서빙(HF Space)에
올라가는 모델 파일이고, `export_meta.json`은 클래스 순서·전처리(mean/std/img_size) 정보를
담고 있어 서빙 코드가 이 값을 그대로 읽어써야 합니다. **서빙 담당자에게 이 세 파일과 함께
`training/README_CLASSIFIER.md` 4장의 margin(0.15)·min-size(24px) 값도 같이 전달하세요**
(지금 `export_meta.json`에는 이 두 값이 자동으로 담기지 않을 수 있습니다).

**실패 시 대처:**
- `ModuleNotFoundError: No module named 'onnx'` → `!pip -q install onnx` 다시 실행.
- ONNX export가 에러로 멈추면 → TorchScript(`classifier_ts.pt`)는 별도로 먼저 저장되므로
  최소한 그 파일은 확보됩니다. onnx 관련 에러 메시지를 그대로 담당자에게 전달하세요.

---

## ⑥ 앱 통합 (지금은 여기까지가 이 저장소가 하는 일)

**중요:** 이 저장소(`training/`)에는 ⑤에서 만든 `classifier_ts.pt`/`classifier.onnx`를
실제로 로드해서 **1단계 YOLO 결과(위치·개수·심각도) + 2단계 분류기 결과(병명·신뢰도)를
합쳐 앱이 기대하는 응답 형태로 조립하는 코드가 아직 없습니다.** 즉 ⑤까지 끝냈다고 바로
앱에서 새 모델이 동작하는 게 아니라, 아래 세 가지가 **별도로 더 필요**합니다.

1. **한글 병명 → 영문(name_en) 매핑표** (예: 정상→healthy, 역병→blight 등) — 지금
   `export_meta.json`에는 한글 클래스명만 있습니다.
2. **크롭 + 재분류 서빙 코드** — YOLO가 준 박스마다 `export_meta.json`의 margin(0.15)·
   img_size·mean/std 그대로 크롭·전처리한 뒤 분류기에 넣어 병명/신뢰도를 얻는 코드.
3. **응답 조립 코드** — 위 결과로 각 detection의 `name`/`name_en`/`confidence`만 바꾸고
   `box`/`severity`/`count`는 1단계 YOLO 값을 그대로 유지해 기존 `DiagnosisResult` 스키마
   (`app/diagnose/result/lib.ts`)를 채우는 코드.

이 세 가지는 개발자(코딩 담당)에게 넘겨야 하는 작업입니다. ⑤까지의 결과물(`classifier_ts.pt`
또는 `classifier.onnx`, `export_meta.json`, 그리고 위 1번 매핑표)을 함께 전달하면 됩니다.

---

## 전체 흐름 한눈에 보기

```
C:\dg\dataset (6.67GB, 완료)
   │  ① python crop_dataset.py --src C:\dg\dataset --out C:\dg\crops   [로컬/윈도우, 5~15분]
   ▼
C:\dg\crops (실측 39,889장, crops.zip 828MB)
   │  ② zip 압축 → Google Drive 업로드                                  [828MB 기준 30Mbps로 약 3.5~4분,
   │                                                                       회선에 따라 다름]
   ▼
Google Drive 의 crops.zip
   │  ③ Colab에서 압축 해제 → train_classifier.py                       [GPU, L4 약 2.5~4.5시간 /
   │     (train 32,155장 기준 권장 설정, 세션 끊기면 --resume)              T4 약 3.4~8.4시간, 조기종료로
   │                                                                       더 짧게 끝나는 경우가 많음]
   ▼
best.pt (+ last.pt, results.csv, classes.json)
   │  ④ eval_classifier.py                                              [test 3,408장 기준 약 3~10분]
   ▼
평가 리포트 5종 (summary.json 등)  ── 결과 확인 후 문제없으면 다음 단계
   │  ⑤ export_classifier.py                                           [1~3분]
   ▼
classifier_ts.pt / classifier.onnx / export_meta.json
   │  ⑥ (별도 개발 작업) 서빙 통합 코드 — 아직 미구현
   ▼
앱에 새 분류기 반영
```
