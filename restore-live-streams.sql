-- 라이브 스트림 3개 복구
-- 기존 데이터 먼저 확인하고 없으면 추가

-- 1. 패션 라이브
INSERT OR IGNORE INTO live_streams (id, title, description, youtube_video_id, status, seller_id, platform, created_at, updated_at)
VALUES (
  1,
  '🔥 겨울 신상 패딩 특가! 최대 70% 할인',
  '겨울 시즌 필수 아이템! 따뜻한 패딩부터 스타일리시한 코트까지 모두 준비했어요. 지금 바로 만나보세요!',
  'jfKfPfyJRdk',
  'live',
  1,
  'youtube',
  datetime('now'),
  datetime('now')
);

-- 2. 뷰티 라이브
INSERT OR IGNORE INTO live_streams (id, title, description, youtube_video_id, status, seller_id, platform, created_at, updated_at)
VALUES (
  2,
  '💄 신상 화장품 언박싱 & 메이크업 쇼',
  '인기 뷰티 유튜버와 함께하는 특별한 라이브! 신상 화장품 리뷰와 메이크업 꿀팁을 함께 공유합니다.',
  '5qap5aO4i9A',
  'live',
  2,
  'youtube',
  datetime('now'),
  datetime('now')
);

-- 3. 가전제품 라이브
INSERT OR IGNORE INTO live_streams (id, title, description, youtube_video_id, status, seller_id, platform, created_at, updated_at)
VALUES (
  3,
  '⚡ 스마트홈 가전 대전! 오늘만 특가',
  '최신 스마트홈 기기부터 생활가전까지! 실시간 시연과 함께 특별한 가격으로 만나보세요.',
  'BGEGse7vgqs',
  'live',
  1,
  'youtube',
  datetime('now'),
  datetime('now')
);
