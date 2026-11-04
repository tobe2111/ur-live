# 블로그 글별 AI 썸네일 (2026-11-04)

대표: *"블로그 업데이트 하고싶어. 사진들 썸네일 부분들 적재적소에 AI로 사진 만들어서 넣어주면 좋겠고."*
→ *"피그마든 캔바든 토큰 제한에 맞게끔 뽑아서 알아서 알맞는 사진들 넣어줘"*

## 구조 (구현됨)
- 표 `BLOG_SEED_THUMBNAILS`(`src/features/blog/api/blog-seed.ts`) — slug → `/assets/blog/<slug>-v<N>.webp`
- 재시드가 `thumbnail_url` 을 채운다(INSERT) · 표에 없는 글은 기존 사진 보존(UPDATE `COALESCE`)
- 사진이 있으면 목록·상세·OG 공유 카드가 자동으로 그 사진을 쓴다(`BlogCover` 첫 분기, `blog-ssr-meta` og:image)
- 가드 `src/tests/unit/blog-thumbnails-2026-11-04.test.ts`
- 사진 교체 시 **파일 이름 v 숫자를 올린다**(`/assets/*` 는 1년 immutable 캐시)

## 사진 생성 — Figma `generate_image`(gpt-image-2.5-flare), 1536×864
파일: https://www.figma.com/design/XhFE8NoZDGqv3rCgs1PI3g (프레임 8:2 ~ 8:22)
공통 스타일: 한국 배경 에디토리얼 라이프스타일 사진 · 자연광 · 은은한 브랜드 블루 · 글자/로고 없음 · 피사체 가운데(16:9·16:7·정사각 잘림 대비)

| 노드 | 글(slug) | 장면 | 상태 |
|---|---|---|---|
| 8:2 | voucher-how-to-use | 식당 카운터에서 휴대폰 QR 보여주는 손님 | ✅ 반영 |
| 8:3 | what-is-urdeal | 작은 가게들이 이어진 동네 골목, 휴대폰 든 행인 | ✅ 반영 |
| 8:4 | voucher-guide | 카페 테이블 위 휴대폰 속 파란 티켓 카드 | ✅ 반영 |
| 8:5 | exchange-voucher-guide | 파란 리본 선물상자·커피·기프트카드 화면 | ✅ 반영 |
| 8:6 | dongne-deal-guide | 골목에서 파란 핀 지도 보는 뒷모습 | ✅ 반영 |
| 8:7 | linkshop-my-store | 소품을 진열한 미니멀 원목 선반 | ✅ 반영 |
| 8:8 | become-business-user | 앞치마 사장님이 노트북 보며 개점 준비 | ✅ 반영 |
| 8:9 | deal-points-guide | 파란 토큰이 채워지는 유리병 | ✅ 반영 |
| 8:10 | safe-payment-system | 휴대폰 체크 표시 결제 완료 화면 | ✅ 반영 |
| 8:11 | review-reward-guide | 음식 사진 찍는 손님(리뷰) | ✅ 반영 |
| 8:12 | business-user-settlement | 영업 끝난 식당에서 태블릿 매출 그래프 | ✅ 반영 |
| 8:13 | meal-voucher-lifestyle | 한식 한상 위로 뻗는 젓가락들 | ✅ 반영 |
| 8:14 | beauty-voucher-guide | 밝은 미용실에서 머리 손질 | ✅ 반영 |
| 8:15 | stay-voucher-guide | 바다가 보이는 호텔 방·캐리어 | ✅ 반영 |
| 8:16 | activity-voucher-guide | 도자기 공방 체험 두 사람 | ✅ 반영 |
| 8:17 | first-purchase-guide | 소파에서 휴대폰 보며 웃는 사람 | ✅ 반영 |
| 8:18 | voucher-faq | 휴대폰·노트·라떼 플랫레이 | ✅ 반영 |
| 8:19 | deal-points-support-culture | 카페에서 휴대폰 보여주는 두 친구 | ✅ 반영 |
| 8:20 | linkshop-decorate-tips | 사진을 격자로 배치하는 사람 | ✅ 반영 |
| 8:21 | smart-saving-lifestyle | 에코백·커피 들고 걷는 아침 골목 | ✅ 반영 |
| 8:22 | gift-guide | 리본 선물을 건네는 두 손 | ✅ 반영 |

## 왜 1장만 반영됐나
이 환경은 `figma.com`·`canva.com` 다운로드를 프록시가 막는다(CONNECT 403). 원본은 Figma `get_screenshot` 의
인라인 응답으로만 받을 수 있었는데, 8:2 를 받은 직후 **Figma Starter 요금제 MCP 호출 한도**에 걸렸다.
Canva 는 198px 미리보기만 온다(원본 내보내기 URL 도 차단). 미리보기(256px)로 채우면 화면에서 흐려 보여 넣지 않았다.

## 나머지를 넣는 방법
1. 위 Figma 파일에서 프레임 8:3~8:22 를 PNG 로 내보내 세션에 올린다(또는 Figma 한도가 풀린 세션에서 `get_screenshot maxDimension=1200 enableBase64Response=true`).
2. `python3 -c` 로 1200×675 webp(quality 80) 변환 → `public/assets/blog/<slug>-v1.webp`
3. `BLOG_SEED_THUMBNAILS` 에 한 줄씩 추가 + `BLOG_SEED_VERSION` +1

## ✅ 구현 완료 (2026-11-04)
- 대표가 환경 네트워크 허용 목록에 `www.figma.com` 을 추가한 뒤, 생성 결과 `image.url` 로 원본(1536×864) 20장을 받아 1200×675 webp(32~158KB)로 변환.
- 21편 전부 사진 반영 · `BLOG_SEED_VERSION` 16. 1차 커밋 PR #2189(`44347c0`).
