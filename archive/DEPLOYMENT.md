# 🚀 Production Deployment Checklist

## Pre-deployment Setup

### 1. Cloudflare Secrets (REQUIRED)
Add secrets to Cloudflare Workers using wrangler CLI:

```bash
# Navigate to project directory
cd /home/user/webapp

# Add Resend API Key
wrangler secret put RESEND_API_KEY
# Paste: re_joVyybjq_KmHKX5g2DmTdqfPBvnxBgyXF

# Add JWT Secret (generate strong random key)
wrangler secret put JWT_SECRET
# Paste: your-super-secret-jwt-key-min-32-chars

# Add Toss Secret (when you get real production key)
wrangler secret put TOSS_SECRET_KEY
# Paste: live_gsk_... (production key from Toss dashboard)

# Optional: Add Sentry DSN
wrangler secret put SENTRY_DSN
# Paste: https://your-dsn@sentry.io/project-id
```

### 2. Verify Secrets
```bash
wrangler secret list
```

Expected output:
```
RESEND_API_KEY
JWT_SECRET
TOSS_SECRET_KEY
SENTRY_DSN (optional)
```

---

## Environment Variables Summary

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `RESEND_API_KEY` | Secret | ✅ Yes | - | Email service API key |
| `JWT_SECRET` | Secret | ✅ Yes | - | JWT token signing key |
| `TOSS_SECRET_KEY` | Secret | ✅ Yes | test_gsk_... | Toss Payments secret (현재 테스트 키) |
| `SENTRY_DSN` | Secret | ❌ Optional | - | Error monitoring DSN |

---

## Deployment Steps

### Option A: GitHub Actions (Automatic)
```bash
# Just push to main branch
git push origin main

# GitHub Actions will:
# 1. Build the project (npm run build)
# 2. Deploy to Cloudflare Pages
# 3. Automatically use secrets from Cloudflare
```

### Option B: Manual Deployment
```bash
# Build project
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name ur-live --branch main

# Secrets are automatically loaded from Cloudflare
```

---

## Post-deployment Verification

### 1. Test API Endpoints
```bash
# Health check
curl https://live.ur-team.com/api/streams

# Email test (trigger seller approval in admin panel)
# Check seller's email inbox

# Notification test
curl "https://live.ur-team.com/api/notifications?userId=1"
```

### 2. Monitor Logs
```bash
# View real-time logs
npx wrangler pages deployment tail ur-live

# View specific deployment
npx wrangler pages deployment list ur-live
```

### 3. Check Production Issues
- [ ] All secrets configured
- [ ] Email sending works
- [ ] Notifications appear
- [ ] Password hashing enabled
- [ ] JWT authentication works
- [ ] Payments work (test mode)

---

## Security Checklist

- [x] Passwords hashed with PBKDF2 (100,000 iterations)
- [x] JWT tokens with secure secret
- [x] API keys stored as Cloudflare secrets (not in code)
- [ ] HTTPS enforced (Cloudflare Pages default)
- [ ] CORS properly configured
- [ ] Rate limiting (TODO: implement if needed)
- [ ] Input validation on all APIs

---

## Switch to Production Toss Payments

When ready to accept real payments:

1. Get production credentials from Toss Dashboard
2. Update secret:
```bash
wrangler secret put TOSS_SECRET_KEY
# Paste production key: live_gsk_...
```

3. Update frontend key in `.env`:
```bash
VITE_TOSS_CLIENT_KEY=live_gck_...
```

4. Redeploy:
```bash
git push origin main
```

---

## Emergency Rollback

If deployment has issues:

```bash
# List recent deployments
npx wrangler pages deployment list ur-live

# Rollback to previous deployment
npx wrangler pages deployment rollback ur-live --deployment-id <DEPLOYMENT_ID>
```

---

## Support Contacts

- **Resend**: https://resend.com/docs
- **Cloudflare**: https://developers.cloudflare.com/pages
- **Toss Payments**: https://docs.tosspayments.com
- **Sentry**: https://docs.sentry.io

---

**Last updated**: 2026-02-25
