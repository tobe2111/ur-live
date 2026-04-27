-- ============================================================
-- Migration 0220: 셀러 외부 플랫폼 연동 (T1)
-- ============================================================
-- 배경: 셀러가 TikTok / Instagram / YouTube 등 외부 SNS 계정을 우리 서비스에 연결.
-- T1 (Tier 1) 목적:
--   - TikTok Login OAuth 후 username + open_id 저장
--   - 셀러 프로필에 "TikTok 인증" 뱃지 표시
--   - Display API 로 비디오 동기화 (선택)
--
-- 향후 (Tier 2/3):
--   - Instagram / YouTube 추가 (같은 테이블)
--   - 정기 sync (last_synced_at 기준)
--
-- 작성: 2026-04-26 (T1)
-- ============================================================

CREATE TABLE IF NOT EXISTS seller_platform_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  -- 'tiktok' | 'instagram' | 'youtube' | 'twitch' (확장 가능)
  platform TEXT NOT NULL CHECK (platform IN ('tiktok','instagram','youtube','twitch')),
  -- 외부 플랫폼의 영구 식별자 (TikTok: open_id, IG: account_id, YT: channel_id)
  platform_user_id TEXT NOT NULL,
  -- 사용자 표시명 (handle / username)
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  -- OAuth 토큰 (만료 시 재인증)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,
  -- 동기화 상태
  last_synced_at DATETIME,
  sync_error TEXT,
  -- 인증 표시 옵션 (셀러가 비공개 가능)
  show_badge INTEGER NOT NULL DEFAULT 1,
  -- 연결 상태
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','revoked')),
  linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (seller_id, platform),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX IF NOT EXISTS idx_seller_platform_links_seller
  ON seller_platform_links(seller_id, platform);
CREATE INDEX IF NOT EXISTS idx_seller_platform_links_platform_user
  ON seller_platform_links(platform, platform_user_id);
