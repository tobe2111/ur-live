/**
 * 🤖 2026-10-27 (대표 "매장주 제공 사진이 있는 매장만 · 그 사진들 중에서도 연관되게"
 *   → "AI로 사진 판정" · "숨기고 자동 교체") — 데모 사진 AI 판정 모드.
 *
 * 불변식:
 *   ① 키가 없으면 판정 모드는 꺼진다 — 사진 수집·버전은 종전 그대로(키 없이 켜면 데모 전멸).
 *   ② 판정 모드 후보는 카카오 **매장주 제공(MYSTORE)** 사진뿐이다.
 *   ③ 판정을 못 했으면(카카오·AI 실패) known=false — 사진을 쓰지도, 데모를 내리지도 않는다.
 *   ④ AI 가 통과시킨 사진만 쓴다. 확정적으로 3장 미만이면 교체 또는 숨김(가역).
 * 이 시험이 못 보는 것: AI 판정의 실제 정확도 · Anthropic 이 카카오 이미지 주소를 실제로 받아 오는지
 *   (라이브 하트비트 swapped·hiddenNoPhoto 와 사진 표본 육안 검사로만 판정).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { demoPhotoJudgeOn, parseJudgeReply, judgeImageUrl, judgeDemoPhotos } from '@/worker/utils/demo-photo-judge'
import { collectJudgedDemoPhotos, fetchDemoPhotos } from '@/worker/utils/demo-photo-set'
import { demoCondV, DEMO_COND_V, DEMO_COND_V_JUDGED } from '@/worker/cron/demo-image-rehost'
import { readCode } from '../helpers/source-text'
import type { Env } from '@/worker/types/env'

const ON = { ANTHROPIC_API_KEY: 'k' } as unknown as Env
const OFF = {} as unknown as Env
const PLACE = 'https://place.map.kakao.com/1276757068'
afterEach(() => vi.unstubAllGlobals())

function mockNet(opts: { mystore?: unknown; judge?: string | null; kakaoFail?: boolean }) {
  const calls: string[] = []
  const bodies: unknown[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push(url)
    if (url.includes('place-api.map.kakao.com')) {
      if (opts.kakaoFail) return new Response('x', { status: 500 })
      return new Response(JSON.stringify(opts.mystore ?? { photos: [] }), { status: 200 })
    }
    if (url.includes('api.anthropic.com')) {
      bodies.push(JSON.parse(String(init?.body || '{}')))
      if (opts.judge == null) return new Response('err', { status: 500 })
      return new Response(JSON.stringify({ content: [{ text: opts.judge }] }), { status: 200 })
    }
    return new Response('', { status: 404 })
  }))
  return { calls, bodies }
}
const photos = (n: number, type = 'MYSTORE') => ({
  counts: { mystore: n },
  photos: Array.from({ length: n }, (_, i) => ({ type, media_type: 'PHOTO', url: `http://t1.daumcdn.net/p/${i}.jpg` })),
})

describe('① 키가 있어야 켜진다', () => {
  it('키 유무로 모드와 버전이 갈린다', () => {
    expect(demoPhotoJudgeOn(OFF)).toBe(false)
    expect(demoPhotoJudgeOn(ON)).toBe(true)
    expect(demoCondV(OFF)).toBe(DEMO_COND_V)
    expect(demoCondV(ON)).toBe(DEMO_COND_V_JUDGED)
    expect(DEMO_COND_V_JUDGED).not.toBe(DEMO_COND_V)
  })
  it('키 없으면 판정을 부르지 않는다(null)', async () => {
    const { calls } = mockNet({ judge: '{"keep":[0]}' })
    expect(await judgeDemoPhotos(OFF, ['https://a/1.jpg'], { storeName: 'x' })).toBeNull()
    expect(calls.some((u) => u.includes('anthropic'))).toBe(false)
  })
})

describe('② 응답 해석', () => {
  it('통과 번호만 true, 범위 밖·비정수는 버린다', () => {
    expect(parseJudgeReply('{"keep":[0,2,9,1.5,-1]}', 3)).toEqual([true, false, true])
    expect(parseJudgeReply('설명\n{"keep":[]}', 2)).toEqual([false, false])
  })
  it('형식이 틀리면 null(모른다)', () => {
    expect(parseJudgeReply('모르겠다', 2)).toBeNull()
    expect(parseJudgeReply('{"keep":"0"}', 2)).toBeNull()
    expect(parseJudgeReply('{bad json}', 2)).toBeNull()
  })
  it('카카오 이미지는 썸네일로 줄여 보낸다', () => {
    expect(judgeImageUrl('https://t1.daumcdn.net/p/a.jpg')).toMatch(/^https:\/\/t1\.kakaocdn\.net\/thumb\/C300x300\/\?fname=/)
    expect(judgeImageUrl('https://ldb-phinf.pstatic.net/a.jpg')).toBe('https://ldb-phinf.pstatic.net/a.jpg')
  })
})

describe('③ 판정 모드 수집', () => {
  it('매장주 사진만 후보로, 통과한 것만 쓴다', async () => {
    const mixed = { counts: { mystore: 3 }, photos: [
      ...photos(4).photos,
      { type: 'BLOG', media_type: 'PHOTO', url: 'http://t1.daumcdn.net/blog/x.jpg' },
    ] }
    const { bodies } = mockNet({ mystore: mixed, judge: '{"keep":[0,1,3]}' })
    const r = await collectJudgedDemoPhotos(ON, { placeId: PLACE, nameQuery: '가게', category: 'meal_voucher', count: 5 })
    expect(r.known).toBe(true)
    expect(r.photos).toEqual(['https://t1.daumcdn.net/p/0.jpg', 'https://t1.daumcdn.net/p/1.jpg', 'https://t1.daumcdn.net/p/3.jpg'])
    const imgs = JSON.stringify(bodies[0])
    expect(imgs).not.toContain('blog')
  })
  it('AI 가 실패하면 모른다 — 사진을 쓰지 않는다', async () => {
    mockNet({ mystore: photos(5), judge: null })
    const r = await collectJudgedDemoPhotos(ON, { placeId: PLACE, nameQuery: '가게', count: 5 })
    expect(r).toEqual({ photos: [], known: false })
    expect(await fetchDemoPhotos(ON, { placeId: PLACE, nameQuery: '가게', count: 5 })).toEqual([])
  })
  it('카카오가 실패하면 모른다', async () => {
    mockNet({ kakaoFail: true, judge: '{"keep":[0]}' })
    expect((await collectJudgedDemoPhotos(ON, { placeId: PLACE, nameQuery: '가게' })).known).toBe(false)
  })
  it('매장주 사진이 3장 미만이면 판정 없이 확정적으로 모자람', async () => {
    const { calls } = mockNet({ mystore: photos(2), judge: '{"keep":[0,1]}' })
    expect(await collectJudgedDemoPhotos(ON, { placeId: PLACE, nameQuery: '가게' })).toEqual({ photos: [], known: true })
    expect(calls.some((u) => u.includes('anthropic'))).toBe(false)
  })
  it('카카오 장소가 없는 데모는 확정적으로 모자람(교체 대상)', async () => {
    expect(await collectJudgedDemoPhotos(ON, { placeId: null, nameQuery: '가게' })).toEqual({ photos: [], known: true })
  })
})

describe('④ 정비 배선', () => {
  const cron = readCode('src/worker/cron/demo-image-rehost.ts')
  it('판정 모드: 모르면 건너뛰고, 확정 3장 미만이면 교체 또는 숨김', () => {
    const blk = cron.slice(cron.indexOf('if (judgeOn && !row.slug'), cron.indexOf('imgs = judged.photos'))
    expect(blk).toMatch(/if \(!judged\.known\) \{[\s\S]*?out\.skipped\+\+[\s\S]*?continue/)
    expect(blk).toMatch(/judged\.photos\.length < DEMO_MIN_PHOTOS/)
    expect(blk).toMatch(/swapDemoStore\(env, row, meta, COND_V\)/)
    expect(blk).toMatch(/SET is_active = 0/)
    expect(blk).toMatch(/demo_hidden_no_photo: '1'/)
  })
  it('정비의 버전은 키 유무로 정한다', () => {
    expect(cron).toMatch(/const COND_V = demoCondV\(env\)/)
    expect(cron).toMatch(/\.bind\(COND_V, Math\.max\(1, perRun\)\)/)
  })
  it('키를 GitHub 에서 Cloudflare 로 옮기는 수동 워크플로가 있다', () => {
    const wf = readCode('.github/workflows/sync-anthropic-secret.yml')
    expect(wf).toMatch(/pages secret put ANTHROPIC_API_KEY --project-name=ur-live/)
    expect(wf).toMatch(/secret put ANTHROPIC_API_KEY --name=ur-live/)
    expect(wf).toMatch(/workflow_dispatch/)
  })
})
