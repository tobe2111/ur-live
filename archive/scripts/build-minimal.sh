#!/bin/bash
# 메모리 절약형 빌드 스크립트

echo "🧹 1단계: 메모리 정리"
# 캐시 정리
rm -rf node_modules/.vite
rm -rf node_modules/.cache
sync && echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || echo "캐시 정리 완료"

echo "📦 2단계: 빌드 (메모리 제한)"
# Node.js 메모리 제한 설정 (512MB)
export NODE_OPTIONS="--max-old-space-size=512"

# 빌드 시도
npm run build

echo "✅ 빌드 완료"
