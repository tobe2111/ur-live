# SNS 연동 목록 = 정보 카드 (2026-11-01)

대표가 다른 서비스의 "연동된 소셜 계정" 화면을 캡처해 보내며:
> **"그렇게 나오면 안되고 이런 식으로 정보들도 나오고 새로고침도 있고 해야하지 않을까"**

## 1. 무엇이 문제였나

`SnsLinkList` 가 **한 줄**이었다 — `인스타그램 / @urdeal_food · 팔로워 12,300명` + [다시 확인][해제].

저장된 값은 **처음부터 다 있었다**(`user_sns_links.username`·`follower_count`·`verified_at`).
화면이 안 보여 줬을 뿐이다. 특히 **`verified_at`(언제 확인한 숫자인가)은 어디에도 없었다.**

🔴 그게 왜 결함인가: 사장님이 "팔로워 1,000명 이상" 조건을 걸면 **이 숫자로 판정된다.**
그런데 그게 방금 값인지 한 달 전 값인지 화면에서 구분되지 않았다.

## 2. 무엇을 했나

| | 전 | 후 |
|---|---|---|
| 로고 | 없음 | 플랫폼 글리프 + 연동=파란 원 / 미연동=회색 원 |
| 제목 | `인스타그램` | **`@urdeal_food`**(아래 작게 플랫폼명) |
| 상태 | 없음 | `✓ 연동됨` 배지(brand-tint) |
| 팔로워 | 13px 회색 | **24px 굵은 숫자**(규칙 ③ 숫자가 주인공) |
| 신선도 | **없었음** | `4일 전 확인` |
| 새로고침 | `다시 확인` 글자 | ⟳ + 마지막 확인 시각(한 버튼) |

- 신규 `src/utils/date.ts` `relativeFromNow()` — `parseUTCDate` 를 지난다(DB 값은 `Z` 없는 UTC).
- 신규 `src/components/icons/sns-logos.tsx` — 유어샵 머리(`CuratorHeader`)의 인라인 SVG 3개를
  **옮겼다**(두 벌이면 한쪽만 고치는 날이 온다). `CuratorHeader` 도 이 부품을 쓴다.

### 지킨 결정

- 🔴 **블록마다 카드를 안 씌웠다** — 이 목록은 이미 `SNS 연동` 카드 **안**이고 신청 시트 안이다.
  참고 화면은 카드마다 판이 깔려 있지만 우리가 그대로 하면 *카드 안에 카드*(2026-10-12 교훈).
  대신 규칙 ⑦ 의 평면 목록 — 블록 사이 hairline 하나.
- 🔴 **`follower_count === null` 을 0 으로 위장 안 함** — `—` + "수를 읽지 못했어요"
  (인스타 비프로페셔널·틱톡 심사 전에는 안 온다).
- 미연동 줄의 안내 문구를 `연동 안 됨` 으로 **줄였다** — 종전 문장은 390px 에서 잘렸고
  바로 위 섹션 설명과 같은 말이었다.

## 3. 가드

- 신규 `src/tests/unit/sns-link-card-2026-11-01.test.ts` 7건 + 주입 8건 **되돌려-검증 전부 빨간불**
  (그중 둘이 반대 방향 — 유어샵 머리가 인라인 SVG 로 복귀 / 공용 로고가 브랜드 색 복귀).
- 🕳️ **기존 가드 둘이 이 이동에 낡았고 둘 다 풀지 않고 재조준했다**:
  - `ushop-sns-mono-2026-09-16.test.ts` ①-2 — `currentColor` 를 `CuratorHeader` 안에서 세고 있었다.
    글리프가 옮겨가서 **0** 이 된다. ⇒ 불변식(브랜드 색 면·그라디언트 0 · 단색)은 그대로 두고
    **두 파일 다** 보게 했다(한쪽만 보면 나머지가 조용히 색을 되찾는다).
  - `custom-icon-size-contract.test.ts` — 탐지가 `export const \w+Icon` 이라
    `export function YouTubeLogo` 에 **한 글자도 안 걸려** "내보낸 아이콘이 없다" 로 빨간불.
    계약은 지키고 있었는데 패턴이 좁았던 것이다 ⇒ 선언 형태(const/function)와 접미사(Icon/Logo)를
    넓혔다. **몸통 자르기도 고쳤다** — `indexOf('})')` 는 `export function` 에 없어 파일 끝까지
    삼켰고, 그러면 *남의 아이콘*의 width/height 로 통과한다(지키는 척).
  - 주입 `ushop-sns-mono.mjs` 의 `🎨 글리프에 흰색을 박는다` 앵커도 새 자리로.
- 4px 격자 위반 4건(`px-2.5`·`py-1.5`·`gap-1.5`·`ml-1.5`)을 `consumer-type-scale` 가드가 잡아 교정.

## 4. 검증

- tsc 0 · `pre-push-gate` 가드 **101개** + 시험 132개 통과
- `surface-budgets` 27화면 전부 예산 안 · `critical-chunks` 14 동일
- 라이트·다크 렌더 눈 확인(`out/visual/my-seeding.png`)

## 5. ⚠️ 다음 세션이 알아야 할 것

### 아직 안 한 것 — **제자리 새로고침**

⟳ 를 누르면 지금은 `connect(p)` 가 돌아 **플랫폼 로그인으로 리다이렉트**된다(앱을 벗어난다).
참고 화면은 제자리에서 숫자만 갱신된다.

**가능하다** — 토큰이 이미 암호화 저장돼 있다(`user_sns_links.access_token_enc`·`refresh_token_enc`·
`token_expires_at`, `sns-link.ts:213`). 필요한 일:

1. `exchangeAndFetch` 안에 인라인으로 있는 **프로필 조회 부분을 `fetchProfile(p, token)` 으로 추출**
   (인스타 `IG_GRAPH/me?fields=…followers_count` · 유튜브 `channels?mine=true` · 틱톡 `user/info`).
   연동 때와 **같은 필드·같은 해석**을 써야 한다(두 벌이면 갈린다).
2. `refreshSnsLink(env, userId, p)` — 복호 → `fetchProfile` → `external_id` 가 같을 때만
   `follower_count`·`verified_at` UPDATE. 다르면 "다른 계정으로 로그인돼 있어요, 다시 연동" .
3. ⚠️ **유튜브·틱톡은 access token 수명이 짧다**(구글 ~1시간). `refresh_token` 으로 먼저 갱신해야
   한다 — 안 하면 가장 흔한 경우에 늘 "다시 연동" 이 뜬다. 인스타는 long-lived(60일)라 그대로 시도.
4. 라우트 `POST /api/seeding/sns/:platform/refresh` + 화면의 ⟳ 를 그쪽으로.

### 결정 대기

- 유어샵 SNS(`users.*_url`, 손입력·무검증) ↔ 체험 SNS(`user_sns_links`, OAuth)가 **상호 참조 0건** —
  같은 계정을 두 번 입력해야 한다. A안/C안 시안을 올렸고 대표가 아직 안 골랐다.
- 어드민 `/admin/instagram-autodm` 에 **체험용 콜백 주소**를 안 보여 준다(Meta 앱 설정에서 빠뜨리기 쉽다).

### 대표 몫(코드 밖)

알림톡 7종 SENS 심사 · SNS 키 등록(인스타 `app_id` null · 유튜브·틱톡 env 없음) ·
신청권 staging 실결제 후 스위치 · 메일 법적 성격 확인.
