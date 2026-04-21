#!/bin/bash
# load-test-curl.sh — Fallback load test without k6 dependency
# Fires 200 requests with 20 concurrency to /api/products and reports
# status-code + timing distribution.

BASE_URL="${1:-https://ur-live.pages.dev}"
echo "==> Simple load test (200 requests, 20 concurrent)"
seq 1 200 | xargs -P 20 -I {} curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" "$BASE_URL/api/products?limit=20" | sort | uniq -c | sort -rn
