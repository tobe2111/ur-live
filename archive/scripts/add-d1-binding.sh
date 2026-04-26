#!/bin/bash

ACCOUNT_ID="1a2c006f0fb54894f81283a5ea787b83"
PROJECT_NAME="ur-live"
API_TOKEN="3i3ZxtKpifhT7BjnH-p2VS9jKyoQs83dl4w1_KXC"

echo "🔧 D1 바인딩 추가 중..."

# 현재 설정 가져오기
CURRENT_CONFIG=$(curl -s "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME" \
  -H "Authorization: Bearer $API_TOKEN" | jq '.result.deployment_configs.production')

echo "📦 현재 설정 확인..."
echo "$CURRENT_CONFIG" | jq -r 'keys'

# D1 바인딩 추가
echo ""
echo "🗄️ D1 바인딩 추가 중..."

curl -X PATCH "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PROJECT_NAME" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "deployment_configs": {
      "production": {
        "d1_databases": {
          "DB": {
            "id": "d9530ba6-7a26-4c02-9295-3ce5aef112a3"
          }
        }
      }
    }
  }' | jq '.'

echo ""
echo "✅ 완료! 재배포 대기 중..."
