#!/bin/bash

# 🚀 무한 루프 수정 적용 스크립트

echo "🚨 무한 로그인 루프 수정 시작..."
echo ""

# 현재 디렉토리 확인
if [ ! -d "src" ]; then
  echo "❌ src 디렉토리를 찾을 수 없습니다."
  echo "프로젝트 루트에서 실행해주세요."
  exit 1
fi

echo "✅ 프로젝트 루트 확인 완료"
echo ""

# 1. 백업 생성
echo "📦 기존 파일 백업 중..."
mkdir -p src/backup_$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="src/backup_$(date +%Y%m%d_%H%M%S)"

if [ -f "src/contexts/AuthContext.tsx" ]; then
  cp src/contexts/AuthContext.tsx "$BACKUP_DIR/AuthContext.tsx.bak"
  echo "  ✅ AuthContext.tsx 백업 완료"
fi

if [ -f "src/App.tsx" ]; then
  cp src/App.tsx "$BACKUP_DIR/App.tsx.bak"
  echo "  ✅ App.tsx 백업 완료"
fi

if [ -f "src/pages/LoginPage.tsx" ]; then
  cp src/pages/LoginPage.tsx "$BACKUP_DIR/LoginPage.tsx.bak"
  echo "  ✅ LoginPage.tsx 백업 완료"
fi

echo ""
echo "📁 백업 위치: $BACKUP_DIR"
echo ""

# 2. 새 파일 적용
echo "🔧 새 파일 적용 중..."

if [ -f "src/contexts/AuthContext.FIXED.tsx" ]; then
  cp src/contexts/AuthContext.FIXED.tsx src/contexts/AuthContext.tsx
  echo "  ✅ AuthContext.tsx 교체 완료"
else
  echo "  ⚠️  AuthContext.FIXED.tsx 파일이 없습니다."
fi

if [ -f "src/App.FIXED.tsx" ]; then
  cp src/App.FIXED.tsx src/App.tsx
  echo "  ✅ App.tsx 교체 완료"
else
  echo "  ⚠️  App.FIXED.tsx 파일이 없습니다."
fi

if [ -f "src/pages/LoginPage.FIXED.tsx" ]; then
  cp src/pages/LoginPage.FIXED.tsx src/pages/LoginPage.tsx
  echo "  ✅ LoginPage.tsx 교체 완료"
else
  echo "  ⚠️  LoginPage.FIXED.tsx 파일이 없습니다."
fi

# RouteGuards는 이미 올바른 위치에 생성됨
if [ -f "src/components/auth/RouteGuards.tsx" ]; then
  echo "  ✅ RouteGuards.tsx 확인 완료"
else
  echo "  ⚠️  RouteGuards.tsx 파일이 없습니다."
fi

echo ""

# 3. TypeScript 컴파일 체크 (선택)
echo "🔍 TypeScript 컴파일 체크..."
if command -v tsc &> /dev/null; then
  tsc --noEmit 2>&1 | head -20
  if [ $? -eq 0 ]; then
    echo "  ✅ TypeScript 컴파일 성공"
  else
    echo "  ⚠️  TypeScript 오류가 있습니다. 위 로그를 확인하세요."
  fi
else
  echo "  ⚠️  tsc가 설치되어 있지 않습니다. 스킵..."
fi

echo ""

# 4. 완료 메시지
echo "✅ 무한 루프 수정 적용 완료!"
echo ""
echo "📝 다음 단계:"
echo "  1. npm run dev 또는 npm run build로 앱 실행"
echo "  2. 브라우저 콘솔에서 디버그 로그 확인"
echo "  3. localStorage.clear() 후 로그인 테스트"
echo ""
echo "📚 자세한 내용은 INFINITE_LOOP_FIX_GUIDE.md 참조"
echo ""
echo "🆘 문제가 계속되면?"
echo "  - 콘솔 로그 전체 복사"
echo "  - INFINITE_LOOP_FIX_GUIDE.md의 디버깅 체크리스트 확인"
echo ""
