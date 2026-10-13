/**
 * 🗓️ 2026-10-12 — 블로그 날짜가 **거짓말을 하지 않는다**.
 *
 * 대표 *"다 개선하고 또 개선할 것 있는지 찾아줘"* 의 전수 중 라이브 실측에서 나온 것:
 *
 *     /api/blog/public  21편의 published_at
 *       2026-09-24 09:51:07 · 09-21 09:51:07 · 09-18 09:51:08 … 07-26 09:51:10
 *       → 시:분:초가 **네 값뿐**(09:51:07~10) · 인접 간격 전부 3일
 *     /blog/:slug JSON-LD
 *       "datePublished":"2026-09-24T09:51:07.000Z"
 *       "dateModified" :"2026-09-24T09:51:07.000Z"   ← 둘이 **항상 같다**
 *
 * 즉 `published_at` 은 발행일이 아니라 **"마지막 재시드 한 순간 − 3i일"** 이었다. 재시드 UPDATE 가
 * `published_at=datetime('now', -3i days)` 를 매 `BLOG_SEED_VERSION` bump 마다 다시 썼기 때문이다
 * (그 룰은 서비스 사실이 바뀌면 bump 하라고 요구하므로 **자주** 돈다) ⇒ 구글이 보는 발행일이
 * 배포마다 앞으로 점프하고, 오래된 글이 나이를 쌓지 못한다. 그리고 `dateModified` 가 같은 값이라
 * *"고쳤다"* 는 신호는 **구조적으로 존재할 수 없었다**.
 *
 * ⚠️ 이 시험이 **못 보는 것**: 구글이 그 날짜를 실제로 어떻게 쓰는지(외부 판정) · D1 의 실제 값
 * (라이브 조회만이 안다) · 어드민에서 사람이 고친 글(`manually_edited=1` 은 재시드가 건드리지 않는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { buildBlogPostMeta } from '@/features/blog/api/blog-ssr-meta'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => readFileSync(p, 'utf-8')
const code = (p: string) => stripComments(read(p))

const BLOG = 'src/features/blog/api/blog.routes.ts'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'

/**
 * 재시드 UPDATE 문장만 떼어낸다.
 * 🩸 첫 판은 `indexOf('UPDATE blog_posts')` 였는데 그게 **다른 문장**(레거시 slug 를
 *   `is_seed=1` 로 표시하는 UPDATE)을 집었다 — 거기엔 날짜가 아예 없으니 ① 이 **늘 통과**했다.
 *   재시드 문장의 지문은 `seed_version=?` 다(그 문장만 버전을 찍는다).
 */
function reseedUpdate(): string {
  const src = code(BLOG)
  const stmts = [...src.matchAll(/UPDATE blog_posts[\s\S]{0,400}/g)].map(m => m[0])
  const hit = stmts.filter(t => /seed_version\s*=/.test(t))
  expect(hit.length, '재시드 UPDATE(seed_version 을 찍는 문장)를 못 찾았다 — 이 시험이 아무것도 안 지킨다').toBe(1)
  return hit[0]
}

describe('🗓️ 블로그 날짜 — 발행일은 한 번만, 수정일은 진짜 수정일', () => {
  it('① 재시드는 published_at 을 다시 쓰지 않는다', () => {
    const u = reseedUpdate()
    expect(u, '재시드가 발행일을 다시 쓴다 — 배포마다 글 21편의 발행일이 앞으로 점프한다')
      .not.toMatch(/published_at\s*=/)
  })

  it('①-2 그래도 updated_at 은 갱신한다 — 그게 진짜 수정 시각이다', () => {
    expect(reseedUpdate()).toMatch(/updated_at\s*=\s*CURRENT_TIMESTAMP/)
  })

  it('①-3 반대 방향 — INSERT 는 발행일을 여전히 설정한다(안 하면 NULL 로 뜬다)', () => {
    const src = code(BLOG)
    const i = src.indexOf('INSERT OR IGNORE INTO blog_posts')
    expect(i).toBeGreaterThan(-1)
    const ins = src.slice(i, i + 400)
    expect(ins, '새 글이 발행일 없이 들어간다 — 목록 정렬(ORDER BY published_at)이 깨진다')
      .toMatch(/published_at/)
    expect(ins, "index 기준 분산(datetime('now', -3i days))이 사라졌다").toMatch(/datetime\('now'/)
  })

  // ② 빌더를 **돌려서** 판정한다 — 문자열 검사로는 두 날짜가 갈렸는지 알 수 없다.
  const post = (extra: Record<string, unknown>) =>
    JSON.stringify({ data: { title: '유어딜이란', summary: '요약', slug: 'what-is-urdeal', ...extra } })
  const dates = (p: string) => {
    const m = buildBlogPostMeta(p, 'https://urdeal.kr')!
    const g = JSON.parse(m.jsonLd)['@graph'] as Array<Record<string, string>>
    const a = g.find(n => n['@type'] === 'BlogPosting')!
    return { pub: a.datePublished, mod: a.dateModified }
  }

  it('② 수정이 발행보다 늦으면 dateModified 가 그 값이다', () => {
    const d = dates(post({ published_at: '2026-07-26 09:51:10', updated_at: '2026-09-24 09:51:07' }))
    expect(d.pub).toBe('2026-07-26T09:51:10.000Z')
    expect(d.mod, 'updated_at 이 안 쓰인다 — "고쳤다" 신호가 영원히 안 생긴다')
      .toBe('2026-09-24T09:51:07.000Z')
    expect(d.mod).not.toBe(d.pub)
  })

  it('②-2 같으면 같다 — 한 번도 안 고친 글', () => {
    const d = dates(post({ published_at: '2026-09-24 09:51:07', updated_at: '2026-09-24 09:51:07' }))
    expect(d.mod).toBe(d.pub)
  })

  it('②-3 수정이 발행보다 **앞서면** 쓰지 않는다 — 모순 신호', () => {
    const d = dates(post({ published_at: '2026-09-24 09:51:07', updated_at: '2026-07-26 09:51:10' }))
    expect(d.mod, '수정이 발행보다 먼저라고 말하고 있다').toBe(d.pub)
  })

  it('②-4 updated_at 이 없어도 안 깨진다 — datePublished 는 그대로', () => {
    const d = dates(post({ published_at: '2026-09-24 09:51:07' }))
    expect(d.pub).toBe('2026-09-24T09:51:07.000Z')
    expect(d.mod).toBe(d.pub)
  })

  it('②-5 날짜가 아예 없으면 두 필드를 안 낸다 — 지어내지 않는다', () => {
    const d = dates(post({}))
    expect(d.pub).toBeUndefined()
    expect(d.mod).toBeUndefined()
  })

  it('③ sitemap 블로그 항목이 lastmod 를 낸다', () => {
    const src = code(SITEMAP)
    const i = src.indexOf('FROM blog_posts')
    expect(i, 'sitemap 의 블로그 절을 못 찾았다').toBeGreaterThan(-1)
    const sel = src.slice(Math.max(0, i - 200), i + 60)
    expect(sel, 'updated_at 을 안 받아 온다 — lastmod 를 낼 재료가 없다').toMatch(/updated_at/)
    const push = src.slice(src.indexOf('`/blog/${b.slug}`') - 40, src.indexOf('`/blog/${b.slug}`') + 220)
    expect(push, 'lastmod 를 안 붙인다 — 본문이 바뀌어도 "다시 읽어라"가 0 이다')
      .toMatch(/lastmod:\s*b\.updated_at/)
  })

  it('③-2 상품 쪽 lastmod 는 그대로 — 359건이 이미 내고 있었다', () => {
    expect(code(SITEMAP)).toMatch(/lastmod:\s*g\.updated_at/)
  })

  // 🚫 이 단언에는 **주입이 없다** — 대상이 주석이라 러너가 거부한다("주입 대상이 주석에만 있다").
  //   그게 러너의 옳은 동작이고(주석만 바꾸는 주입은 행동을 안 바꾼다), ④ 는 행동 가드가 아니라
  //   **근거 정확성** 가드다. 그래서 `read()`(주석 포함 원문)를 본다 — `code()` 로는 아예 안 보인다.
  it('④ 과장된 근거가 되살아나지 않는다 — 카톡은 SVG 를 그린다(우리 실측)', () => {
    // 2026-10-09 audit log: "카드는 떴고 그 안의 외부 <image href> 만 비었다".
    // 그러니 *빈 카드*는 트위터·페북·슬랙 쪽이고, 카톡에서는 **제목 중복**이 문제였다.
    const txt = read('src/features/blog/api/blog-ssr-meta.ts')
    expect(txt, '카카오가 SVG 를 못 읽는다는 과장이 돌아왔다 — 우리 실측과 반대다')
      .not.toMatch(/카카오[^\n]*SVG 를\s*\n?\s*\/\/\s*안 읽는다/)
    expect(txt).toContain('정정')
  })
})
