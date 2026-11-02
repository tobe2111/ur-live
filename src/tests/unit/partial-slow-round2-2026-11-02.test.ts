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
    expect(s).toMatch(/if \(!_voucherIdxDone\.has\(DB\)\) \{ _voucherIdxDone\.add\(DB\); try \{ await DB\.prepare\(`CREATE INDEX IF NOT EXISTS idx_vouchers_user_created/)
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
  it('데우기는 뷰어 청크 + 유튜브 API 둘 다, 동적으로만(홈 묶음에 안 끌려온다)', () => {
    const s = read('src/pages/videos/warm-viewer.ts')
    expect(s).toMatch(/import\('\.\.\/VideosPage'\)/)
    expect(s).toMatch(/import\('\.\/youtube-player'\)\.then\(\(m\) => m\.loadYouTubePlayerApi\(\)\)/)
    expect(s).not.toMatch(/^import /m)
  })
})
