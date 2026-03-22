# Payment Gateway Integration Guide

## 📋 Table of Contents

- [Overview](#overview)
- [Current Status](#current-status)
- [Architecture](#architecture)
- [Adding a New Payment Provider](#adding-a-new-payment-provider)
- [Switching Payment Providers](#switching-payment-providers)
- [Toss Payments Integration](#toss-payments-integration)
- [PortOne Integration](#portone-integration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

This application uses a **Payment Provider Abstraction Layer** that allows easy switching between different payment gateways without changing core business logic.

### Key Benefits

- ✅ **PG-agnostic**: Business logic doesn't depend on specific payment provider
- ✅ **Easy migration**: Switch providers by changing environment variable
- ✅ **Multi-PG support**: Run multiple providers simultaneously (future)
- ✅ **Testable**: Mock provider for development without real payment

---

## Current Status

### ✅ Completed

- **NicePay Integration**: ❌ Removed (deprecated)
- **Payment Abstraction Layer**: ✅ Implemented
- **Mock Provider**: ✅ Implemented
- **Environment Configuration**: ✅ Configured

### ⏳ Ready for Implementation

- **Toss Payments**: Interface ready, implementation needed
- **PortOne (구 아임포트)**: Interface ready, implementation needed

---

## Architecture

### Component Structure

```
src/
├── types/
│   └── payment.ts              # PaymentProvider interface
├── services/
│   └── payment/
│       ├── index.ts            # Export all providers
│       ├── PaymentProviderFactory.ts  # Factory pattern
│       ├── MockPaymentProvider.ts     # Mock for testing
│       ├── TossPaymentProvider.ts     # TODO: Implement
│       └── PortOnePaymentProvider.ts  # TODO: Implement
└── index.tsx                   # Main backend (uses PaymentProviderFactory)
```

### PaymentProvider Interface

```typescript
interface PaymentProvider {
  readonly name: PaymentProviderType;
  
  initialize(request: PaymentRequest): Promise<{ widgetUrl?: string; data?: any }>;
  approve(paymentKey: string, orderId: string, amount: number): Promise<PaymentResponse>;
  cancel(request: CancelRequest): Promise<CancelResponse>;
  verify?(data: any): Promise<boolean>;
}
```

### Current Flow

```
1. User clicks "결제하기"
   ↓
2. Backend: PaymentProviderFactory.create(PAYMENT_PROVIDER)
   ↓
3. Provider: initialize(paymentRequest)
   ↓
4. Return widgetUrl to frontend
   ↓
5. User completes payment in widget
   ↓
6. Callback: Provider.approve(paymentKey, orderId, amount)
   ↓
7. Update order status in DB
   ↓
8. Redirect to success page
```

---

## Adding a New Payment Provider

### Example: Toss Payments

#### Step 1: Create Provider Class

Create `src/services/payment/TossPaymentProvider.ts`:

```typescript
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResponse,
  CancelRequest,
  CancelResponse,
} from '../../types/payment';

export class TossPaymentProvider implements PaymentProvider {
  readonly name = 'toss' as const;
  
  private clientKey: string;
  private secretKey: string;

  constructor(config: { clientKey: string; secretKey: string }) {
    this.clientKey = config.clientKey;
    this.secretKey = config.secretKey;
  }

  async initialize(request: PaymentRequest) {
    // Implement Toss Payments widget initialization
    // See: https://docs.tosspayments.com/guides/payment-widget/integration
    
    return {
      widgetUrl: `/toss-payment?orderId=${request.orderId}`,
      data: {
        clientKey: this.clientKey,
        orderId: request.orderId,
        amount: request.amount,
      },
    };
  }

  async approve(paymentKey: string, orderId: string, amount: number): Promise<PaymentResponse> {
    // Call Toss Payments approval API
    // POST https://api.tosspayments.com/v1/payments/confirm
    
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(this.secretKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        orderId,
        amount,
        status: 'failed',
        error: data.message || '결제 승인에 실패했습니다',
      };
    }

    return {
      success: true,
      paymentKey: data.paymentKey,
      transactionId: data.transactionKey,
      orderId: data.orderId,
      amount: data.totalAmount,
      status: 'approved',
    };
  }

  async cancel(request: CancelRequest): Promise<CancelResponse> {
    // POST https://api.tosspayments.com/v1/payments/{paymentKey}/cancel
    
    const response = await fetch(
      `https://api.tosspayments.com/v1/payments/${request.paymentKey}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(this.secretKey + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelReason: request.reason,
          cancelAmount: request.amount,
        }),
      }
    );

    const data = await response.json();

    return {
      success: response.ok,
      orderId: request.orderId,
      cancelAmount: request.amount,
      cancelDate: new Date().toISOString(),
      error: data.message,
    };
  }
}
```

#### Step 2: Register in Factory

Update `src/services/payment/PaymentProviderFactory.ts`:

```typescript
import { TossPaymentProvider } from './TossPaymentProvider';

export class PaymentProviderFactory {
  static create(type: PaymentProviderType = 'mock', config?: any): PaymentProvider {
    switch (type) {
      case 'mock':
        return new MockPaymentProvider();
      
      case 'toss':
        if (!config?.clientKey || !config?.secretKey) {
          throw new Error('Toss Payments requires clientKey and secretKey');
        }
        return new TossPaymentProvider(config);
      
      // ... other providers
    }
  }
}
```

#### Step 3: Update Backend to Use Provider

In `src/index.tsx`, add payment initialization endpoint:

```typescript
import { PaymentProviderFactory } from './services/payment';

app.post('/api/payments/initialize', async (c) => {
  const { DB, PAYMENT_PROVIDER, TOSS_CLIENT_KEY, TOSS_SECRET_KEY } = c.env;
  
  const { orderId, amount, orderName } = await c.req.json();
  
  // Create payment provider
  const provider = PaymentProviderFactory.create(
    PAYMENT_PROVIDER || 'mock',
    {
      clientKey: TOSS_CLIENT_KEY,
      secretKey: TOSS_SECRET_KEY,
    }
  );
  
  // Initialize payment
  const result = await provider.initialize({
    orderId,
    amount,
    orderName,
    customerName: 'Customer', // Get from user data
  });
  
  return c.json({
    success: true,
    widgetUrl: result.widgetUrl,
    data: result.data,
  });
});
```

#### Step 4: Configure Environment Variables

Add to `.dev.vars`:

```bash
PAYMENT_PROVIDER=toss
TOSS_CLIENT_KEY=test_ck_...
TOSS_SECRET_KEY=test_sk_...
```

For production, set as Cloudflare Secrets:

```bash
npx wrangler secret put PAYMENT_PROVIDER --project-name toss-live-commerce
npx wrangler secret put TOSS_CLIENT_KEY --project-name toss-live-commerce
npx wrangler secret put TOSS_SECRET_KEY --project-name toss-live-commerce
```

---

## Switching Payment Providers

### Development Environment

1. Update `.dev.vars`:

```bash
# Switch from mock to toss
PAYMENT_PROVIDER=toss
TOSS_CLIENT_KEY=test_ck_...
TOSS_SECRET_KEY=test_sk_...
```

2. Restart development server:

```bash
npm run build
pm2 restart ur-live
```

### Production Environment

1. Set Cloudflare Secret:

```bash
npx wrangler secret put PAYMENT_PROVIDER --project-name toss-live-commerce
# Enter: toss
```

2. Deploy:

```bash
npm run deploy:prod
```

3. Verify:

```bash
curl https://live.ur-team.com/api/health
```

---

## Toss Payments Integration

### Prerequisites

1. Sign up at https://tosspayments.com
2. Get API keys from Dashboard
3. Configure redirect URLs

### Implementation Checklist

- [ ] Create `TossPaymentProvider.ts`
- [ ] Implement `initialize()` with Payment Widget
- [ ] Implement `approve()` with `/v1/payments/confirm`
- [ ] Implement `cancel()` with `/v1/payments/{paymentKey}/cancel`
- [ ] Add frontend Payment Widget integration
- [ ] Test with test keys
- [ ] Deploy with production keys

### Resources

- Docs: https://docs.tosspayments.com/
- API Reference: https://docs.tosspayments.com/reference
- Widget Guide: https://docs.tosspayments.com/guides/payment-widget/integration

---

## PortOne Integration

### Prerequisites

1. Sign up at https://portone.io
2. Get API credentials from Admin Console
3. Configure webhook URL

### Implementation Checklist

- [ ] Create `PortOnePaymentProvider.ts`
- [ ] Implement `initialize()` with PortOne.js
- [ ] Implement `approve()` with verification API
- [ ] Implement `cancel()` with cancel API
- [ ] Add frontend PortOne.js integration
- [ ] Configure webhook handling
- [ ] Test with test credentials
- [ ] Deploy with production credentials

### Resources

- Docs: https://portone.io/docs
- API Reference: https://api.portone.io/docs
- Migration Guide: https://portone.io/docs/migration

---

## Testing

### Mock Provider (Default)

The `MockPaymentProvider` simulates payment flow without actual payment:

```typescript
// Always succeeds
const provider = new MockPaymentProvider();
const result = await provider.approve('MOCK_KEY', 'ORDER_123', 10000);
// result.success === true
```

### Testing Checklist

- [ ] Order creation without payment (mock provider)
- [ ] Payment initialization flow
- [ ] Payment approval with test keys
- [ ] Payment cancellation/refund
- [ ] Error handling (insufficient funds, network errors)
- [ ] Webhook verification
- [ ] Production deployment with real keys

---

## Troubleshooting

### Error: "Payment provider not implemented yet"

**Cause**: Factory trying to create unimplemented provider

**Solution**:
1. Check `.dev.vars`: `PAYMENT_PROVIDER=mock`
2. Or implement the provider (see [Adding a New Payment Provider](#adding-a-new-payment-provider))

### Error: "Environment variables not set"

**Cause**: Missing `TOSS_CLIENT_KEY` or `TOSS_SECRET_KEY`

**Solution**:
1. Development: Add to `.dev.vars`
2. Production: Set Cloudflare Secret

```bash
npx wrangler secret put TOSS_CLIENT_KEY --project-name toss-live-commerce
```

### Payment approval fails silently

**Check**:
1. API keys are correct
2. Redirect URL is whitelisted
3. Request signature is valid
4. Network logs for API errors

---

## Migration Timeline

### Immediate (Now)

- ✅ NicePay removed
- ✅ Abstraction layer ready
- ✅ Mock provider working

### Short-term (1-2 weeks)

- Implement Toss Payments provider
- Frontend Payment Widget integration
- Testing with test keys

### Mid-term (1 month)

- Deploy Toss Payments to production
- Implement PortOne provider (optional)
- Multi-PG support (if needed)

---

## Contact

For payment integration support:
- 개발팀: dev@ur-team.com
- 문서: docs/PAYMENT_GATEWAY_GUIDE.md
- 이슈: GitHub Issues

---

**Last Updated**: 2026-02-10  
**Version**: 1.0.0
