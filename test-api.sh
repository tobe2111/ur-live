#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_BASE="https://live.ur-team.com"

echo "=================================="
echo "🧪 API 통합 테스트 시작"
echo "=================================="
echo ""

# Phase 1: 스트림 목록 조회
echo "📺 Phase 1: 스트림 목록 조회"
RESPONSE=$(curl -s "$API_BASE/api/streams")
STREAM_COUNT=$(echo $RESPONSE | jq -r '.data | length')
if [ "$STREAM_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ 스트림 목록 조회 성공: ${STREAM_COUNT}개${NC}"
    STREAM_ID=$(echo $RESPONSE | jq -r '.data[0].id')
    echo "   첫 번째 스트림 ID: $STREAM_ID"
else
    echo -e "${RED}❌ 스트림 목록 조회 실패${NC}"
    exit 1
fi
echo ""

# Phase 2: 특정 스트림 조회
echo "📺 Phase 2: 특정 스트림 조회 (ID: $STREAM_ID)"
STREAM_RESPONSE=$(curl -s "$API_BASE/api/streams/$STREAM_ID")
STREAM_TITLE=$(echo $STREAM_RESPONSE | jq -r '.data.title')
if [ "$STREAM_TITLE" != "null" ]; then
    echo -e "${GREEN}✅ 스트림 조회 성공${NC}"
    echo "   제목: $STREAM_TITLE"
else
    echo -e "${RED}❌ 스트림 조회 실패${NC}"
fi
echo ""

# Phase 3: 스트림의 상품 목록 조회
echo "🛍️  Phase 3: 스트림 상품 목록 조회"
PRODUCTS_RESPONSE=$(curl -s "$API_BASE/api/streams/$STREAM_ID/products")
PRODUCT_COUNT=$(echo $PRODUCTS_RESPONSE | jq -r '.data | length')
if [ "$PRODUCT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ 상품 목록 조회 성공: ${PRODUCT_COUNT}개${NC}"
    PRODUCT_ID=$(echo $PRODUCTS_RESPONSE | jq -r '.data[0].id')
    PRODUCT_NAME=$(echo $PRODUCTS_RESPONSE | jq -r '.data[0].name')
    PRODUCT_PRICE=$(echo $PRODUCTS_RESPONSE | jq -r '.data[0].price')
    echo "   첫 번째 상품:"
    echo "   - ID: $PRODUCT_ID"
    echo "   - 이름: $PRODUCT_NAME"
    echo "   - 가격: ${PRODUCT_PRICE}원"
else
    echo -e "${YELLOW}⚠️  상품이 없습니다${NC}"
    PRODUCT_ID=1
fi
echo ""

# Phase 4: 특정 상품 조회
echo "🛍️  Phase 4: 특정 상품 조회 (ID: $PRODUCT_ID)"
PRODUCT_RESPONSE=$(curl -s "$API_BASE/api/products/$PRODUCT_ID")
PRODUCT_DETAIL=$(echo $PRODUCT_RESPONSE | jq -r '.data.name')
if [ "$PRODUCT_DETAIL" != "null" ]; then
    echo -e "${GREEN}✅ 상품 조회 성공${NC}"
    echo "   상품명: $PRODUCT_DETAIL"
    PRODUCT_STOCK=$(echo $PRODUCT_RESPONSE | jq -r '.data.stock')
    echo "   재고: $PRODUCT_STOCK"
else
    echo -e "${RED}❌ 상품 조회 실패${NC}"
fi
echo ""

# Phase 5: 재고 확인
echo "📦 Phase 5: 재고 확인 (Product ID: $PRODUCT_ID)"
STOCK_RESPONSE=$(curl -s "$API_BASE/api/products/$PRODUCT_ID/stock")
STOCK=$(echo $STOCK_RESPONSE | jq -r '.data.stock')
if [ "$STOCK" != "null" ]; then
    echo -e "${GREEN}✅ 재고 확인 성공: ${STOCK}개${NC}"
else
    echo -e "${RED}❌ 재고 확인 실패${NC}"
fi
echo ""

# Phase 6: 404 에러 테스트
echo "🚫 Phase 6: 404 에러 테스트"
NOT_FOUND=$(curl -s -w "%{http_code}" -o /dev/null "$API_BASE/api/streams/99999")
if [ "$NOT_FOUND" == "404" ]; then
    echo -e "${GREEN}✅ 404 에러 처리 정상${NC}"
else
    echo -e "${YELLOW}⚠️  404 에러 코드: $NOT_FOUND (expected: 404)${NC}"
fi
echo ""

# Phase 7: 인증 없이 사용자 API 접근 (401 예상)
echo "🔒 Phase 7: 인증 테스트"
UNAUTH_RESPONSE=$(curl -s -w "%{http_code}" "$API_BASE/api/orders/user/999")
HTTP_CODE=$(echo $UNAUTH_RESPONSE | tail -c 4)
if [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
    echo -e "${GREEN}✅ 인증 필요 API 보호 정상${NC}"
else
    echo -e "${YELLOW}⚠️  인증 테스트 - HTTP $HTTP_CODE (expected: 401 or 403)${NC}"
fi
echo ""

echo "=================================="
echo "🎉 API 테스트 완료"
echo "=================================="
