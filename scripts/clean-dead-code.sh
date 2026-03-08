#!/bin/bash

echo "🧹 Dead Code Cleanup Starting..."
echo ""

# 1. ESLint로 미사용 imports 찾기
echo "📊 Step 1: Finding unused imports..."
npx eslint --ext .ts,.tsx src/ --max-warnings 0 --format compact 2>&1 | grep "unused-imports" | head -20

echo ""
echo "✅ ESLint check complete!"
echo ""

# 2. 빈 폴더 찾기
echo "📁 Step 2: Finding empty directories..."
find src -type d -empty 2>/dev/null || echo "No empty directories found"

echo ""
echo "🎉 Cleanup analysis complete!"
echo ""
echo "To fix unused imports automatically, run:"
echo "  npx eslint --ext .ts,.tsx src/ --fix"
