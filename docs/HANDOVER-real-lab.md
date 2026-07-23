# 인수인계 보고서 — 실물 실습(real-lab) 전환

- 작성일: 2026-07-23
- 대상 독자: 이 프로젝트를 처음 보는 AI 에이전트/개발자 (이 문서 하나로 작업을 이어받을 수 있어야 함)
- 프로젝트 소유자: 이주원 (GitHub `henna2022`)

---

## 1. 프로젝트 지형도 — 저장소 3개

| 저장소 | 경로 | 역할 | git 상태 |
|---|---|---|---|
| **doctor_green** | `/Users/henna/Desktop/doctor_green` | 본 서비스(실제 스마트팜 앱, Next.js 16) + `docs/`(교안 docx·슬라이드 pptx·활동지 PDF) + `training/`(AI Hub 딸기 YOLO 학습 파이프라인) | git repo, 현재 브랜치 `training/aihub-data-prep`(clean), 원격 `henna2022/doctor-green` |
| **doctor-green-edu** | `/Users/henna/Desktop/doctor-green-edu` | 수업용 실습실 웹앱 (본 서비스와 의도적으로 분리된 독립 프로젝트). Vercel 배포: https://doctor-green-edu.vercel.app | git repo(비공개 `henna2022/doctor-green-edu`), 현재 브랜치 **`real-lab`**. ⚠️ 워킹트리에 **다른 에이전트가 팬·펌프 통합 작업 진행 중**(미커밋 5파일+신규 1파일, §6-2 참고) |
| **hexa-smart-farm** | `/Users/henna/Desktop/hexa-smart-farm` | ESP32 간이 스마트팜 키트 펌웨어 (PlatformIO). 보드 17대(esp32-00~16) 프로비저닝 | ⚠️ **git 저장소가 아님** (`git status` → not a repository). 펌웨어·진단 도구·프로비저닝 문서가 버전 관리 밖에 있으므로 **`git init` + 원격 생성 권장** (`.gitignore`는 이미 있음: `.pio/`, `include/config.h`, `include/config_edu.h`) |

**수업 정보**: 서울로봇인공지능과학관, 고등학생 15명, 120분 1차시, **2026년 7월 말 예정**(ADR 기준 마감 ~7/25). 학생 1인 1보드(방 번호 N ↔ `esp32-NN`), 예비 1대.

데이터 흐름: **ESP32 보드 → (WiFi) → 교육용 Supabase REST 직접 POST/폴링 ← 실습실 웹앱(PostgREST 2초 폴링)**. 중간 서버 없음. 펌웨어: `hexa-smart-farm/src/main.cpp`, 앱 클라이언트: `doctor-green-edu/lib/eduSupabase.ts`.

---

## 2. 2026-07-22~23 대전환: 가상 실습실 → 실물 전환 (사용자 확정)

원래 실습실은 "완전 가상"(브라우저 시뮬레이션)이었으나, 사용자의 원 의도는 "API만 시뮬레이션, 나머지는 실물"이었음이 확인되어 2026-07-22에 실물 전환을 확정했다. **가상 모드는 폴백(수업 안전망)으로 유지**된다.

### STEP별 현재 상태 (`doctor-green-edu/app/control/`)

| 단계 | 내용 | 상태 |
|---|---|---|
| STEP 1 `weather/` | **실제 기상청 초단기실황 API** — 서버 보관 키 `KMA_SERVICE_KEY` 사용, 학생 키 입력은 잠금 해제 연출. 실패 시 체험 모드(가상 날씨) 폴백. 프록시: `app/api/kma/`, `app/api/geocode/` | 완료·배포됨 |
| STEP 2 `yolo/` | **TFjs 앱 내 실제 전이학습** — MobileNet v2(α0.5, ~2.8MB) `public/models/` 셀프호스팅(외부 네트워크 0) → dense64 헤드 `model.fit()`. 견본 `public/train-samples/`(healthy/diseased + manifest.json). 학습 헤드는 방별 IndexedDB 저장. 공용 로직: `lib/trainer.ts` | 완료·배포됨 |
| STEP 3 `sensor/` | **실물 센서 이중모드** — env 2종이 있으면 실물 프로브(최근 60초 내 측정값 → 실물 모드), 없거나 실패 시 가상 시뮬레이션 폴백. LED 원격제어(`devices.led_on`) 배포됨. **팬·펌프는 미커밋 진행 중**(§6-2) | LED까지 배포, 팬·펌프 진행 중 |
| STEP 4 `camera/` | **NC-150 USB 웹캠** getUserMedia 실카메라 + STEP 2에서 학생이 학습한 자기 모델로 판정. 웹캠 실패 시 가상 폴백 | 완료·배포됨 |
| 캡스톤 `app/` | 자동화 규칙("~이면 → ~한다") — LED 규칙은 실물 보드 연동(10초 평가). **팬·펌프 규칙 연동은 미커밋 진행 중**(펌프 60초 쿨다운 안전장치 포함) | LED까지 배포, 팬·펌프 진행 중 |

### real-lab 브랜치 커밋 3개 (모두 origin 미푸시, main 미병합)

- `af9a7de` feat: 실물 대전환 1차 — TFjs 실학습·실물 센서·웹캠·캡스톤 LED 연동
- `2405cdf` chore: 표기 정리 — "헥사보드" → "간이 스마트팜 보드"
- `174d363` test: e2e 실물 모드 견고화 — 보드 live여도 결정적 통과 (`e2e/helpers.ts`)

### 배포·테스트 상태

- **프로덕션 배포 완료**(2026-07-23, 사용자 승인 후 `vercel --prod`): `174d363` 시점 코드. 즉 **프로덕션은 LED까지만 실물 제어 가능, 팬·펌프는 아직 없음**.
- e2e 스모크 **9종**(`e2e/smoke.spec.ts` — 허브/STEP1/STEP2/STEP3/STEP4/STEP4폴백(5b)/캡스톤/퀴즈/초기화) 로컬·프로덕션 9/9 통과. a11y **8종**(`e2e/a11y.spec.ts`, axe serious 0건 유지). 실행: `npm run test:e2e` / `test:e2e:prod` / `test:a11y` / `preflight`(수업 전 원커맨드, `scripts/preflight.sh`).
- 실기기 종단 리허설 성공(2026-07-23, 과학관 현장): 실보드(esp32-01) 실측값이 2초 주기로 Supabase → 프로덕션 STEP 3 실물 모드에 표시, 원격 `led_on=true` → 실물 LED 점등, LCD 정상(사용자 육안 확인).

---

## 3. 인프라

### 교육용 Supabase (본 서비스 Supabase와 **완전 별개**, 수업 전용 일회성)

- URL: `https://abqdshwwfyiodplvehli.supabase.co`
- anon 키 위치(⚠️ 문서·커밋에 원문 금지): `doctor-green-edu/.env.local`(`NEXT_PUBLIC_EDU_SUPABASE_URL` / `NEXT_PUBLIC_EDU_SUPABASE_ANON_KEY`), `hexa-smart-farm/include/config_edu.h`(`SUPABASE_URL` / `SUPABASE_API_KEY`, gitignore 대상). **수업 후 프로젝트·키 폐기 전제.**
- 스키마: `doctor-green-edu/supabase/schema.sql` (신규 프로젝트용 완전판; 워킹트리 버전은 migration-002까지 반영된 상태로 수정돼 있음 — 미커밋)
  - `sensor_readings`(device_id/temp/hum/soil/created_at, 보드가 2초마다 INSERT) — RLS: anon INSERT+SELECT만
  - `devices`(id/led_on/fan_on/pump_on/updated_at, 시드 esp32-00~16) — RLS: anon SELECT+UPDATE, grant는 `led_on, fan_on, pump_on` 컬럼만
- **⚠️ 미실행 마이그레이션**: `doctor-green-edu/supabase/migration-002-actuators.sql`(신규 파일, 미커밋) — `devices.pump_on` 컬럼 추가 + UPDATE grant에 pump_on 포함 + `esp32-00`(교사 테스트 보드) 시드. **사용자가 Supabase 대시보드 → SQL Editor에서 직접 실행해야 함**(멱등, 여러 번 실행 안전). 실행 전에는 앱이 레거시 컬럼 폴백으로 동작하고(`lib/eduSupabase.ts`의 `pumpColumnMissing`), 펌웨어도 `led_on,fan_on` 폴백 후 ~1분마다 재시도한다 — 죽지는 않지만 급수가 안 됨.
- **무료 티어 주의**: Supabase 무료 플랜은 **1주 미사용 시 프로젝트 자동 일시정지**. 수업 당일 첫 요청이 실패할 수 있으니 수업 며칠 전·전날 대시보드에서 활성 상태 확인 필수. (이 리스크 때문에 교사 모니터링 B안은 Firebase RTDB로 결정된 이력 — `doctor-green-edu/docs/ADR-001-교사-모니터링.md`)

### Vercel (doctor-green-edu 프로젝트)

- production 환경변수: `NEXT_PUBLIC_EDU_SUPABASE_URL`, `NEXT_PUBLIC_EDU_SUPABASE_ANON_KEY`(실물 모드 스위치 2종) + `KMA_SERVICE_KEY`(STEP 1 기상청 키).
- **⚠️ `NEXT_PUBLIC_*`은 빌드 타임에 번들로 인라인**된다(`lib/eduSupabase.ts` 상단 주석). env 값을 바꾸면 **반드시 재배포**해야 반영됨.

---

## 4. 하드웨어 확정 사실 (실측 2026-07-23)

현역 하드웨어는 **간이 스마트팜 키트 16+1대**. 원조 헥사보드는 **레거시(완전 미사용, 사용자 확정)** — 배선이 다르므로 혼용 금지(`platformio.ini`의 `esp32dev` env + `include/config.h`는 이력 보존용). 근거 문서: `hexa-smart-farm/docs/wiring.md`, `docs/edu-provisioning.md`, 실값: `include/config_edu.h`.

### 핀맵 (config_edu.h 기준, pindiag/actdiag 실측)

| 신호 | GPIO | 비고 |
|---|---|---|
| DHT11 DATA | **25** | 레거시 헥사보드는 33 — 다름! |
| 토양수분 AOUT | **34** (ADC1) | 레거시는 32. 보정: `SOIL_RAW_DRY=2530` / `SOIL_RAW_WET=950` (1호기 공기 중·물컵 침지 실측; 기본값 3200/1300 아님) |
| 네오픽셀 LED DIN | 4 | 30개(`LED_COUNT`), 레거시와 동일 |
| 추가 LED 조명 | 18 (`LED2_PIN`) | HIGH-active, `led_on`으로 네오픽셀과 동시 on/off |
| 환기팬 | 19 (`FAN_PIN`) | HIGH-active, `fan_on` 연속 토글 |
| 워터펌프 | 23 (`PUMP_PIN`) | HIGH-active. **1회 급수 규약**: `pump_on=true` 감지 → 4초(`PUMP_RUN_MS`) 급수 → 보드가 **스스로 Supabase에 `pump_on=false` PATCH**(침수 방지). 급수 중 센서 전송 1회 결손 허용 |
| LCD I2C SDA/SCL | 21 / 22 | 1602, 주소 0x27 |

### 디바이스·플래시

- `esp32-00` = 교사 테스트 보드(**현재 플래시된 보드**), `esp32-01`~`16` = 학생용(방 번호 1:1). **01만 실기기 검증 완료, 02~16은 미플래시** → `cd /Users/henna/Desktop/hexa-smart-farm && ./scripts/flash_edu.sh 2 16` (1대씩 꽂으며 진행; 업로드 직후 LCD에 `esp32-NN` 5초 표시 → 그때 스티커 라벨링, 나중엔 구분 불가).
- WiFi: `ROBOT-SCIENCE`(과학관) — `config_edu.h`에 하드코딩(gitignore). 2.4GHz만 지원, 캡티브 포털 불가.
- 빌드: `default_envs = edu01`(`platformio.ini`) — env 미지정 `pio run`도 edu 빌드. CP2102(USB 허브 경유, `/dev/cu.usbserial-0001`) 기준 **첫 플래시 대당 ~5.5분 / 증분 ~20초** (16대 전체 ≈ 1.5시간, 여유 확보 필수).
- 진단 도구(15대 검수에 재사용): `pio run -e pindiag -t upload`(`src/pindiag/` — DHT 핀 스캔 + ADC1 6핀 1초 주기 스캔), `pio run -e actdiag -t upload`(`src/actdiag/` — 팬·펌프 GPIO 스윕, LCD에 후보 핀 표시).
- **시리얼 판독 주의**: pyserial로 모니터링 시 `dtr=False, rts=False`로 열어야 함 — 기본값이면 DTR/RTS가 보드를 리셋 홀드 상태로 잡는다. 반대로 RTS 펄스를 주면 원격 리부팅 가능. (저장소에 미문서화 — hexa-smart-farm 문서에 추가할 가치 있음)

---

## 5. 작업 규칙 (사용자 지시 — 위반 금지)

1. **오케스트레이션 원칙**: 메인 모델(대화 담당 에이전트)은 코드를 직접 짜거나 검증하지 않는다. 설계·비판적 검토 역할만 하고, 구현·검증은 하위 에이전트에 위임한다.
2. **프로덕션 배포(`vercel --prod`)는 사용자 승인 필요.** 임의 배포 금지.
3. doctor-green-edu의 `lib/sim.ts`와 `app/control/shared.tsx`는 여러 STEP 화면이 공유하는 코어 — **병렬 에이전트 작업 충돌의 단골 지점**이므로 수정 시 다른 작업과 겹치지 않는지 확인.
4. **본 서비스(doctor_green) Supabase·API 키 회전이 백로그 최우선**(2026-07-07 감사, NCPMS·팜맵 키가 GitHub에 커밋된 이력) — 교육용 Supabase와는 별개 건이며, 사용자가 직접 재발급해야 하는 사람-작업.

---

## 6. 미완료 작업 (우선순위순)

1. **migration-002 실행**(사용자 — Supabase SQL Editor에서 `doctor-green-edu/supabase/migration-002-actuators.sql` 실행) → 직후 esp32-00 보드로 **팬·펌프·LED 실물 원격 테스트**(펌프는 호스를 물통에! `pump_on`이 4초 뒤 자동 false 복귀 확인).
2. **앱 팬·펌프 통합 완료·커밋·배포** — 현재 다른 에이전트가 진행 중인 미커밋 변경: `lib/eduSupabase.ts`(`setDeviceFan`/`startDevicePump`/`pumpColumnAvailable` + 레거시 폴백), `app/control/sensor/page.tsx`(팬 토글·펌프 1회 급수 UI), `app/control/app/page.tsx`(캡스톤 규칙→led/fan/pump 분류, 펌프 60초 쿨다운), `e2e/smoke.spec.ts`(가상 모드에 실물 버튼 미노출 등 검증 추가), `supabase/schema.sql`(완전판 갱신), 신규 `supabase/migration-002-actuators.sql`. **완료 여부 확인 후** lint·build·e2e 통과 → 커밋 → (사용자 승인 후) 배포.
3. **15대 플래시 + 라벨링**: `./scripts/flash_edu.sh 2 16` (§4). 핀·보정값은 1호기 실측 기준 로트 동일 가정 — 이상 보드는 pindiag로 개별 확인.
4. **NC-150 단독(학생 PC 없는 자리) 스트리밍**: ESP32에 USB 웹캠 직결은 불가로 결론 — **라즈베리파이 수배 중**(사용자). 현재 STEP 4는 학생 PC에 NC-150을 꽂는 구성으로 동작하므로 수업 블로커는 아님. (이 항목은 세션 결정 사항으로 저장소 문서에는 아직 없음)
5. **교안·슬라이드·활동지 전면 개편** — `doctor_green/docs/닥터그린_수업_가이드라인.docx`·`닥터그린_수업_슬라이드.pptx`·활동지 PDF가 아직 **가상 실습 기준**. 실물 전환(120분 재배분: 보드 배부·실측·급수 시연 등) 반영 필요. 개편 후 인쇄용 PDF 재추출.
6. **real-lab → main 병합·push** (edu 저장소; CI가 push마다 lint·build·e2e 실행).
7. **수업 직전**: Supabase SQL Editor에서 `truncate sensor_readings;` + `update public.devices set led_on=false, fan_on=false, pump_on=false;`(schema.sql 6절 주석 참고) → `npm run preflight`.
8. (별개 트랙) hexa-smart-farm `git init`, 본 서비스 키 회전(§5-4), doctor_green `training/aihub-data-prep` 브랜치의 YOLO 학습 작업.

---

## 7. 함정 목록 (다음 에이전트가 밟기 쉬운 것)

- **e2e를 "고치지" 말 것**: 실물 보드가 live면 STEP 3이 실물 모드로 열리는데, `e2e/helpers.ts`의 `openVirtualSensorLab`이 "가상 모드로 전환" 버튼으로 빠져나와 결정적으로 통과하게 견고화돼 있다(커밋 174d363). 테스트에 **센서 절대값 검증을 넣지 말 것** — 기준점 대비(개수 증가 등)로만 검증하는 패턴 유지.
- **프로덕션 env는 빌드 타임 인라인**(`NEXT_PUBLIC_*`) — Vercel env 변경만으로는 반영 안 됨, 재배포 필수.
- **ADR·커밋 메시지에 본 서비스 키 유출을 언급하지 말 것** — GitHub push protection이 차단했던 이력 있음(`docs/ADR-001` 관련 메모리). 키 회전 건은 문서에 "키 회전"으로만 지칭.
- **`config_edu.example.h`가 낡음**: 예제 파일은 아직 레거시 핀(DHT=33, SOIL=32, 보정 3200/1300)을 담고 있다. `config_edu.h`를 잃어버리고 예제에서 재생성하면 **틀린 핀으로 16대를 플래시하게 됨**. 진짜 값은 §4 표(현 `config_edu.h`)와 `docs/wiring.md`.
- **교육용 anon 키는 수업 후 폐기 전제** — 공개 노출에 과민할 필요는 없지만, 문서·커밋에 원문을 남기지 말고 위치만 가리킬 것(§3).
- **ADC 주의**: WiFi 사용 중 ESP32 ADC2 핀은 못 읽는다 — 토양수분 추가 센서는 ADC1(32/33/35/36/39)만.
- doctor-green-edu는 **Next.js 16** — 학습 데이터와 API가 다를 수 있음. doctor_green 쪽 `AGENTS.md` 규칙(코드 작성 전 `node_modules/next/dist/docs/` 확인)을 edu에도 준용할 것.

---

## 8. 처음 온 에이전트가 5분 안에 할 일

- [ ] `cd /Users/henna/Desktop/doctor-green-edu && git status && git log --oneline -5` — real-lab 브랜치인지, §6-2의 미커밋 변경이 아직 있는지(다른 에이전트 작업 완료/중단 여부) 확인
- [ ] `git diff --stat` 결과를 §6-2 목록과 대조 — 달라졌으면 이 문서보다 워킹트리가 진실
- [ ] 교육용 Supabase 대시보드에서 프로젝트 **일시정지 여부** 확인 + `devices` 테이블에 `pump_on` 컬럼 존재 여부 확인(없으면 §6-1이 여전히 최우선)
- [ ] https://doctor-green-edu.vercel.app/control/sensor 접속 — 실물 프로브 동작 확인(보드 꺼져 있으면 가상 폴백이 정상)
- [ ] `npm run test:e2e` (로컬 9종, ~30초) — 기준선 green 확인
- [ ] §5 작업 규칙 4개 숙지 (특히: 직접 코딩 금지·배포는 사용자 승인)
- [ ] 사용자에게 확인할 것: ① migration-002 실행했는지 ② 팬·펌프 통합 에이전트 작업 상태 ③ 라즈베리파이 수배 진행 상황 ④ 수업 확정 날짜
