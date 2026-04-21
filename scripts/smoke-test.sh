#!/bin/bash
set -e
TARGET="${1:-staging}"
BASE=""
if [ "$TARGET" = "prod" ]; then BASE="https://live.ur-team.com"; else BASE="https://ur-live.pages.dev"; fi
echo "==> Smoke test: $BASE"
for path in "/api/health" "/api/products?limit=1" "/api/streams?status=live" "/"; do
  echo -n "  $path ... "
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE$path" 2>/dev/null || echo "FAIL")
  if [ "$STATUS" = "200" ]; then echo "OK"; else echo "FAIL ($STATUS)"; exit 1; fi
done
echo "All passed"
