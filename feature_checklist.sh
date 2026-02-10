#!/bin/bash

check_feature() {
  local feature=$1
  local file=$2
  local pattern=$3
  
  if grep -q "$pattern" "$file" 2>/dev/null; then
    echo "✅ $feature"
    return 0
  else
    echo "❌ $feature"
    return 1
  fi
}

echo "=== 사용자 기능 체크 ==="
check_feature "카카오 로그인" "src/pages/LoginPage.tsx" "kakao"
check_feature "장바구니 담기" "src/pages/LivePage.tsx" "handleAddToCart"
check_feature "주문하기" "src/pages/CheckoutPage.tsx" "createOrder"
check_feature "주문 내역" "src/pages/MyOrdersPage.tsx" "orders"
check_feature "배송지 관리" "src/pages/AddressManagementPage.tsx" "shipping"
check_feature "마이페이지" "src/pages/MyPage.tsx" "profile"

echo -e "\n=== 판매자 기능 체크 ==="
check_feature "상품 관리" "src/pages/SellerProductsPage.tsx" "products"
check_feature "주문 관리" "src/pages/SellerOrdersPage.tsx" "orders"
check_feature "라이브 생성" "src/pages/SellerStreamNewPage.tsx" "stream"
check_feature "라이브 제어" "src/pages/SellerLiveControlPage.tsx" "control"
check_feature "세금계산서" "src/pages/SellerTaxInvoicesPage.tsx" "tax"
check_feature "정산 관리" "src/pages/SellerPage.tsx" "settlement"

echo -e "\n=== 관리자 기능 체크 ==="
check_feature "판매자 관리" "src/index.tsx" "admin/sellers"
check_feature "정산 관리" "src/pages/AdminSettlementPage.tsx" "settlement"
check_feature "주문 관리" "src/index.tsx" "admin/orders"

echo -e "\n=== 핵심 비즈니스 로직 체크 ==="
check_feature "재고 검증" "src/index.tsx" "Insufficient stock"
check_feature "재고 차감" "src/index.tsx" "stock = stock -"
check_feature "수수료 계산" "src/index.tsx" "commission_rate"
check_feature "정산 처리" "src/index.tsx" "settlement_status"
check_feature "주문 취소" "src/index.tsx" "orders/:orderId/cancel"
check_feature "환불 처리" "src/index.tsx" "orders/:orderNo/refund"

