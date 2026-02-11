#!/bin/bash
# 네이밍 충돌 체크 스크립트
# Usage: ./scripts/check-naming-conflicts.sh [filename]

TARGET_FILE=${1:-""}
PROJECT_DIR="/home/user/webapp"
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
    
    # Extract variable declarations
    variables=$(grep -E "^\s*(const|let|var)\s+\[?([a-zA-Z_][a-zA-Z0-9_]*)" "$file" | sed -E 's/.*\[?([a-zA-Z_][a-zA-Z0-9_]*).*/\1/')
    
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
