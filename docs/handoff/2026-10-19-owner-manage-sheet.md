# 2026-10-19 — 주인 [관리하기] 안 A · 숙소·쇼핑 상세까지

대표: *"안 A로 해주고, 숙소 및 쇼핑 상품에도 관리하기를 넣자"* (시안 캔버스 https://claude.ai/artifact/JTLDqVnWRSEWEMBFVLo8XP)

## 무엇이 바뀌었나
- [관리하기] → 셀러 목록이 아니라 **그 상품 하나의 관리 시트**(`src/components/deal/OwnerManageSheet.tsx`).
  숫자 2칸(판매/사용) + 수정·현황 줄 + 판매 중지(시트 안 재확인) / 멈춘 상품은 [다시 판매하기].
- 숙소(`StayDetailPage`) · 쇼핑(`ProductDetailPage`) 상세도 주인이면 예약·구매 자리에 [관리하기].
  숙소는 객실 카드의 예약 버튼도 숨긴다.
- 서버: `src/features/group-buy/api/owner-viewer.routes.ts` — `GET /viewer/:id`(옮김, 주인이면 kind·is_active·stats 추가)
  · `POST /viewer/:id/active`(신규, 같은 판정 뒤에만).

## 다음 세션의 첫 액션
- 배포 후 사장님 계정(로그인 필요 — 세션은 못 잰다)으로 `/pass/:id` · `/stays/:id` · `/products/:id` 에서 [관리하기] → 시트 숫자가 셀러 화면과 같은지,
  판매 중지 → 홈 피드에서 빠지는지(이용권만 피드 퍼지). 대표 판정.

## 틀린 판단 / 주의
- 판매 숫자는 **판매 수**(환불 제외)이지 매출이 아니다. 매출을 넣으려면 수수료 개념이 붙어 정의가 필요하다 — 의도적으로 뺐다.
- 쇼핑 판매 중지는 피드 퍼지를 안 한다(이용권 카테고리만 그 캐시를 쓴다). `/api/products` 엣지 캐시는 TTL 로 풀린다.

## 남은 것
- 없음(대표 판정 대기).
