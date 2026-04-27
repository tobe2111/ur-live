#!/bin/bash
echo "=== 전체 페이지 검토 ==="
for page in src/pages/*.tsx; do
  filename=$(basename "$page" .tsx)
  lines=$(wc -l < "$page")
  echo "✓ $filename ($lines lines)"
done

echo -e "\n=== 전체 API 엔드포인트 검토 ==="
grep -E "app\.(get|post|put|delete|patch)\(" src/index.tsx | \
  sed 's/.*app\.//' | \
  sed 's/,.*//' | \
  sort | \
  nl

echo -e "\n=== 데이터베이스 테이블 검토 ==="
grep -h "CREATE TABLE" migrations/*.sql | \
  sed 's/CREATE TABLE IF NOT EXISTS //' | \
  sed 's/ (.*$//' | \
  sort -u | \
  nl

echo -e "\n=== 외부 서비스 연동 확인 ==="
echo "1. Kakao Login API - $(grep -c 'kakao' src/index.tsx) references"
echo "2. Daum 우편번호 API - $(grep -c 'daumcdn' src/pages/*.tsx) references"
echo "3. Barobill (세금계산서) - $(grep -c 'barobill' src/index.tsx) references"
echo "4. Firebase (채팅) - $(grep -c 'firebase' src/pages/*.tsx) references"
