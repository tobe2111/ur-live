#!/bin/bash

echo "=== Pages ==="
ls -1 src/pages/*.tsx 2>/dev/null | sed 's|src/pages/||' | sed 's|.tsx||'

echo ""
echo "=== Components ==="
find src/components -name "*.tsx" 2>/dev/null | sed 's|src/components/||' | sed 's|.tsx||'

echo ""
echo "=== API Endpoints ==="
grep -E "^app\.(get|post|put|patch|delete)\(" src/index.tsx | sed "s/app\.//" | sed "s/async (c).*//" | head -50

echo ""
echo "=== Database Tables ==="
grep -E "CREATE TABLE" migrations/*.sql 2>/dev/null | sed 's/.*CREATE TABLE//' | sed 's/ .*//' | sort -u
