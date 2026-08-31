# 2026-08-31 (2차) — 이미지 폴백 전 표면 배선 · 검색창 경계 실증

대표 지시: **"다음 꺼 모두 순차적으로 진행"** (직전 배치 #1275 판정 뒤 남긴 세 후보를 순서대로).

## 다음 세션의 첫 액션

배포 확인은 **`ur-btn-secondary` 처럼 이 PR 로만 생기는 문자열이 없다** — 도매/어드민/몰의 페이지 청크가
폴백 헬퍼를 import 하는지로 본다(소비자 청크는 #1275 에서 이미 한다):

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
# app-utils 에서 cfImageOnError 의 압축 export 별칭을 먼저 찾는다 (지난번엔 `ke as E` 였다)
curl -sS -A "$UA" https://urdeal.kr/assets/app-utils-*.js | grep -o '\w\+ as [A-Za-z_$]*'
# 그 별칭을 도매 청크가 import 하는지
curl -sS -A "$UA" https://urdeal.kr/wholesale | grep -o '/assets/Wholesale[A-Za-z0-9._-]*\.js'
```
⚠️ **`cfFallback` 문자열로 판정하지 말 것** — 그 헬퍼는 원래도 딜 카드가 써서 **배포 전후가 같다**.
지난 판정에서 이 함정을 만났고, export 별칭 추적으로 바꿔서야 구분됐다.

## 완료분

| 무엇 | 어디 |
|---|---|
| 도매·어드민·몰 무방비 `<img>` 18곳 배선 | 11파일 (코드모드 `--all`) |
| 이미지 폴백 래칫 baseline 18 → **0** | `scripts/image-fallback-baseline.json` |
| 그 래칫에 합성 대조(FIXTURE_BAD/OK) | `scripts/check-image-fallback.mjs` |
| 주입 매니페스트 +1 (매칭 무력화) | `check-guard-mutations` |
| 미리보기 하네스 `--pins=N` | `scripts/visual-preview.mjs` |

## 🩸 이번에 배운 것

### ① baseline 0 래칫은 **둘 다** 있어야 한다 — 합성 대조 없이는 죽어도 초록
버튼 래칫에서 겪은 것과 같은 구조라, 이미지 래칫도 baseline 을 0 으로 내리면서 **같은 자리에**
`FIXTURE_BAD`(일부러 무방비) / `FIXTURE_OK`(배선됨 + cfImage 밖 `<img>`)를 넣었다.
되돌려-검증 2종 전부 빨간불 확인(무방비 주입 · 매칭 무력화).

### ② 경계는 눈으로 봐야 한다 — 라이브에 그 경계가 없으면 하네스로 만든다
`SEARCH_MIN_PINS = 12` 는 라이브에 12개짜리 진열대가 **하나도 없어**(최다 4개) 실물 확인이 불가능했다.
그래서 미리보기 하네스에 `--pins=N` 을 넣고 11 / 12 를 각각 렌더해 **11=검색창 없음 · 12=나타남**을 확인했다.
"측정할 수 없으니 넘어간다" 가 아니라 **측정 가능한 자리를 만든다**.

### ③ 크로스-레일이라 먼저 보고했다
도매·어드민·몰을 건드리므로 CLAUDE.md 룰 4 대로 세 줄(어느 레일 / 머니 경로 없음 / 롤백)을 먼저 보고하고 진행.

## 남은 결정 / 대기

- **`SEARCH_MIN_PINS = 12` 의 체감** — 경계 동작은 확증했지만 "12가 적절한 숫자인가"는 실제 진열대가
  커져 봐야 안다. 지금은 대상이 0곳이라 판단 불가.
- **화면별 완성도** — 버튼·배치·폴백은 체계로 잠갔지만 "이 화면이 세련됐나"는 기계가 판단 못 한다.
  다음 항목으로 착수(별도 PR — 시안 먼저).
