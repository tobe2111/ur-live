#!/bin/bash

# CSS 구문 검증 스크립트
# 사용법: ./validate-css.sh <directory>

DIR=${1:-.}

echo "🔍 CSS 구문 검증 시작..."
echo ""

# 1. 잘못된 HSL 구문 찾기
echo "1️⃣ 잘못된 HSL 구문 검사 (4개 파라미터)"
INVALID_HSL=$(grep -rn "hsl([^)]*,[^)]*,[^)]*,[^)]*)" "$DIR" 2>/dev/null)
if [ -n "$INVALID_HSL" ]; then
  echo "❌ 발견됨!"
  echo "$INVALID_HSL"
  echo ""
  echo "💡 해결 방법:"
  echo "   hsl(0, 0%, 96%, 0.3) ❌"
  echo "   → hsla(0, 0%, 96%, 0.3) ✅"
  echo "   → text-white/30 (Tailwind) ✅"
  exit 1
else
  echo "✅ 정상"
fi
echo ""

# 2. 잘못된 RGB 구문 찾기
echo "2️⃣ 잘못된 RGB 구문 검사 (4개 파라미터)"
INVALID_RGB=$(grep -rn "rgb([^)]*,[^)]*,[^)]*,[^)]*)" "$DIR" 2>/dev/null)
if [ -n "$INVALID_RGB" ]; then
  echo "❌ 발견됨!"
  echo "$INVALID_RGB"
  echo ""
  echo "💡 해결 방법:"
  echo "   rgb(255, 255, 255, 0.5) ❌"
  echo "   → rgba(255, 255, 255, 0.5) ✅"
  echo "   → bg-white/50 (Tailwind) ✅"
  exit 1
else
  echo "✅ 정상"
fi
echo ""

# 3. HTML onclick 속성 찾기
echo "3️⃣ HTML onclick 속성 검사 (React에서는 onClick)"
ONCLICK=$(grep -rn 'onclick=' "$DIR" --include="*.tsx" --include="*.jsx" 2>/dev/null)
if [ -n "$ONCLICK" ]; then
  echo "⚠️  발견됨!"
  echo "$ONCLICK"
  echo ""
  echo "💡 해결 방법:"
  echo "   onclick=\"handleClick()\" ❌"
  echo "   → onClick={handleClick} ✅"
else
  echo "✅ 정상"
fi
echo ""

# 4. class 속성 찾기 (React에서는 className)
echo "4️⃣ HTML class 속성 검사 (React에서는 className)"
CLASS_ATTR=$(grep -rn ' class=' "$DIR" --include="*.tsx" --include="*.jsx" 2>/dev/null | grep -v className)
if [ -n "$CLASS_ATTR" ]; then
  echo "⚠️  발견됨!"
  echo "$CLASS_ATTR" | head -5
  echo ""
  echo "💡 해결 방법:"
  echo "   class=\"container\" ❌"
  echo "   → className=\"container\" ✅"
else
  echo "✅ 정상"
fi
echo ""

echo "✅ CSS 구문 검증 완료!"
exit 0
