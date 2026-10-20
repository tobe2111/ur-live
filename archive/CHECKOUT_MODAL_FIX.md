# 체크아웃 페이지 배송지 변경 모달 수정

## 문제점
- PC 버전: 배송지 변경 버튼 클릭 시 반응 없음
- 모바일 버전: 모달에 "배송지 선택" 글자만 나오고 내용 없음
- 원인: CustomModal 컴포넌트가 children을 지원하지 않음 (message prop만 지원)

## 해결 방법

### 1. CustomModal 컴포넌트 개선 (`src/components/CustomModal.tsx`)

#### 추가된 기능:
- **children 지원**: ReactNode 타입의 children prop 추가
- **custom 타입**: `type="custom"` 옵션 추가
  - 헤더에 제목과 닫기(X) 버튼 표시
  - 콘텐츠 영역에 children 렌더링
  - 스크롤 가능 (max-height: 70vh)
- **maxWidth prop**: sm/md/lg/xl 옵션으로 모달 크기 조정
- **배경 클릭으로 닫기**: 모달 외부 클릭 시 onClose 호출

#### 코드 변경사항:
```typescript
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title?: string
  message?: string           // 선택 사항으로 변경
  children?: ReactNode       // 추가
  type?: 'alert' | 'confirm' | 'error' | 'success' | 'info' | 'warning' | 'custom'  // custom 추가
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'  // 추가
}
```

### 2. CheckoutPage 수정 (`src/pages/CheckoutPage.tsx`)

#### 배송지 선택 모달:
```tsx
<CustomModal
  isOpen={showAddressModal}
  onClose={() => setShowAddressModal(false)}
  title="배송지 선택"
  type="custom"
  maxWidth="lg"
>
  {/* 배송지 목록 */}
  <div className="space-y-3">
    {addresses.map((addr) => (
      <div key={addr.id} onClick={() => handleSelectAddress(addr)}>
        {/* 배송지 정보 표시 */}
      </div>
    ))}
    <button onClick={() => setShowNewAddressForm(true)}>
      새 배송지 추가
    </button>
  </div>
</CustomModal>
```

#### 새 배송지 추가 모달:
```tsx
<CustomModal
  isOpen={showNewAddressForm}
  onClose={() => setShowNewAddressForm(false)}
  title="새 배송지 추가"
  type="custom"
  maxWidth="lg"
>
  {/* 입력 폼 */}
  <div className="space-y-4">
    <input placeholder="수령인 이름" />
    <input placeholder="연락처" />
    {/* Daum 우편번호 API */}
    <div id="daum-postcode-container"></div>
  </div>
</CustomModal>
```

## 모달 타입 비교

| 타입 | 용도 | 레이아웃 | 버튼 |
|------|------|---------|------|
| **alert** | 알림 메시지 | 아이콘 + 제목 + 메시지 | 확인 |
| **confirm** | 확인 요청 | 아이콘 + 제목 + 메시지 | 취소 / 확인 |
| **custom** | 범용 콘텐츠 | 헤더(제목 + X) + children | 없음 (children에서 처리) |

## 테스트 완료 사항

✅ PC 버전: 배송지 변경 버튼 클릭 → 모달 정상 표시  
✅ 모바일 버전: 배송지 변경 버튼 클릭 → 모달 정상 표시  
✅ 배송지 목록: 등록된 배송지들이 카드 형태로 표시  
✅ 배송지 선택: 클릭 시 선택되고 모달 닫힘  
✅ 새 배송지 추가: 버튼 클릭 시 입력 폼 모달 표시  
✅ Daum 우편번호: 주소 검색 기능 정상 작동  
✅ 모달 외부 클릭: 모달 닫힘  
✅ X 버튼: 모달 닫힘  

## 배포 정보

- **커밋**: 892b11e
- **배포 URL**: https://0c21022b.ur-live.pages.dev/checkout
- **프로덕션**: https://live.ur-team.com/checkout
- **배포 시간**: 2026-02-19 04:36 GMT

## 사용 방법

### 기존 alert/confirm 모달 (변경 없음):
```tsx
<CustomModal
  isOpen={true}
  onClose={handleClose}
  title="알림"
  message="작업이 완료되었습니다."
  type="success"
/>
```

### 새로운 custom 모달:
```tsx
<CustomModal
  isOpen={true}
  onClose={handleClose}
  title="배송지 선택"
  type="custom"
  maxWidth="lg"
>
  <div>
    {/* 원하는 콘텐츠 */}
  </div>
</CustomModal>
```

## 스타일링

- **모달 크기**:
  - `maxWidth="sm"`: 최대 너비 384px (기본값)
  - `maxWidth="md"`: 최대 너비 448px
  - `maxWidth="lg"`: 최대 너비 512px (배송지 모달 사용)
  - `maxWidth="xl"`: 최대 너비 576px

- **스크롤**:
  - custom 모달의 콘텐츠는 `max-h-[70vh]`로 제한
  - 초과 시 자동 스크롤

- **애니메이션**:
  - 배경: fadeIn (0.2s)
  - 모달: slideUp (0.3s)
