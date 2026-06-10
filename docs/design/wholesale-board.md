# 도매몰 통합 게시판 + 배송 안내 (2026-06-10 사용자 시안/요청)

## 시안 출처
- 배송 안내: 사용자 제공 이미지 (Sellpie 형) — 4단계 플로우(주문 및 결제확인 → 배송준비 → 배송출발 → 송장번호 안내) + 마감시간 + 당일배송 체크포인트.
  - **제외 지시**: 택배사명/택배사코드/출고지 주소/반품지 주소 4행, "현재 베이식스…" 문장.
- 상품 자료실: sellpie.co.kr/board/product/img_download.html — 상품 이미지 다운로드 게시판.
- 공지사항: sellpie.co.kr/board/free/list.html.
- 신고 게시판: sellpie.co.kr/board/free/notify.html — 최저가 미준수 신고 등.
- 찜리스트 + 장바구니: "필요해" (장바구니는 기존 /wholesale/cart 존재 — 찜만 신규).

## 구현 (✅ 2026-06-10 완료)
- `/wholesale/board` 탭 4종: 공지사항 / 상품 자료실 / 배송 안내 / 신고·제안
  - 공지·자료실: `wholesale_board_posts` (notice|archive, 몰 스코프, 고정글, 조회수)
  - 자료실 상세: 연결 상품의 대표+상세 이미지 그리드 + 원본 다운로드 버튼
  - 신고·제안: 기존 `wholesale_proposal_tickets` 재사용 (회원 전용 폼 + 내 접수 내역 + 상태 배지)
  - 배송 안내: `WholesaleShippingGuide` (위 시안 콘텐츠)
- 찜리스트: `wholesale_wishlists` + 카탈로그 카드 ♥ 토글(낙관) + `/wholesale/wishlist`
- 어드민: `/admin/wholesale-board` CRUD (공지/자료실, 고정, 상품 연결)
- 진입점: 카탈로그 카테고리 네비 '공지·자료실', 모바일 헤더 ♥ 아이콘
