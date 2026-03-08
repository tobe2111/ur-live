#!/bin/bash

echo "🔍 데이터베이스 계정 확인 중..."
echo ""

# API 호출
response=$(curl -s https://live.ur-team.com/api/debug/accounts)

echo "📊 응답 데이터:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"

echo ""
echo "---"
echo ""

# 셀러 계정 확인
seller_count=$(echo "$response" | jq '.data.sellers | length' 2>/dev/null)
if [ "$seller_count" = "1" ]; then
  echo "✅ 셀러 계정 존재"
  echo "   이메일: $(echo "$response" | jq -r '.data.sellers[0].email')"
  echo "   이름: $(echo "$response" | jq -r '.data.sellers[0].name')"
  echo "   상태: $(echo "$response" | jq -r '.data.sellers[0].status')"
  echo "   활성: $(echo "$response" | jq -r '.data.sellers[0].is_active')"
  echo "   해시 미리보기: $(echo "$response" | jq -r '.data.sellers[0].hash_preview')"
  echo "   해시 길이: $(echo "$response" | jq -r '.data.sellers[0].hash_length')"
elif [ "$seller_count" = "0" ]; then
  echo "❌ 셀러 계정 없음"
  echo "   → SQL을 다시 실행해야 합니다!"
else
  echo "⚠️ 셀러 계정 개수: $seller_count"
fi

echo ""

# 어드민 계정 확인
admin_count=$(echo "$response" | jq '.data.admins | length' 2>/dev/null)
if [ "$admin_count" = "1" ]; then
  echo "✅ 어드민 계정 존재"
  echo "   이메일: $(echo "$response" | jq -r '.data.admins[0].email')"
  echo "   이름: $(echo "$response" | jq -r '.data.admins[0].name')"
  echo "   역할: $(echo "$response" | jq -r '.data.admins[0].role')"
  echo "   활성: $(echo "$response" | jq -r '.data.admins[0].is_active')"
  echo "   해시 미리보기: $(echo "$response" | jq -r '.data.admins[0].hash_preview')"
  echo "   해시 길이: $(echo "$response" | jq -r '.data.admins[0].hash_length')"
elif [ "$admin_count" = "0" ]; then
  echo "❌ 어드민 계정 없음"
  echo "   → SQL을 다시 실행해야 합니다!"
else
  echo "⚠️ 어드민 계정 개수: $admin_count"
fi

echo ""
echo "---"
echo ""

# 예상 해시 확인
echo "📋 예상 해시 값:"
echo "   셀러:  \$2b\$10\$ECEIHTgi3Ge1p3"
echo "   어드민: \$2b\$10\$3WoWNsMd./fG2mM"
