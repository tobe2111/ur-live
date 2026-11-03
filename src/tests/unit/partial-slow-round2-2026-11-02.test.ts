/**
 * 🐢 2026-11-02 대표 *"부분적으로 느린 경우들이 많아서 유저들이 헷갈려해"* → *"모두 순서대로 해줘"* — 2차.
 *
 * ① 마이 '내 가게' — `listOperableStores` 의 소유·위임 두 읽기를 나란히(직렬 2왕복 → 1).
 * ② 마이 '내 이용권' — `/api/vouchers/my` 가 **매 요청** 색인 DDL 로 원본 DB 를 한 번 더 다녀왔다 → isolate 당 1회.
 *    (로딩 잠금 파일 · 대표 *"허가 — 고쳐줘"* · `docs/locks/loading/2026-11-02-vouchers-my-ddl-memo.md`)
 * ③ 유어쇼츠 — 홈 레일 카드가 `window.location.href` 로 **앱 전체를 다시 불러왔다** → 앱 안 이동 +
 *    누르는 사이에 뷰어 코드·유튜브 재생기 미리 받기(`warmShortsViewer`).
 * (홈 맨 위 사진은 `home-region-hero-row-2026-10-31.test.tsx` 가 고정한다.)
 * ⚠️ 못 보는 것: 실제 왕복 시간 · 유튜브 스크립트 실제 도착 시각(라이브에서 잰다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => readFileSync(p, 'utf8')

describe('마이 — 내 가게·내 이용권', () => {
  it('listOperableStores 는 소유·위임을 한 물결로', () => {
    const s = read('src/worker/utils/seller-operators.ts')
    const fn = s.slice(s.indexOf('export async function listOperableStores'), s.indexOf('const out = new Map', s.indexOf('export async function listOperableStores')))
    expect(fn).toMatch(/const \[owned, granted\] = await Promise\.all\(\[/)
    expect((fn.match(/\bawait\b/g) || []).length).toBe(2) // ensureSellerOperators + 그 한 물결
  })
  it('/api/vouchers/my 의 색인 DDL 은 isolate 당 한 번', () => {
    const s = read('src/features/group-buy/api/group-buy-public.routes.ts')
    expect(s).toMatch(/const _voucherIdxDone = new WeakSet<object>\(\)/)
    expect(s).toMatch(/if \(!_voucherIdxDone\.has\(dbKey\(DB\)\)\) \{ _voucherIdxDone\.add\(dbKey\(DB\)\); try \{ await c\.env\.DB\.prepare\(`CREATE INDEX IF NOT EXISTS idx_vouchers_user_created/) // 👤 2026-11-03 사본 세션 → 메모 키는 원본, DDL 은 원본으로
    // 메모 없는 맨 DDL 이 다시 생기면 빨간불
    expect(s.match(/CREATE INDEX IF NOT EXISTS idx_vouchers_user_created/g)?.length).toBe(1)
  })
})

describe('유어쇼츠 — 앱 안 이동 + 미리 받기', () => {
  it('홈 레일 카드는 앱 전체를 다시 불러오지 않는다', () => {
    const s = read('src/components/home/UrShortsRail.tsx')
    expect(s).not.toMatch(/window\.location\.href\s*=\s*`\$\{URSHORTS_VIEWER_PATH\}/)
    expect(s).toMatch(/onOpen=\{\(\) => navigate\(`\$\{URSHORTS_VIEWER_PATH\}\?v=\$\{it\.video_id\}`\)\}/)
    expect(s).toMatch(/onPointerDown=\{warmShortsViewer\}/)
  })
  it('목록 카드도 누르는 사이에 데운다', () => {
    expect(read('src/pages/urshorts/BrowseCard.tsx')).toMatch(/onPointerDown=\{warmShortsViewer\}/)
  })
  it('데우기는 등록부 이름으로만(홈 묶음이 재생 화면 모듈을 직접 가리키지 않는다) + 화면 모듈이 유튜브를 스스로 출발', () => {
    // 주석은 빼고 코드만 본다(머리말이 그 함정을 설명하느라 같은 글자를 쓴다).
    const s = stripComments(read('src/pages/videos/warm-viewer.ts'))
    expect(s).toMatch(/preloadRoute\('videos'\)/)
    expect(s).not.toMatch(/import\(['"][^'"]*VideosPage/)
    expect(s).not.toMatch(/import\(['"][^'"]*youtube-player/)
    expect(read('src/App.tsx')).toMatch(/const VideosPage = lazyPage\(\(\) => import\('\.\/pages\/VideosPage'\)\); registerRoutePreload\('videos', VideosPage\.load\)/)
    expect(read('src/pages/VideosPage.tsx')).toMatch(/^if \(typeof window !== 'undefined'\) void loadYouTubePlayerApi\(\)$/m)
  })
})

describe('지도 — 홈에서 들어갈 때', () => {
  it('홈이 지도를 데울 때 첫 목록(시드와 같은 요청)도 미리 받는다', () => {
    const w = read('src/pages/mobile-home/map-warmup.ts')
    // 🩸 2026-11-03 — 누르는 순간(`preconnectMapTiles`)에만. 홈 load 뒤에 받으면 CI dup 이 같은 경로 두 번으로 잡는다.
    const press = w.slice(w.indexOf('export function preconnectMapTiles'))
    expect(press).toMatch(/void loadRoute\('map'\)\.then\(\(m\) => \(m as \{ prefetchMapSeedFirstPage\?: \(\) => Promise<void> \} \| undefined\)\?\.prefetchMapSeedFirstPage\?\.\(\)\)/)
    const idle = w.slice(w.indexOf('export function warmKakaoMapsAfterLoad'), w.indexOf('export function preconnectMapTiles'))
    expect(stripComments(idle)).not.toMatch(/prefetchMapSeedFirstPage/)
    // 홈이 지도 모듈을 직접 가리키면 묶음기가 봉투를 다시 짠다(전 화면 첫 화면 무게 ↑) — 코드에 그 import 가 없어야 한다
    const code = stripComments(w)
    expect(code).not.toMatch(/useMapProducts|map-feed-seed/)
    expect(read('src/pages/RestaurantMapPage.tsx')).toMatch(/export \{ prefetchMapSeedFirstPage \} from '@\/hooks\/queries\/useMapProducts'/)
    const h = read('src/hooks/queries/useMapProducts.ts')
    expect(h).toMatch(/export function prefetchMapFeedFirstPage\(category: string, near: Near, sort: string\)/)
    expect(h).toMatch(/const k = keyOf\(category, near, sort\)/) // 화면 훅과 같은 키라야 적중한다
  })
})

