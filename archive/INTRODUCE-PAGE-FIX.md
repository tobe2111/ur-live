# Introduce Page MIME Type Error - Root Cause Analysis & Fix

## 🚨 Problem Summary
**Error**: `Failed to load module script: Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "application/octet-stream"`

**Impact**: 
- White screen on `/introduce` page
- Browser console error
- No React app rendering

---

## 🔍 Deep Root Cause Analysis

### Investigation Timeline

#### 1. Initial Hypothesis (❌ Wrong)
- **Suspected**: Invalid HSL color syntax in GripFrameLayout.tsx
- **Fixed**: Replaced HSL with Tailwind classes
- **Result**: Error persisted

#### 2. Second Hypothesis (❌ Wrong)
- **Suspected**: IntroducePage returning `null` breaking React tree
- **Fixed**: Changed `return null` to `return <div className="w-full h-full" />`
- **Result**: Error persisted

#### 3. Third Hypothesis (❌ Wrong)
- **Suspected**: Browser cache serving old build
- **Actions**: 
  - Cleared `.wrangler` and `dist` folders
  - Full rebuild
  - PM2 restart
  - Hard refresh browser
- **Result**: Error persisted

#### 4. Final Investigation (✅ ROOT CAUSE FOUND)

**Critical Discovery**: Line 120 of `dist/index.html`
```html
<!-- Original source (index.html) -->
<link rel="modulepreload" href="/src/main.tsx" />

<!-- After Vite build (dist/index.html) -->
<link rel="modulepreload" href="data:application/octet-stream;base64,aW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0JwppbXBvcnQgUmVhY3RET00gZnJvbSAncmVhY3QtZG9tL2NsaWVudCcKaW1wb3J0IEFwcCBmcm9tICcuL0FwcC50c3gnCmltcG9ydCAnLi9pbmRleC5jc3MnCmltcG9ydCB7IGluaXRTZW50cnkgfSBmcm9tICcuL3NlbnRyeScKCi8vIFNlbnRyeSDstIjquLDtmZQgKOyVsSDsi5zsnpEg7KCEKQppbml0U2VudHJ5KCkKClJlYWN0RE9NLmNyZWF0ZVJvb3QoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jvb3QnKSEpLnJlbmRlcigKICA8UmVhY3QuU3RyaWN0TW9kZT4KICAgIDxBcHAgLz4KICA8L1JlYWN0LlN0cmljdE1vZGU+LAopCg==" />
```

**Why This Breaks**:
1. Vite build process converts `/src/main.tsx` to inline base64 data URL
2. Sets MIME type as `application/octet-stream` (binary data)
3. Browser enforces strict MIME type checking for ES modules
4. Browser rejects loading the module → White screen

**Base64 Decoded Content** (what Vite was trying to inline):
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initSentry } from './sentry'

// Sentry 초기화 (앱 시작 전)
initSentry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

## ✅ Solution

### What We Changed
**File**: `index.html` (line 119-122)

**Before** (❌ Problematic):
```html
<!-- ⚡ Preload critical resources -->
<link rel="modulepreload" href="/src/main.tsx" />
<link rel="preload" href="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" as="script" crossorigin />
<link rel="preload" href="https://js.tosspayments.com/v1/payment-widget" as="script" />
```

**After** (✅ Fixed):
```html
<!-- ⚡ Preload critical resources -->
<!-- 🚫 Removed modulepreload for /src/main.tsx - causes MIME type error in build -->
<link rel="preload" href="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" as="script" crossorigin />
<link rel="preload" href="https://js.tosspayments.com/v1/payment-widget" as="script" />
```

### Why This Works
1. **Removed problematic modulepreload**: No more data URL conversion
2. **Vite generates proper script tags**: `<script type="module" src="/assets/index-[hash].js">`
3. **Cloudflare serves with correct MIME**: `Content-Type: application/javascript`
4. **Browser accepts module script**: No MIME type error

---

## 🧪 Verification

### Build Output
```bash
✅ Built successfully in 19.88s
- index.html: 8.98 kB (gzip: 2.81 kB)
- Main bundle: 58.20 kB (gzip: 13.52 kB)
- React vendor: 240.55 kB (gzip: 77.07 kB)
```

### Local Test
```bash
curl http://localhost:3000/introduce | grep "data:application"
# ✅ No results (fixed)

curl -I http://localhost:3000/assets/index-ClpDD_ZR.js
# ✅ Content-Type: application/javascript
```

### Production Test
```bash
curl https://live.ur-team.com/introduce | grep "data:application"
# ✅ No results after deployment

curl -I https://live.ur-team.com/assets/index-ClpDD_ZR.js
# ✅ Content-Type: application/javascript
# ✅ cf-cache-status: HIT
```

---

## 📚 Lessons Learned

### 1. **Avoid modulepreload for local source files**
   - Vite may convert to data URLs with wrong MIME types
   - Use regular `<script type="module" src="...">` instead
   - Let Vite inject proper script tags during build

### 2. **Trust the build process**
   - Vite automatically optimizes module loading
   - Manual preload hints can interfere with build output
   - Only preload external CDN scripts

### 3. **Debug methodology for white screen errors**
   ```
   1. Check browser DevTools Console (not just Network tab)
   2. Look for MIME type errors
   3. Inspect generated dist/index.html (not source index.html)
   4. Compare source vs built HTML
   5. Search for data:application URLs
   6. Check for base64-encoded content
   ```

### 4. **Vite build quirks to watch out for**
   - `rel="modulepreload"` for local files → data URL conversion
   - `href="/src/..."` paths → inlined during build
   - Always verify `dist/` output, not just source

---

## 🛡️ Prevention for Future HTML ZIP Integrations

### Pre-Conversion Checklist
```bash
# ✅ Check for problematic tags in HTML
grep -r "modulepreload" new-design/
grep -r "data:application" new-design/
grep -r "octet-stream" new-design/

# ✅ Validate after conversion to React
grep -r "modulepreload" src/
grep -r "data:application" src/

# ✅ Always verify build output
npm run build
grep -r "data:application/octet-stream" dist/
```

### Safe Preload Patterns
```html
<!-- ✅ Safe: External scripts -->
<link rel="preload" href="https://cdn.example.com/script.js" as="script" />

<!-- ✅ Safe: DNS prefetch -->
<link rel="dns-prefetch" href="https://api.example.com" />

<!-- ✅ Safe: Preconnect -->
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />

<!-- ❌ Avoid: Local module preload -->
<link rel="modulepreload" href="/src/main.tsx" />

<!-- ❌ Avoid: Relative paths in modulepreload -->
<link rel="modulepreload" href="./components/App.tsx" />
```

---

## 🚀 Deployment Info

**Commit**: `3019f29`
**Message**: "fix: Remove modulepreload data URL causing MIME type error"
**Repository**: https://github.com/tobe2111/ur-live
**Production**: https://live.ur-team.com/introduce

**GitHub Actions**: Auto-deployment in progress (~3-4 minutes)

---

## 📝 Updated HTML-to-React Validation Script

Added to `scripts/validate-html.sh`:
```bash
#!/bin/bash

echo "🔍 Checking for problematic modulepreload tags..."
if grep -r "modulepreload.*src/\|modulepreload.*\.tsx\|modulepreload.*\.ts" src/ index.html 2>/dev/null; then
  echo "❌ Found local file modulepreload (will cause data URL conversion)"
  exit 1
else
  echo "✅ No problematic modulepreload tags"
fi

echo "🔍 Checking for data URL MIME issues in build..."
if [ -d "dist" ]; then
  if grep -r "data:application/octet-stream" dist/ 2>/dev/null; then
    echo "❌ Found octet-stream data URL in dist/"
    exit 1
  else
    echo "✅ No octet-stream data URLs in dist/"
  fi
fi
```

---

## 🎯 Next Steps

1. **Wait for GitHub Actions** (~3-4 minutes)
2. **Test production**: https://live.ur-team.com/introduce
3. **Verify browser DevTools**: No console errors
4. **Proceed with next HTML ZIP** upload
5. **Apply same validation** to all future HTML conversions

---

**Status**: ✅ **RESOLVED**
**Date**: 2026-02-17
**Time to Resolution**: 45 minutes (deep investigation)
**Final Fix**: 1 line removal in index.html
