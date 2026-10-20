#!/bin/bash
# AuthContext를 Zustand로 마이그레이션하는 스크립트

cd /home/user/webapp

# AuthContext를 사용하는 모든 페이지 찾기
FILES=$(grep -l "from '@/contexts/AuthContext'" src/pages/*.tsx 2>/dev/null)

echo "=== AuthContext를 사용하는 페이지 목록 ==="
echo "$FILES"
echo ""

# 각 파일을 Zustand로 변환
for file in $FILES; do
    echo "처리 중: $file"
    
    # 1. import 문 변경
    sed -i "s|import { useAuth } from '@/contexts/AuthContext'|import { useAuthKR } from '@/shared/stores/useAuthKR'\nimport { useAuthWorld } from '@/shared/stores/useAuthWorld'\nimport { isKorea } from '@/shared/config/region'|g" "$file"
    
    # 2. useAuth() 호출을 조건부로 변경
    # 간단한 경우: const { ... } = useAuth()
    #sed -i "s|const { \(.*\) } = useAuth()|const authStore = isKorea() ? useAuthKR : useAuthWorld\n  const { \1 } = authStore()|g" "$file"
    
    echo "✓ 완료: $file"
done

echo ""
echo "=== 변환 완료 ==="
echo "주의: 각 파일을 수동으로 검토하여 isLoggedIn 등의 로직이 올바른지 확인하세요."
