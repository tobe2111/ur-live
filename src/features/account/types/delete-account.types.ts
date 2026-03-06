// 탈퇴 플로우 타입 정의 - 심리적으로 번거롭게!

export interface DeleteAccountFormData {
  agreedToDataDeletion: boolean;
  agreedToLoseBenefits: boolean;
  agreedToNoRefund: boolean;
  confirmText: string; // "회원탈퇴" 직접 입력해야 함
}

export interface DeleteAccountWarning {
  id: string;
  title: string;
  description: string;
  icon: 'alert' | 'trash' | 'gift';
}

export const DELETE_ACCOUNT_WARNINGS: DeleteAccountWarning[] = [
  {
    id: 'data_loss',
    title: '모든 데이터가 영구 삭제됩니다',
    description:
      '주문 내역, 찜한 상품, 포인트, 쿠폰 등 모든 정보가 삭제되며 복구할 수 없습니다.',
    icon: 'trash',
  },
  {
    id: 'reregistration',
    title: '같은 이메일로 재가입이 제한됩니다',
    description: '탈퇴 후 30일간 동일한 이메일로 재가입할 수 없습니다.',
    icon: 'alert',
  },
  {
    id: 'benefits_loss',
    title: '진행 중인 혜택을 모두 잃게 됩니다',
    description:
      '쿠폰, 포인트, 멤버십 등급, 누적 구매 혜택이 모두 사라지며 재가입 시에도 복구되지 않습니다.',
    icon: 'gift',
  },
];

export interface UserRetentionOffer {
  id: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export const USER_RETENTION_OFFERS: UserRetentionOffer[] = [
  {
    id: 'coupon',
    title: '🎁 특별 할인 쿠폰 10,000원',
    description: '지금 탈퇴를 취소하시면 즉시 사용 가능한 10,000원 쿠폰을 드립니다.',
    action: {
      label: '쿠폰 받고 머무르기',
      href: '/my',
    },
  },
  {
    id: 'points',
    title: '💰 보유 중인 포인트',
    description: '현재 사용 가능한 포인트가 있습니다. 탈퇴 시 모두 소멸됩니다.',
  },
  {
    id: 'orders',
    title: '📦 진행 중인 주문',
    description: '배송 중이거나 예정된 주문이 있습니다. 탈퇴 시 처리가 어려울 수 있습니다.',
    action: {
      label: '주문 확인하기',
      href: '/my/orders',
    },
  },
  {
    id: 'membership',
    title: '⭐ VIP 등급 혜택',
    description:
      '현재 VIP 등급으로 다양한 혜택을 받고 계십니다. 탈퇴 시 등급이 초기화됩니다.',
  },
];
