# 닥터 그린 — 화면 구성도 플로우 (포트폴리오 자산)

블루·화이트 톤 서비스 화면 흐름도. 한국어(ko) / 영어(en), 라이트 / 다크 / 자동 전환 제공.

## 파일

| 파일 | 설명 |
|---|---|
| `doctor-green-flow-{ko,en}-light.png` | 라이트 모드 · **투명 배경** · 2040×2004 (3x) — 밝은 배경 위에 |
| `doctor-green-flow-{ko,en}-dark.png` | 다크 모드 · **투명 배경** · 2040×2004 (3x) — 어두운 배경 위에 |
| `doctor-green-flow-{ko,en}-auto.svg` | **한 파일이 OS 테마 따라 라이트↔다크 자동 전환** (`prefers-color-scheme`) |
| `doctor-green-flow-{ko,en}-{light,dark}.svg` | 편집용 정적 벡터 소스 |

## 자동 전환 SVG 사용법

`<img>`로 넣기만 하면 됩니다. 브라우저가 OS(또는 상위 페이지)의 라이트/다크 설정을 SVG 내부 `@media (prefers-color-scheme)`에 그대로 전달합니다.

```html
<img src="doctor-green-flow-en-auto.svg" alt="Doctor Green screen flow" width="760">
```

- Chrome / Firefox / Safari 최신 버전에서 동작 확인.
- 배경은 투명이므로 라이트 페이지엔 밝게, 다크 페이지엔 어둡게 자연스럽게 얹힙니다.

## 참고

- PNG는 래스터라 자동 전환이 안 됩니다 → 밝은/어두운 배경별로 각각의 PNG를 쓰세요.
- 색을 바꾸려면 `*-light.svg` / `*-dark.svg`의 `<style>` 팔레트만 수정 후 `rsvg-convert -z 3` 로 재변환.

## 교육 프로그램(가상 실습실) 화면 구성도

스마트팜 교육 프로그램(닥터그린 스마트팜 가상 실습실)의 실습 흐름도. 서비스 플로우와 **동일한 블루·화이트 디자인 시스템**을 재사용.

| 파일 | 설명 |
|---|---|
| `doctorgreen-edu-flow-{ko,en}-{light,dark}.svg` | 정적 벡터 (사이트 임베드용 · 테마×언어 4조합) |
| `doctorgreen-edu-flow-{ko,en}-auto.svg` | **한 파일이 OS 테마 따라 라이트↔다크 자동 전환** (`prefers-color-scheme`) |
| `doctorgreen-edu-flow-{ko,en}-{light,dark}.png` | 투명 배경 래스터 @3x |
| `gen_edu_flow.py` | 위 SVG 6종 생성 스크립트 (좌표·팔레트·문구 한곳에서 관리) |

- 흐름: 실습실 접속 → 방 선택 허브(1~15) → 4개 STEP(공공데이터 날씨·AI 비전·IoT 센서·카메라 라이브) → 가상 Supabase 적재(`weather_cache`·`diagnoses`·`sensor_readings`·`camera_frames`) → 내 앱 완성 → (선택) 실물 디바이스 시연.
- 문구·좌표 수정은 `gen_edu_flow.py`만 고쳐 재실행하면 6종이 일관되게 재생성됨.
- 포트폴리오(`portfolio_v2`) `p-smartfarmedu` 카드의 "화면 구성도"에 정적 4종을 임베드(사이트 자체 테마·언어 토글에 맞춰 CSS로 전환).
