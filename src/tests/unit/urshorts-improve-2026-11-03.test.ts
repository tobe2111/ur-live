/**
 * 🎬 유어쇼츠 개선 — 2026-11-03 대표 *"1,2,7번만 해 … 10번도 해줘"*.
 *  ① 소리 없이 자동 재생 + [소리 켜기] (휴대폰은 소리 있는 자동 재생을 막아 멈춘 채 떴다)
 * ⚠️ 못 보는 것: 실제 기기에서 자동 재생이 되는지(브라우저 정책) — 배포 후 폰으로 확인.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { youTubeEmbedUrl, youTubePlayerVars } from '@/shared/urshorts'

const V = readFileSync('src/pages/VideosPage.tsx', 'utf8')

describe('① 소리 없이 자동 재생', () => {
  it('두 길(재생기·폴백) 모두 음소거로 시작한다', () => {
    expect(youTubePlayerVars({ autoplay: true, muted: true }).mute).toBe('1')
    expect(youTubeEmbedUrl('abc', { autoplay: true, muted: true })).toContain('mute=1')
    expect(youTubePlayerVars({ autoplay: true }).mute, '기본값은 안 건드린다').toBeUndefined()
    expect(V).toContain('youTubePlayerVars({ autoplay: true, controls: false, muted: true })')
    expect(V).toContain('youTubeEmbedUrl(cur.video_id, { autoplay: true, controls: false, muted: true })')
  })
  it('[소리 켜기]가 제스처 층 위에 있고 재생기를 켠다', () => {
    expect(V).toMatch(/data-testid="shorts-sound"\s*\n\s*className="absolute [^"]*z-20/)
    expect(V).toContain('if (muted) { p.unMute(); p.playVideo(); setMuted(false) }')
  })
})

describe('② 관리자 — 이용권 붙이기 쉽게', () => {
  it('제목에서 가게 이름일 법한 앞부분을 뽑는다', async () => {
    const { suggestTerm } = await import('@/pages/AdminUrShortsPage')
    expect(suggestTerm('용산 상록! 맛의 고장 광주에서 #shorts')).toBe('용산 상록')
    expect(suggestTerm('[부산] 해운대 돼지국밥 | 맛집')).toBe('해운대 돼지국밥')
    expect(suggestTerm(null)).toBe('')
  })
  it('미연결만 보기 · 검색칸 미리 채우기가 배선돼 있다', () => {
    const A = readFileSync('src/pages/AdminUrShortsPage.tsx', 'utf8')
    expect(A).toContain('(onlyOrphan ? rows.filter((r) => !r.product_id) : rows).map((r) => (')
    expect(A).toContain('suggest={suggestTerm(r.title)}')
    const P = readFileSync('src/pages/admin-urshorts/ProductPicker.tsx', 'utf8')
    expect(P, '이미 붙은 영상에는 미리 채우지 않는다').toContain('if (!open && !q && !value && suggest) setQ(suggest)')
  })
})

describe('⑦ 링크로 곧장 들어온 사람에게만 홈 버튼', () => {
  it('첫 항목일 때만 그린다', () => {
    expect(V).toContain("const landedDirect = useLocation().key === 'default'")
    expect(V).toMatch(/\{landedDirect && \(\s*<Link to="\/" aria-label="유어딜 홈" data-testid="shorts-home"/)
  })
})

describe('⑩ 넘김이 부드럽게', () => {
  it('덮개는 늘 그려 두고 투명도로 걷는다(뚝 떼면 한 프레임 번쩍인다)', () => {
    expect(V).toMatch(/transition-opacity duration-300 ease-out"\s*\n\s*style=\{\{ opacity: coverId === cur\.video_id \? 1 : 0 \}\}/)
  })
  it('두 칸 뒤 썸네일도 미리 받는다', () => {
    expect(V).toContain('const afterNextThumb = thumbOf(items[idx + 2])')
    expect(V).toContain('<link rel="prefetch" as="image" href={cfImage(afterNextThumb, { width: 480 })} />')
  })
})
