#!/bin/bash
# 모든 AuthContext 페이지를 Zustand로 자동 마이그레이션

cd /home/user/webapp

echo "🚀 AuthContext → Zustand 자동 마이그레이션 시작"
echo "=================================================="
echo ""

# 백업 생성
BACKUP_DIR="backups/auth-migration-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 백업 생성 중: $BACKUP_DIR"
cp -r src/pages/*.tsx "$BACKUP_DIR/" 2>/dev/null
cp src/contexts/AuthContext.tsx "$BACKUP_DIR/" 2>/dev/null
echo "✅ 백업 완료"
echo ""

# AuthContext 사용 파일 찾기
FILES=$(grep -l "from '@/contexts/AuthContext'" src/pages/*.tsx 2>/dev/null | grep -v ".backup" | grep -v ".FIXED" | grep -v ".BACKUP")

echo "📝 마이그레이션 대상 파일:"
echo "$FILES" | while read file; do echo "  - $file"; done
echo ""

TOTAL_FILES=$(echo "$FILES" | wc -l)
CURRENT=0

for file in $FILES; do
    CURRENT=$((CURRENT + 1))
    FILENAME=$(basename "$file")
    
    echo "[$CURRENT/$TOTAL_FILES] 처리 중: $FILENAME"
    
    # 이미 마이그레이션된 파일 건너뛰기
    if grep -q "useAuthKR\|useAuthWorld" "$file" 2>/dev/null; then
        echo "  ⏭️  이미 마이그레이션됨, 건너뜀"
        continue
    fi
    
    # 1. Import 문 변경
    sed -i "s|import { useAuth } from '@/contexts/AuthContext'|import { useAuthKR } from '@/shared/stores/useAuthKR'\nimport { useAuthWorld } from '@/shared/stores/useAuthWorld'\nimport { isKorea } from '@/shared/config/region'|g" "$file"
    
    # 2. useAuth() 호출 패턴 찾기
    if grep -q "const {.*} = useAuth()" "$file"; then
        # useAuth() 호출이 있는 경우
        
        # 2-1. 간단한 패턴: const { ... } = useAuth()
        # 임시 마커 추가
        sed -i "s|const {\([^}]*\)} = useAuth()|// MIGRATE: const {\1} = useAuth()|g" "$file"
        
        # 2-2. 새로운 코드 추가 (useAuth() 바로 위에)
        sed -i "/\/\/ MIGRATE: const {/i\\
  // ✅ Zustand 스토어 사용 (지역별)\n\
  const authStore = isKorea() ? useAuthKR : useAuthWorld\n\
  const { isAuthReady, user, logout } = authStore()\n\
  const isLoggedIn = !!user\n" "$file"
        
        # 2-3. 기존 useAuth() 호출 제거
        sed -i "/\/\/ MIGRATE: const {/d" "$file"
        
        echo "  ✅ useAuth() → authStore() 변환 완료"
    else
        echo "  ⚠️  useAuth() 패턴을 찾을 수 없음, 수동 확인 필요"
    fi
    
    echo ""
done

echo ""
echo "=================================================="
echo "✅ 자동 마이그레이션 완료!"
echo "=================================================="
echo ""
echo "📋 다음 단계:"
echo "1. 변경사항 검토:"
echo "   git diff src/pages/"
echo ""
echo "2. 빌드 테스트:"
echo "   npm run build:kr"
echo ""
echo "3. 로컬 테스트:"
echo "   npm run dev:kr"
echo "   - 각 페이지 접속 테스트"
echo "   - 로그인/로그아웃 테스트"
echo ""
echo "4. 커밋 & 배포:"
echo "   git add src/pages/"
echo "   git commit -m 'feat: Complete AuthContext to Zustand migration'"
echo "   git push origin main"
echo ""
echo "⚠️  주의: 자동 마이그레이션 후 반드시 수동 검토 필요!"
echo ""
