# CI/CD Pipeline Documentation

## Overview
This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the UR-Live E-Commerce platform.

## Table of Contents
- [Pipeline Architecture](#pipeline-architecture)
- [GitHub Actions Workflows](#github-actions-workflows)
- [Environment Setup](#environment-setup)
- [Testing Strategy](#testing-strategy)
- [Performance Monitoring](#performance-monitoring)
- [Deployment Process](#deployment-process)
- [Troubleshooting](#troubleshooting)

---

## Pipeline Architecture

### CI/CD Flow
```
┌─────────────┐
│  Git Push   │
│  / PR       │
└──────┬──────┘
       │
       v
┌─────────────┐
│   Lint &    │
│ Type Check  │
└──────┬──────┘
       │
       v
┌─────────────┐
│ Unit Tests  │
│ (464 tests) │
└──────┬──────┘
       │
       v
┌─────────────┐
│Integration  │
│   Tests     │
│  (8 tests)  │
└──────┬──────┘
       │
       v
┌─────────────┐
│  E2E Tests  │
│ (77 tests)  │
└──────┬──────┘
       │
       v
┌─────────────┐
│    Build    │
└──────┬──────┘
       │
       v
┌─────────────┐
│Performance  │
│ Monitoring  │
└──────┬──────┘
       │
       v
┌─────────────┐
│   Deploy    │
│(Cloudflare) │
└─────────────┘
```

---

## GitHub Actions Workflows

### 1. Main CI/CD Pipeline (`ci-cd.yml`)
**Trigger**: Push to `main`/`develop`, Pull Requests

**Jobs**:
1. **test-unit**: Run unit and integration tests
   - Duration: ~15 min
   - Tests: 464 unit + 8 integration
   - Coverage reporting to Codecov
   
2. **test-e2e**: Run E2E tests with Playwright
   - Duration: ~30 min
   - Tests: 77 E2E tests
   - Browser: Chromium
   
3. **type-check**: TypeScript type checking
   - Duration: ~10 min
   
4. **lint**: ESLint code quality check
   - Duration: ~10 min
   
5. **build**: Build application
   - Duration: ~15 min
   - Outputs: dist/ artifacts
   
6. **deploy**: Deploy to Cloudflare Pages
   - Condition: Only on `main` branch
   - Target: Production (live.ur-team.com)

### 2. Pull Request Checks (`pr-checks.yml`)
**Trigger**: Pull Request opened/updated

**Jobs**:
1. **quick-check**: Fast lint and type check
2. **test-coverage**: Unit tests with coverage report
3. **changed-files**: Detect which files changed
4. **test-e2e**: E2E tests (only if src/ changed)
5. **build-preview**: Build and analyze bundle size
6. **pr-summary**: Generate PR summary report

### 3. Performance Monitoring (`performance.yml`)
**Trigger**: Push to `main`, PR, Daily schedule, Manual

**Jobs**:
1. **lighthouse**: Lighthouse CI performance audit
   - Performance score ≥ 80
   - Accessibility ≥ 90
   - Best Practices ≥ 90
   - SEO ≥ 90
   
2. **bundle-size**: Analyze JavaScript bundle sizes
   - Warning if any file > 500KB
   
3. **web-vitals**: Core Web Vitals monitoring
   - LCP ≤ 2.5s
   - FID ≤ 100ms
   - CLS ≤ 0.1

---

## Environment Setup

### Required Secrets
Configure these in GitHub repository settings → Secrets:

```yaml
# Cloudflare Deployment
CLOUDFLARE_API_TOKEN: <your-cloudflare-api-token>
CLOUDFLARE_ACCOUNT_ID: <your-cloudflare-account-id>

# Code Coverage (optional)
CODECOV_TOKEN: <your-codecov-token>

# Lighthouse CI (optional)
LHCI_GITHUB_APP_TOKEN: <your-lhci-token>
```

### How to Get Secrets

#### Cloudflare API Token
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. My Profile → API Tokens
3. Create Token → Edit Cloudflare Workers
4. Permissions: Account.Cloudflare Pages (Edit)
5. Copy the token

#### Codecov Token
1. Go to [Codecov.io](https://codecov.io)
2. Add your repository
3. Copy the upload token

---

## Testing Strategy

### Test Pyramid
```
       /\
      /  \  E2E (77)
     /____\
    /      \ Integration (8)
   /________\
  /          \ Unit (464)
 /__________\
```

### Test Execution Times
| Test Type | Count | Duration | When Run |
|-----------|-------|----------|----------|
| Unit | 464 | ~22s | Every push/PR |
| Integration | 8 | ~5s | Every push/PR |
| E2E | 77 | ~10min | Push/PR (if src changed) |
| Accessibility | 25 | ~5min | On demand |

### Test Commands
```bash
# Local development
npm run test:unit              # Unit tests
npm run test:unit:coverage     # With coverage
npm test tests/integration/    # Integration tests
npm run test:e2e               # E2E tests
npm run test:e2e:a11y          # Accessibility tests

# CI environment
npm run test:unit              # CI unit tests
npm run test:e2e:ci            # CI E2E tests
npm run lighthouse:ci          # Performance tests
```

---

## Performance Monitoring

### Lighthouse CI Thresholds

#### Performance Metrics
```javascript
{
  'categories:performance': ['error', { minScore: 0.8 }],
  'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
  'total-blocking-time': ['warn', { maxNumericValue: 300 }],
  'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
  'speed-index': ['warn', { maxNumericValue: 3000 }],
  'interactive': ['warn', { maxNumericValue: 3500 }],
}
```

#### Accessibility Thresholds
```javascript
{
  'categories:accessibility': ['warn', { minScore: 0.9 }],
  'categories:best-practices': ['warn', { minScore: 0.9 }],
  'categories:seo': ['warn', { minScore: 0.9 }],
}
```

### Core Web Vitals Targets
| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤ 2.5s | 2.5s - 4.0s | > 4.0s |
| FID | ≤ 100ms | 100ms - 300ms | > 300ms |
| CLS | ≤ 0.1 | 0.1 - 0.25 | > 0.25 |
| FCP | ≤ 1.8s | 1.8s - 3.0s | > 3.0s |
| TTFB | ≤ 800ms | 800ms - 1800ms | > 1800ms |

### Bundle Size Limits
- Total bundle: < 1MB (gzipped)
- Individual JS chunks: < 500KB
- CSS files: < 100KB

---

## Deployment Process

### Automatic Deployment
Deployments to production happen automatically on successful merge to `main`:

1. All tests pass ✅
2. Build succeeds ✅
3. Performance checks pass ✅
4. Deploy to Cloudflare Pages
5. Domain: https://live.ur-team.com

### Manual Deployment
```bash
# Deploy to production
npm run deploy

# Quick deploy (skip full build)
npm run deploy:quick

# Safe deploy with checks
npm run deploy:safe:prod
```

### Deployment Environments
| Environment | Branch | URL |
|-------------|--------|-----|
| Production | main | https://live.ur-team.com |
| Preview | PR branches | https://[branch].ur-live.pages.dev |
| Development | develop | https://develop.ur-live.pages.dev |

---

## Continuous Monitoring

### Daily Automated Checks
- **Performance audit** runs daily at 2 AM UTC
- **Results** stored in GitHub Actions artifacts
- **Alerts** posted to GitHub issues if thresholds fail

### Monitoring Dashboard
View real-time metrics at:
- [GitHub Actions](https://github.com/tobe2111/ur-live/actions)
- [Cloudflare Analytics](https://dash.cloudflare.com)
- [Codecov Dashboard](https://codecov.io/gh/tobe2111/ur-live)

---

## Troubleshooting

### Common Issues

#### 1. E2E Tests Failing
```bash
# Run locally with debug
npm run test:e2e:debug

# Check Playwright report
npm run test:e2e:report

# Update Playwright browsers
npx playwright install --with-deps
```

#### 2. Build Failures
```bash
# Check TypeScript errors
npm run typecheck

# Check lint errors
npm run lint

# Clear cache and rebuild
npm run clean
npm ci
npm run build
```

#### 3. Performance Test Failures
```bash
# Run Lighthouse locally
npm run lighthouse

# Check bundle sizes
npm run build
du -sh dist/assets/*.js

# Analyze with source-map-explorer
npx source-map-explorer dist/assets/*.js
```

#### 4. Deployment Failures
```bash
# Check Cloudflare logs
wrangler pages deployment list --project-name=ur-live

# Verify environment variables
wrangler pages deployment list

# Manual deploy
npm run deploy
```

### Debug Commands
```bash
# View workflow logs
gh run list
gh run view <run-id>

# Download artifacts
gh run download <run-id>

# Re-run failed jobs
gh run rerun <run-id> --failed
```

---

## Best Practices

### For Developers

1. **Before Push**
   ```bash
   npm run lint
   npm run typecheck
   npm run test:unit
   ```

2. **Before PR**
   ```bash
   npm run test:all
   npm run build
   ```

3. **Monitor CI**
   - Check GitHub Actions status
   - Review failed tests immediately
   - Don't merge with failing checks

### For Reviewers

1. **Check CI Status**
   - All green ✅ before approval
   - Review test coverage report
   - Check bundle size changes

2. **Performance Review**
   - Review Lighthouse scores
   - Check for bundle size increases
   - Verify Core Web Vitals

3. **Code Quality**
   - Ensure tests are added
   - Review type safety
   - Check for accessibility issues

---

## Metrics & KPIs

### Current Status
- **Total Tests**: 549 (464 unit + 8 integration + 77 E2E)
- **Test Coverage**: 100% (unit tests)
- **Build Time**: ~15 minutes
- **Deploy Time**: ~5 minutes
- **Performance Score**: ≥ 80
- **Uptime**: 99.9%

### Success Criteria
- ✅ All tests pass
- ✅ Coverage ≥ 80%
- ✅ Performance score ≥ 80
- ✅ Build time < 20 min
- ✅ Zero critical vulnerabilities

---

## Support

### Resources
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Playwright Documentation](https://playwright.dev/docs/ci)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages)

### Contact
- **GitHub Issues**: https://github.com/tobe2111/ur-live/issues
- **Email**: tobe2111@naver.com
- **Slack**: #ur-live-ci-cd (if applicable)

---

## Changelog

### Version 1.0.0 (2026-03-07)
- ✅ Initial CI/CD pipeline setup
- ✅ Unit, Integration, E2E test automation
- ✅ Performance monitoring with Lighthouse
- ✅ Accessibility testing with axe-core
- ✅ Automatic deployment to Cloudflare Pages
- ✅ PR checks and automated reviews

---

*Last updated: 2026-03-07*
