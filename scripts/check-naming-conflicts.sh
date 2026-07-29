#!/bin/bash
# 네이밍 충돌 체크 스크립트
# Usage: ./scripts/check-naming-conflicts.sh [filename]

TARGET_FILE=${1:-""}
# 🛡️ 스크립트 위치 기준 레포 루트 (하드코딩 경로 금지 — CI/다른 머신에서도 동작)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "🔍 Checking for naming conflicts..."
echo ""

# ==========================================
# Function: Check single file
# ==========================================
check_file() {
    local file=$1
    local conflicts_found=false
    
    echo "📄 Checking: $file"
    
    # Extract imports
    imports=$(grep -E "^import.*from" "$file" | sed -E "s/import \{([^}]+)\}.*/\1/" | tr ',' '\n' | sed 's/^ *//;s/ *$//')
    
    # Extract MODULE-LEVEL variable declarations (들여쓰기 없는 최상위만).
    # 🛡️ 진짜 충돌 = 최상위 import명 == 최상위 선언명 (= JS 중복 바인딩, 컴파일 에러).
    #   함수 스코프(들여쓰기) 선언이 import 를 가리는 건 합법이라 제외 → 오탐 0.
    # 🛡️ (이전 버그) greedy `.*` sed 는 `const geo = ... // 게이트 X)` 처럼 줄 끝 주석의
    #   마지막 단어(X)를 변수로 오인 → lucide `X` import 와 가짜 충돌. grep -oE 로 선언부만 잘라 방지.
    variables=$(grep -oE "^(const|let|var)[[:space:]]+\[?[a-zA-Z_][a-zA-Z0-9_]*" "$file" | sed -E 's/^(const|let|var)[[:space:]]+\[?//')
    
    # Check for conflicts
    for import_var in $imports; do
        # Remove 'as alias' part
        import_var=$(echo "$import_var" | awk '{print $1}')
        
        if echo "$variables" | grep -q "^${import_var}$"; then
            echo "  ⚠️  CONFLICT: '$import_var' is both imported and declared as variable"
            conflicts_found=true
        fi
    done
    
    if [ "$conflicts_found" = false ]; then
        echo "  ✓ No conflicts found"
    fi
    
    echo ""
}

# ==========================================
# Main
# ==========================================

if [ -n "$TARGET_FILE" ]; then
    # Check single file
    if [ -f "$TARGET_FILE" ]; then
        check_file "$TARGET_FILE"
    else
        echo "❌ File not found: $TARGET_FILE"
        exit 1
    fi
else
    # Check all TypeScript files
    echo "Scanning all TypeScript files..."
    echo ""
    
    CONFLICTS_COUNT=0
    
    while IFS= read -r file; do
        if check_file "$file" | grep -q "CONFLICT"; then
            CONFLICTS_COUNT=$((CONFLICTS_COUNT + 1))
        fi
    done < <(find src -name "*.tsx" -o -name "*.ts" | grep -v "node_modules")
    
    echo "=========================================="
    if [ $CONFLICTS_COUNT -eq 0 ]; then
        echo "✅ No naming conflicts found!"
    else
        echo "⚠️  Found conflicts in $CONFLICTS_COUNT file(s)"
        echo "❌ Please fix conflicts before committing"
        exit 1
    fi
fi
