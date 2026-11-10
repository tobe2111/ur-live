/**
 * 🌐 푸시 전 안내 검사가 프록시 너머의 GitHub 를 읽는다 (2026-11-10) · 근거: scripts/github-api.mjs 머리말
 * (Node fetch 는 HTTPS_PROXY 를 안 봐서 클라우드에선 403 → 두 경고가 11/3 부터 조용히 안 돌았다)
 * ⚠️ 못 보는 것: 실제 프록시·네트워크 — curl 을 부르는 모양과 실패를 말하는지까지만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getGithubJson, proxyFor } from '../../../scripts/github-api.mjs'

const URL_ = 'https://api.github.com/repos/o/r/pulls'
const noFetch = async () => { throw new Error('fetch 를 부르면 안 된다(프록시 환경)') }

describe('GitHub 읽기', () => {
  it('프록시가 있으면 curl 로 읽는다 — Node fetch 는 프록시를 안 본다', async () => {
    const calls: Array<{ cmd: string; args: string[] }> = []
    const run = (cmd: string, args: string[]) => { calls.push({ cmd, args }); return '[{"number":1}]\n200' }
    const out = await getGithubJson(URL_, { env: { HTTPS_PROXY: 'http://127.0.0.1:1' }, run, fetchImpl: noFetch })
    expect(out).toEqual([{ number: 1 }])
    expect(calls[0].cmd).toBe('curl')
    expect(calls[0].args).toContain(URL_)
    expect(proxyFor({ https_proxy: 'x' })).toBe('x')
  })
  it('2xx 가 아니면 이유를 담아 던진다 — 조용히 빈 값으로 통과하지 않는다', async () => {
    const run = () => '{"message":"Forbidden"}\n403'
    await expect(getGithubJson(URL_, { env: { HTTPS_PROXY: 'p' }, run, fetchImpl: noFetch })).rejects.toThrow('HTTP 403')
    const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({}) })
    await expect(getGithubJson(URL_, { env: {}, fetchImpl })).rejects.toThrow('HTTP 403')
  })
  it('프록시가 없으면(대표 PC) 종전처럼 fetch', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ ok: 1 }) })
    const run = () => { throw new Error('curl 을 부르면 안 된다') }
    expect(await getGithubJson(URL_, { env: {}, run, fetchImpl })).toEqual({ ok: 1 })
  })
})

describe('두 경고가 이 길을 쓰고, 못 읽으면 말한다', () => {
  for (const f of ['scripts/check-verify-in-flight.mjs', 'scripts/check-pr-collision.mjs']) {
    it(f, () => {
      const s = readFileSync(f, 'utf8')
      expect(s).toContain("from './github-api.mjs'")
      expect(s).not.toMatch(/await fetch\(/)
      expect(s).toMatch(/console\.log\(`⚠️ [^`]*GitHub 를 못 읽어 건너뛴다/)
    })
  }
})
