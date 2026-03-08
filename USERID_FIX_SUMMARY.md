# userId Issue Fix Summary

## 🐛 Problem
Users logging in via Firebase (email/Google login) couldn't access the checkout page due to missing `userId` in:
- localStorage
- Custom Claims
- D1 database

Console error: **"Custom Claims에 userId 없음"** → `userId: null` → **"❌ userId 없음"**

---

## ✅ Solution (3-Layer Fix)

### 1️⃣ **Frontend: AuthContext.tsx**
- **Auto-save Firebase UID to localStorage** when custom claim `userId` is missing
- Ensures `localStorage.getItem('user_id')` always returns a valid ID

```typescript
// Before:
if (!userId) {
  console.log('[Auth] ⚠️ Custom Claims에 userId 없음')
} else {
  localStorage.setItem('user_id', userId.toString())
}

// After:
if (!userId) {
  console.log('[Auth] ⚠️ Custom Claims에 userId 없음 - Firebase UID 사용:', firebaseUser.uid)
  localStorage.setItem('user_id', firebaseUser.uid)
} else {
  localStorage.setItem('user_id', userId.toString())
}
```

### 2️⃣ **Frontend: CheckoutPage.tsx**
- **Fallback to Firebase UID** when `getUserId()` returns `null`
- Prevents "userId 없음" error

```typescript
// Before:
const uid = getUserId()

// After:
let uid = getUserId()

if (!uid && user) {
  console.log('[CheckoutPage] ⚠️ localStorage에 userId 없음, Firebase UID 사용:', user.uid)
  uid = user.uid
  localStorage.setItem('user_id', user.uid)
}
```

### 3️⃣ **Backend: src/index.tsx (getFirebaseAuth)**
- **Auto-create D1 users** from Firebase ID tokens on first API request
- Prevents `USER_NOT_FOUND` errors

```typescript
// Before:
if (!user) {
  console.warn('[Firebase Auth] User not found for UID:', firebasePayload.uid)
  return { userId: 0, userType: '', errorDetails: { code: 'USER_NOT_FOUND' } }
}

// After:
if (!user) {
  console.warn('[Firebase Auth] User not found for UID:', firebasePayload.uid)
  
  // Auto-create D1 user
  const email = firebasePayload.email || `user_${firebasePayload.uid}@firebase.local`
  const name = firebasePayload.name || 'User'
  
  await c.env.DB.prepare(`
    INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).bind(firebasePayload.uid, email, name).run()
  
  user = await c.env.DB.prepare(`
    SELECT id, email, name, firebase_uid FROM users WHERE firebase_uid = ?
  `).bind(firebasePayload.uid).first()
}
```

---

## 🔄 Flow Diagram

### Before (❌ Broken)
```
Firebase Login (email/Google)
  ↓
Firebase UID: BpcLipJtvwasGTs162L2Dz56bD12
  ↓
Custom Claims: { userId: undefined } ❌
  ↓
localStorage.getItem('user_id'): null ❌
  ↓
CheckoutPage: userId = null ❌
  ↓
Error: "❌ userId 없음"
```

### After (✅ Fixed)
```
Firebase Login (email/Google)
  ↓
Firebase UID: BpcLipJtvwasGTs162L2Dz56bD12
  ↓
Custom Claims: { userId: undefined } → Use UID instead ✅
  ↓
localStorage.setItem('user_id', 'BpcLipJtvwasGTs162L2Dz56bD12') ✅
  ↓
CheckoutPage: userId = 'BpcLipJtvwasGTs162L2Dz56bD12' ✅
  ↓
API Call: /api/cart
  ↓
Backend: Auto-create D1 user if not exists ✅
  ↓
Success: Cart items loaded ✅
```

---

## 🧪 Test Cases

### Test 1: Email Login (First Time)
1. Go to `/login`
2. Click "Email로 계속하기"
3. Enter email & password, click login
4. **Expected**: 
   - Redirect to checkout page ✅
   - `localStorage.user_id` = Firebase UID ✅
   - Cart API works ✅
   - No "userId 없음" error ✅

### Test 2: Google Login (First Time)
1. Go to `/login`
2. Click "Google로 로그인" button
3. Complete Google OAuth
4. **Expected**:
   - Redirect to checkout page ✅
   - `localStorage.user_id` = Firebase UID ✅
   - D1 user auto-created ✅
   - Shipping addresses loaded ✅

### Test 3: Existing User (Kakao/Email)
1. User already has D1 record with `firebase_uid`
2. Login via any method
3. **Expected**:
   - `userId` from custom claims (if available) ✅
   - OR Firebase UID (if custom claims missing) ✅
   - Backend matches `firebase_uid` in D1 ✅

---

## 📊 Database Schema

### D1 `users` table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT UNIQUE,  -- BpcLipJtvwasGTs162L2Dz56bD12
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  kakao_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Firebase Custom Claims (Optional)
```json
{
  "userId": 123,        // D1 users.id (optional)
  "role": "user",
  "email": "user@example.com",
  "userName": "홍길동"
}
```

---

## 🚀 Deployment Steps

### 1. Local Testing
```bash
cd /home/user/webapp
npm run dev
```
- Visit `http://localhost:5173/login`
- Test email & Google login
- Check browser console for `userId` logs

### 2. Build & Deploy
```bash
# Global version (Google login)
npm run build:global

# Korean version (Kakao login)
npm run build:kr

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=ur-live-global
```

### 3. Verify Production
```bash
# Check Cloudflare deployment
curl -I https://world.ur-team.com

# Test login flow
# 1. Open https://world.ur-team.com/login
# 2. Click "Login with Google"
# 3. Complete OAuth
# 4. Go to /checkout → Should work without errors ✅
```

---

## 🔍 Debug Commands

### Browser Console
```javascript
// Check localStorage
console.log('user_id:', localStorage.getItem('user_id'))
console.log('firebase_token:', localStorage.getItem('firebase_token'))
console.log('user_name:', localStorage.getItem('user_name'))

// Check Firebase user
import { getAuth } from 'firebase/auth'
const auth = getAuth()
console.log('Firebase UID:', auth.currentUser?.uid)
console.log('Firebase email:', auth.currentUser?.email)
```

### Backend Logs (Cloudflare)
```bash
# View real-time logs
wrangler tail --project-name=ur-live-global

# Look for:
# [Firebase Auth] ✅ User authenticated via Custom Claims
# [Firebase Auth] 🆕 Creating new D1 user
# [CheckoutPage] ✅ userId 설정: BpcLipJtvwasGTs162L2Dz56bD12
```

---

## 📝 Modified Files
- ✅ `src/contexts/AuthContext.tsx` (Auto-save Firebase UID)
- ✅ `src/pages/CheckoutPage.tsx` (Fallback to Firebase UID)
- ✅ `src/index.tsx` (Auto-create D1 users)

### Git Commit
```bash
git log -1 --oneline
# 2b8f184 fix: Resolve userId issue for Firebase email/Google login users
```

### GitHub
https://github.com/tobe2111/ur-live/commit/2b8f184

---

## ✅ Expected Results

### Before Fix
- ❌ Email login → checkout page shows "userId 없음"
- ❌ Google login → API calls fail with 401 USER_NOT_FOUND
- ❌ Custom Claims warning in console

### After Fix
- ✅ Email login → checkout page loads normally
- ✅ Google login → D1 user auto-created, APIs work
- ✅ localStorage always has valid `user_id`
- ✅ No console errors related to userId

---

## 🎯 Next Steps
1. **Test locally** (email & Google login)
2. **Deploy to staging** (Cloudflare Pages)
3. **Verify production** (https://world.ur-team.com)
4. **Monitor logs** (Cloudflare dashboard)

---

## 🆘 Troubleshooting

### Issue: Still seeing "userId 없음"
**Solution**: Clear browser cache + localStorage
```javascript
localStorage.clear()
location.reload()
```

### Issue: API returns 401 USER_NOT_FOUND
**Check**:
1. Firebase token is valid (`firebase_token` in localStorage)
2. Backend deployed with latest code
3. D1 database connection working

### Issue: Google login not working
**Check**:
1. `VITE_GOOGLE_CLIENT_ID` set in Cloudflare env vars
2. Firebase authorized domains include `world.ur-team.com`
3. OAuth consent screen configured correctly

---

## 📚 Related Documentation
- `GETTING_API_KEYS.md` - How to get Google OAuth client ID
- `CLOUDFLARE_PAGES_SETUP.md` - Deployment guide
- `DEPLOYMENT_STATUS.md` - Current deployment status

---

**Status**: ✅ **FIXED** (Commit 2b8f184)  
**Tested**: ⏳ Pending local + production testing  
**Deployed**: ⏳ Pending Cloudflare Pages deployment
