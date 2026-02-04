#!/bin/bash

echo "=== Testing New APIs ==="
echo ""

# Test 1: Get seller products
echo "1. GET /api/seller/products"
curl -s http://localhost:3000/api/seller/products \
  -H "X-Session-Token: seller_1_test" | head -50
echo -e "\n"

# Test 2: Create product
echo "2. POST /api/seller/products"
curl -s -X POST http://localhost:3000/api/seller/products \
  -H "X-Session-Token: seller_1_test" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "테스트 신상품",
    "description": "API 테스트용 상품",
    "price": 50000,
    "original_price": 70000,
    "discount_rate": 28,
    "image_url": "https://picsum.photos/400/400",
    "stock": 100,
    "category": "테스트",
    "is_active": 1
  }' | head -50
echo -e "\n"

# Test 3: Create live stream
echo "3. POST /api/seller/streams"
curl -s -X POST http://localhost:3000/api/seller/streams \
  -H "X-Session-Token: seller_1_test" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "🎉 신상품 출시 라이브",
    "description": "신상품 소개 및 특가 행사",
    "youtube_video_id": "test123",
    "scheduled_at": "2026-02-10 20:00:00",
    "status": "scheduled"
  }' | head -50
echo -e "\n"

# Test 4: Update tracking (will fail - need real order)
echo "4. PUT /api/seller/orders/TEST123/tracking (Expected to fail - no order)"
curl -s -X PUT http://localhost:3000/api/seller/orders/TEST123/tracking \
  -H "X-Session-Token: seller_1_test" \
  -H "Content-Type: application/json" \
  -d '{
    "courier": "CJ대한통운",
    "tracking_number": "1234567890"
  }'
echo -e "\n"

echo "=== Tests Complete ==="
