#!/bin/bash

echo "==================================="
echo "전자세금계산서 API 테스트"
echo "==================================="
echo ""

# 1. 판매자 로그인
echo "1. 판매자 로그인..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "seller1",
    "password": "seller123",
    "type": "seller"
  }' | jq -r '.sessionToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ 판매자 로그인 실패"
  exit 1
fi

echo "✅ 로그인 성공: $TOKEN"
echo ""

# 2. 사업자 정보 등록
echo "2. 사업자 정보 등록..."
curl -s -X POST http://localhost:3000/api/seller/business-info \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: $TOKEN" \
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
  }' | jq '.'

echo ""

# 3. 사업자 정보 조회
echo "3. 사업자 정보 조회..."
BUSINESS_INFO=$(curl -s -X GET http://localhost:3000/api/seller/business-info \
  -H "X-Session-Token: $TOKEN")

echo "$BUSINESS_INFO" | jq '.'
IS_VERIFIED=$(echo "$BUSINESS_INFO" | jq -r '.data.is_verified')

echo ""

# 4. 관리자 로그인 (사업자 승인용)
echo "4. 관리자 로그인..."
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "type": "admin"
  }' | jq -r '.sessionToken')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "⚠️  관리자 로그인 실패 (admin 계정 없음 - 수동 승인 필요)"
else
  echo "✅ 관리자 로그인 성공"
  
  # 5. 사업자 정보 승인
  echo "5. 사업자 정보 승인..."
  BUSINESS_ID=$(echo "$BUSINESS_INFO" | jq -r '.data.id')
  
  curl -s -X PUT "http://localhost:3000/api/admin/seller-business/$BUSINESS_ID/verify" \
    -H "Content-Type: application/json" \
    -H "X-Session-Token: $ADMIN_TOKEN" \
    -d '{"verified": true}' | jq '.'
fi

echo ""

# 6. 세금계산서 발행 테스트 (샘플 주문번호 사용)
echo "6. 세금계산서 발행 시도..."
echo "⚠️  실제 주문번호가 필요합니다. 주문 생성 후 테스트하세요."

# 샘플: ORDER_1738647600000_ABC123
# curl -s -X POST http://localhost:3000/api/seller/tax-invoices/issue \
#   -H "Content-Type: application/json" \
#   -H "X-Session-Token: $TOKEN" \
#   -d '{"order_no": "ORDER_1738647600000_ABC123"}' | jq '.'

echo ""

# 7. 세금계산서 목록 조회
echo "7. 세금계산서 목록 조회..."
curl -s -X GET "http://localhost:3000/api/seller/tax-invoices" \
  -H "X-Session-Token: $TOKEN" | jq '.'

echo ""
echo "==================================="
echo "테스트 완료"
echo "==================================="
