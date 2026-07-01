#!/bin/bash
# 네이밍 충돌 체크 스크립트
# Usage: ./scripts/check-naming-conflicts.sh [filename]

TARGET_FILE=${1:-""}
# 레포 루트(스크립트 위치 기준) — CI/로컬 어디서 실행해도 동작 (하드코딩 경로 제거)
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
    
    # Extract named imports (실제 로컬 바인딩만): `type ` 프리픽스 제거 + `X as Y` 는 별칭 Y 채택.
    imports=$(grep -E "^import[^']*\{" "$file" \
      | sed -E "s/^import[^{]*\{([^}]*)\}.*/\1/" | tr ',' '\n' \
      | sed -E 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^type[[:space:]]+//; s/.*[[:space:]]as[[:space:]]+//' \
      | grep -E '^[a-zA-Z_][a-zA-Z0-9_]*$')

    # Extract TOP-LEVEL simple declarations only: `const|let|var NAME =/:/;`.
    #   - 최상위만(들여쓰기 제외) → 함수 스코프의 합법적 로컬 섀도잉은 충돌 아님.
    #   - 단순 선언만(destructure `{`/`[` 제외) → 실제 "identifier already declared" 버그 클래스.
    #   (기존 greedy 정규식은 라인 끝 토큰/주석 단어까지 잡아 lucide 아이콘 `X` 등과 오탐)
    variables=$(grep -E "^(const|let|var)\s+[a-zA-Z_][a-zA-Z0-9_]*\s*(=|:|;)" "$file" \
      | sed -E 's/^(const|let|var)[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*).*/\2/')

    # Check for conflicts
    for import_var in $imports; do
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
