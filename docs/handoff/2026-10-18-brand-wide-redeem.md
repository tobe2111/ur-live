# 2026-10-18 — 브랜드 전 지점 사용 (이용권을 같은 주인 지점에서도)

대표: *"다른 지점에서도 쓸 지는 선택하게 하는게 좋지 않아?"* → *"응 진행해줘 그게 가장 이상적인거지?"*
잠금 파일(`group-buy-public.routes.ts`) 두 줄: `AskUserQuestion` 승인 *"허가 — 그 두 줄만 (추천)"*.

## 다음 세션의 첫 액션
1. PR 머지·배포 확인 후 **E4**: 같은 주인 두 지점(A·B)이 한 브랜드인 테스트 셀러가 필요하다(라이브에 아직 없음).
   - A 지점 이용권 펼침 → "같은 주인 지점 1곳에서도 사용" 켜기
   - 손님 상세에 "{브랜드} 2곳 어디서나 사용 가능 · 지점 보기" 가 뜨는지 (`GET /api/brands/of-store/A?product=<id>` → `usable_branches: 2`)
   - B 지점 확인코드로 셀프 사용 → 성공 · `ledger_entries` 상인이 **A** 인지(정산 귀속 불변)
   - 가맹점(주인 다른 C) 확인코드 → 403 이어야 한다

## 완료분
- 판정 SSOT `src/worker/utils/brand-wide-redeem.ts` — 켬 여부(`product_supply_meta.brand_wide_use`), 형제 지점·주인(SQL 판 = `resolveStoreOwnerUserId`), 사용 순간 재판정
- 사용 3경로: 카운터(`group-buy-voucher.routes` → `redeemByCounterSecret` 에 형제 지점 id, CAS 안 비밀 재대조) · 사장님 스캔·챗봇(`voucher-seller-redeem` `canStoreRedeemProduct`) · 손님 셀프(`self-redeem-gate` productId + 잠금 파일 두 줄)
- 설정 API `GET/PUT /api/seller/products/:id/brand-wide` (판 지점 주인만, 60/시간)
- 화면: 이용권 펼침 `BrandWideToggle` · 손님 상세 `BrandBranchesLink` "N곳 어디서나 사용 가능"
- 가드 `brand-wide-redeem-2026-10-18.test.ts` 18건 + 주입 `scripts/mutations/brand-wide-redeem-2026-10-18.mjs` 7건(전부 빨간불 확인)
- 셀러 가이드 '지점이 여러 곳이라면' 절 + `GUIDE_SEED_VERSION` 52 · 플랫폼 모델 §프랜차이즈 갱신

## 이번에 틀렸던 판단 / 주의
- 플랫폼 모델이 "브랜드엔 권한이 안 붙는다" 고 적어 두었다 — 이제 예외 하나(사용 처리)가 있다. 정산은 여전히 안 붙는다.
- 셀프 CAS 자체는 비밀을 안 본다(`code=? AND user_id=?`) → 셀프 경로의 문은 게이트다. 게이트를 약화하면 그대로 소각 구멍.

## 남은 결정 (대표)
- **3단계 — 가맹점(주인 다름) 사이 사용**: 쓴 지점으로 정산을 옮기는 머니 경로. 결재 필요(지금은 받지 않는다).
