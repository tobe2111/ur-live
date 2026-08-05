import type { Env } from '@/worker/types/env'
import { SECTION_DEFAULT_LIMIT } from '@/shared/constants/home-showcase'

/**
 * 🏠 홈 섹션 기본 시드 (2026-08-04 대표 신고 *"너가 줬던 시안이랑 완전 다르잖아"*).
 *
 * ## 왜 필요한가
 * #1046 은 섹션 **기능**만 넣고 섹션을 하나도 만들지 않았다. 그래서 라이브 홈은
 * *"틀은 있는데 안이 빈"* 상태였고, 승인받은 시안(인기 / 마감 임박 / 숙소 세 줄)과 전혀 달랐다.
 * 어드민이 손으로 만들어야만 보이는 구조는 **"기본이 빈 화면"** 이라는 뜻이고, 그건 시안이 아니다.
 *
 * ## 규칙 섹션만 시드한다
 * 전부 `source` 가 규칙(popular/deadline/category)이라 **상품이 들고 나는 대로 저절로 맞는다.**
 * 수동 큐레이션을 시드하면 담긴 상품이 없어 어차피 홈에서 빠진다(빈 줄은 서버가 뺀다).
 *
 * ## 대표의 편집을 절대 덮지 않는다
 * 블로그·가이드 시드와 같은 철학: **제목이 같은 섹션이 이미 있으면 건드리지 않는다.**
 * 지운 섹션도 되살리지 않는다(버전을 올릴 때만 없는 것을 새로 넣는다).
 * ⇒ 마음에 안 들면 어드민에서 지우거나 고치면 되고, 그 선택이 유지된다.
 */

/** 올릴 때마다 "아직 없는 시드 섹션"만 추가된다. 기존 행은 건드리지 않는다. */
export const SECTION_SEED_VERSION = 1

interface SeedSection {
  title: string
  subtitle: string
  source: 'popular' | 'deadline' | 'category'
  source_value: string | null
  limit_count: number
  more_href: string
}

/**
 * 기본 노출 줄.
 * ⚠️ 2026-08-04 대표 지시로 **'오늘 마감 임박' 은 뺐다**("아예 필요없어").
 *   규칙(`deadline`) 자체는 살아 있어 어드민에서 언제든 다시 만들 수 있다.
 */
export const HOME_SECTION_SEED: SeedSection[] = [
  {
    title: '지금 인기 이용권',
    subtitle: '많이 팔린 순으로 모았어요',
    source: 'popular',
    source_value: null,
    limit_count: SECTION_DEFAULT_LIMIT,
    more_href: '/group-buy',
  },
  {
    title: '주말에 떠나는 숙소',
    subtitle: '가까운 곳부터 천천히',
    source: 'category',
    source_value: 'stay_voucher',
    limit_count: SECTION_DEFAULT_LIMIT,
    more_href: '/stays',
  },
]

const SETTING_KEY = 'home_sections_seed_version'

async function readSeededVersion(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare(
      `SELECT value FROM platform_settings WHERE key = ?`
    ).bind(SETTING_KEY).first<{ value: string }>()
    const n = Number(row?.value)
    return Number.isFinite(n) ? n : 0
  } catch {
    // 테이블/행이 없으면 "아직 안 함" — 시드가 도는 게 맞다.
    return 0
  }
}

/**
 * 버전이 올랐을 때만 실행. **제목이 같은 섹션이 이미 있으면 건너뛴다**(대표 편집 보존).
 * 실패는 통째로 삼킨다 — 시드가 홈 조회를 깨뜨리면 안 된다.
 */
export async function maybeSeedHomeSections(env: Env): Promise<void> {
  const DB = env.DB
  try {
    if (await readSeededVersion(DB) >= SECTION_SEED_VERSION) return

    const { results } = await DB.prepare('SELECT title FROM homepage_sections').all<{ title: string }>()
    const existing = new Set((results ?? []).map(r => String(r.title)))

    const maxRow = await DB.prepare('SELECT MAX(sort_order) AS m FROM homepage_sections').first<{ m: number | null }>()
    let order = (maxRow?.m ?? 0) + 1

    for (const s of HOME_SECTION_SEED) {
      if (existing.has(s.title)) continue
      await DB.prepare(
        `INSERT INTO homepage_sections
           (title, subtitle, layout, sort_order, is_active, source, source_value, limit_count, more_href)
         VALUES (?, ?, 'grid3', ?, 1, ?, ?, ?, ?)`
      ).bind(s.title, s.subtitle, order++, s.source, s.source_value, s.limit_count, s.more_href).run()
    }

    await DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    ).bind(SETTING_KEY, String(SECTION_SEED_VERSION)).run()
  } catch {
    /* 시드 실패가 홈을 깨뜨리지 않는다 — 다음 요청에서 다시 시도된다. */
  }
}
