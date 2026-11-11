/**
 * 🎬 `/videos?v=…` 첫 화면 = 표지 한 장 (2026-11-11)
 *
 * 공유 링크로 들어오면 앱·목록·재생기가 다 올 때까지 검은 화면이었다. 표지 주소는 영상 번호만으로 정해지므로
 * 서버가 바로 그리고, 앱은 같은 사진을 재생이 시작될 때까지 잇는다.
 * 지키는 것:
 *   ① 주소의 `v` 는 11자 영상 번호 모양일 때만 받는다(주소 글자를 HTML 에 그대로 넣지 않는다)
 *   ② 서버 그림 · Link 헤더 · 앱의 로딩 화면이 **같은 함수**로 표지 주소를 만든다
 *   ③ 워커 배선 — 폰 + 유효한 `v` 일 때만 첫 화면과 표지 preload
 *   ④ 앱은 로딩 중 로더 대신 표지를, 그 뒤엔 덮개를 재생 시작까지(첫 영상은 더 길게) 잇는다
 * 못 보는 것: 실제 첫 그림 시각(배포 뒤 `measure-live-vitals "/videos?v=…"`) · 데이터 절약 모드 손님의 주소 일치(품질 값이 갈린다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { videosStartIdOf, videosCoverSrc, VIDEOS_FS_STYLE, VIDEOS_FS_CLS, VIDEOS_COVER_WIDTH } from '@/shared/videos-first'
import { buildVideosFirstScreen } from '../../worker/utils/videos-first-screen'
import { COVER_MAX_MS, INITIAL_COVER_MAX_MS } from '@/pages/videos/useSlideTransition'

const WORKER = readFileSync('src/worker/index.ts', 'utf8')
const PAGE = readFileSync('src/pages/VideosPage.tsx', 'utf8')
const HOOK = readFileSync('src/pages/videos/useSlideTransition.ts', 'utf8')
const ID = 'L8rhfbzQuBM'

describe('/videos?v= 첫 화면 표지', () => {
  it('① v 는 영상 번호 모양일 때만', () => {
    expect(videosStartIdOf(`?v=${ID}`)).toBe(ID)
    expect(videosStartIdOf('')).toBeNull()
    expect(videosStartIdOf('?v=short')).toBeNull()
    expect(videosStartIdOf('?v="><script>x</script>')).toBeNull()
    expect(videosStartIdOf(`?v=${ID}x`)).toBeNull()
  })
  it('② 서버 그림이 같은 주소의 표지를 그린다 · 첫 화면 노드 id', () => {
    const html = buildVideosFirstScreen(ID)
    expect(html).toContain('id="ur-first-screen"')
    expect(html).toContain(`src="${videosCoverSrc(ID).replace(/&/g, '&amp;')}"`)
    expect(html).toContain(VIDEOS_FS_STYLE.page)
    expect(html).toContain('fetchpriority="high"')
    expect(videosCoverSrc(ID)).toContain(`/vi/${ID}/hqdefault.jpg`)
  })
  it('② 서버 스타일과 화면 클래스가 같은 모양(검은 바탕 · 꽉 채운 표지)', () => {
    expect(VIDEOS_FS_STYLE.page).toContain('#0A0C12'); expect(VIDEOS_FS_CLS.page).toContain('bg-[#0A0C12]')
    expect(VIDEOS_FS_STYLE.page).toContain('min-height:100dvh'); expect(VIDEOS_FS_CLS.page).toContain('min-h-[100dvh]')
    expect(VIDEOS_FS_STYLE.cover).toContain('object-fit:cover'); expect(VIDEOS_FS_CLS.cover).toContain('object-cover')
    expect(VIDEOS_COVER_WIDTH).toBe(480) // 뷰어 덮개(`shorts-cover`)의 폭과 같다
    expect(PAGE).toContain("src={cfImage(thumb, { width: 480 })} alt=\"\" aria-hidden=\"true\"\n          className=\"pointer-events-none absolute inset-0")
  })
  it('③ 워커 — 폰 + 유효한 v 일 때만 첫 화면, 표지는 Link 로 미리', () => {
    expect(WORKER).toContain("url.pathname === '/videos' && videosStartIdOf(url.search) && shouldRenderMobileFirstScreen(c.req.header('user-agent'))")
    expect(WORKER).toContain('buildVideosFirstScreen(videosStartIdOf(url.search) as string)')
    expect(WORKER).toContain("if (vCover && isMobileUserAgent(c.req.header('user-agent'))) appendLcpLink(c.res.headers, videosCoverSrc(vCover))")
  })
  it('④ 앱 — 로딩 중엔 로더가 아니라 표지, 덮개는 그 영상으로 시작한다', () => {
    expect(PAGE).toContain('const [startCoverId] = useState(() => videosStartIdOf(window.location.search))')
    expect(PAGE).toMatch(/if \(startCoverId\) return <div className=\{VIDEOS_FS_CLS\.page\}[^\n]*videosCoverSrc\(startCoverId\)/)
    expect(PAGE).toContain('initialCoverId: startCoverId,')
    expect(HOOK).toContain('useState<string | null>(opts.initialCoverId ?? null)')
  })
  it('④ 첫 영상의 덮개는 넘김 때보다 오래 둔다(재생기가 처음 켜지는 시간)', () => {
    expect(INITIAL_COVER_MAX_MS).toBeGreaterThan(COVER_MAX_MS)
    expect(HOOK).toContain('moved.current ? COVER_MAX_MS : INITIAL_COVER_MAX_MS')
  })
})
