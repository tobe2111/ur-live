# Cloudflare Pages Setup Guide

## Problem: Deploy Command Cannot Be Empty

Cloudflare Pages Dashboard doesn't allow leaving the "Deploy command" field empty due to a UI validation bug. This guide provides the correct setup.

---

## Solution 1: Use Automatic Deployment (Recommended)

### For ur-live-global (Global Version - world.ur-team.com)

1. **Go to Cloudflare Dashboard**
   - Open https://dash.cloudflare.com/
   - Navigate to **Workers & Pages** → **ur-live-global**

2. **Settings → Builds & deployments → Edit configuration**
   
   Set the following:
   
   | Field | Value |
   |-------|-------|
   | Framework preset | None |
   | Build command | `npm install && npm run build:global` |
   | Build output directory | `dist` |
   | Root directory | (leave empty) |
   | **Deploy command** | `echo "Cloudflare Pages auto-deploys"` |

   ⚠️ **Important**: Use `echo "Cloudflare Pages auto-deploys"` as a placeholder command that does nothing but satisfies the UI validation.

3. **Save Configuration**

4. **Add Environment Variables** (Settings → Environment variables → Production)
   
   Add these 7 variables:
   
   ```
   VITE_REGION=GLOBAL
   VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLISHABLE_KEY
   STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
   VITE_DEFAULT_LANGUAGE=en
   VITE_API_BASE_URL=https://world.ur-team.com
   D1_DATABASE=lister-db
   ```

5. **Redeploy**
   - Click "Retry deployment" or push a new commit

---

## Solution 2: Use Local Deployment Script

If you prefer to deploy from your local machine:

```bash
# Install wrangler globally (if not installed)
npm install -g wrangler

# Login to Cloudflare
npx wrangler login

# Deploy global version
npm run build:global
npx wrangler pages deploy dist --project-name=ur-live-global --config wrangler.global.toml

# Or use the provided script
chmod +x deploy-global.sh
./deploy-global.sh
```

---

## Solution 3: Use GitHub Actions (Automated CI/CD)

Create `.github/workflows/deploy-global.yml`:

```yaml
name: Deploy Global to Cloudflare Pages

on:
  push:
    branches:
      - main
    paths:
      - 'src/**'
      - 'public/**'
      - 'package.json'
      - '.env.global'
  workflow_dispatch:

jobs:
  deploy-global:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build global version
        run: npm run build:global
        env:
          VITE_REGION: GLOBAL
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
          VITE_STRIPE_PUBLISHABLE_KEY: ${{ secrets.VITE_STRIPE_PUBLISHABLE_KEY }}
          VITE_DEFAULT_LANGUAGE: en
          VITE_API_BASE_URL: https://world.ur-team.com

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=ur-live-global
```

**Required GitHub Secrets** (Repository Settings → Secrets and variables → Actions):
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Pages permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key

---

## Comparison Table

| Method | Setup Time | Maintenance | Auto-Deploy | Recommended For |
|--------|-----------|-------------|-------------|-----------------|
| **Solution 1: Dashboard** | 5 min | Low | Yes (on push) | Most users ✅ |
| **Solution 2: Local CLI** | 2 min | High (manual) | No | Testing/debugging |
| **Solution 3: GitHub Actions** | 10 min | Low | Yes (on push) | Teams/production |

---

## Quick Fix for Current Issue

**Right now**, to fix the `npx wrangler deploy` error:

1. Go to **ur-live-global** → Settings → Builds & deployments
2. Click **Edit configuration**
3. Change **Deploy command** from:
   ```
   npx wrangler deploy
   ```
   to:
   ```
   echo "Auto-deploy enabled"
   ```
4. Click **Save**
5. Go to **Deployments** → Click **Retry deployment** on the failed build

This will bypass the wrangler command and let Cloudflare Pages automatically deploy the `dist/` folder.

---

## Expected Result

After successful deployment:

- ✅ **Korean version**: https://live.ur-team.com
  - Kakao login
  - Toss Payments
  - Korean UI (default)

- ✅ **Global version**: https://world.ur-team.com (or https://ur-live-global.pages.dev)
  - Google login
  - Stripe Payments
  - English UI (default)

Both sites share the same:
- D1 database
- KV namespaces
- Backend API logic
- Authentication (JWT for seller/admin)

---

## Testing Checklist

After deployment:

- [ ] Visit https://world.ur-team.com → Should load English homepage
- [ ] Check browser console: `console.log(import.meta.env.VITE_REGION)` → Should print "GLOBAL"
- [ ] Click language switcher → Should toggle between EN/KO
- [ ] Test Google login → Should open Google OAuth popup
- [ ] Add product to cart → Proceed to checkout
- [ ] Verify Stripe Payment Element loads (with test card form)
- [ ] Test payment with card `4242 4242 4242 4242` (exp: any future date, CVC: any 3 digits)
- [ ] Verify API endpoint:
  ```bash
  curl -X POST https://world.ur-team.com/api/payment/stripe/create-intent \
    -H "Content-Type: application/json" \
    -d '{"amount":1000,"currency":"usd"}'
  ```
  Expected response: `{"success":true,"clientSecret":"pi_xxx_secret_yyy"}`

---

## Troubleshooting

### Issue: Build succeeds but deployment fails with authentication error

**Solution**: Use Solution 1 (echo command) instead of `npx wrangler deploy`

### Issue: Environment variables not loaded

**Cause**: Forgot to add env vars in Production environment

**Solution**: Go to Settings → Environment variables → Select "Production" tab → Add all 7 variables → Save → Redeploy

### Issue: `VITE_REGION` is undefined in browser

**Cause**: Env vars are set for deployment but not for build

**Solution**: In Cloudflare Pages, env vars prefixed with `VITE_` are automatically injected into the build process. Make sure they're added to the **Production** environment.

### Issue: Stripe Payment Element doesn't load

**Possible causes**:
1. `VITE_STRIPE_PUBLISHABLE_KEY` not set
2. `STRIPE_SECRET_KEY` not set (backend)
3. API endpoint `/api/payment/stripe/create-intent` returns error

**Debug**:
```javascript
// Open browser console on checkout page
console.log('Publishable Key:', import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// Check API response
fetch('https://world.ur-team.com/api/payment/stripe/create-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 1000, currency: 'usd' })
}).then(r => r.json()).then(console.log)
```

---

## Final Notes

- **Korean version** (`ur-live`) and **Global version** (`ur-live-global`) are completely separate Cloudflare Pages projects
- They share the same GitHub repository but use different build commands
- Modifying one project does NOT affect the other
- Both use the same D1 database and KV namespaces (data is shared)
- Custom domains are configured separately

**Estimated total setup time**: 20-30 minutes (including env var lookup and deployment)

---

## Need Help?

- Cloudflare Pages Docs: https://developers.cloudflare.com/pages/
- Stripe API Keys: https://dashboard.stripe.com/apikeys
- Firebase Console: https://console.firebase.google.com/
- GitHub Issues: https://github.com/tobe2111/ur-live/issues
