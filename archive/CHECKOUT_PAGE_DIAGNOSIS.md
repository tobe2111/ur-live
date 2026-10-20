# Checkout Page UI & Payment Button Diagnosis

**Created**: 2026-03-05  
**Dev Server**: https://5174-inh6ye2hzktmo586gwg9c-c07dda5e.sandbox.novita.ai  
**Production**: https://live.ur-team.com

---

## 📋 Issue Summary

### User Request:
1. **Identify UI components** showing shipping fee and total payment amount
2. **Diagnose payment button** showing '결제 시스템 로딩 중…' (Payment system loading...)
3. **Investigate SDK loading** issues with TossPayments widget

### Key Clues from Console Logs:
- Firebase auth initialized successfully
- TossPayments SDK v1 loaded
- Preloaded script warning for payment-widget.js
- Network errors: `ERR_NETWORK_IO_SUSPENDED`, 400 auth errors
- Auth listener loop (previously fixed)

---

## 🎯 PART 1: UI Components Identification

### A. Shipping Fee Display

**Location**: CheckoutPage.tsx (Lines 828-862 Desktop, 876-914 Mobile)

#### Desktop View (Right Column):
```tsx
{/* Line 826-873: Desktop Order Summary */}
<div className="hidden lg:block lg:w-[360px]">
  <div className="sticky top-20 rounded-3xl">
    <section className="bg-white px-5 py-6">
      <h2 className="text-[17px] font-bold text-gray-900">결제 금액</h2>

      <div className="mt-5 flex flex-col gap-3.5">
        {/* 상품금액 */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-gray-600">상품금액</span>
          <span className="text-[14px] text-gray-900">
            {subtotal.toLocaleString()}원
          </span>
        </div>

        {/* 배송비 - THIS IS WHERE SHIPPING FEE IS SHOWN */}
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-gray-600">배송비</span>
          <span className="text-[14px] text-gray-900">
            {totalShippingFee === 0 ? (
              <span className="font-medium text-blue-600">무료</span>
            ) : (
              `${totalShippingFee.toLocaleString()}원`
            )}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="my-5 h-px bg-gray-200" />

      {/* 총 결제금액 - THIS IS WHERE TOTAL AMOUNT IS SHOWN */}
      <div className="flex items-end justify-between">
        <span className="text-[15px] font-semibold text-gray-900">총 결제금액</span>
        <div className="flex items-baseline gap-0.5">
          <span className="text-[26px] font-bold tracking-tight text-gray-900">
            {totalAmount.toLocaleString()}
          </span>
          <span className="text-[15px] font-semibold text-gray-900">원</span>
        </div>
      </div>
    </section>
  </div>
</div>
```

#### Mobile View (Bottom Section):
```tsx
{/* Lines 876-914: Mobile Order Summary */}
<div className="lg:hidden">
  <div className="h-2 bg-gray-100" />
  <section className="bg-white px-5 py-6">
    <h2 className="text-[17px] font-bold text-gray-900">결제 금액</h2>

    <div className="mt-5 flex flex-col gap-3.5">
      {/* 상품금액 */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] text-gray-600">상품금액</span>
        <span className="text-[14px] text-gray-900">
          {subtotal.toLocaleString()}원
        </span>
      </div>

      {/* 배송비 */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] text-gray-600">배송비</span>
        <span className="text-[14px] text-gray-900">
          {totalShippingFee === 0 ? (
            <span className="font-medium text-blue-600">무료</span>
          ) : (
            `${totalShippingFee.toLocaleString()}원`
          )}
        </span>
      </div>
    </div>

    <div className="my-5 h-px bg-gray-200" />

    {/* 총 결제금액 */}
    <div className="flex items-end justify-between">
      <span className="text-[15px] font-semibold text-gray-900">총 결제금액</span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[26px] font-bold tracking-tight text-gray-900">
          {totalAmount.toLocaleString()}
        </span>
        <span className="text-[15px] font-semibold text-gray-900">원</span>
      </div>
    </div>
  </section>
</div>
```

### B. Shipping Fee Calculation Logic

**Location**: CheckoutPage.tsx (Lines 128-163)

```tsx
// Line 128-151: Seller grouping with shipping fees
const sellerGroups = cartItems.reduce((groups, item) => {
  const sellerId = item.seller_id || 0
  if (!groups[sellerId]) {
    groups[sellerId] = {
      seller_id: sellerId,
      seller_name: item.seller_name || '판매자',
      items: [],
      subtotal: 0,
      shipping_fee: item.shipping_fee || 3000,  // Default 3000원
      free_shipping_threshold: item.free_shipping_threshold || 0,
    }
  }
  groups[sellerId].items.push(item)
  groups[sellerId].subtotal += item.price_snapshot * item.quantity
  return groups
}, {})

// Line 154-163: Shipping fee calculation
const subtotal = cartItems.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0)

const totalShippingFee = Object.values(sellerGroups).reduce((total, group) => {
  // Free shipping if order meets threshold
  if (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold) {
    return total
  }
  return total + group.shipping_fee
}, 0)

const totalAmount = subtotal + totalShippingFee
```

### C. Per-Seller Shipping Fee Display

**Location**: CheckoutPage.tsx (Lines 748-761)

```tsx
{/* Shipping fee per seller group */}
<div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-[13px]">
  <span className="text-gray-600">배송비</span>
  <span className="font-semibold text-gray-900">
    {group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold
      ? <span className="text-blue-600 font-medium">무료</span>
      : `${group.shipping_fee.toLocaleString()}원`}
  </span>
</div>
{group.free_shipping_threshold > 0 && group.subtotal < group.free_shipping_threshold && (
  <p className="text-[12px] text-gray-500 mt-1">
    {(group.free_shipping_threshold - group.subtotal).toLocaleString()}원 추가 시 무료배송
  </p>
)}
```

---

## 🔍 PART 2: Payment Button Loading Issue

### Current Symptoms:
- Payment button shows: **"결제 시스템 로딩 중…"** (Payment system loading...)
- Button remains disabled indefinitely
- TossPayments widget may not be rendering properly

### A. Payment Widget Component Structure

**Component**: `TossPaymentWidget.tsx` (Region-based lazy loading)

```tsx
// CheckoutPage.tsx Lines 12-18: Lazy loading
const TossPaymentWidget = lazy(() => 
  import('@/components/payments/TossPaymentWidget').then(m => ({ default: m.TossPaymentWidget }))
)
const StripeCheckout = lazy(() => 
  import('@/components/payments/StripeCheckout').then(m => ({ default: m.StripeCheckout }))
)

// Lines 775-821: Region-based rendering
{isKorea() ? (
  /* 한국: Toss Payments */
  <Suspense fallback={
    <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
      <p>결제 수단 불러오는 중...</p>
    </div>
  }>
    <TossPaymentWidget
      userId={userId || ''}
      cartItems={cartItems}
      totalAmount={subtotal}
      shippingFee={totalShippingFee}
      onPaymentSuccess={(orderId, paymentKey, amount) => {
        console.log('[CheckoutPage] 결제 성공:', { orderId, paymentKey, amount })
        navigate(`/payment/success?orderId=${orderId}&paymentKey=${paymentKey}&amount=${amount}`)
      }}
      onPaymentError={(error) => {
        console.error('[CheckoutPage] 결제 실패:', error)
        showErrorToast(error)
      }}
    />
  </Suspense>
) : (
  /* 글로벌: Stripe */
  // ... Stripe checkout ...
)}
```

### B. TossPaymentWidget Initialization Flow

**File**: `src/components/payments/TossPaymentWidget.tsx`

#### Step 1: SDK Loading Check (Lines 44-71)
```tsx
useEffect(() => {
  if (!userId || cartItems.length === 0 || hasInitialized.current) {
    return
  }

  async function fetchPaymentWidgets() {
    try {
      console.log('[TossPayments] 초기화 시작')

      // ⚠️ CRITICAL: Check if SDK is loaded
      if (typeof window.PaymentWidget === 'undefined') {
        console.warn('[TossPayments] SDK가 로드되지 않음. 스크립트 확인 필요.')
        return  // ❌ EXITS HERE IF SDK NOT LOADED
      }

      const customerKey = `user_${userId}`
      const widgetsInstance = window.PaymentWidget(TOSS_CLIENT_KEY, customerKey)
      console.log('[TossPayments] ✅ 인스턴스 생성 완료')

      setWidgets(widgetsInstance)
      hasInitialized.current = true
    } catch (err) {
      console.error('[TossPayments] ❌ 초기화 실패:', err)
      onPaymentError(t('payment.initError') || '결제 초기화 실패')
    }
  }

  fetchPaymentWidgets()
}, [userId, cartItems, onPaymentError, t])
```

**🚨 POTENTIAL ISSUE #1**: If `window.PaymentWidget` is undefined, initialization silently fails without error feedback.

#### Step 2: UI Rendering (Lines 74-122)
```tsx
useEffect(() => {
  if (!widgets || isRendered) {
    return  // ❌ EXITS IF NO WIDGETS INSTANCE
  }

  async function renderPaymentWidgets() {
    try {
      console.log('[TossPayments] UI 렌더링 시작')

      const finalAmount = totalAmount + shippingFee

      // DOM 요소 확인 (최대 2초 대기)
      let attempts = 0
      const checkElement = setInterval(() => {
        const paymentMethodEl = document.getElementById('payment-method')
        const agreementEl = document.getElementById('agreement')

        if (paymentMethodEl && agreementEl) {
          clearInterval(checkElement)
          console.log('[TossPayments] ✅ DOM 요소 발견!')

          // 결제 UI 렌더링
          widgets.renderPaymentMethods(
            '#payment-method',
            { value: finalAmount },
            { variantKey: 'DEFAULT' }
          )

          widgets.renderAgreement('#agreement', { variantKey: 'AGREEMENT' })

          console.log('[TossPayments] ✅ UI 렌더링 완료')
          setIsRendered(true)  // ✅ THIS ENABLES THE BUTTON
        }

        attempts++
        if (attempts > 20) {
          clearInterval(checkElement)
          console.error('[TossPayments] ❌ DOM 요소를 찾을 수 없음')
          onPaymentError(t('payment.renderError') || 'UI 렌더링 실패')
        }
      }, 100)
    } catch (err) {
      console.error('[TossPayments] ❌ 렌더링 실패:', err)
      onPaymentError(t('payment.renderError') || 'UI 렌더링 실패')
    }
  }

  renderPaymentWidgets()
}, [widgets, isRendered, totalAmount, shippingFee, onPaymentError, t])
```

**🚨 POTENTIAL ISSUE #2**: If DOM elements are not found within 2 seconds (20 attempts × 100ms), rendering fails.

#### Step 3: Payment Button (Lines 172-187)
```tsx
<button
  onClick={handlePayment}
  disabled={!isRendered || isProcessing}  // ❌ DISABLED IF NOT RENDERED
  className={`
    w-full py-4 rounded-lg font-bold text-white text-lg
    ${!isRendered || isProcessing
      ? 'bg-gray-300 cursor-not-allowed'  // Gray disabled state
      : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
    }
  `}
>
  {isProcessing
    ? t('payment.processing') || '결제 진행 중...'
    : t('payment.pay') || `${(totalAmount + shippingFee).toLocaleString()}원 결제하기`
  }
</button>
```

**🚨 ROOT CAUSE IDENTIFIED**:
- Button is **disabled** when `isRendered = false`
- `isRendered` only becomes `true` after successful UI rendering (Step 2)
- If widget initialization fails or DOM elements are missing, button stays disabled

### C. SDK Loading Configuration

**File**: `index.html` (Lines 277-283)

```html
<!-- TossPayments 결제위젯 SDK - Load AFTER React with defer -->
<script defer src="https://js.tosspayments.com/v1/payment-widget"></script>
<script defer>
  window.addEventListener('load', function() {
    console.log('[TossPayments] 결제위젯 SDK v1 loaded - window.PaymentWidget:', typeof window.PaymentWidget);
  });
</script>
```

**Configuration**:
- SDK loads with `defer` attribute (after HTML parsing)
- Preconnect hint on line 188: `<link rel="preconnect" href="https://js.tosspayments.com" crossorigin />`
- Preload hint on line 196: `<link rel="preload" href="https://js.tosspayments.com/v1/payment-widget" as="script" />`

**🚨 POTENTIAL ISSUE #3**: Race condition - React component may mount before SDK finishes loading.

### D. Script Injection in Component

**File**: `TossPaymentWidget.tsx` (Lines 189-193)

```tsx
{/* Toss Payments SDK 로드 */}
{!hasInitialized.current && (
  <script src="https://js.tosspayments.com/v1/payment-widget" async />
)}
```

**⚠️ ANTI-PATTERN**: This JSX `<script>` tag does NOT actually load the script in React. It's dead code that has no effect.

---

## 🐛 PART 3: Root Cause Analysis

### Problem Chain:

1. **SDK Loading Uncertainty**
   - SDK is loaded via `<script defer>` in index.html
   - TossPaymentWidget component may mount before `window.PaymentWidget` is available
   - No loading state or retry mechanism

2. **Silent Failure**
   - If `window.PaymentWidget === undefined`, initialization returns early
   - No error is thrown to user
   - Button remains in "loading" state indefinitely

3. **DOM Element Timing**
   - Component expects `#payment-method` and `#agreement` elements
   - Elements may not exist if component suspends or lazy loads
   - 2-second timeout may not be enough on slow connections

4. **isRendered State Never Set**
   - If any step fails, `isRendered` stays `false`
   - Button disabled state: `disabled={!isRendered || isProcessing}`
   - User sees gray button with "결제 시스템 로딩 중…"

### Error Clues from Console:
- ✅ `[TossPayments] 결제위젯 SDK v1 loaded` appears in logs
- ❓ Need to check if `[TossPayments] 초기화 시작` appears
- ❓ Need to check if `[TossPayments] UI 렌더링 시작` appears
- ❓ Check for `[TossPayments] ❌ SDK가 로드되지 않음` warning

---

## 🔧 PART 4: Recommended Fixes

### Fix #1: Add SDK Loading Verification

**File**: `TossPaymentWidget.tsx`

```tsx
useEffect(() => {
  if (!userId || cartItems.length === 0 || hasInitialized.current) {
    return
  }

  async function fetchPaymentWidgets() {
    try {
      console.log('[TossPayments] 초기화 시작')

      // ✅ Wait for SDK to load with retry mechanism
      let retries = 0
      const maxRetries = 30 // 3 seconds
      
      while (typeof window.PaymentWidget === 'undefined' && retries < maxRetries) {
        console.log(`[TossPayments] SDK 로딩 대기 중... (${retries + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 100))
        retries++
      }

      if (typeof window.PaymentWidget === 'undefined') {
        throw new Error('TossPayments SDK failed to load after 3 seconds')
      }

      const customerKey = `user_${userId}`
      const widgetsInstance = window.PaymentWidget(TOSS_CLIENT_KEY, customerKey)
      console.log('[TossPayments] ✅ 인스턴스 생성 완료')

      setWidgets(widgetsInstance)
      hasInitialized.current = true
    } catch (err) {
      console.error('[TossPayments] ❌ 초기화 실패:', err)
      onPaymentError(t('payment.initError') || '결제 초기화 실패')
    }
  }

  fetchPaymentWidgets()
}, [userId, cartItems, onPaymentError, t])
```

### Fix #2: Add Loading/Error UI States

```tsx
const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading')
const [errorMessage, setErrorMessage] = useState<string>('')

// Update button rendering
<button
  onClick={handlePayment}
  disabled={loadingState !== 'ready' || isProcessing}
  className={`
    w-full py-4 rounded-lg font-bold text-white text-lg
    ${loadingState !== 'ready' || isProcessing
      ? 'bg-gray-300 cursor-not-allowed'
      : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
    }
  `}
>
  {loadingState === 'loading' && '결제 시스템 로딩 중...'}
  {loadingState === 'error' && '결제 시스템 오류 (새로고침 필요)'}
  {loadingState === 'ready' && !isProcessing && `${(totalAmount + shippingFee).toLocaleString()}원 결제하기`}
  {loadingState === 'ready' && isProcessing && '결제 진행 중...'}
</button>

{loadingState === 'error' && errorMessage && (
  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
    <p className="text-sm text-red-800">{errorMessage}</p>
    <button onClick={() => window.location.reload()} className="text-blue-600 underline mt-2">
      새로고침
    </button>
  </div>
)}
```

### Fix #3: Remove Dead Script Tag

**Delete lines 189-193** in TossPaymentWidget.tsx:
```tsx
// ❌ REMOVE THIS - IT DOES NOTHING
{!hasInitialized.current && (
  <script src="https://js.tosspayments.com/v1/payment-widget" async />
)}
```

### Fix #4: Add Network Error Handling

Check for 400 auth errors and `ERR_NETWORK_IO_SUSPENDED`:

```tsx
try {
  const widgetsInstance = window.PaymentWidget(TOSS_CLIENT_KEY, customerKey)
  // ... rest of code
} catch (err: any) {
  if (err.message?.includes('network') || err.message?.includes('400')) {
    setErrorMessage('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
  } else if (err.message?.includes('auth')) {
    setErrorMessage('인증 오류가 발생했습니다. 다시 로그인해주세요.')
  } else {
    setErrorMessage('결제 시스템 초기화에 실패했습니다.')
  }
  setLoadingState('error')
  onPaymentError(errorMessage)
}
```

---

## 📊 PART 5: Testing Checklist

### A. Dev Server Tests

1. **Open dev server**: https://5174-inh6ye2hzktmo586gwg9c-c07dda5e.sandbox.novita.ai
2. **Open browser console** (F12)
3. **Navigate to checkout page**: Add items to cart → Go to /cart → Click checkout
4. **Watch for these console logs**:
   - `[TossPayments] 결제위젯 SDK v1 loaded - window.PaymentWidget: function`
   - `[TossPayments] 초기화 시작`
   - `[TossPayments] ✅ 인스턴스 생성 완료`
   - `[TossPayments] UI 렌더링 시작`
   - `[TossPayments] ✅ DOM 요소 발견!`
   - `[TossPayments] ✅ UI 렌더링 완료`

5. **Check button state**:
   - Should be **blue** and **enabled** after rendering completes
   - If gray and disabled, check for errors

### B. Network Tests

1. **Open Network tab** (F12 → Network)
2. **Filter by "payment"**
3. **Check for**:
   - `GET https://js.tosspayments.com/v1/payment-widget` → Status 200
   - `POST https://log.tosspayments.com/...` (analytics, can be ignored)
4. **Look for failed requests** (status 400, 500, or red color)

### C. Auth Token Tests

1. **Check localStorage**:
   ```javascript
   console.log('Firebase Token:', localStorage.getItem('firebase_token'))
   console.log('User ID:', localStorage.getItem('user_id'))
   ```
2. **Verify token validity** (should not be expired)
3. **Test without login** → Should redirect to login page

### D. Shipping Fee Display Tests

1. **Add products from different sellers**
2. **Verify shipping fee calculation**:
   - Each seller group shows its own shipping fee
   - Total shipping fee at bottom = sum of all seller fees
   - Free shipping badge appears when threshold met
3. **Check both desktop and mobile views**

---

## 📝 PART 6: Summary

### UI Components Answer:
✅ **Shipping fee and total amount are shown in TWO places**:

1. **Desktop**: Right sidebar "결제 금액" section
   - Lines 839-847: 배송비 (Shipping Fee)
   - Lines 853-861: 총 결제금액 (Total Amount)

2. **Mobile**: Bottom "결제 금액" section  
   - Lines 890-898: 배송비 (Shipping Fee)
   - Lines 904-912: 총 결제금액 (Total Amount)

3. **Per-Seller**: In each seller group card
   - Lines 748-761: Individual shipping fee with free shipping notification

### Payment Button Issue:
🐛 **Root cause**: Button disabled when `isRendered === false`

**Likely reasons**:
1. TossPayments SDK not loaded before component initialization
2. DOM elements (#payment-method, #agreement) not found
3. Silent failure with no error feedback to user

**Recommended fixes**:
- Add SDK loading retry mechanism
- Add error state UI with "새로고침" button
- Remove dead script injection code
- Add better loading indicators

### Next Steps:
1. Apply Fix #1-4 above
2. Test on dev server with console logs
3. Verify network requests for payment-widget.js
4. Check for auth token validity
5. Deploy and test on production

---

**End of diagnosis report**
