#!/usr/bin/env bash
# 🏭 유통스타트 도매몰 — 스테이징 스모크 테스트
#
# 머니플로우 E2E 검증의 자동화 가능한 부분(가격계산·주문생성·검증가드·목록·감독)을 실행.
# 실제 Toss 결제 승인은 브라우저 위젯이 필요 → docs/design/wholesale-utongstart-VERIFY.md 의 수동 절차 참조.
#
# 사용법:
#   BASE_URL=https://live.ur-team.com \
#   SELLER_TOKEN=<유통사 seller JWT> \
#   ADMIN_TOKEN=<admin JWT (선택)> \
#   bash scripts/wholesale-smoke.sh
#
# 사전조건(스테이징): repair-schema 실행 + 승인된 제조사 + 도매상품(is_supply_product=1, supply_price>0) +
#   유통사 등급 배정. (VERIFY.md 1~3단계)

set -uo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:8788}"
SELLER_TOKEN="${SELLER_TOKEN:-}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

pass=0; fail=0
green(){ printf '\033[32m✅ %s\033[0m\n' "$1"; pass=$((pass+1)); }
red(){ printf '\033[31m❌ %s\033[0m\n' "$1"; fail=$((fail+1)); }
info(){ printf '\033[36m• %s\033[0m\n' "$1"; }

# JSON 필드 추출 (python3).
jget(){ python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(\"d$1\"))" 2>/dev/null; }

if [ -z "$SELLER_TOKEN" ]; then red "SELLER_TOKEN 환경변수 필요"; exit 1; fi
SAUTH=(-H "Authorization: Bearer $SELLER_TOKEN")
echo "── BASE_URL=$BASE_URL ──"

# 1) 등급 조회
ME=$(curl -s "$BASE_URL/api/wholesale/me" "${SAUTH[@]}")
GRADE=$(echo "$ME" | jget "['grade']")
MARGIN=$(echo "$ME" | jget "['margin_pct']")
if [ -n "$GRADE" ]; then green "내 등급: $GRADE (마진 ${MARGIN}%)"; else red "GET /me 실패: $ME"; exit 1; fi

# 2) 카탈로그 → 첫 상품
CAT=$(curl -s "$BASE_URL/api/wholesale/catalog?limit=1" "${SAUTH[@]}")
PID=$(echo "$CAT" | jget "['items'][0]['id']")
PRICE=$(echo "$CAT" | jget "['items'][0]['distributor_price']")
if [ -n "$PID" ] && [ "$PID" != "None" ]; then
  green "카탈로그 상품 #$PID, 등급공급가 ${PRICE}원"
else
  red "카탈로그 비어있음 — 스테이징에 도매상품 시드 필요 (VERIFY.md 2단계). 응답: $CAT"; exit 1
fi

# 3) 주문 생성 (수량 2) → 금액 = 등급공급가 × 2 검증
QTY=2
ORD=$(curl -s -X POST "$BASE_URL/api/wholesale/orders" "${SAUTH[@]}" -H 'Content-Type: application/json' -d "{\"items\":[{\"product_id\":$PID,\"qty\":$QTY}]}")
TOSS_OID=$(echo "$ORD" | jget "['toss_order_id']")
AMOUNT=$(echo "$ORD" | jget "['amount']")
OID=$(echo "$ORD" | jget "['order_id']")
EXPECTED=$((PRICE * QTY))
if [ "$AMOUNT" = "$EXPECTED" ]; then
  green "주문 생성 #$OID — 금액 ${AMOUNT}원 == 등급가×수량(${EXPECTED}) ✓ (서버 재계산 일치)"
else
  red "금액 불일치: 서버 ${AMOUNT} vs 기대 ${EXPECTED}"
fi

# 4) 금액 위조 가드 — 틀린 금액으로 confirm → 400 '금액 불일치'
WRONG=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/wholesale/orders/confirm" "${SAUTH[@]}" -H 'Content-Type: application/json' -d "{\"paymentKey\":\"fake\",\"orderId\":\"$TOSS_OID\",\"amount\":1}")
if [ "$WRONG" = "400" ]; then green "금액 위조 가드 작동 (1원 confirm → 400)"; else red "금액 가드 비정상: HTTP $WRONG (400 기대)"; fi

# 5) 정상 금액 confirm → Toss 도달 (테스트키 없으면 NO_SECRET/402, 키 있으면 위젯 paymentKey 필요)
CONF=$(curl -s -X POST "$BASE_URL/api/wholesale/orders/confirm" "${SAUTH[@]}" -H 'Content-Type: application/json' -d "{\"paymentKey\":\"fake_no_widget\",\"orderId\":\"$TOSS_OID\",\"amount\":$AMOUNT}")
info "confirm(정상금액·가짜키) 응답: $CONF"
info "  → 실제 결제는 브라우저 위젯에서 paymentKey 발급 필요. VERIFY.md 4단계 수동 진행."

# 6) 주문 목록에 생성된 주문 노출
LIST=$(curl -s "$BASE_URL/api/wholesale/orders" "${SAUTH[@]}")
if echo "$LIST" | grep -q "\"id\":$OID"; then green "주문 목록에 #$OID 노출 (PENDING)"; else red "주문 목록 누락"; fi

# 7) 거래내역서 엔드포인트
ST=$(curl -s "$BASE_URL/api/wholesale/statement" "${SAUTH[@]}")
if echo "$ST" | grep -q '"success":true'; then green "거래내역서 조회 OK"; else red "거래내역서 실패: $ST"; fi

# 8) (admin) 도매주문 모니터에 노출
if [ -n "$ADMIN_TOKEN" ]; then
  AL=$(curl -s "$BASE_URL/api/admin/distributor/orders" -H "Authorization: Bearer $ADMIN_TOKEN")
  if echo "$AL" | grep -q "\"id\":$OID"; then green "어드민 모니터에 #$OID 노출"; else red "어드민 모니터 누락: $(echo "$AL" | head -c 200)"; fi
else
  info "ADMIN_TOKEN 미설정 — 어드민 모니터 검증 skip"
fi

echo "──────────────"
echo "통과 $pass / 실패 $fail"
echo "⚠️  미검증(수동 필수): 실제 Toss 결제승인 → 정산 적립 → 제조사 송장 → 환불 역전."
echo "    → docs/design/wholesale-utongstart-VERIFY.md 4~7단계 + SQL 확인."
[ "$fail" -eq 0 ]
