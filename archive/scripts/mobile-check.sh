#!/bin/bash

echo "📱 모바일 최적화 검증 스크립트"
echo "================================"
echo ""

PROJECT_ROOT="/home/user/webapp"

# 1. 반응형 클래스 체크
echo "1️⃣ 반응형 클래스 사용 현황"
echo "----------------------------"
echo "✅ sm: (640px+) 사용 횟수: $(grep -r "sm:" $PROJECT_ROOT/src --include="*.tsx" | wc -l)"
echo "✅ md: (768px+) 사용 횟수: $(grep -r "md:" $PROJECT_ROOT/src --include="*.tsx" | wc -l)"
echo "✅ lg: (1024px+) 사용 횟수: $(grep -r "lg:" $PROJECT_ROOT/src --include="*.tsx" | wc -l)"
echo ""

# 2. 터치 영역 체크 (버튼 크기)
echo "2️⃣ 터치 영역 (최소 44px 권장)"
echo "----------------------------"
echo "⚠️  작은 버튼 (h-8, w-8 = 32px): $(grep -r "h-8.*w-8\|w-8.*h-8" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo "✅ 적절한 버튼 (h-10+ = 40px+): $(grep -r "h-10\|h-12\|h-14\|h-16" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo ""

# 3. 폰트 크기 체크
echo "3️⃣ 폰트 크기 (최소 16px 권장)"
echo "----------------------------"
echo "⚠️  작은 폰트 (text-xs = 12px): $(grep -r "text-xs" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo "⚠️  작은 폰트 (text-sm = 14px): $(grep -r "text-sm" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo "✅ 적절한 폰트 (text-base+ = 16px+): $(grep -r "text-base\|text-lg\|text-xl" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo ""

# 4. 고정 너비 체크
echo "4️⃣ 고정 너비 사용 (모바일에서 문제 가능)"
echo "----------------------------"
echo "⚠️  고정 너비 (w-\[숫자\]px): $(grep -r "w-\[.*px\]" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo "✅ 반응형 너비 (w-full, w-screen): $(grep -r "w-full\|w-screen" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo ""

# 5. 오버플로우 체크
echo "5️⃣ 오버플로우 처리"
echo "----------------------------"
echo "✅ 스크롤 처리 (overflow-): $(grep -r "overflow-" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo "✅ 숨김 처리 (hidden sm:block): $(grep -r "hidden.*sm:block\|hidden.*sm:flex" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo ""

# 6. 모바일 전용 클래스 체크
echo "6️⃣ 모바일 전용 최적화"
echo "----------------------------"
echo "✅ 모바일 숨김 (sm:hidden): $(grep -r "sm:hidden" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo "✅ 모바일 패딩 조정 (px-4 sm:px-6): $(grep -r "px-4.*sm:px-" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo ""

# 7. 주요 페이지 체크
echo "7️⃣ 주요 페이지 반응형 점수"
echo "----------------------------"
echo "HomePage: $(grep -c "sm:\|md:\|lg:" $PROJECT_ROOT/src/pages/HomePage.tsx) 개 반응형 클래스"
echo "LivePage: $(grep -c "sm:\|md:\|lg:" $PROJECT_ROOT/src/pages/LivePage.tsx) 개 반응형 클래스"
echo "CartPage: $(grep -c "sm:\|md:\|lg:" $PROJECT_ROOT/src/pages/CartPage.tsx) 개 반응형 클래스"
echo "CheckoutPage: $(grep -c "sm:\|md:\|lg:" $PROJECT_ROOT/src/pages/CheckoutPage.tsx) 개 반응형 클래스"
echo ""

# 8. 메타 태그 체크
echo "8️⃣ 모바일 메타 태그"
echo "----------------------------"
if grep -q "viewport" $PROJECT_ROOT/index.html 2>/dev/null; then
    echo "✅ viewport 메타 태그 있음"
else
    echo "⚠️  viewport 메타 태그 없음 (추가 필요)"
fi
echo ""

# 9. Touch 이벤트 체크
echo "9️⃣ 터치 이벤트"
echo "----------------------------"
echo "onClick 사용: $(grep -r "onClick=" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo "onTouch 사용: $(grep -r "onTouch" $PROJECT_ROOT/src --include="*.tsx" | wc -l) 개"
echo ""

# 10. 권장 사항
echo "🎯 권장 사항"
echo "----------------------------"
echo "1. 모든 버튼은 최소 h-10 (40px) 이상 사용"
echo "2. 중요한 텍스트는 text-base (16px) 이상 사용"
echo "3. 고정 너비 대신 w-full, max-w-* 사용"
echo "4. 데스크톱 전용 요소는 hidden sm:block 사용"
echo "5. 모바일 전용 여백은 px-4 sm:px-6 패턴 사용"
echo ""

echo "✅ 검증 완료!"
