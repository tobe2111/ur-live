#!/bin/bash

set -e

echo "🔍 HTML/React Validation Script"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# 1. Check for problematic modulepreload tags (active code only, not comments)
echo "1️⃣ Checking for problematic modulepreload tags..."
if grep -r '<link rel="modulepreload" href="/src/\|<link rel="modulepreload" href="\./' src/ index.html 2>/dev/null | grep -v "<!--"; then
  echo -e "${RED}❌ Found local file modulepreload (will cause data URL conversion)${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No problematic modulepreload tags${NC}"
fi
echo ""

# 2. Check for data URL MIME issues in build
if [ -d "dist" ]; then
  echo "2️⃣ Checking for data URL MIME issues in dist/..."
  if grep -r "data:application/octet-stream" dist/ 2>/dev/null; then
    echo -e "${RED}❌ Found octet-stream data URL in dist/${NC}"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ No octet-stream data URLs in dist/${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  dist/ not found (run 'npm run build' first)${NC}"
fi
echo ""

# 3. Check for invalid CSS syntax (from previous validation)
echo "3️⃣ Checking CSS syntax..."
if grep -rn "hsl([^)]*,[^)]*,[^)]*,[^)]*)" src/ 2>/dev/null | grep -v "hsla"; then
  echo -e "${RED}❌ Found invalid 4-parameter HSL syntax (use hsla or Tailwind)${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No invalid HSL syntax${NC}"
fi
echo ""

# 4. Check for HTML attributes in React code (exclude backup files)
echo "4️⃣ Checking for HTML attributes in React code..."
FOUND_CLASS=$(grep -rn '\sclass=' src/ 2>/dev/null | grep -v className | grep -v "\.bak" | grep -v "\.dirty" | grep -v "\.backup" | wc -l)
FOUND_ONCLICK=$(grep -rn '\sonclick=' src/ 2>/dev/null | grep -v onClick | grep -v "\.bak" | grep -v "\.dirty" | grep -v "\.backup" | wc -l)
FOUND_FOR=$(grep -rn '\sfor=' src/ 2>/dev/null | grep -v htmlFor | grep -v "\.bak" | grep -v "\.dirty" | grep -v "\.backup" | wc -l)

if [ "$FOUND_CLASS" -gt 0 ]; then
  echo -e "${RED}❌ Found $FOUND_CLASS instances of 'class=' (should be 'className=')${NC}"
  grep -rn '\sclass=' src/ 2>/dev/null | grep -v className | head -5
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No 'class=' attributes${NC}"
fi

if [ "$FOUND_ONCLICK" -gt 0 ]; then
  echo -e "${RED}❌ Found $FOUND_ONCLICK instances of 'onclick=' (should be 'onClick=')${NC}"
  grep -rn '\sonclick=' src/ 2>/dev/null | grep -v onClick | head -5
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No 'onclick=' attributes${NC}"
fi

if [ "$FOUND_FOR" -gt 0 ]; then
  echo -e "${RED}❌ Found $FOUND_FOR instances of 'for=' (should be 'htmlFor=')${NC}"
  grep -rn '\sfor=' src/ 2>/dev/null | grep -v htmlFor | head -5
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ No 'for=' attributes${NC}"
fi
echo ""

# 5. Check TypeScript compilation
echo "5️⃣ Checking TypeScript compilation..."
if npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS"; then
  echo -e "${RED}❌ TypeScript compilation errors${NC}"
  npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✅ TypeScript compilation passed${NC}"
fi
echo ""

# Summary
echo "================================"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All validations passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Found $ERRORS validation error(s)${NC}"
  exit 1
fi
