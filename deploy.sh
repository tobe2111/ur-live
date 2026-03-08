#!/bin/bash
# 배포 스크립트
source .cloudflare-token.sh 2>/dev/null || true
npx wrangler pages deploy dist --project-name=ur-live --branch=main
