#!/bin/bash
echo "=== API 엔드포인트 테스트 ==="
echo ""

echo "1. GET /api/streams (라이브 스트림 목록)"
curl -s http://localhost:3000/api/streams | jq -r '.success, .data | length' 2>/dev/null || echo "❌ 실패"
echo ""

echo "2. GET /api/streams/2 (라이브 스트림 상세)"
curl -s http://localhost:3000/api/streams/2 | jq -r '.success, .data.title' 2>/dev/null || echo "❌ 실패"
echo ""

echo "3. GET /api/streams/2/products (스트림 상품 목록)"
curl -s http://localhost:3000/api/streams/2/products | jq -r '.success, .data | length' 2>/dev/null || echo "❌ 실패"
echo ""

echo "4. GET /api/products/1 (상품 상세)"
curl -s http://localhost:3000/api/products/1 | jq -r '.success, .data.name' 2>/dev/null || echo "❌ 실패"
echo ""

echo "5. GET /api/streams/2/current-product (현재 상품)"
curl -s http://localhost:3000/api/streams/2/current-product | jq -r '.success' 2>/dev/null || echo "❌ 실패"
echo ""

echo "6. GET / (홈페이지)"
curl -s -I http://localhost:3000/ | head -1
echo ""

echo "7. GET /live/2 (라이브 페이지)"
curl -s -I http://localhost:3000/live/2 | head -1
echo ""

echo "8. GET /checkout (주문서)"
curl -s -I http://localhost:3000/checkout | head -1
echo ""

echo "9. GET /seller (셀러 대시보드)"
curl -s -I http://localhost:3000/seller | head -1
echo ""

