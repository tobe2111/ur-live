/**
 * 🔗 SNS 연동 계정의 **말** — 계정 종류 · 팔로워를 못 읽은 이유 · 추이 (2026-11-01 대표 확정 안 C)
 *
 * 왜 따로 두나: 이 문장들은 화면과 시험이 함께 읽고, 종전엔 카드 안에 흩어져 있었다.
 * 특히 *팔로워를 못 읽은 이유*는 `account_type` 에 **이미 저장돼 있었는데** 화면이 그냥
 * "읽지 못했어요" 라고만 적었다. 사장님의 최소 팔로워 조건이 그 숫자로 자동 판정되므로,
 * 빈 칸의 이유를 모르면 사람이 고칠 길이 없다(유튜브는 스튜디오에서 공개로 바꾸면 바로 읽힌다).
 *
 * 🔴 **못 읽은 것을 0 으로 위장하지 않는다.** 모르는 것과 0 은 다르다.
 */
import { FOLLOWER_WORD, type SeedingPlatform } from './seeding-labels'

/**
 * 계정 종류 라벨 — 플랫폼 이름 옆에 붙는다(`인스타그램 · 비즈니스 계정`).
 * 더 말할 게 없으면 `null`(= 플랫폼 이름만 쓴다). 모르는 값은 지어내지 않고 `null`.
 */
export function snsAccountLabel(platform: SeedingPlatform, accountType: string | null | undefined): string | null {
  const t = String(accountType ?? '').trim()
  if (!t) return null
  if (platform === 'instagram') {
    if (t === 'BUSINESS') return '비즈니스 계정'
    if (t === 'MEDIA_CREATOR' || t === 'CREATOR') return '크리에이터 계정'
    if (t === 'PERSONAL') return '개인 계정'
    return null
  }
  if (platform === 'youtube') {
    // 'channel' 은 평범한 경우라 아무 말도 더하지 않는다 — 모든 줄에 붙는 라벨은 정보가 아니다.
    if (t === 'hidden_subscribers') return '구독자 비공개'
    return null
  }
  return null
}

/** 팔로워를 못 읽었을 때 큰 숫자 자리 옆에 쓰는 말. 이유를 알면 이유를, 모르면 사실만. */
export function snsUnknownFollowerText(platform: SeedingPlatform, accountType: string | null | undefined): string {
  const t = String(accountType ?? '').trim()
  if (platform === 'youtube' && t === 'hidden_subscribers') return '구독자 수를 숨긴 채널이에요'
  if (platform === 'instagram' && t === 'PERSONAL') return '프로페셔널 계정에서만 읽을 수 있어요'
  if (platform === 'tiktok') return '틱톡 심사가 끝나면 보여요'
  return `${FOLLOWER_WORD[platform]} 수를 읽지 못했어요`
}

/** 사람이 직접 고칠 수 있는 경우에만 한 줄 더. 고칠 수 없으면 `null`(빈말을 안 한다). */
export function snsUnknownFollowerHint(platform: SeedingPlatform, accountType: string | null | undefined): string | null {
  if (platform === 'youtube' && String(accountType ?? '') === 'hidden_subscribers') {
    return '유튜브 스튜디오에서 구독자 수를 공개하면 읽을 수 있어요'
  }
  return null
}

/** 플랫폼마다 "게시물" 을 부르는 말이 다르다. */
export const POST_WORD: Record<SeedingPlatform, string> = {
  instagram: '게시물',
  youtube: '영상',
  tiktok: '영상',
}

export interface SnsTrend {
  /** 지금 팔로워 − 기준 스냅샷. 0 이면 쓰지 않는다. */
  delta: number
  /** 기준 스냅샷이 며칠 전인가. */
  days: number
}

/**
 * 추이 문구. **없으면 `null` 이고 화면은 그 자리를 비운다** (2026-11-01 대표
 * *"추이는 다음 주부터는 굳이 안넣어도 돼"* — 기다리라는 자리표시자를 두지 않는다).
 *
 * 🔢 날짜를 지어내지 않는다: 기준이 12일 전이면 `12일 전보다` 라고 적는다.
 *   스냅샷은 사람이 다시 확인을 누를 때 쌓이므로 "정확히 7일 전" 은 대개 없다.
 *   그걸 전부 "이번 주" 라고 부르면 틀린 말이 된다.
 *
 * 🎨 색을 쓰지 않는다 — 이 팔레트에는 초록이 없다(`tailwind.config.js` 가 장식 색조를 전부
 *   잉크로 중화한다). 늘고 주는 것은 화살표가 말한다.
 */
export function snsTrendText(trend: SnsTrend | null | undefined): string | null {
  if (!trend || !Number.isFinite(trend.delta) || trend.delta === 0) return null
  const sign = trend.delta > 0 ? '↑' : '↓'
  return `${trend.days}일 전보다 ${sign} ${Math.abs(trend.delta).toLocaleString('ko-KR')}`
}
