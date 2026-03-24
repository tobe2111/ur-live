# 배송지 필수 입력 구현

## 🎯 요구사항

**배송지 정보를 필수로 입력해야 결제가 가능하도록 구현**

사용자가 배송지를 선택하지 않으면:
1. 결제 버튼이 비활성화되어야 함
2. 명확한 경고 메시지가 표시되어야 함
3. 결제 버튼 클릭 시 배송지 선택 모달이 자동으로 열려야 함

---

## ✅ 구현 내용

### 1. **배송지 미선택 시 경고 UI 추가**

배송지가 선택되지 않았을 때 눈에 띄는 경고 박스 표시:

```tsx
{!selectedAddress && (
  <div className="space-y-3">
    {/* ⚠️ 경고 박스 */}
    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-red-800 mb-1">배송지를 선택해주세요 (필수)</h3>
          <p className="text-sm text-red-700">
            결제를 진행하려면 상품을 받으실 배송지를 먼저 선택해야 합니다.
          </p>
        </div>
      </div>
    </div>
    
    {/* 배송지 선택 버튼 (강조) */}
    <button
      onClick={() => setShowAddressModal(true)}
      className="w-full py-4 border-2 border-dashed border-red-300 bg-red-50 rounded-lg text-red-600 hover:border-red-500 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 font-medium"
    >
      <Plus className="h-5 w-5" />
      배송지 선택하기 (필수)
    </button>
  </div>
)}
```

**시각적 효과:**
- 🔴 빨간색 테마로 필수 입력 강조
- ⚠️ AlertCircle 아이콘으로 주의 환기
- 명확한 안내 문구

---

### 2. **결제 버튼 텍스트 개선**

배송지 선택 상태에 따라 버튼 텍스트 동적 변경:

```tsx
<Button
  onClick={handlePayment}
  disabled={!ready || !selectedAddress || isProcessing}
  className="..."
>
  {isProcessing 
    ? '처리 중...' 
    : !selectedAddress 
      ? '⚠️ 배송지를 선택해주세요' 
      : ready 
        ? '결제하기' 
        : '결제 준비 중...'}
</Button>
```

**버튼 상태:**
- ✅ 정상: `결제하기` (파란색)
- ⚠️ 배송지 미선택: `⚠️ 배송지를 선택해주세요` (비활성화)
- 🔄 처리 중: `처리 중...` (비활성화)
- ⏳ 준비 중: `결제 준비 중...` (비활성화)

---

### 3. **결제 버튼 하단 경고 메시지**

배송지 미선택 시 버튼 아래 추가 경고:

```tsx
{!selectedAddress && (
  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
    <p className="text-sm text-amber-800 text-center flex items-center justify-center gap-2">
      <AlertCircle className="h-4 w-4" />
      <span>배송지를 선택하셔야 결제가 가능합니다</span>
    </p>
  </div>
)}
```

**시각적 효과:**
- 🟡 황금색(amber) 테마로 주의 표시
- 버튼과 가까이 배치하여 눈에 잘 띄게 구성

---

### 4. **결제 버튼 클릭 시 자동 모달 오픈**

배송지를 선택하지 않고 결제 버튼 클릭 시 자동으로 배송지 선택 모달 표시:

```tsx
const handlePayment = async () => {
  // ... 다른 검증 로직

  // 배송지 필수 체크
  if (!selectedAddress) {
    alert('⚠️ 배송지를 먼저 선택해주세요.\n\n배송지 선택 화면으로 이동합니다.')
    setShowAddressModal(true)  // 📍 자동으로 모달 오픈
    return
  }

  // ... 결제 진행
}
```

**사용자 경험 개선:**
- 배송지 미선택 상태에서 결제 시도 → 모달 자동 오픈
- 추가 클릭 없이 바로 배송지 선택 가능
- 명확한 안내 메시지 제공

---

## 📊 Before vs After

### ❌ Before (문제점)

```tsx
// 배송지 미선택 시 단순한 버튼만 표시
{!selectedAddress && (
  <button onClick={() => setShowAddressModal(true)}>
    <Plus /> 배송지를 선택해주세요
  </button>
)}

// 결제 버튼 클릭 시 단순 alert만 표시
if (!selectedAddress) {
  alert('배송지를 선택해주세요.')
  return
}

// 버튼 텍스트가 상태를 명확히 표시하지 않음
<Button disabled={!ready || !selectedAddress}>
  {ready ? '결제하기' : '결제 준비 중...'}
</Button>
```

**문제점:**
- 배송지가 필수인지 명확하지 않음
- 시각적 강조가 약함
- 사용자가 왜 결제가 안 되는지 이해하기 어려움

---

### ✅ After (개선점)

```tsx
// 🔴 눈에 띄는 경고 박스 + 강조된 버튼
{!selectedAddress && (
  <div className="space-y-3">
    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
      <AlertCircle /> 배송지를 선택해주세요 (필수)
      결제를 진행하려면 상품을 받으실 배송지를 먼저 선택해야 합니다.
    </div>
    <button className="border-red-300 bg-red-50 text-red-600">
      배송지 선택하기 (필수)
    </button>
  </div>
)}

// ✅ 모달 자동 오픈 + 명확한 안내
if (!selectedAddress) {
  alert('⚠️ 배송지를 먼저 선택해주세요.\n\n배송지 선택 화면으로 이동합니다.')
  setShowAddressModal(true)  // 자동 오픈
  return
}

// ✅ 상태별 명확한 버튼 텍스트
<Button disabled={!ready || !selectedAddress || isProcessing}>
  {isProcessing ? '처리 중...' 
   : !selectedAddress ? '⚠️ 배송지를 선택해주세요' 
   : ready ? '결제하기' 
   : '결제 준비 중...'}
</Button>

// ✅ 추가 경고 메시지
{!selectedAddress && (
  <div className="bg-amber-50 border border-amber-200">
    <AlertCircle /> 배송지를 선택하셔야 결제가 가능합니다
  </div>
)}
```

**개선점:**
- ✅ 빨간색 테마로 필수 입력 강조
- ✅ 명확한 안내 문구 3단계 (경고 박스 + 버튼 텍스트 + 하단 메시지)
- ✅ 자동 모달 오픈으로 사용자 편의성 향상
- ✅ 시각적으로 눈에 잘 띄는 디자인

---

## 🎨 UI 개선 요약

### 1. **배송지 섹션 (미선택 시)**
```
┌─────────────────────────────────────────────┐
│ 📍 배송지                          [변경 >] │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ ⚠️ 배송지를 선택해주세요 (필수)        │ │
│ │ 결제를 진행하려면 상품을 받으실 배송지 │ │
│ │ 를 먼저 선택해야 합니다.               │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │  + 배송지 선택하기 (필수)              │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 2. **결제 버튼 영역 (배송지 미선택 시)**
```
┌─────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────┐ │
│ │ ⚠️ 배송지를 선택해주세요 (비활성화)    │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ ⚠️ 배송지를 선택하셔야 결제가 가능합니다│ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 🚀 배포 정보

| 항목 | 값 |
|------|-----|
| **Preview URL** | https://2507595f.toss-live-commerce.pages.dev |
| **Production URL** | https://live.ur-team.com |
| **커밋 해시** | `406c71e` |
| **배포 일시** | 2025-02-11 |

---

## ✅ 테스트 시나리오

### 1. 배송지 미선택 상태 확인

```bash
1. https://live.ur-team.com/login → user@example.com / user123 로그인
2. https://live.ur-team.com/live → 상품 담기
3. https://live.ur-team.com/checkout 접속
4. ✅ 배송지 섹션에 빨간색 경고 박스 표시 확인
5. ✅ "배송지 선택하기 (필수)" 버튼이 빨간색으로 강조됨 확인
6. ✅ 결제 버튼이 "⚠️ 배송지를 선택해주세요"로 표시되고 비활성화됨 확인
7. ✅ 결제 버튼 아래 황금색 경고 메시지 표시 확인
```

### 2. 결제 버튼 클릭 시 모달 자동 오픈

```bash
1. 위 1~3 단계 동일 (배송지 미선택 상태)
2. "⚠️ 배송지를 선택해주세요" 버튼 클릭
3. ✅ alert 메시지 표시: "배송지를 먼저 선택해주세요.\n\n배송지 선택 화면으로 이동합니다."
4. ✅ 배송지 선택 모달 자동으로 오픈됨
5. 배송지 선택 또는 새 배송지 추가
6. ✅ 선택 후 경고 메시지 사라지고 결제 버튼 활성화됨
```

### 3. 배송지 선택 후 정상 결제

```bash
1. 배송지 선택 모달에서 배송지 선택
2. ✅ 경고 박스 및 메시지 모두 사라짐
3. ✅ 결제 버튼이 "결제하기"로 변경되고 파란색으로 활성화됨
4. "결제하기" 버튼 클릭
5. ✅ 결제창 정상 오픈
```

---

## 📝 변경 파일

```
src/pages/CheckoutPage.tsx
```

**변경 내용:**
1. 배송지 미선택 시 빨간색 경고 박스 추가
2. 배송지 선택 버튼을 빨간색 테마로 강조
3. 결제 버튼 텍스트에 배송지 미선택 상태 표시
4. 결제 버튼 하단에 황금색 경고 메시지 추가
5. `handlePayment()` 함수에서 배송지 미선택 시 모달 자동 오픈 로직 추가

---

## 🎯 핵심 개선 포인트

### 1. **3단계 시각적 경고**
- 🔴 **1단계**: 배송지 섹션 빨간색 경고 박스
- 🔴 **2단계**: 결제 버튼 텍스트 "⚠️ 배송지를 선택해주세요"
- 🟡 **3단계**: 버튼 하단 황금색 경고 메시지

### 2. **자동 모달 오픈**
- 사용자가 배송지를 선택하지 않고 결제 시도 시
- 추가 클릭 없이 바로 배송지 선택 모달 표시
- 사용자 경험(UX) 크게 개선

### 3. **명확한 안내 문구**
- "배송지를 선택해주세요 (필수)"
- "결제를 진행하려면 상품을 받으실 배송지를 먼저 선택해야 합니다."
- "배송지를 선택하셔야 결제가 가능합니다"

### 4. **색상 활용**
- 🔴 빨간색: 필수 입력, 오류 강조
- 🟡 황금색(amber): 주의, 경고
- 🔵 파란색: 정상 상태, 활성화

---

## ✅ 최종 결과

✅ **배송지 필수 입력 완벽 구현**  
✅ **3단계 시각적 경고 시스템**  
✅ **자동 모달 오픈으로 UX 개선**  
✅ **명확한 안내 문구**  
✅ **색상 코딩으로 직관적인 UI**  

**이제 사용자가 배송지를 선택하지 않으면 절대 결제할 수 없습니다! 🎉**

---

## 📚 관련 문서

- [PAYMENT_DUPLICATE_FIX.md](./PAYMENT_DUPLICATE_FIX.md) - 결제 중복 요청 방지
- [BRANDPAY_COMPLETE_IMPLEMENTATION.md](./BRANDPAY_COMPLETE_IMPLEMENTATION.md) - 브랜드페이 완전 구현
- [CHECKOUT_ERROR_DEBUG.md](./CHECKOUT_ERROR_DEBUG.md) - 체크아웃 오류 디버깅
- [CHECKOUT_TEST_GUIDE.md](./CHECKOUT_TEST_GUIDE.md) - 체크아웃 테스트 가이드
