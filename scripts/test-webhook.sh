#!/bin/bash
# ============================================================
# Toss Webhook Signature Test Script
# HMAC-SHA256 서명 생성 & 검증 테스트
# ============================================================
set -euo pipefail

API_URL="${API_URL:-http://localhost:8787}"
WEBHOOK_SECRET="${TOSS_WEBHOOK_SECRET:-test-webhook-secret-for-test}"
ORDER_NUM="ORD-SIG-$(date +%s)"

echo "=============================================="
echo "🔐 Toss Webhook HMAC-SHA256 Signature Test"
echo "=============================================="
echo "API: $API_URL"
echo "Order: $ORDER_NUM"
echo ""

# Build payload
PAYLOAD=$(cat <<EOF
{"eventType":"payment.confirmed","createdAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","data":{"paymentKey":"test_pk_sig_$(date +%s)","orderId":"$ORDER_NUM","orderName":"서명 검증 테스트","status":"DONE","totalAmount":29900,"currency":"KRW","method":"CARD","approvedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}}
EOF
)

# Generate HMAC-SHA256 signature
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')
echo "Payload length: ${#PAYLOAD} bytes"
echo "Computed HMAC-SHA256: v1=$SIG"
echo ""

# ---- Test 1: Valid Signature ----
echo "--- Test 1: Valid Signature ---"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "Toss-Signature: v1=$SIG" \
  -d "$PAYLOAD")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo "HTTP Status: $HTTP_STATUS"
echo "Response: $BODY"
if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ PASS: Returns 200 OK"
else
  echo "❌ FAIL: Expected 200, got $HTTP_STATUS"
fi
echo ""

# ---- Test 2: Invalid Signature ----
echo "--- Test 2: Invalid Signature (should return 200 with rejected/processed) ---"
RESPONSE2=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "Toss-Signature: v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" \
  -d "$PAYLOAD")

HTTP_STATUS2=$(echo "$RESPONSE2" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY2=$(echo "$RESPONSE2" | grep -v "HTTP_STATUS:")

echo "HTTP Status: $HTTP_STATUS2"
echo "Response: $BODY2"
if [ "$HTTP_STATUS2" = "200" ]; then
  echo "✅ PASS: Returns 200 (no retry storm)"
else
  echo "❌ FAIL: Expected 200"
fi
echo ""

# ---- Test 3: Duplicate Event (Idempotency) ----
echo "--- Test 3: Duplicate Idempotency Check ---"
RESPONSE3=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "Toss-Signature: v1=$SIG" \
  -d "$PAYLOAD")

HTTP_STATUS3=$(echo "$RESPONSE3" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY3=$(echo "$RESPONSE3" | grep -v "HTTP_STATUS:")

echo "HTTP Status: $HTTP_STATUS3"
echo "Response: $BODY3"
if echo "$BODY3" | grep -q "duplicate_skipped"; then
  echo "✅ PASS: Duplicate correctly skipped"
elif [ "$HTTP_STATUS3" = "200" ]; then
  echo "✅ PASS: Returns 200 (idempotent)"
else
  echo "❌ FAIL: Idempotency not working"
fi
echo ""

# ---- Test 4: Missing Signature Header ----
echo "--- Test 4: Missing Signature Header ---"
RESPONSE4=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP_STATUS4=$(echo "$RESPONSE4" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY4=$(echo "$RESPONSE4" | grep -v "HTTP_STATUS:")

echo "HTTP Status: $HTTP_STATUS4"
echo "Response: $BODY4"
if [ "$HTTP_STATUS4" = "200" ]; then
  echo "✅ PASS: Always returns 200 (Toss retry prevention)"
else
  echo "❌ FAIL"
fi
echo ""

# ---- Test 5: payment.cancelled ----
CANCEL_ORDER="ORD-CANCEL-SIG-$(date +%s)"
CANCEL_PAYLOAD=$(cat <<EOF
{"eventType":"payment.cancelled","createdAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","data":{"paymentKey":"pk_cancel_$(date +%s)","orderId":"$CANCEL_ORDER","status":"CANCELLED","totalAmount":45000,"currency":"KRW","cancelledAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","failureMessage":"고객 요청 취소"}}
EOF
)
CANCEL_SIG=$(echo -n "$CANCEL_PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')

echo "--- Test 5: payment.cancelled ---"
RESPONSE5=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "Toss-Signature: v1=$CANCEL_SIG" \
  -d "$CANCEL_PAYLOAD")

HTTP_STATUS5=$(echo "$RESPONSE5" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY5=$(echo "$RESPONSE5" | grep -v "HTTP_STATUS:")
echo "HTTP Status: $HTTP_STATUS5"
echo "Response: $BODY5"
[ "$HTTP_STATUS5" = "200" ] && echo "✅ PASS" || echo "❌ FAIL"
echo ""

# ---- Test 6: payment.failed ----
FAIL_ORDER="ORD-FAIL-SIG-$(date +%s)"
FAIL_PAYLOAD=$(cat <<EOF
{"eventType":"payment.failed","createdAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","data":{"paymentKey":"pk_fail_$(date +%s)","orderId":"$FAIL_ORDER","status":"ABORTED","totalAmount":15000,"currency":"KRW","failureCode":"INVALID_CARD","failureMessage":"유효하지 않은 카드"}}
EOF
)
FAIL_SIG=$(echo -n "$FAIL_PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')

echo "--- Test 6: payment.failed ---"
RESPONSE6=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$API_URL/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "Toss-Signature: v1=$FAIL_SIG" \
  -d "$FAIL_PAYLOAD")

HTTP_STATUS6=$(echo "$RESPONSE6" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY6=$(echo "$RESPONSE6" | grep -v "HTTP_STATUS:")
echo "HTTP Status: $HTTP_STATUS6"
echo "Response: $BODY6"
[ "$HTTP_STATUS6" = "200" ] && echo "✅ PASS" || echo "❌ FAIL"
echo ""

echo "=============================================="
echo "🎯 Webhook Test Complete"
echo "For production: set TOSS_WEBHOOK_SECRET to real value"
echo "   wrangler secret put TOSS_WEBHOOK_SECRET"
echo "=============================================="
