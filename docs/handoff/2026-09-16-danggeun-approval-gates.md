# 당근 모델 — 들여보내되, 승인 전엔 열지 않는다 (2026-09-16)

## 대표 지시 (그대로)

> *"일단 반려는 되더라도 셀러 대시보드를 쓸 수는 있나보네. 우리도 반려는 되더라도 쓸 수는 있게
> 하고 유어애즈 인플루언서 DB는 보이지 않게 하자 반려 아닌 승인까지는. 최종 이용권 등록은
> 되지만 반려가 아닌 승인이 되어야 메인에 노출이 되게끔 하고."*

당근비즈니스 화면 6장을 보내 주시며 확정. 앞서 *"간판 사진 제출은 좀 아닌 것 같고"* 로
간판 사진은 제외, *"복잡해서도 안되긴 하는데"* 로 앞문 등록증은 **필수 → 선택**.

## ✅ 라이브 판정 끝남 (2026-09-16 15:5x KST) — **다시 하지 말 것**

프로덕션 `0135adb71` 확인. 술어를 새로 붙인 세 자리 전부 정상:
`/api/sections` 2줄 × 4개 · `/api/group-buy/products` **total 336**(변화 없음) · bbox 클러스터 50행.
⚠️ **E4 는 아니다** — 셀러 1곳(승인됨)·셀러 소유 활성 상품 0건이라 *가릴 대상이 없다*.
확인된 것은 "배포됐고 플랫폼 상품을 안 가린다" 까지다.

## 다음 세션의 첫 액션

```bash
# ① 이 브랜치 PR 이 초록·머지됐는지
gh pr view --json state,mergeStateStatus   # (이 환경은 gh 없음 → mcp__github__pull_request_read)

# ② 배포 후 라이브 판정 — 오늘 기준으로는 "아무것도 안 바뀌어야" 맞다
#    셀러 1곳(id 14, approved) · 활성 상품 2,598건 전부 seller_id IS NULL
curl -s 'https://urdeal.kr/api/group-buy/products?status=active' | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d.get('data',[])))"
#    → 이 숫자가 배포 전후로 같아야 한다. 줄었으면 술어가 플랫폼 상품까지 가린 것이다(즉시 롤백).
#    ✅ 2026-09-16 실측: 336 (변화 없음). 이 확인은 **이미 끝났다**.
```

## 완료분

| | 무엇 | 파일 |
|---|---|---|
| ① | 대기·반려도 셀러 대시보드 진입 (정지만 차단) | `seller-registration.routes.ts` `switch-to-seller` · `SellerWaitingPage.tsx` |
| ① | 상태 배너 — 반려 사유 / 등록증 없음 / 심사 중 | 신규 `components/seller/SellerApprovalBanner.tsx` · `SellerLayout.tsx`(2줄) |
| ② | 유어애즈 DB 는 승인된 매장만 (`ADS_DB_NOT_APPROVED`) | `worker/utils/ads-db-access.ts` |
| ② | 네비에서 '파트너 찾기' 숨김 (사이드바 + 그룹 탭) | 신규 `shared/seller-approval.ts` · `useSellerNavModel.ts` · `SellerGroupTabs.tsx` |
| ③ | 메인 노출 = 승인 매장만 (피드 2 + 지도 1 + cron + 홈 섹션) | 신규 `approvedSellerProductSql` · `group-buy-public.routes.ts` · `group-buy-feed-cache.ts` · `section-rules.ts` |
| — | 앞문 등록증 **선택**으로 완화 + `has_business_cert` 신호 | `SellerRegisterSupplierPage.tsx` · `seller-registration.routes.ts` · `auth/api/seller.routes.ts` |

선행 머지: **PR #1468**(`d13d3cc71`) — 사용 확인 게이트 + 앞문 등록증(필수판).

## 이번에 틀렸던 판단 (제일 값지다)

1. **"②(등록증 대조)는 기계로 불가능"** 이라고 오전 결재에 적었다. **국세청 API 기준에서만 맞다** —
   OCR 을 쓰면 된다(당근이 하는 것이 그것). 결재 파일에 정정 문단을 넣었고 후속 결재를 올렸다:
   `docs/decisions/2026-09-16-ocr-license-automation.md`.
   그리고 재 보니 **영업신고증이 사업자등록증보다 자동화 가치가 크다** — 대조할 공개 원장이
   우리 DB 에 이미 있다(`store_prospects` **269,708행**, 지방행정 인허가정보, 업종 넷 일치).
2. **주입이 내 시험 넷을 헛돈다고 잡았다.** 배선 검사를 `toContain('함수이름')` 으로 썼는데
   **import 줄 때문에** SQL 의 술어를 지워도 초록이었다(2곳). 정지 판정도 문자열 존재로 재서
   `if (false)` 에 통과했다. ⇒ **이름이 아니라 호출 형태**를 앵커로 쓸 것.
3. `NOT EXISTS` 술어의 **반대 방향 사고**(플랫폼 상품까지 가리는 것)를 따로 시험하지 않았다면
   놓쳤을 것이다 — 실측상 활성 상품 **2,598건 전부가 `seller_id IS NULL`** 이라,
   그 방향으로 틀리면 **홈이 통째로 빈다**. 주입 2번이 그 자리다.

## 남은 결정 / 대기

- **OCR 도입** — 결재 `2026-09-16-ocr-license-automation.md`. 기본안: Workers AI 로 **먼저 실측**(비용 0).
  ⚠️ 대표가 Cloudflare 대시보드에서 `[[ai]]` 바인딩을 켜야 한다(세션 토큰은 조회 전용).
- **`payout_requires_voucher_use` ON** — 등급 C, `STAGING_CHECKLIST.md` S-USEGATE 8건 뒤.
- **#17 예금주 = 등록증 상호/대표자명 일치** · **#19 중개사 계약 owner 수락** — 미착수.
- **부채**: `seller-registration.routes.ts` 758줄(NTS 비동기 블록이 분해 후보).

## 못 막는 것 (그대로 보고)

- **직링크 상세·구매는 막지 않는다.** 지시가 *"메인에 노출"* 이고 구매 차단은 결제 경로(등급 C)다.
  승인 전 매장이 자기 링크를 뿌리면 여전히 팔 수 있고, 그 돈은 사용 확인 게이트가 잡는다.
- 네비 숨김은 **안내**지 방어가 아니다(개발자 도구로 뚫린다). 방어는 서버 `ads-db-access.ts`.
- 어드민이 실제로 승인을 눌러 주는지는 운영이다. 지금 대기열에 **`business_registration_status='pending'`
  인 셀러가 1곳**(id 14) 있다.
