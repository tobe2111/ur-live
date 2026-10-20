# 2026-10-17 — 프랜차이즈 지점 편의 기능

대표: *"만약 프랜차이즈가 사장님으로 가입하면? 지점이 여러개잖아"* → *"근데 그 프랜차이즈를 영업해온 중개사일 수 있잖어"* →
*"어렵네.. 더 복잡해진건가?"* → (규칙 하나로 정리) → **"응응 다 해줘"**.

## 확정 규칙 (다른 세션도 이걸로 판단)
**모든 건 지점 단위이고, 그 지점의 주인이 정한다.**
- 지점 = `sellers` 행 하나. 정산 계좌·확인코드·리뷰·지도 위치가 지점마다.
- 직영점 = 본사가 주인. 가맹점 = 점주가 주인, 본사는 점주가 들인 운영자(`seller_operators`).
- 에이전시가 영업해 온 지점도 같다 — 운영자가 하나 더 붙을 뿐. 수수료 채널은 *누가 데려왔나*로 지점마다.
- 브랜드는 **보여 주기용 묶음**. 정산·권한·이용권 어느 것도 브랜드에 안 붙는다.

## 한 일 (서비스: 유어딜 소비자 레일 · 머니 경로 접촉 없음)
| | 무엇 | 어디 |
|---|---|---|
| ① | 매장 목록 상한 50/20 → 500 (바인딩 한도는 조각으로) | `seller-operators.ts` `MAX_OPERABLE_STORES` · `seller-operators.routes.ts` summary · `d1-in-chunks.ts` · 알림 20→90 |
| ② | 지점 여러 곳 한 번에 등록 (같은 `POST /api/seller/stores` 를 한 곳씩, 시간당 한도 10→60) | `BranchBulkRegisterSheet.tsx` · 매장 관리 화면 버튼 |
| ③ | 이용권 다른 지점에 복사 — 같은 등록 함수(`createSellerProduct`)로, 지점 고유 정보는 대상 지점 프로필로 | `seller-product-copy.routes.ts` · `BranchCopySheet.tsx` · `VoucherRow` 펼침 버튼 |
| ④ | 브랜드 묶음 + 손님 페이지 `/brand/:slug` + 이용권 상세 "다른 지점 N곳 보기" | `store-brands.ts` · `seller-brands.routes.ts` · `brands-public.routes.ts`(`/api/brands`, edgeCache 300) · `BrandPage.tsx` · `BrandBranchesLink.tsx`(매장 카드가 보일 때만 조회) |

`seller-orders.routes.ts` 의 `POST /products` 핸들러를 `createSellerProduct(c, forced?)` 함수로 뺐다(본문 무변경 — 복사가 같은 검증·매장 확정·피드 무효화를 타게).

## 가드
`src/tests/unit/franchise-branches-2026-10-17.test.ts` 16건 + 주입 `scripts/mutations/franchise-branches-2026-10-17.mjs` 11건 — **전부 빨간불 확인**.
기존 주입 1건(`seller-d3` 요약 정지 매장)은 앵커만 `slice(0, MAX_SUMMARY_STORES)` 로 재조준.

## 다음 세션의 첫 액션
1. 배포 뒤 `curl -s https://urdeal.kr/api/brands/없는주소` → 404 JSON, `curl -s https://urdeal.kr/brand/abc` → 200(SPA, 404 아님).
2. 라이브엔 지점이 여럿인 계정이 아직 없다 — 실제 판정(E4/E5)은 테스트 셀러로 지점 두 곳을 만들어:
   일괄 등록 → 이용권 복사(복사본의 `restaurant_address` 가 **대상 지점 주소**인지 D1 으로 확인) → 브랜드 만들기 → `/brand/주소` 에서 두 지점 보임.

## 이번에 틀릴 뻔한 것
- 처음 대답에서 "가맹점 수수료 10%냐 5%냐" 를 대표 결정으로 올렸는데, 규칙(채널 = 누가 데려왔나)으로 이미 답이 나온다. 대표가 *"어렵네"* 라고 했고, 규칙 하나로 줄이니 결정할 것이 사라졌다.
- 서버 쪽 일괄 처리(한 요청에 30곳)는 요청당 서브리퀘스트 한도(무료)에 걸린다 → 화면이 한 곳씩 부르는 설계로.

## 남은 것 (대표 판단)
- **어느 지점에서나 쓰는 이용권**(사는 지점 ≠ 쓰는 지점) — 정산 귀속이 바뀌는 머니 경로라 결재가 필요하다. 지금은 지점별 이용권을 복사해서 판다.
- 에이전시 콘솔(직원 좌석)에서의 복사·브랜드는 아직 안 된다(사람 계정 기준으로만 동작).
- Notion 미기록(이 세션에 MCP 미사용).
