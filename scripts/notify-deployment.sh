#!/bin/bash
#
# Deployment Notification Script
# 
# Purpose: Send deployment notifications to Discord
# Usage: bash scripts/notify-deployment.sh <status> <environment> <version> <commit>
#

set -e

# Configuration
STATUS="${1:-success}"
ENVIRONMENT="${2:-production}"
VERSION="${3:-unknown}"
COMMIT="${4:-unknown}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

if [ -z "$DISCORD_WEBHOOK_URL" ]; then
  echo "⚠️ DISCORD_WEBHOOK_URL not set, skipping notification"
  exit 0
fi

# Colors
case "$STATUS" in
  success)
    COLOR=65280  # Green
    EMOJI="🚀"
    TITLE="Deployment Successful"
    ;;
  failure)
    COLOR=16711680  # Red
    EMOJI="🚨"
    TITLE="Deployment Failed"
    ;;
  rollback)
    COLOR=16744192  # Orange
    EMOJI="🔄"
    TITLE="Automatic Rollback"
    ;;
  started)
    COLOR=255  # Blue
    EMOJI="⏳"
    TITLE="Deployment Started"
    ;;
  *)
    COLOR=8421504  # Gray
    EMOJI="ℹ️"
    TITLE="Deployment Update"
    ;;
esac

# Build JSON payload
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
JSON_PAYLOAD=$(cat <<EOF
{
  "embeds": [{
    "title": "$EMOJI $TITLE",
    "description": "Deployment to **$ENVIRONMENT** environment",
    "color": $COLOR,
    "fields": [
      {"name": "Version", "value": "$VERSION", "inline": true},
      {"name": "Commit", "value": "\`$COMMIT\`", "inline": true},
      {"name": "Environment", "value": "$ENVIRONMENT", "inline": true},
      {"name": "Status", "value": "$STATUS", "inline": true}
    ],
    "timestamp": "$TIMESTAMP",
    "footer": {
      "text": "UR-Live CI/CD Pipeline"
    }
  }]
}
EOF
)

# Send notification
echo "📤 Sending deployment notification to Discord..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  "$DISCORD_WEBHOOK_URL")

if [ "$HTTP_CODE" -eq 204 ] || [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Notification sent successfully (HTTP $HTTP_CODE)"
else
  echo "❌ Failed to send notification (HTTP $HTTP_CODE)"
  exit 1
fi
