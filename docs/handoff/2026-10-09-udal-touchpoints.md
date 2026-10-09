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
