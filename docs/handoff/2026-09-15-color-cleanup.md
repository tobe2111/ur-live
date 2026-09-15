# 소비자 화면 색 정리 — 표면 토큰 채택 + 재발 차단 래칫 (2026-09-15)

## 대표 지시
> *"색 정리도 진행해줘."* (앞선 흐름: *"이용권페이지가 너무 AI로 만든 것 같아"*)

## 1) 실측 — 정한 색보다 안 정한 색이 훨씬 많았다

소비자 화면(`src/{pages,components,features,shared}`, 대시보드 제외) **806파일**:

```
hex 색 등장   2,875회 / 304종
선언된 토큰      65개  (src/index.css)
```

그리고 그 2,875회 중 **1,927회(67%)는 토큰과 값이 같은데 hex 로 다시 적은 것**이었다:

| hex | 회 | 정체 |
|---|---|---|
| `#2C2F35` | 682 | `--line` 다크 |
| `#1D1F29` | 604 | `--surface` 다크 |
| `#11141C` | 490 | `--bg` 다크 |

**왜 이렇게 됐나**: `tailwind.config.js` 의 `surface`/`line`/`warm` 이 **고정 hex** 였다.
그래서 `bg-surface` 는 다크에서도 흰색이고, 화면마다 `dark:bg-[#1D1F29]` 를 손으로 적어야 했다.
같은 값을 1,776번 재입력한 셈이고, 화면마다 조금씩 갈리던 "AI 같다"의 정체가 이것이다.

## 2) 한 일

### ① 토큰을 테마 변수로
`surface: 'var(--surface)'` · `line: 'var(--line)'` · `warm: 'var(--bg)'`
→ `bg-surface` 한 클래스가 두 테마를 다 덮는다.

### ② 값이 한 글자도 안 바뀌는 짝만 접었다 (431곳 / 166파일)
`scripts/codemods/adopt-surface-tokens.mjs`

| 접기 전 | 접은 뒤 | 근거 |
|---|---|---|
| `bg-white` + `dark:bg-[#1D1F29]` | `bg-surface` | `--surface` = #FFFFFF / #1D1F29 |
| `border-gray-200` + `dark:border-[#2C2F35]` | `border-line` | `--line` = #EAE4E0(=INK.200) / #2C2F35 |
| `bg-gray-50`·`bg-[#F8F7FC]` + `dark:bg-[#11141C]` | `bg-warm` | `--bg` = #F8F7FC(=INK.50) / #11141C |

→ **2,875 → 2,400회**. 렌더 결과는 라이트·다크 모두 종전과 동일하다(값이 같으므로).

### ③ 래칫 — 늘어나지 못하게
`scripts/check-consumer-hex-ratchet.mjs` + `scripts/consumer-hex-baseline.json`(280파일 / 2,400회).
줄이는 건 자유, 늘리는 건 차단. verify.yml + audit-gate 등록(불변식 111).

## 3) 🔴 이 변경이 터뜨릴 뻔한 것 — 셀러 대시보드가 다크에서 검게

대시보드는 **화이트 고정**이다(CLAUDE.md "🚨 절대 규칙"). `html.dark` 에서도 흰색이어야 하므로
`index.css` 의 라이트 고정 스코프가 테마 변수를 라이트 값으로 되박는다. 그 목록이 이랬다:

```css
.light-island, .force-light-theme, .admin-light-theme, .agency-light-theme {   /* ← seller 없음 */
```

**`.seller-light-theme` 만 빠져 있었다.** 토큰이 고정 hex 이던 동안엔 변수를 안 읽어 안 터졌고,
변수로 돌리는 순간 셀러 대시보드 배경이 `--bg`(#11141C)를 읽는다. 같은 커밋에서 목록에 넣었다.

**렌더로 확인**(`html.dark` + 각 래퍼, 실제 브라우저 computed style):

```
seller/admin/force/island →  배경 rgb(248,247,252) · 카드 rgb(255,255,255) · 테두리 rgb(234,228,224)   ← 라이트 유지
consumer                  →  배경 rgb(17,20,28)    · 카드 rgb(29,31,41)    · 테두리 rgb(44,47,53)      ← 다크
```

## 4) 🔴 **안 접은 것 — 대표 판단이 필요하다**

기계가 고를 수 없는 것이 둘 남았다. 이건 게을러서가 아니라 **디자인 결정**이라 남겼다.

**(a) 같은 `bg-white` 에 다크 답이 둘이다 — 489곳**

| 짝 | 회 | 다크에서 |
|---|---|---|
| `bg-white` + `dark:bg-[#11141C]` | **321** | 페이지 색 |
| `bg-white` + `dark:bg-[#1D1F29]` | **168** | 카드 색 |

라이트 모드는 페이지와 카드를 **둘 다 흰색**으로 뭉개므로, 작성자가 다크에서 매번 골라야 했고
**489번 중 168번 다르게 골랐다.** 어느 자리가 "페이지"고 어느 자리가 "카드"인지는 화면을 보고
정해야 한다(표면 규칙은 "표면 두 톤"이다).

**(b) 세 번째 톤 — `gray-100`(#F3EEEA) 421곳**
`border-gray-100`+`dark:border-[#2C2F35]` 258 · `bg-gray-100`+`dark:bg-[#1D1F29]` 163.
체계의 두 톤(`--bg` #F8F7FC · `--surface` #FFFFFF) 밖의 값이다. 접으면 라이트 화면이 바뀐다.

## 5) 이번에 틀렸던 판단

1. 🩸 **첫 코드모드가 템플릿 리터럴을 망가뜨렸다.** className 값을 공백으로 쪼갰다가 다시 이었더니
   `${...}` 표현식 안의 공백까지 먹어 `isWide ?'absolute…'` 가 됐다. ⇒ **토큰화 금지, 문자열 치환만.**
   (첫 판은 `hit` 을 파일 전역 카운터로 써서 매치 안 된 className 까지 재조립하는 버그도 있었다.)
2. 🩸 **Toss 잠금 파일 2개를 건드렸다**(`TossWidgetPayPage` 3줄 · `PaymentSuccessPage` 2줄).
   "색 정리" 는 일반 지시이지 잠금표의 명시 허가가 아니다. 되돌리고 코드모드에 `LOCKED` 제외 목록을 넣었다.
   얻는 것이 hex 5줄이고 잃을 수 있는 것이 결제다.
3. 🩸 **내 변경이 남의 주입 4건의 앵커를 낡게 만들었다**(코드모드가 `bg-[#F8F7FC] dark:bg-[#11141C]` 를
   접었고, 라이트 고정 셀렉터에 seller 를 추가했다). 지우지 않고 재조준했다.
4. ⚠️ **`--verify-clean` 이 "복원 실패 의심"을 냈다** — 주입 잔재가 아니라 **앵커가 낡아서** 난 오탐이었다.
   `git diff` 로 확인하고 넘어갔다. 앵커를 고치면 사라진다.

## 6) 가드

- `src/tests/unit/surface-tokens-2026-09-15.test.ts` **10건**
- `scripts/mutations/surface-tokens.mjs` **7건** — 되돌려-검증 전부 빨간불 확인
  (토큰 hex 복귀 · seller 스코프 누락 · 되박기 토큰 누락 · 코드모드가 gray-100/bg-white#11141C 까지 접기 ·
   래칫 CI 제외 · 래칫 0건 통과)

## 7) 다음 세션의 첫 액션

1. **배포 후 다크 모드로 소비자 화면 훑기** — 값이 같아 회귀는 없어야 하지만, 431곳을 한 번에
   바꿨으니 눈으로 한 바퀴. 특히 `/`(홈) · `/vouchers` · `/my-vouchers` · `/group-buy/:id`.
2. **§4 의 두 결정**을 대표에게 물을 것. (a) 는 489곳, (b) 는 421곳이라 합치면 **남은 hex 의 절반**이다.
   결정만 나면 같은 코드모드에 규칙 두 줄 더해 끝난다.

---

## 8) 🩸 PR #1450 첫 CI 가 빨갛게 났다 — 원인과, 그게 드러낸 더 큰 구멍

### 무엇이 났나
`src/tests/unit/voucher-wallet-split.test.ts:118` 가 라이트 지갑 래퍼에서
`bg-[#F8F7FC] dark:bg-[#11141C]` **그 hex 짝 그대로**를 찾는데, 내 코드모드가 같은 값의 토큰
`bg-warm` 으로 접으면서 **정상인데 빨간불**이 됐다(§5-3 과 같은 클래스의 다섯 번째).

**재조준했다. 그리고 판정 기준을 hex 에서 불변식으로 옮겼다** — 그 시험이 지키려던 것은
"저 두 hex 가 적혀 있다" 가 아니라 **"라이트 지갑의 배경을 인라인으로 칠하지 않는다"**(2026-08-31 에
흰 배경 + 흰 글자가 된 원인)이고, 토큰 쪽이 그 불변식을 더 강하게 만족한다. 앵커 자기검증 1건도 함께 넣었다.
되돌려-검증: 라이트 분기에 `background: t.bg` 를 심으니 ②가 빨간불 → 복원.

### 🔴 진짜 문제는 그게 아니라 **로컬 게이트가 그 스텝을 안 돈다**는 것
`pre-push` 게이트는 **95개를 통과시키고** 푸시를 내보냈다. 이유는 구조적이다:

```
local-ci-parity.mjs  →  verify.yml 에서 scripts/check-*.{mjs,sh} 만 긁는다
verify.yml:68-69     →  - name: Run unit tests
                          run: npm test -- --run        ← check-* 가 아니라 **안 보인다**
```

즉 **CI 가 차단하는 스텝 하나가 로컬 게이트의 모델 밖에 통째로 있다.** 이건 그 게이트가
없애려고 만들어진 바로 그 "CI 는 막는데 로컬은 안 막음"(2026-09-14)이고, 하필 **그 게이트 자신**이
같은 구멍을 갖고 있었다 — 오늘 CI 한 바퀴를 그 구멍으로 태웠다.

⚠️ **`vitest related` 로는 못 막는다.** 이 레포의 가드형 시험은 대상 파일을
`readFileSync('src/...')` 로 **문자열**로 읽는다. 모듈 그래프에 간선이 없어서 `related` 가 못 찾는다
(`voucher-wallet-split.test.ts` 가 정확히 그 모양이다).

### 🩸 그리고 내가 제안한 대안도 틀렸다 — **스코핑 자체가 이 레포에선 헛돈다**

위 자리에 처음엔 *"테스트 본문에서 바뀐 파일 경로를 문자열로 grep 하면 된다"* 고 적었다. **실측으로 뒤집혔다.**

그 방식으로 뽑으면 위험군 **81개**(전체 672개 중)가 나오고 1분이면 돈다. 그런데 전체를 돌려 보니
**낡은 앵커는 4개 파일에 7건**이었고, 그중 **3개 파일을 그 그물이 통째로 놓쳤다**:

| 놓친 시험 | 왜 |
|---|---|
| `consumer-popups-dark.test.ts` (4건) | `R('components/ToastContainer.tsx')` — **헬퍼로 경로를 조립**해 원문에 `src/…` 문자열이 없다 |
| `stay-detail-pc-booking-panel.test.ts` | 〃 (`R('pages/stay-detail/StayBookingPanel.tsx')`) |
| `deal-card-shapes.test.ts` | 파일 **목록을 돌며** 읽는다(이름이 변수) |

⇒ **스코핑한 게이트를 만들었다면 그 자체가 "헛도는 가드"가 됐을 것이다** — 초록을 찍고 CI 는 빨갛게.
전체 시험은 이 컨테이너에서 **425초**다. 게이트에 넣을 값으로 못 쓸 수는 없지만(현재 게이트 20초),
그건 다음 세션이 대표 판단과 함께 정할 일이다. **확실한 것 하나**: 스코핑으로 빠져나갈 수는 없다.

🧭 **교훈**: 스코핑 휴리스틱은 **전수와 대조해 보기 전에는 믿지 말 것.** 나는 한 사례
(`voucher-wallet-split`)가 맞는 걸 보고 일반화했고, 그 사례가 하필 **직접 경로를 쓰는 소수파**였다.

## 9) 🔴 곁다리로 드러난 **대외 랜딩 다크 결함** (내 PR 무관 — main 에 이미 있다)

§8 을 파다 `check-dark-contrast` 의 경로 목록을 봤더니 **대외 랜딩 5개가 사각지대**였다
(`/business` · `/creators` · `/partners` · `/influencer` · `/introduce` — 전부 sitemap 제출 대상).
브라우저로 실제 렌더해 재 봤다(다크, 430px):

| 경로 | 대비 3:1 미만 | 최악 |
|---|---|---|
| `/business` | **4건** | **1.18:1** — "공구당 참여자 수"·"공구 가격"·"월 공구 횟수" |
| `/introduce` | **8건** | 1.28:1 (clip-text) · 1:1 (흰 글자 위 흰 반투명) · 푸터 2.4:1 |
| `/refund` | **7건** | 2.14:1 — `text-green-600` 이 다크에서 안 밝아진다 |
| `/influencer` | 1건 | 1:1 — `bg-brand/10` 위 `text-brand` |
| `/creators`·`/creators/apply`·`/partners`·`/terms`·`/privacy` | 0건 | — |

**`/business` 의 원인**(사장님 유치용 랜딩이다):
```jsx
<div className="bg-gray-50 rounded-3xl p-6 lg:p-10 border border-rule">   // ← dark: 없음
  <label className="text-sm font-bold text-gray-700 dark:text-gray-200">월 공구 횟수</label>
```
패널이 `bg-gray-50`(#F8F7FC)에 다크 대응이 **없어** 다크에서도 near-white 로 남는데, 그 위 글자는
`dark:text-gray-200`(#EAE4E0)로 밝아진다 ⇒ **near-white on near-white**.
**`origin/main:147` 과 동일 — 내 PR 무접촉**(`git diff origin/main...HEAD` 로 확인).

**처방(다음 세션)**: ① 그 5개 경로를 `check-dark-contrast.mjs` 의 `ROUTES` 에 추가 → 빨간불 확인
② 드러난 것들 수정. ⚠️ `text-green-600`(#557 계열로 측정됨)은 `--tone-ok` 로 가는 게 맞고,
그건 §4 의 색 정리와 같은 줄기다.

🧭 **교훈**: 가드의 **경로 목록이 곧 범위**다. `contrast` 가 초록이라고 "다크는 괜찮다"가 아니라
**"목록에 있는 17곳은 괜찮다"** 는 뜻이다. 대외 랜딩은 그 목록에 한 번도 없었다.


## 10) 낡은 앵커 7건 — 전부 재조준했고, **철자 SSOT** 로 재발을 막았다

| 시험 | 건 | 앵커였던 것 |
|---|---|---|
| `voucher-wallet-split` | 1 | `bg-[#F8F7FC] dark:bg-[#11141C]` |
| `dashboard-rinda-shell` | 1 | 라이트 고정 **셀렉터 목록 문자열 통째로** |
| `consumer-popups-dark` | 4 | `bg-white dark:bg-[#1D1F29]` · `dark:bg-[#11141C]` · `dark:bg-[#` |
| `deal-card-shapes` | 1 | `bg-white dark:bg-[#1D1F29]` |
| `stay-detail-pc-booking-panel` | 1 | 〃 |

**하나도 지우지 않았다.** 전부 같은 병이라 **개별로 깁지 않고 이름을 붙였다** —
신규 `src/tests/helpers/surface-class.ts`:

```ts
CARD_BG  = (?:bg-surface\b|bg-white dark:bg-\[#1D1F29\])      // --surface
PAGE_BG  = (?:bg-warm\b|bg-(?:gray-50|\[#F8F7FC\]) dark:bg-\[#11141C\])  // --bg
DARK_AWARE_BG = (?:bg-surface\b|bg-warm\b|dark:bg-\[#)        // "다크를 아는가" 만 물을 때
```

정규식 **조각**이라 앞뒤로 이어 쓴다: ``new RegExp(`rounded-2xl ${CARD_BG} shadow-lift`)``.
다음에 또 접히면 **고칠 곳은 이 파일 하나**다.

`dashboard-rinda-shell` 은 성격이 달라 따로 고쳤다 — 셀렉터 목록을 앵커로 쓰면
**스코프를 늘리는 올바른 변경이 시험을 깬다**(늘리는 건 장려할 방향이다). ⇒ 목록이 아니라
"`--brand-tint` 되박기가 admin·agency·light-island 를 **덮는가**" 를 묻도록.
🩸 첫 재조준은 `indexOf` 로 첫 선언을 집었다가 **`:root` 의 라이트 기본값**을 잡아 여전히 빨간불이었다
(같은 값이 거기에도 있다) — 라이트 고정 스코프 안의 선언만 고르도록 다시 고쳤다.

**되돌려-검증 7건 전부 빨간불 확인** (소스에 `bg-surface`→`bg-white`, `bg-warm`→`bg-gray-50` 주입 후 복원).
🩸 그 과정에서 `git checkout -- <파일들>` 이 **경로 하나가 틀리면 전부 복원을 안 한다**는 걸 밟았다
(주입된 5개가 그대로 남아 있었다). 복원 뒤 `git status` 로 확인할 것 — 명령 성공을 믿지 말고.
