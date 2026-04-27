#!/bin/bash
echo "=== 구현된 페이지 목록 ==="
find src/pages -name "*.tsx" | sed 's|src/pages/||' | sed 's|.tsx||' | sort

echo -e "\n=== 구현된 컴포넌트 목록 ==="
find src/components -name "*.tsx" -o -name "*.ts" | sed 's|src/components/||' | sed 's|.tsx||' | sed 's|.ts||' | sort

echo -e "\n=== API 엔드포인트 목록 ==="
grep -E "app\.(get|post|put|delete|patch)\(" src/index.tsx | sed "s/.*app\.//" | sed "s/,.*$//" | sort

echo -e "\n=== 데이터베이스 테이블 목록 ==="
grep -h "CREATE TABLE" migrations/*.sql | sed 's/CREATE TABLE IF NOT EXISTS //' | sed 's/ (.*$//' | sort
