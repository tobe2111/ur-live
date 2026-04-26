#!/bin/bash

echo "========================================"
echo "전자세금계산서 전체 플로우 테스트"
echo "========================================"
echo ""

BASE_URL="http://localhost:3000"

# 1. 판매자 로그인
echo "1️⃣  판매자 로그인 (seller1)..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "seller1",
    "password": "seller123",
    "userType": "seller"
  }')

SELLER_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.sessionToken')

if [ "$SELLER_TOKEN" == "null" ] || [ -z "$SELLER_TOKEN" ]; then
  echo "❌ 판매자 로그인 실패"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ 로그인 성공: $SELLER_TOKEN"
echo ""

# 2. 사업자 정보 등록
echo "2️⃣  사업자 정보 등록..."
BUSINESS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/seller/business-info" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: $SELLER_TOKEN" \
  -d '{
    "business_number": "123-45-67890",
    "business_name": "토스 패션몰",
    "ceo_name": "김판매",
    "business_type": "도매 및 소매업",
    "business_category": "의류 소매업",
    "postal_code": "06236",
    "address": "서울시 강남구 테헤란로 123",
    "phone": "02-1234-5678",
    "email": "seller1@example.com"
  }')

echo "$BUSINESS_RESPONSE" | jq '.'
BUSINESS_ID=$(echo "$BUSINESS_RESPONSE" | jq -r '.data.id')
echo ""

# 3. 사업자 정보 조회
echo "3️⃣  사업자 정보 조회..."
BUSINESS_INFO=$(curl -s -X GET "$BASE_URL/api/seller/business-info" \
  -H "X-Session-Token: $SELLER_TOKEN")

echo "$BUSINESS_INFO" | jq '.'
IS_VERIFIED=$(echo "$BUSINESS_INFO" | jq -r '.data.is_verified')
echo "승인 상태: $IS_VERIFIED"
echo ""

# 4. 관리자 로그인 및 승인 (승인이 안 되어 있다면)
if [ "$IS_VERIFIED" != "1" ]; then
  echo "4️⃣  관리자 로그인 및 사업자 승인..."
  
  ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "username": "admin",
      "password": "admin123",
      "userType": "admin"
    }')
  
  ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.data.sessionToken')
  
  if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
    echo "⚠️  관리자 로그인 실패 - 수동 승인 필요"
    echo "   사업자 ID: $BUSINESS_ID"
  else
    echo "✅ 관리자 로그인 성공"
    
    # 사업자 승인
    VERIFY_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/admin/seller-business/$BUSINESS_ID/verify" \
      -H "Content-Type: application/json" \
      -H "X-Session-Token: $ADMIN_TOKEN" \
      -d '{"verified": true}')
    
    echo "$VERIFY_RESPONSE" | jq '.'
    echo "✅ 사업자 승인 완료"
  fi
  echo ""
fi

# 5. 테스트 주문 생성 (사업자 정보 포함)
echo "5️⃣  테스트 주문 생성 (사업자 정보 포함)..."
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/orders/create" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "sellerId": 1,
    "totalAmount": 129000,
    "shippingAddressId": 1,
    "cartItems": [
      {
        "product_id": 1,
        "quantity": 1,
        "price": 129000,
        "price_snapshot": 129000
      }
    ],
    "issueTaxInvoice": true,
    "buyerBusinessNumber": "987-65-43210",
    "buyerBusinessName": "테스트 구매 회사",
    "buyerCeoName": "이구매"
  }')

echo "$ORDER_RESPONSE" | jq '.'
ORDER_NO=$(echo "$ORDER_RESPONSE" | jq -r '.data.orderNumber')

if [ "$ORDER_NO" == "null" ] || [ -z "$ORDER_NO" ]; then
  echo "❌ 주문 생성 실패"
  exit 1
fi

echo "✅ 주문 생성 성공: $ORDER_NO"
echo ""

# 6. 세금계산서 발행
echo "6️⃣  세금계산서 발행..."
TAX_INVOICE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/seller/tax-invoices/issue" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: $SELLER_TOKEN" \
  -d "{\"order_no\": \"$ORDER_NO\"}")

echo "$TAX_INVOICE_RESPONSE" | jq '.'

SUCCESS=$(echo "$TAX_INVOICE_RESPONSE" | jq -r '.success')
NTS_CONFIRM=$(echo "$TAX_INVOICE_RESPONSE" | jq -r '.data.nts_confirm_number')
MOCK_MODE=$(echo "$TAX_INVOICE_RESPONSE" | jq -r '.data.mock_mode')
MESSAGE=$(echo "$TAX_INVOICE_RESPONSE" | jq -r '.data.message')

echo ""
echo "========================================="
echo "테스트 결과"
echo "========================================="
echo "발행 성공: $SUCCESS"
echo "국세청 승인번호: $NTS_CONFIRM"
echo "Mock 모드: $MOCK_MODE"
echo "메시지: $MESSAGE"
echo ""

if [ "$SUCCESS" == "true" ]; then
  echo "✅ 세금계산서 발행 성공!"
  
  # 7. 세금계산서 조회
  echo ""
  echo "7️⃣  세금계산서 목록 조회..."
  TAX_LIST=$(curl -s -X GET "$BASE_URL/api/seller/tax-invoices" \
    -H "X-Session-Token: $SELLER_TOKEN")
  
  echo "$TAX_LIST" | jq '.'
  
else
  echo "❌ 세금계산서 발행 실패"
  echo "에러: $(echo "$TAX_INVOICE_RESPONSE" | jq -r '.error')"
fi

echo ""
echo "========================================="
echo "테스트 완료"
echo "========================================="
