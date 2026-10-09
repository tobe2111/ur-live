# 2026-10-09 — 유달이 새 자리 6곳 (대표 "좋다 모두 해줘")

## 다음 세션의 첫 액션
1. 머지·배포 뒤 **카톡에 이용권 링크를 붙여** 공유 카드가 사진 + 유달이 + `urdeal.` 로 뜨는지 본다
   (`/pass/2888` 등). 서버에서 먼저: `curl -sA "$UA" "https://urdeal.kr/api/og/group-buy/2888?v=1" -o c.svg`
   → `python3 -c "import xml.dom.minidom as m;m.parse('c.svg')"` 가 통과하고 `href="data:image/jpeg` 가 있어야 한다.
2. 유어샵 카드도 같은 방법으로 `/api/og/curator/<handle>?v=3` 파싱 확인(아래 "틀렸던 것" 참조).
3. 대표 계정(users.id=3)으로 `/my-vouchers` — 이용권이 D-2 이하면 합계 아래 한 줄이 떠야 한다.

## 완료분
- ① `RedeemReviewCard`(취소 가능 시간 뒤에만) + `ProductReviews` 의 `ReviewForm` 을 named export(initialOpen/initialRating)
- ② `og-pass-card.ts` 신설 + `og-image.routes.ts` 가 사진 인라인으로 그림 + `detail-ssr-meta` 의 `/pass/:id` og:image → 카드(`PASS_OG_VERSION=1`). JSON-LD image 는 사진 유지
- ③ `ExpiryNotice` + `WalletRow` 의 `URGENT_DAYS` 상수화(값 2 그대로)
- ④ `FirstVoucherSheet`(지갑 1장 + 기기 표시 없음일 때 한 번)
- ⑤ 알림함 빈 화면 6개 언어 문구 + CTA, 유어샵 빈 진열대 유달이
- 🔒 `MyVouchersPage.tsx` 렌더 2줄 = `[UNLOCK_LOADING]` 대표 승인("허가 — 렌더 줄만 추가")

## 이번에 틀렸던 것 / 발견
- 🩸 **라이브 유어샵 공유 카드가 깨진 XML 이었다**(실측 `/api/og/curator/jiwon1228?v=2` → expat `not well-formed`).
  `font-family="${OG_FONT}"` 인데 OG_FONT 안에 큰따옴표가 있어 속성이 끊겼다. 2026-09-28 테스트는 href 모양만 봐서 못 잡았다.
  ⇒ 홑따옴표로 고치고 `?v=2 → 3`(worker/index.ts 한 줄). 새 시험은 **실제 XML 파서**로 넣어 본다.
- 내 새 카드도 처음엔 같은 버그로 렌더가 깨졌다 — 브라우저로 그려 보고서야 알았다. 문자열 생성 SVG 는 파싱해 볼 것.
- 유달이 말하는 영상은 Weave(Veo·TTS) 무료 한도로 막혀 만들지 못했다(대표에게 보고함).

## 남은 결정
- 공유 카드(SVG)를 카카오가 실제로 굽는지는 배포 뒤 카톡에 붙여 보는 것이 유일한 판정이다.
- 상세의 "카톡 공유" **버튼**(KakaoShareButton)은 여전히 사진 원본을 보낸다 — 버튼은 잠금 파일(GroupBuyDetailPage)이 이미지를 넘기는 구조라 이번엔 링크 미리보기만 바꿨다.

## 후속 (같은 날) — 상세 공유 버튼에도 판 번호

대표 "1번 해줘". 상세 페이지의 카카오 공유 버튼 두 곳(모바일 플로팅 헤더 · PC 탭바)은 원래부터
`/api/og/group-buy/{id}` 카드 주소를 보내고 있었다 — **사진 원본이 아니었다**(직전 보고에서 "사진 원본을
보낸다"고 한 것은 틀렸다. 코드를 다시 보고 정정). 진짜 결함은 **판 번호(`?v=`)가 없다**는 것:
카카오가 주소 단위로 그림을 캐시해서 새 카드가 안 나간다.
- 신규 SSOT `src/shared/pass-share-card.ts` `passShareCardUrl(id)` — 서버 og:image 와 두 버튼이 같이 쓴다.
- 잠금 파일 `GroupBuyDetailPage.tsx` 는 import 1줄 + prop 2곳(CLAUDE.md audit log 기록).
- 대표 질문 "리뷰 보상은 따로 없지 않아?" → **있다.** 라이브 `GET /api/reviews/reward-config` =
  텍스트 100 · 사진 300 · 영상 500 딜, 사용한 이용권 기준 상품당 1회(`reviews.routes.ts`).
- 근거: 카카오가 SVG 카드를 실제로 굽는다 — 2026-09-28 대표 카톡 스크린샷에 유어샵 SVG 카드가 (사진만 빠진 채) 렌더돼 있었다.

## 🩸 라이브 판정에서 뒤집힌 것 (#1669 배포 후 · 2026-10-10 02:3x KST)

`/api/og/group-buy/2888?v=1` 을 받아 보니 **사진 없는 이름 판**이었다(유달이만 박힘). 원인:
**서버(Pages 워커) 안에서 부른 자기 도메인 cdn-cgi 는 리사이즈가 안 걸린다** — 밖에서 같은 주소는
91KB 로 줄어드는데(`cf-resized: internal=ok`), 안에서는 원본 656KB 가 와 한도 160KB 를 넘고 `null`.
(CLAUDE.md 2026-06-11 항목이 이미 적어 둔 현상 — "프록시는 워커 내부 cdn-cgi subrequest 에 리사이저 미적용".)
⇒ **유어샵 카드(09-28)의 사진 인라인도 라이브에선 한 번도 안 됐을 가능성이 높다**(유어샵 카드 응답에 href 0개 실측).

임시 처방(이 PR): 사진을 못 박으면 카드 대신 **사진 원본으로 302** — 카드 이전과 같은 미리보기.
진짜 해결은 서버 밖에서 줄인 사진을 받는 길(Cloudflare Images 바인딩 등)이고 **아직 미착수**.
⚠️ 카카오가 og:image 의 302 를 따라가는지는 대표 카톡 확인이 필요하다.
