/**
 * 시청자 충성도 4단계 시스템 — Phase 2-3
 *
 * TikTok 의 "시청자가 선물을 보내는 4가지 심리" 자료에서 영감.
 * 시청자를 4단계로 분류해서 셀러가 차등 응대 가능.
 *
 * 등급 (자동 계산):
 *   newbie  — 첫 방문 또는 시청 1~2회
 *   regular — 3회+ 방문 (재방문)
 *   loyal   — 5회+ 방문 OR 1회+ 결제
 *   vip     — 3회+ 결제 OR 누적 50,000+ 딜 사용
 *
 * 사용:
 *   - 셀러 채팅창에서 시청자 등급 배지 표시
 *   - 등급별 추천 응대 메시지 (셀러 도구)
 *   - 후원/결제 알림 우선순위
 */

export type ViewerLoyalty = 'newbie' | 'regular' | 'loyal' | 'vip';

export const VIEWER_LOYALTY_LABEL: Record<ViewerLoyalty, string> = {
  newbie: '신규',
  regular: '단골',
  loyal: '충성',
  vip: 'VIP',
};

export const VIEWER_LOYALTY_BADGE: Record<ViewerLoyalty, { bg: string; text: string; emoji: string }> = {
  newbie: { bg: 'bg-gray-100',    text: 'text-gray-700',   emoji: '🌱' },
  regular: { bg: 'bg-blue-100',   text: 'text-blue-700',   emoji: '👋' },
  loyal: { bg: 'bg-purple-100',   text: 'text-purple-700', emoji: '💜' },
  vip: { bg: 'bg-yellow-100',     text: 'text-yellow-800', emoji: '👑' },
};

export interface ViewerStats {
  visits: number;        // 라이브 시청 횟수
  payments: number;      // 결제 완료 횟수
  totalSpent: number;    // 누적 사용 딜
}

export function computeViewerLoyalty(stats: ViewerStats): ViewerLoyalty {
  if (stats.payments >= 3 || stats.totalSpent >= 50_000) return 'vip';
  if (stats.payments >= 1 || stats.visits >= 5) return 'loyal';
  if (stats.visits >= 3) return 'regular';
  return 'newbie';
}

export const LOYALTY_RESPONSE_TEMPLATES: Record<ViewerLoyalty, string[]> = {
  newbie: [
    '{name}님 환영해요! 처음 오신 분이시네요 🎉',
    '{name}님 라이브 처음이세요? 편하게 즐겨주세요!',
    '신규 시청자분! 궁금한 점 있으시면 언제든 채팅으로 물어봐 주세요',
  ],
  regular: [
    '{name}님 다시 오셨네요! 반가워요 👋',
    '{name}님 자주 와주셔서 감사해요',
    '안녕하세요 {name}님~ 오늘도 함께 해주셔서 감사합니다',
  ],
  loyal: [
    '{name}님 늘 응원해주셔서 정말 감사해요 💜',
    'VIP 같은 단골 {name}님 등장!',
    '{name}님 항상 함께 해주셔서 큰 힘이 됩니다',
  ],
  vip: [
    '👑 {name}님 VIP가 되셨어요! 오늘도 감사합니다',
    '{name}님께서 등장하셨습니다! 최고의 응원에 감사드려요',
    '소중한 {name}님~ 오늘도 함께 해주셔서 영광입니다 🙏',
  ],
};
