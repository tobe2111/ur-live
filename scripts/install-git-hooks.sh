#!/bin/bash
# install-git-hooks.sh — Install git pre-commit hook

set -e

HOOK_DIR="$(git rev-parse --git-dir)/hooks"
HOOK_FILE="$HOOK_DIR/pre-commit"

cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# Pre-commit hook — enforce schema + auth rules
set -e

# Only check staged .ts files
staged_ts=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$' | grep -v 'node_modules/\|dist/' || true)

if [ -z "$staged_ts" ]; then
  exit 0
fi

echo "==> Pre-commit: checking schema references..."
bash scripts/check-schema-refs.sh || {
  echo ""
  echo "❌ Commit blocked. Fix the schema reference issues above."
  echo "   Run 'bash scripts/check-schema-refs.sh' to see details."
  echo "   Or add [skip-checks] to commit message to bypass (not recommended)."
  exit 1
}

# TypeScript check on staged files
echo "==> Pre-commit: TypeScript check..."
npx tsc --noEmit --skipLibCheck || {
  echo "❌ Commit blocked. Fix TypeScript errors."
  exit 1
}

echo "✅ Pre-commit checks passed"
EOF

chmod +x "$HOOK_FILE"
echo "✅ Git pre-commit hook installed at $HOOK_FILE"
