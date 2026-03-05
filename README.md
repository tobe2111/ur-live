# 🌍 UR-Live Multi-Region E-Commerce

한국과 글로벌 시장을 위한 통합 E-Commerce 플랫폼

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Cloudflare Pages](https://img.shields.io/badge/deploy-Cloudflare%20Pages-orange.svg)](https://pages.cloudflare.com/)

---

## 🎯 Overview

하나의 코드베이스로 한국과 글로벌 버전을 동시에 지원하는 Multi-Region E-Commerce 플랫폼입니다.

### 🌏 Supported Regions

| Region | Domain | Login | Payment | Language | Status |
|--------|--------|-------|---------|----------|--------|
| **🇰🇷 Korea** | [live.ur-team.com](https://live.ur-team.com) | Kakao | Toss Payments | 한국어 (기본) | ✅ **Production** |
| **🌐 Global** | world.ur-team.com (Coming soon) | Google | Stripe | English | ⏳ **Planned** |

> **Note**: 현재는 한국(KR) 버전만 운영 중입니다. 글로벌 버전은 6-12개월 내 출시 예정입니다.

---

## ✨ Features

### 🔐 Multi-Authentication
- **한국**: 카카오 로그인 + 이메일 로그인
- **글로벌**: Google 로그인 + 이메일 로그인
- **공통**: Seller/Admin JWT 인증

### 💳 Multi-Payment
- **한국**: Toss Payments (TossPayments Widget SDK)
- **글로벌**: Stripe (Stripe Elements + Payment Intents API)
- **지연 로딩**: 결제 SDK는 체크아웃 페이지에서만 로드 (3KB 미만)

### 🌐 Internationalization (i18n)
- **react-i18next** 기반
- 30+ 번역 키 지원
- 실시간 언어 전환 (한국어 ↔ English)
- Region별 기본 언어 자동 설정

### ⚡ Performance Optimizations
- **Lazy Loading**: 결제 컴포넌트 동적 로딩
- **Tree Shaking**: 미사용 코드 자동 제거
- **Code Splitting**: Route별 청크 분리
- **Region Branching**: `isKorea()` / `isGlobal()` 기반 조건부 로딩

---

## 📦 Tech Stack

### Frontend
- **Framework**: React 18.3.1 + TypeScript
- **Build Tool**: Vite 6.4.1
- **Routing**: React Router DOM 7.x
- **Styling**: Tailwind CSS 3.x
- **i18n**: react-i18next 15.x
- **State Management**: React Context API

### Backend
- **Runtime**: Cloudflare Workers (Hono)
- **Database**: Cloudflare D1 (SQLite)
- **Authentication**: Firebase Auth (Buyer) + JWT (Seller/Admin)
- **Payment**: Stripe API, TossPayments API

### Payment SDKs
- **Stripe**: `@stripe/stripe-js`, `@stripe/react-stripe-js`
- **Toss Payments**: Widget SDK (CDN)

---

## 🚀 Quick Start

### Prerequisites
```bash
# Node.js 18+ required
node -v

# Install dependencies
npm install
```

### Development
```bash
# Korean version (default)
npm run dev

# Note: GLOBAL version is not yet implemented
```

### Build
```bash
# Production build (KR only)
npm run build

# Preview locally
npm run preview
# → http://localhost:4173
```

> **Important**: `npm run build`는 항상 한국(KR) 버전으로 빌드됩니다. 글로벌 버전은 향후 추가 예정입니다.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [MULTI_REGION_SETUP.md](./MULTI_REGION_SETUP.md) | 전체 설정 가이드 (Step 1-4) |
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | 로컬 & 결제 테스트 가이드 |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Cloudflare Pages 배포 가이드 |
| [MULTI_REGION_QUICKSTART.md](./MULTI_REGION_QUICKSTART.md) | 빠른 시작 가이드 |

---

## 🏗️ Project Structure

```
webapp/
├── src/
│   ├── components/
│   │   ├── payments/
│   │   │   ├── TossPaymentWidget.tsx    # 한국 전용 (3.12 KB lazy)
│   │   │   └── StripeCheckout.tsx       # 글로벌 전용 (2.51 KB lazy)
│   │   └── LanguageSwitcher.tsx         # 언어 전환 UI
│   ├── config/
│   │   └── region.ts                    # Region utilities
│   ├── i18n.ts                          # i18next 설정
│   ├── pages/
│   │   ├── LoginPage.tsx                # Region별 로그인
│   │   └── CheckoutPage.tsx             # Region별 결제
│   └── index.tsx                        # Cloudflare Workers entry
├── public/
│   └── locales/
│       ├── ko/translation.json          # 한국어 번역
│       └── en/translation.json          # 영어 번역
├── .env.kr                              # 한국 환경 변수
├── .env.global                          # 글로벌 환경 변수
└── package.json                         # build:kr, build:global
```

---

## 🔧 Environment Variables

### Korean Version (`.env.kr`)
```bash
VITE_REGION=KR
VITE_KAKAO_APP_KEY=975a2e7f97254b08f15dba4d177a2865
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
VITE_DEFAULT_LANGUAGE=ko
VITE_API_BASE_URL=https://live.ur-team.com
```

### Global Version (`.env.global`)
```bash
VITE_REGION=GLOBAL
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY
VITE_DEFAULT_LANGUAGE=en
VITE_API_BASE_URL=https://world.ur-team.com
```

---

## 🚀 Deployment

### Cloudflare Pages

#### Korean Version
```bash
npm run build:kr
wrangler pages deploy dist --project-name=ur-live
```

#### Global Version
```bash
npm run build:global
wrangler pages deploy dist --project-name=ur-live-global
```

### Custom Domains

#### DNS Setup (Cloudflare Dashboard)
```
# Korean
Name: live
Target: ur-live.pages.dev
Proxy: ✅ Proxied

# Global
Name: world
Target: ur-live-global.pages.dev
Proxy: ✅ Proxied
```

**Full Deployment Guide**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

## 🧪 Testing

### Stripe Test Cards
```
Success:        4242 4242 4242 4242
3D Secure:      4000 0025 0000 3155
Declined:       4000 0000 0000 9995
Expired:        4000 0000 0000 0069

Expiry: 12/34
CVC: 123
ZIP: 12345
```

### Toss Test Cards
```
카드번호: 5570****0001****
만료일: 01/25
CVC: 123
```

**Full Testing Guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

---

## 📊 Bundle Size

| Component | Size (gzip) | Load Strategy |
|-----------|-------------|---------------|
| Main Bundle | ~250 KB | Initial |
| TossPaymentWidget | 3.12 KB (1.56 KB) | Lazy (KR only) |
| StripeCheckout | 2.51 KB (1.42 KB) | Lazy (GLOBAL only) |
| i18n Translations | ~5 KB | Async |

**Optimization**: Region별 미사용 SDK는 완전히 제거됨 (Tree Shaking)

---

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev                    # 개발 서버 (Vite)

# Build
npm run build                  # 기본 빌드
npm run build:kr              # 한국 버전 빌드
npm run build:global          # 글로벌 버전 빌드

# Preview
npm run preview               # 빌드 미리보기

# Deploy
npm run deploy                # Cloudflare Pages 배포

# Database
npm run db:migrate            # D1 마이그레이션
npm run db:seed               # 초기 데이터 입력
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support

- **GitHub Issues**: [https://github.com/tobe2111/ur-live/issues](https://github.com/tobe2111/ur-live/issues)
- **Documentation**: [MULTI_REGION_SETUP.md](./MULTI_REGION_SETUP.md)
- **Email**: tobe2111@naver.com

---

## 🎉 Acknowledgments

- [TossPayments](https://www.tosspayments.com/) - Korean payment solution
- [Stripe](https://stripe.com/) - Global payment platform
- [Firebase](https://firebase.google.com/) - Authentication
- [Cloudflare Pages](https://pages.cloudflare.com/) - Hosting & Edge computing
- [Vite](https://vitejs.dev/) - Frontend build tool
- [React](https://react.dev/) - UI framework

---

**Built with ❤️ by tobe2111**

🌐 **Live**: [live.ur-team.com](https://live.ur-team.com)  
🌍 **World**: [world.ur-team.com](https://world.ur-team.com)
