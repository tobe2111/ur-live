#!/bin/bash

echo "========================================"
echo "프로덕션 환경 - 바로빌 API 실제 테스트"
echo "========================================"
echo ""

BASE_URL="https://live.ur-team.com"

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

echo "✅ 로그인 성공"
echo "   Token: ${SELLER_TOKEN:0:20}..."
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

echo "$BUSINESS_RESPONSE" | jq '.success, .data.business_number, .data.is_verified, .data.message'
BUSINESS_ID=$(echo "$BUSINESS_RESPONSE" | jq -r '.data.id')
echo "   사업자 ID: $BUSINESS_ID"
echo ""

# 3. 사업자 정보 조회
echo "3️⃣  사업자 정보 조회..."
BUSINESS_INFO=$(curl -s -X GET "$BASE_URL/api/seller/business-info" \
  -H "X-Session-Token: $SELLER_TOKEN")

IS_VERIFIED=$(echo "$BUSINESS_INFO" | jq -r '.data.is_verified')
echo "   승인 상태: $IS_VERIFIED"

if [ "$IS_VERIFIED" != "1" ]; then
  echo ""
  echo "⚠️  사업자 정보가 승인되지 않았습니다."
  echo "   관리자 승인이 필요합니다."
  echo ""
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
    echo "❌ 관리자 로그인 실패"
    echo "   수동으로 승인해주세요: 사업자 ID = $BUSINESS_ID"
    exit 1
  else
    echo "✅ 관리자 로그인 성공"
    
    # 사업자 승인
    VERIFY_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/admin/seller-business/$BUSINESS_ID/verify" \
      -H "Content-Type: application/json" \
      -H "X-Session-Token: $ADMIN_TOKEN" \
      -d '{"verified": true}')
    
    VERIFY_SUCCESS=$(echo "$VERIFY_RESPONSE" | jq -r '.success')
    if [ "$VERIFY_SUCCESS" == "true" ]; then
      echo "✅ 사업자 승인 완료"
    else
      echo "❌ 사업자 승인 실패"
      echo "$VERIFY_RESPONSE" | jq '.'
      exit 1
    fi
  fi
else
  echo "✅ 이미 승인됨"
fi

echo ""

# 5. 기존 주문 조회 (테스트용)
echo "5️⃣  기존 주문 확인..."
SELLER_ORDERS=$(curl -s -X GET "$BASE_URL/api/seller/orders" \
  -H "X-Session-Token: $SELLER_TOKEN")

ORDER_COUNT=$(echo "$SELLER_ORDERS" | jq -r '.data | length')
echo "   기존 주문 수: $ORDER_COUNT"

if [ "$ORDER_COUNT" -gt "0" ]; then
  LATEST_ORDER=$(echo "$SELLER_ORDERS" | jq -r '.data[0].order_number')
  echo "   최신 주문: $LATEST_ORDER"
  echo ""
  echo "📝 기존 주문을 사용하여 세금계산서 발행 테스트를 진행하시겠습니까?"
  echo "   주문번호: $LATEST_ORDER"
  echo ""
  ORDER_NO=$LATEST_ORDER
else
  echo "⚠️  기존 주문이 없습니다."
  echo "   프로덕션에서 직접 주문을 생성하거나,"
  echo "   주문번호를 수동으로 입력해주세요."
  echo ""
  
  # 수동 입력 모드
  read -p "주문번호를 입력하세요 (엔터 시 스킵): " MANUAL_ORDER_NO
  
  if [ -z "$MANUAL_ORDER_NO" ]; then
    echo "❌ 주문번호가 없어 테스트를 종료합니다."
    exit 0
  fi
  
  ORDER_NO=$MANUAL_ORDER_NO
fi

echo ""

# 6. 세금계산서 발행 (실제 바로빌 API)
echo "6️⃣  세금계산서 발행 (바로빌 테스트 서버 호출)..."
echo "   주문번호: $ORDER_NO"
echo ""

TAX_INVOICE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/seller/tax-invoices/issue" \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: $SELLER_TOKEN" \
  -d "{\"order_no\": \"$ORDER_NO\"}")

echo "$TAX_INVOICE_RESPONSE" | jq '.'

SUCCESS=$(echo "$TAX_INVOICE_RESPONSE" | jq -r '.success')
NTS_CONFIRM=$(echo "$TAX_INVOICE_RESPONSE" | jq -r '.data.nts_confirm_number')
MOCK_MODE=$(echo "$TAX_INVOICE_RESPONSE" | jq -r '.data.mock_mode')
STATUS=$(echo "$TAX_INVOICE_RESPONSE" | jq -r '.data.status')
INVOICE_ID=$(echo "$TAX_INVOICE_RESPONSE" | jq -r '.data.invoice_id')

echo ""
echo "========================================="
echo "바로빌 API 테스트 결과"
echo "========================================="
echo "발행 성공: $SUCCESS"
echo "발행 상태: $STATUS"
echo "국세청 승인번호: $NTS_CONFIRM"
echo "Mock 모드: $MOCK_MODE"
echo "세금계산서 ID: $INVOICE_ID"
echo ""

if [ "$SUCCESS" == "true" ] && [ "$STATUS" != "failed" ]; then
  echo "✅ 세금계산서 발행 성공!"
  
  if [ "$MOCK_MODE" == "false" ]; then
    echo ""
    echo "🎉 실제 바로빌 API 호출 성공!"
    echo "   - 바로빌 테스트 서버로 실제 API 호출됨"
    echo "   - 국세청 승인번호: $NTS_CONFIRM"
    echo "   - 세금계산서가 DB에 저장되었습니다"
  else
    echo ""
    echo "ℹ️  Mock 모드로 발행되었습니다"
    echo "   실제 바로빌 API를 호출하려면:"
    echo "   src/services/barobill.ts에서 isBarobillMockMode()를 false로 설정"
  fi
  
  # 7. 세금계산서 조회
  echo ""
  echo "7️⃣  발행된 세금계산서 조회..."
  
  if [ "$INVOICE_ID" != "null" ] && [ -n "$INVOICE_ID" ]; then
    TAX_DETAIL=$(curl -s -X GET "$BASE_URL/api/seller/tax-invoices/$INVOICE_ID" \
      -H "X-Session-Token: $SELLER_TOKEN")
    
    echo "$TAX_DETAIL" | jq '.data | {invoice_number, issue_date, status, total_amount, supply_price, tax_amount, nts_confirm_number}'
  fi
  
  echo ""
  echo "8️⃣  세금계산서 목록 조회..."
  TAX_LIST=$(curl -s -X GET "$BASE_URL/api/seller/tax-invoices" \
    -H "X-Session-Token: $SELLER_TOKEN")
  
  LIST_COUNT=$(echo "$TAX_LIST" | jq -r '.data | length')
  echo "   총 $LIST_COUNT 건의 세금계산서"
  
  echo "$TAX_LIST" | jq '.data[] | {id, invoice_number, order_no, status, total_amount, issue_date, nts_confirm_number}'
  
else
  echo "❌ 세금계산서 발행 실패"
  ERROR_MSG=$(echo "$TAX_INVOICE_RESPONSE" | jq -r '.error // .data.message')
  echo "   에러: $ERROR_MSG"
fi

echo ""
echo "========================================="
echo "테스트 완료"
echo "========================================="
