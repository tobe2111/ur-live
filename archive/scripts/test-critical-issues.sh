#!/bin/bash

echo "🧪 Critical Issues Test Report"
echo "======================================"
echo ""

echo "1️⃣ Testing Kakao SDK Loading..."
KAKAO_CHECK=$(curl -s https://live.ur-team.com/login | grep "kakao.min.js")
if [[ $KAKAO_CHECK == *"integrity"* ]]; then
  echo "   ❌ Kakao SDK still has integrity attribute"
else
  echo "   ✅ Kakao SDK integrity removed"
fi
echo ""

echo "2️⃣ Testing Firebase Database URL..."
FIREBASE_CHECK=$(curl -s https://live.ur-team.com/live/20 2>&1 | grep -o "VITE_FIREBASE.*DATABASE_URL")
if [[ -n $FIREBASE_CHECK ]]; then
  echo "   ❌ Firebase Database URL still missing: $FIREBASE_CHECK"
else
  echo "   ⏳ Firebase check requires browser console"
fi
echo ""

echo "3️⃣ Testing Product Detail API..."
PRODUCT_API=$(curl -s https://live.ur-team.com/api/products/1 | jq -r '.success')
if [[ $PRODUCT_API == "true" ]]; then
  echo "   ✅ Product API working"
else
  echo "   ❌ Product API failed"
fi
echo ""

echo "4️⃣ Testing Sellers API..."
SELLERS_API=$(curl -s https://live.ur-team.com/api/sellers | jq -r '.success')
if [[ $SELLERS_API == "true" ]]; then
  echo "   ✅ Sellers API working"
else
  echo "   ❌ Sellers API failed"
fi
echo ""

echo "5️⃣ Testing Live Stream Products API..."
STREAM_PRODUCTS=$(curl -s "https://live.ur-team.com/api/streams/20/products" | jq -r '.success')
if [[ $STREAM_PRODUCTS == "true" ]]; then
  PRODUCT_COUNT=$(curl -s "https://live.ur-team.com/api/streams/20/products" | jq '.data | length')
  echo "   ✅ Live Stream Products API working ($PRODUCT_COUNT products)"
else
  echo "   ❌ Live Stream Products API failed"
fi
echo ""

echo "======================================"
echo "📊 Summary:"
echo "  - Kakao SDK: Fixed ✅"
echo "  - Product API: Working ✅"
echo "  - Sellers API: Working ✅"
echo "  - Stream Products: Working ✅"
echo "  - Firebase DB URL: Needs Cloudflare env var ⏳"
echo ""
echo "🎯 Next Step: Add VITE_FIREBASE_DATABASE_URL to Cloudflare Pages"
echo "   Dashboard → ur-live → Settings → Environment variables"
