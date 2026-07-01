#!/bin/bash
# 네이밍 충돌 체크 스크립트
# Usage: ./scripts/check-naming-conflicts.sh [filename]

TARGET_FILE=${1:-""}
# 🛠️ 2026-07-01: 하드코딩된 절대경로(/home/user/webapp)는 CI/타 환경에서 존재하지 않아
#   `cd` 가 실패하고도 스크립트가 리포지토리 루트에서 계속 스캔했음. 스크립트 위치 기준
#   리포지토리 루트로 이동해 어디서 실행해도 동일하게 동작하도록 수정.
cd "$(dirname "$0")/.." || { echo "❌ cannot cd to repo root"; exit 1; }

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
    
    # Extract MODULE-LEVEL variable declarations (column 0 — no leading whitespace).
    # 🛠️ 2026-07-01: 두 가지 버그 수정.
    #   ① 기존 정규식 `s/.*\[?(ident).*/\1/` 은 선두 `.*` 가 greedy 라 줄의 "마지막"
    #      식별자(주석 내 단어 등)를 잡아 오탐(예: `const geo = ... // 게이트 X)` → 'X').
    #   ② 들여쓴(함수 내부) 지역 선언까지 스캔하면 import 이름을 정상적으로 shadow 하는
    #      합법 코드를 전부 충돌로 오인함. 이 검사의 의도는 "모듈 레벨 재선언"(실제 TS 에러)
    #      감지이므로 컬럼 0(들여쓰기 없음) 선언만 대상으로 하고, 키워드 바로 뒤 첫 식별자만
    #      앵커링해 추출한다(구조분해 `const {X}/[X]/(X` 선두 토큰 포함).
    variables=$(grep -E "^(const|let|var)[[:space:]]+" "$file" | sed -E 's/^(const|let|var)[[:space:]]+[[{(]?[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*).*/\2/')
    
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
