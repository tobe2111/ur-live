/**
 * ✍️ 2026-08-01 (대표: "앤트로픽 없이도 초안 최대한 자연스럽게 생성되게끔 해줘")
 *
 * LLM 경로는 프롬프트로 "AI 티 내지 마라"고 **부탁**할 수밖에 없다(그래서 어길 수 있다).
 * 조합형 작성기는 문장이 데이터라서 **전수 검사**가 가능하다 — 그게 이 테스트의 요점이다.
 * 주제 12개 × 플랫폼 3개 × 회차 6번 = 216개 조합을 전부 만들어 규칙을 검사한다.
 *
 * ⚠️ 못 막는 것: "자연스럽다"의 최종 판단은 사람 몫이다. 여기서 보는 건 `HUMAN_VOICE_RULES` 중
 *    **기계로 판정 가능한 항목**(이모지/느낌표/상투어/최상급)과 금지어·형식뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { composeSocialDraft } from '@/features/social-media/api/social-compose'
import { PROMO_TOPICS, SOCIAL_PLATFORMS, findForbidden } from '@/features/social-media/api/social-brief'

const NONCES = [0, 1, 2, 3, 7, 12]

function everyDraft() {
  const out: Array<{ platform: string; slug: string; nonce: number; title: string; body: string; hashtags: string[] }> = []
  for (const platform of SOCIAL_PLATFORMS) {
    for (const topic of PROMO_TOPICS) {
      for (const nonce of NONCES) {
        const r = composeSocialDraft(platform, topic, nonce)
        if (!r.ok) throw new Error(`생성 실패: ${platform}/${topic.slug}/${nonce} — ${r.error}`)
        out.push({ platform, slug: topic.slug, nonce, ...r.draft })
      }
    }
  }
  return out
}

const ALL = everyDraft()

describe('AI 없이 만든 소셜 초안 — 전수 검사', () => {
  it('조합이 실제로 만들어진다 (0건이면 통과가 아니라 실패)', () => {
    expect(ALL.length).toBe(SOCIAL_PLATFORMS.length * PROMO_TOPICS.length * NONCES.length)
    expect(ALL.length).toBeGreaterThan(200)
  })

  it('금지어(운영·내부 정보 / 폐기 용어 / 도매)를 포함하지 않는다', () => {
    for (const d of ALL) {
      const bad = findForbidden(`${d.title}\n${d.body}\n${d.hashtags.join(' ')}`)
      expect(bad, `${d.platform}/${d.slug}/${d.nonce} 에 금지어 ${bad}`).toBeNull()
    }
  })

  // HUMAN_VOICE_RULES 중 기계 판정 가능한 것들.
  it('이모지를 쓰지 않는다', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u
    for (const d of ALL) expect(emoji.test(`${d.title}${d.body}`), `${d.platform}/${d.slug}`).toBe(false)
  })

  it('느낌표를 도배하지 않는다 (아예 쓰지 않는다)', () => {
    for (const d of ALL) expect(`${d.title}${d.body}`.includes('!'), `${d.platform}/${d.slug}`).toBe(false)
  })

  it('상투어·과장 표현을 쓰지 않는다', () => {
    const banned = ['여러분', '지금 바로', '놓치지 마세요', '바쁜 일상 속에서', '요즘 같은 시대에', '최고', '완벽', '최적의', '1위']
    for (const d of ALL) {
      const hay = `${d.title}\n${d.body}`
      for (const w of banned) expect(hay.includes(w), `${d.platform}/${d.slug} 에 "${w}"`).toBe(false)
    }
  })

  it('문장 길이를 섞는다 (전부 비슷한 길이면 기계가 쓴 티가 난다)', () => {
    for (const d of ALL) {
      const lens = d.body.split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => s.length)
      expect(lens.length, `${d.platform}/${d.slug} 본문 조각 부족`).toBeGreaterThanOrEqual(3)
      expect(Math.max(...lens) - Math.min(...lens), `${d.platform}/${d.slug} 길이 편차 없음`).toBeGreaterThan(8)
    }
  })

  it('주제마다 본문이 실제로 다르다 (앵글이 안 녹으면 전부 같은 글이 된다)', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const bodies = ALL.filter(d => d.platform === platform && d.nonce === 0).map(d => d.body)
      expect(new Set(bodies).size, `${platform}: 주제별 본문이 겹친다`).toBe(bodies.length)
    }
  })

  it('같은 주제라도 회차가 바뀌면 글이 바뀐다 (재생성이 복사가 되면 안 된다)', () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const bodies = NONCES.map(n => {
        const r = composeSocialDraft(platform, PROMO_TOPICS[0], n)
        return r.ok ? r.draft.body : ''
      })
      expect(new Set(bodies).size, `${platform}: 회차를 바꿔도 같은 글`).toBeGreaterThan(1)
    }
  })

  it('같은 입력이면 항상 같은 결과다 (결정론 — 재시도해도 요동치지 않는다)', () => {
    const a = composeSocialDraft('threads', PROMO_TOPICS[3], 5)
    const b = composeSocialDraft('threads', PROMO_TOPICS[3], 5)
    expect(a.ok && b.ok && a.draft.body).toBe(b.ok ? b.draft.body : null)
  })

  it('플랫폼별 형식을 지킨다 (길이·해시태그 수·유튜브 제목 필수)', () => {
    for (const d of ALL) {
      expect(d.hashtags.length, `${d.platform} 해시태그 없음`).toBeGreaterThan(0)
      expect(new Set(d.hashtags).size, `${d.platform}/${d.slug} 해시태그 중복`).toBe(d.hashtags.length)
      for (const t of d.hashtags) expect(t.startsWith('#'), '해시태그는 # 없이 단어만').toBe(false)
      if (d.platform === 'threads') expect(d.body.length, 'threads 500자').toBeLessThanOrEqual(500)
      if (d.platform === 'instagram') {
        expect(d.body.length, 'instagram 300자').toBeLessThanOrEqual(300)
        expect(d.hashtags.length).toBeGreaterThanOrEqual(12)
      }
      if (d.platform === 'youtube') {
        expect(d.title.length, 'youtube 제목 필수').toBeGreaterThan(0)
        expect(d.title.length, 'youtube 제목 60자').toBeLessThanOrEqual(60)
      }
    }
  })

  it('키가 없어도 초안 생성 경로가 열려 있다 (라우트에서 ANTHROPIC 게이트 제거)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/features/social-media/api/social-media.routes.ts', 'utf8')
    const gen = src.slice(src.indexOf("socialMediaRoutes.post('/posts/generate'"))
    const head = gen.slice(0, 400)
    expect(head.includes('ANTHROPIC_API_KEY'), '초안 생성 라우트에 키 게이트가 남아 있다').toBe(false)
  })
})
