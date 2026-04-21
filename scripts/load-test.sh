#!/bin/bash
# load-test.sh — Basic load test for ur-live
# Requires: k6 (https://k6.io/)
#
# Usage: bash scripts/load-test.sh [staging|prod]

set -e

TARGET="${1:-staging}"
BASE_URL=""
if [ "$TARGET" = "prod" ]; then
  BASE_URL="https://live.ur-team.com"
else
  BASE_URL="https://ur-live.pages.dev"
fi

echo "==> Load test against $BASE_URL"

# Check k6 installed
if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 not installed. Install: brew install k6 OR https://k6.io/docs/getting-started/installation/"
  echo "   Falling back to simple curl loop..."
  bash "$(dirname "$0")/load-test-curl.sh" "$BASE_URL"
  exit 0
fi

BASE_URL="$BASE_URL" k6 run "$(dirname "$0")/load-test.k6.js"
