# 2026-08-31 — 유어샵 검색창 임계값 · 이미지 폴백 배선 · 셀러 버튼 잔여 5건

대표 지시: **"모두 진행"** (직전 배치 #1263 배포·판정 보고 뒤 남겨 둔 두 후보를 둘 다 하라).

## 다음 세션의 첫 액션

배포됐는지부터 확인한다(청크를 **직접** 받아서 — 홈 프리로드만 훑으면 lazy 청크를 못 본다,
#1256 에서 그렇게 한 번 오판했다):

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
# 유어샵 청크에 임계값 상수가 실렸는가 (배포 전엔 없음)
curl -sS -A "$UA" https://urdeal.kr/u/me | grep -o '/assets/[^"]*\.js' | sort -u | while read -r c; do
  curl -sS -A "$UA" "https://urdeal.kr$c" | grep -l 'SEARCH_MIN_PINS\|>=12' >/dev/null && echo "found $c"; done
# 이미지 폴백이 실렸는가 — cfImageOnError 호출이 소비자 청크에 있어야 한다
curl -sS -A "$UA" https://urdeal.kr/ | grep -o '/assets/index-[^"]*\.js' | head -1
```
⚠️ 번들은 압축·리네임되므로 **상수 이름으로는 못 찾는다.** 실제 판정은 화면으로 한다:
**핀이 4개인 유어샵(`/u/{handle}`)에 검색창이 안 보이면 통과.** 라이브 실측상 진열대 3곳
전부 핀 ≤4 라 **모든 유어샵에서 사라져야 정상**이다.

## 완료분

| 무엇 | 어디 |
|---|---|
| 유어샵 검색창 = 핀 12개 이상일 때만 | `src/pages/CuratorPage.tsx` `SEARCH_MIN_PINS` |
| cfImage `<img>` 29곳에 `onError` 배선 | 23파일 (코드모드 `scripts/codemods/adopt-image-fallback.mjs`) |
| 이미지 폴백 래칫 (95번째 불변식) | `scripts/check-image-fallback.mjs` + baseline 18 |
| 셀러 원시 주 버튼 잔여 5건 → 체계 | Bundles·Influencers·Inventory·NotifyFollowers·Supply |
| 버튼 래칫 baseline 13 → **0** | `scripts/dashboard-button-baseline.json` |
| 감싸는 태그 판정 SSOT 분리 | `scripts/lib/jsx-enclosing-tag.mjs` (가드·코드모드 공유) |
| 주입 매니페스트 +3 | `check-guard-mutations` (601건) |

## 🩸 이번에 틀렸던 판단 — **여기가 제일 값지다**

### ① 되돌려-검증에서 가드가 **초록불로 통과했다** (가드 자체가 헛돌고 있었다)
버튼 래칫에 위반을 일부러 주입했는데 초록이 떴다. 원인:

```jsx
<button onClick={handleSubmit} disabled={submitting || form.items.length < 2}
  className="w-full py-3 bg-gray-900 text-white rounded-xl">
```
감싸는 태그를 찾는 `lastIndexOf('<')` 가 **`< 2` 의 비교 연산자**를 태그 시작으로 집었고,
이름 매칭이 실패하자 `continue` 로 **"버튼 아님"** 처리됐다. 즉 래칫이 통째로 헛돌았다.
같은 로직이 코드모드(`adopt-button-system`)에도 있었으므로 **#1263 의 67건 변환에서도 일부를
조용히 건너뛰었을 수 있다**(재실행 결과는 0건이라 지금은 남은 게 없다).
⇒ 판정을 `scripts/lib/jsx-enclosing-tag.mjs` 로 분리하고, 그 함정(비교 연산자가 바로 위에 있는 버튼)을
**주입 지점으로 고정**했다.

### ② baseline 0 래칫은 매칭이 죽어도 초록이다 → 합성 대조를 박았다
처음엔 양성 대조를 "`ur-btn-primary` 사용처 ≥10" 으로 뒀는데, 그건 **체계가 사라진 것**만 잡지
**매칭이 죽은 것**은 못 잡는다. 이제 매 실행마다 `FIXTURE_BAD`(일부러 위반) / `FIXTURE_OK`(배지+체계 버튼)를
같은 판정에 통과시켜, 잡아야 할 걸 잡고 잡지 말아야 할 걸 안 잡는지 확인한다.

### ③ 래칫이 세던 13건 중 **8건은 버튼이 아니었다**
단계 번호 배지 · 사진 위 오버레이 배지 · 개수 칩 · `bg-gray-800` 카드 패널.
"어두운 배경 + 흰 글자" 는 버튼만의 특징이 아니다. 그걸 세는 동안 이 래칫은 "버튼 체계"가 아니라
**"어두운 무언가"** 를 세고 있었고, 다음 세션은 정상 배지를 추가했다가 빨간불을 보고
`dashboard-button-ok` 주석을 다는 소음 경로로 밀려났을 것이다.

### ④ `git checkout -- src/pages/ src/components/` 로 **커밋 안 한 작업을 통째로 날렸다**
되돌려-검증 뒤 복원한다고 디렉토리 단위로 checkout 했다. 그 순간 CuratorPage 수정 · 이미지 폴백 29곳 ·
버튼 전환 6건이 전부 사라졌다(스크립트는 untracked 라 살아남아 재실행으로 복구).
⇒ **되돌려-검증의 복원은 `cp` 로 그 파일만.** 디렉토리 checkout 은 절대 금지.

### ⑤ "프로필 사진 폴백" 은 내가 잘못 적어 둔 항목이었다
직전 세션이 남긴 후보였는데, 실제로 보니 **배너는 이미 2단 폴백 + 띠 축소가 구현돼 있었고**
(2026-08-30 작업), `profile_image` 는 유어샵 화면에 **렌더 자체가 안 된다**(SEO/OG 용).
진짜 노출은 다른 데 있었다 — cfImage `<img>` 절반에 `onError` 가 없다는 것. 그래서 항목을
그쪽으로 바꿔 잡았다. **후보 목록을 그대로 믿지 말고 코드에서 다시 확인할 것.**

## 남은 결정 / 대기

- **도매·어드민·몰의 무방비 `<img>` 18곳** — 서비스 분리 때문에 이 배치에서 안 건드렸다.
  래칫 baseline 이 18 이라 늘지는 않는다. 도매 작업 세션에서 `--all` 로 코드모드 돌리면 된다.
- **`SEARCH_MIN_PINS = 12` 는 측정 기반 추정치다.** 진열대가 커지면 실제로 12에서 답답한지
  대표 확인이 필요하다(지금은 12 이상인 유어샵이 하나도 없어 검증 불가).
- **셀러 대시보드 "이 화면이 세련됐나"** 는 기계가 판단 못 한다 — 버튼·배치는 체계로 잠갔지만
  화면별 완성도는 페이지를 지목받아야 진행 가능.
