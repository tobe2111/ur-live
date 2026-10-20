# 🚨 CRITICAL: React Version Policy

## ⚠️ DO NOT UPGRADE REACT

This project **MUST** use React 18.3.1. 

### Why?
React 19+ causes critical errors:
- ❌ `Cannot read properties of undefined (reading 'forwardRef')`
- ❌ White screen on all pages
- ❌ Incompatibility with UI libraries:
  - Radix UI
  - Recharts
  - lucide-react
  - React Router 7+

### Locked Versions
```json
{
  "react": "18.3.1",          // EXACT - no ^
  "react-dom": "18.3.1",      // EXACT - no ^
  "react-router-dom": "6.28.1" // 6.x only
}
```

### Automatic Protection
This project has **4 layers** of protection:

1. **package.json**:
   - Exact versions (no `^` or `~`)
   - `overrides` section to force React 18.3.1 globally
   - `engines` enforcement

2. **.npmrc**:
   - `save-exact=true` (always save exact versions)
   - `engine-strict=true` (enforce Node.js version)

3. **Pre-install check** (`scripts/check-react-version.js`):
   - Runs before `npm install`
   - Blocks installation if React version is wrong

4. **Post-install verification** (`scripts/verify-react-version.js`):
   - Runs after `npm install`
   - Verifies node_modules has correct version

### If You See Errors

#### Error: "Cannot read properties of undefined (reading 'forwardRef')"
```bash
# Fix immediately:
rm -rf node_modules package-lock.json
npm install

# Verify:
npm list react react-dom
```

#### Error: "React version mismatch" during install
```bash
# Your package.json was modified - restore correct versions:
npm install react@18.3.1 react-dom@18.3.1 react-router-dom@6.28.1 --save-exact
```

### Upgrading Dependencies

#### ✅ SAFE to upgrade:
- Vite
- TypeScript
- Wrangler
- Hono
- Tailwind CSS
- Axios
- Other non-React libraries

#### ❌ DO NOT upgrade:
- React (stay at 18.3.1)
- React DOM (stay at 18.3.1)
- React Router (stay at 6.x)
- Any library that requires React 19+

### Future React 19 Migration

**Before upgrading to React 19**, ensure:
1. All UI libraries support React 19
2. Test on a separate branch
3. Verify no forwardRef errors in build
4. Check all pages render correctly

**Check library compatibility:**
```bash
# Check if libraries support React 19
npm outdated
npm info @radix-ui/react-slot peerDependencies
npm info recharts peerDependencies
npm info lucide-react peerDependencies
```

---

## Quick Commands

```bash
# Verify current React version
npm list react react-dom react-router-dom

# Emergency fix (if React version is wrong)
rm -rf node_modules package-lock.json && npm install

# Check for conflicting dependencies
npm ls react --depth=10
```

---

**Last Updated**: 2026-02-22  
**Current React Version**: 18.3.1  
**Status**: ✅ LOCKED & PROTECTED
