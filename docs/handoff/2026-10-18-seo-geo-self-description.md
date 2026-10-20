# 2026-10-18 · SEO/GEO — 자기소개 문장 · 숙소 지역 · 교환권 facet 문구

대표: *"Seo, geo 부분에서의 개선점 말이야"* → 실측 보고 → ***"다 개선해줘 계속"***

## 실측(라이브 · Googlebot/Yeti/OAI-SearchBot × 31표면)
기본기는 깨진 곳 없음(canonical 전부 1개 · 매달린 @id 0 · h1 1개 · 세 봇 메타 동일).
남은 것은 **문구와 데이터가 사실과 다른 곳** 셋.

## 이번에 고친 것 (이 브랜치)
1. **AI 가 인용하는 자기소개가 "그룹 특가"** — llms.txt 첫 인용문 · `/about` 크롤러 본문(`CONCEPT_ABOUT_LINES[0]`)
   · `/introduce` 제목 "…이용권 공동구매". 원인 둘: ① `CONCEPT_ABOUT_LINES` 주석이 대조 대상을 `AboutPage.tsx`
   라고 적었는데 `/about` 은 2026-07-19 부터 `AboutServicePage.tsx`(AboutPage 는 noindex `/about/print`)
   ② `/introduce` 가 SEO·FAQ 를 i18n 키로 따로 들고 있었고 **locale 값이 SSOT defaultValue 를 이겨** 서버 메타와
   JS 제목이 달랐다. ⇒ 첫 줄을 `/about` h1 에 맞춤, `/introduce` 는 표를 직접 읽고 FAQ 는 `CONCEPT_FAQ` 에서 고름,
   locale `introduce.*` 69키×6개 언어 삭제(사용처 0).
   - `/introduce` 화면 문구 사실 교정: 친구 초대 보너스(안 줌) · 7일 환불·양도(사실 아님) · 앱(없음) · 전화번호 가입(카카오) ·
     이용권을 "교환권" 으로 · `/group-buy`·`/seller/login` 링크 · 공구/그룹 특가.
   - `/about/print`(PDF 소개서): 입점 수수료 0원(→가입비·월 고정비 0원) · 친구 초대 보너스 · 도매몰 카드·로드맵 ·
     딜 충전 "수수료 ZERO" · 어드민 로그인 CTA · `/seller/login` · Firebase · 공구 문구.
   - `/about`: "셀러 대시보드 하나에서" → 마이의 내 가게(2026-10-12 삭제).
   - 가드 `self-description-truth-2026-10-18.test.ts` + 주입 6건 빨간불 확인.
2. **숙소 12건이 주소와 다른 지역을 제목·설명에** — `product_stay_info.region_*` 가 주소와 다름(2887 `(강원 속초시)` ↔ 양양군,
   2719 도부터 다름). 2026-10-14 "컬럼 우선(49건 byte-동일)" 결정의 근거가 틀렸다. ⇒ `stayRegionShort`(stay-address.ts —
   주소를 `/region` 파서로 짧게) 하나로 제목·설명·크롤러 본문. 라이브 49건 실측: **37 동일 · 12 교정**.
   가드 `detail-title-ssot` ①-4·①-5·④-3 재조준 + 주입 1건 신설·1건 재조준.
3. **교환권 facet 20개 설명이 같은 브랜드 나열** — "편의점: 스타벅스·…" · 제목 중복. ⇒ `facetTitle/facetDescription` 틀.
   가드 `voucher-facet-copy-2026-10-18.test.ts` + 주입 2건.

4. **VouchersPage(잠금표) 클라 SEO 두 벌** — facet 에서도 클라 `<SEO url="/vouchers">` · 제목 "교환권 - 유어딜" · 설명 "김밥천국 등".
   JS 렌더 구글은 facet 20개를 `/vouchers` 로 통합할 수 있었다(#1901 효과 상쇄). 대표 `AskUserQuestion` 승인 "허가 — SEO 태그만" →
   `resolveConsumerSurfaceSeo` 결과를 그대로. CLAUDE.md 로딩 audit log 기록. 주입이 가드 구멍(정본 값 미검사) 하나를 잡았다.

## 🩸 이번에 틀린 판단 / 사고
- `check-guard-mutations.mjs` 는 **모르는 인자를 무시하고 전수를 돈다**(`--help` 도). `--only` 는 부분일치라
  `"a\|b"` 는 0건 → 전수. 백그라운드로 두 벌이 돌며 남의 파일에 주입한 채 남았다. **`pkill -f` 패턴이 내 셸을 같이 죽였고**,
  SIGTERM 은 핸들러가 바로 안 돌아 SIGKILL 후 `GroupBuyDetailPage.tsx` 를 `git checkout` 으로 복원했다.
  ⇒ `--only` 는 한 이름씩, 끊을 땐 PID 로.
- 지역 데이터 쪽은 **안 고쳤다**: `/stays` 지역 필터는 여전히 칸을 쓴다(2887 이 "속초" 필터에 뜬다). 칸 값 교정은 데이터 쓰기라 별건.

## 남은 것 / 대표 판단
- 숙소 지역 칸 12건 데이터 교정(필터용).
- `/products/2917` "프리미엄 무선아이폰"(user_40) 실상품인지.

## 다음 세션 첫 액션
배포 후: `curl -A '<OAI-SearchBot UA>' https://urdeal.kr/llms.txt | sed -n 4p` 가 "할인 이용권을 앱에서 사고…" 인지 ·
`/stays/2887` `<title>` 이 `(강원 양양군)` 인지 · `/vouchers?category=편의점` description 에 스타벅스 0건인지 ·
`/introduce` title 이 "유어딜 소개 - 우리 동네 이용권 할인" 인지(JS 렌더 후에도 — locale 키 삭제 확인).

## ✅ E4 판정 통과 (배포 후 라이브, 머지 `05b1a37e9` · 18:49 KST)
배포 **전에 기준점**을 먼저 잡고(배포 진행 중) 배포 뒤 같은 명령으로 다시 쟀다:
| 항목 | 배포 전 | 배포 후 |
|---|---|---|
| `llms.txt` 4번째 줄 | "…그룹 특가로 사는 로컬 커머스 플랫폼" | "동네 가게의 할인 이용권을 앱에서 사고 매장에서 QR로 쓰는 로컬 딜 플랫폼" |
| `/stays/2887` 제목(Googlebot) | `(강원 속초시)` | `(강원 양양군)` (설명도 `강원 양양군`) |
| `/vouchers?category=편의점` 제목 | `편의점 기프티콘 교환권 - 카페·편의점·치킨 할인` | `편의점 기프티콘 교환권 할인` |
| 같은 페이지 설명 | `편의점: 스타벅스·메가MGC커피·GS25·투썸 등…` | 스타벅스 **0** — "편의점 기프티콘 교환권을 할인가로 사세요…" |
| `/introduce` 제목 | `…이용권 공동구매` | `…이용권 할인` (Googlebot·iPhone 둘 다) |
⚠️ **못 잰 것**: `/introduce` 의 JS 렌더 뒤 제목(그 페이지 청크는 하드로드 modulepreload 표면이 아니라 서버 HTML 에서 안 보인다 — 코드는 같은 표를 읽는다) · 구글이 새 제목을 실제로 쓰는지(색인 수일~수주).
Notion 기록 완료.
