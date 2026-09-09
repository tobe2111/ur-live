/**
 * 🎬 유어쇼츠 여러 개 한 번에 추가 (2026-09-09 대표 *"자동으로 계속 여러개 영상 업로드"*)
 *
 * 그전까지 어드민은 **주소 하나씩**만 받았다. 서른 개를 넣으려면 서른 번 붙여 넣고 서른 번 눌러야 했다.
 *
 * ## 이 파일이 지키는 것
 * ① 파싱은 SSOT(`shared/urshorts`) 한 곳 — 화면이 세는 개수와 서버로 가는 개수가 같아야 한다.
 * ② **순차 전송** — 병렬로 던지면 유튜브 쿼터를 순간에 태우고 어느 것이 실패했는지 뒤섞인다.
 * ③ **하나 실패해도 안 멈춘다** — 스물아홉이 멀쩡한데 하나 때문에 전부 버리면 안 된다.
 *
 * ## 못 막는 것
 * - 유튜브가 실제로 그 영상을 쇼츠로 인정하는지(길이) — 서버가 판정한다.
 * - 진행 표시가 사람 눈에 충분히 빠른지 — 그건 실제로 넣어 봐야 안다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseYouTubeUrlList, URSHORTS_BULK_MAX } from '@/shared/urshorts'

const PAGE = readFileSync('src/pages/AdminUrShortsPage.tsx', 'utf8')
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① 여러 줄 파서', () => {
  it('줄바꿈·쉼표·공백 아무거나로 나눈다 (사람이 어디서 복사할지 우리가 못 정한다)', () => {
    const r = parseYouTubeUrlList(
      'https://www.youtube.com/shorts/aaaaaaaaaaa\n https://youtu.be/bbbbbbbbbbb , https://www.youtube.com/watch?v=ccccccccccc'
    )
    expect(r.ok.map(x => x.id)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'])
    expect(r.bad).toEqual([])
  })
  it('주소 모양을 그대로 보존한다 (shorts 는 그 자체로 증명이라 서버 조회가 다르다)', () => {
    const r = parseYouTubeUrlList('https://www.youtube.com/shorts/aaaaaaaaaaa\nhttps://youtu.be/bbbbbbbbbbb')
    expect(r.ok[0].form).toBe('shorts')
    expect(r.ok[1].form).toBe('watch')
  })
  it('같은 영상은 먼저 나온 것만 남긴다 — 화면 개수가 실제 추가 개수와 같아야 한다', () => {
    const r = parseYouTubeUrlList('https://youtu.be/aaaaaaaaaaa\nhttps://www.youtube.com/shorts/aaaaaaaaaaa')
    expect(r.ok).toHaveLength(1)
    expect(r.dupes).toHaveLength(1)
  })
  it('못 읽은 줄은 원문 그대로 돌려준다 — 사람이 어느 줄인지 찾아야 한다', () => {
    const r = parseYouTubeUrlList('https://youtu.be/aaaaaaaaaaa\nhttps://vimeo.com/12345')
    expect(r.ok).toHaveLength(1)
    expect(r.bad).toEqual(['https://vimeo.com/12345'])
  })
  it('빈 입력에도 안 터진다', () => {
    for (const v of ['', '   \n\n ', null, undefined]) {
      const r = parseYouTubeUrlList(v)
      expect(r.ok).toEqual([]); expect(r.bad).toEqual([])
    }
  })
  it('한 개짜리는 종전과 같은 결과다(회귀 방지)', () => {
    const r = parseYouTubeUrlList('https://www.youtube.com/shorts/aaaaaaaaaaa')
    expect(r.ok).toHaveLength(1)
    expect(r.ok[0].id).toBe('aaaaaaaaaaa')
  })
  it('상한이 있고 0 이 아니다 (0 이면 아무것도 못 넣는다)', () => {
    expect(URSHORTS_BULK_MAX).toBeGreaterThanOrEqual(10)
  })
})

describe('② 어드민 화면 배선', () => {
  const s = code(PAGE)
  it('입력이 여러 줄을 받는다 (input 이면 붙여 넣어도 한 줄로 뭉친다)', () => {
    expect(s).toContain('<textarea')
    expect(s, '한 줄 input 이 남아 있으면 어느 쪽이 진짜인지 모른다').not.toMatch(/<input\s+value=\{url\}/)
  })
  it('화면이 세는 개수와 보내는 개수가 같은 SSOT 에서 나온다', () => {
    expect(s).toContain('parseYouTubeUrlList')
    expect(s, '화면이 자기만의 split 을 만들면 개수가 갈린다').not.toMatch(/url\.split\(/)
  })
  it('🔴 순차 전송이다 — Promise.all 로 던지지 않는다', () => {
    expect(s).not.toMatch(/Promise\.all[\s\S]{0,120}urshorts/)
    expect(s, 'for 루프 안에서 하나씩 await 해야 한다').toMatch(/for \(const \[i, it\] of items\.entries\(\)\)/)
  })
  it('🔴 하나 실패해도 멈추지 않는다 (루프 안에서 잡는다)', () => {
    const at = s.indexOf('for (const [i, it] of items.entries())')
    const body = s.slice(at, s.indexOf('setProgress(null)', at))
    expect(body, '루프 안에 try/catch 가 없으면 첫 실패에서 나머지가 통째로 날아간다').toContain('catch')
  })
  it('상한을 넘겨 보내지 않는다', () => {
    expect(s).toMatch(/slice\(0, URSHORTS_BULK_MAX\)/)
  })
  it('실패한 줄은 입력칸에 남는다 — 지우면 사람이 다시 다 붙여 넣어야 한다', () => {
    expect(s).toMatch(/setUrl\(failed\.length \?/)
  })
  it('진행이 보인다 (서른 개면 수십 초 — 안 보이면 멈춘 줄 안다)', () => {
    expect(s).toContain('setProgress')
    expect(s).toMatch(/progress\.done\}\/\$\{progress\.total\}/)
  })
})
