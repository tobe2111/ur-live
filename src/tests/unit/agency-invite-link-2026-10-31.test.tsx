/**
 * 🔗 **매장 영입 링크** — 2026-10-31 대표
 *   *"매장 영입 링크 만들기 이렇게 버튼 필요하지 않을까? 카카오톡으로 보면 예쁘게 보이게끔 하거나. 매장이 있어도 계속 초대가 필요해"*
 *   *"그 링크로 들어와서 가입하면 바로 에이전시와 매장이 연동되게 하면 되잖아."*
 *
 * 지키는 것:
 *   ① 영입 버튼은 맡은 매장 수와 무관하게 판 **위**에 늘 선다(관리자만) — 종전엔 매장이 생기면 줄 맨 끝으로 숨었다
 *   ② 관리자 판정을 응답 전에 캐시된 역할로 그린다 — 버튼이 늦게 끼어들어 아래를 밀지 않게
 *   ③ 영입 시트는 살아 있는 링크가 없으면 열자마자 만들고, [카카오톡으로 보내기] 가 에이전시 이름이 든 카드를 보낸다
 *   ④ 주소를 붙여 넣는 길(카톡 스크래퍼)도 홈 카드가 아니라 초대 카드 + **noindex** 를 받는다
 *   ⑤ 매장이 없는 사장님은 링크에서 바로 등록 화면으로 가고, 등록이 끝나는 순간 그 링크로 맡겨진다
 *
 * ⚠️ 이 시험이 못 보는 것: 카카오가 실제로 그리는 카드(렌더 주체가 카카오다) · 폰 브라우저가 공유창을 막는지 ·
 *   라이브 워커의 HTMLRewriter 배선(유닛 밖 — 배포 후 `curl -A kakaotalk-scrap` 로 판정).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { stripComments } from '../helpers/source-text'
import {
  AGENCY_INVITE_QUERY, agencyInviteCardCopy, agencyInviteSurfaceSeo, isAgencyInviteToken,
} from '@/shared/agency-store-invite'
import { resolveConsumerSurfaceSeo } from '@/shared/seo/consumer-surfaces'
import '@/worker/utils/surface-list-jsonld' // 워커가 동적 표면을 등록하는 자리 — 등록 배선까지 본다

const TOKEN = 'a'.repeat(64)
const code = (p: string) => stripComments(readFileSync(p, 'utf-8'))

const agencyRequest = vi.fn()
const sendKakaoShare = vi.fn()
const shareViaKakao = vi.fn()
vi.mock('@/pages/agency-console/agency-api', () => ({
  agencyRequest: (...a: unknown[]) => agencyRequest(...a),
  readAgencyProfile: () => ({ staff: { role: 'admin' }, agency: { name: '동네매장' } }),
}))
vi.mock('@/lib/kakao-share', async (orig) => {
  const real = await orig<typeof import('@/lib/kakao-share')>()
  return { ...real, sendKakaoShare: (p: unknown) => sendKakaoShare(p), shareViaKakao: (p: unknown) => shareViaKakao(p) }
})
vi.mock('@/lib/kakao-sdk', () => ({ ensureKakaoSdk: () => Promise.resolve() }))

describe('④ 카톡 스크래퍼 길 — 초대 카드 + noindex (종전: 유어딜 홈 카드 · index, follow)', () => {
  it('토큰 모양의 초대 주소에만 답한다', () => {
    expect(agencyInviteSurfaceSeo(`/store/agency/${TOKEN}`)).toMatchObject({ noindex: true })
    expect(agencyInviteSurfaceSeo('/store/agency/abc')).toBeNull()
    expect(agencyInviteSurfaceSeo('/store/new')).toBeNull()
    expect(isAgencyInviteToken(TOKEN)).toBe(true)
    expect(isAgencyInviteToken(`${TOKEN}x`)).toBe(false)
  })
  it('워커 리졸버가 그 주소에 초대 카드와 noindex 를 낸다(등록 배선)', () => {
    const r = resolveConsumerSurfaceSeo(`/store/agency/${TOKEN}`, '', 'https://urdeal.kr')
    expect(r, '등록이 빠지면 null — 홈 카드로 돌아간다').not.toBeNull()
    expect(r!.noindex).toBe(true)
    expect(r!.title).toContain('매장 운영을 맡겠다고 해요')
    expect(r!.canonical).toBe(`https://urdeal.kr/store/agency/${TOKEN}`)
  })
  it('다른 표면에는 noindex 가 새지 않는다', () => {
    expect(resolveConsumerSurfaceSeo('/faq', '', 'https://urdeal.kr')?.noindex).toBeFalsy()
  })
  it('카드 글은 이름이 있으면 넣고, 없으면 이름 없이 같은 말을 한다', () => {
    expect(agencyInviteCardCopy('동네매장').title).toBe('동네매장 에이전시가 매장 운영을 맡겠다고 해요')
    expect(agencyInviteCardCopy(null).title).toBe('에이전시가 매장 운영을 맡겠다고 해요')
    expect(agencyInviteCardCopy(undefined).title).not.toMatch(/undefined|null/)
  })
})

describe('③ 영입 시트 — 열자마자 링크 · 카카오톡 카드', () => {
  beforeEach(() => { agencyRequest.mockReset(); sendKakaoShare.mockReset(); shareViaKakao.mockReset() })
  afterEach(() => cleanup())

  it('살아 있는 링크가 없으면 열자마자 만든다(사람이 누를 버튼은 보내기 하나)', async () => {
    agencyRequest.mockImplementation((path: string, opts?: { method?: string }) => Promise.resolve(
      opts?.method === 'POST'
        ? { ok: true, status: 200, data: { invite: { url: `https://urdeal.kr/store/agency/${TOKEN}`, useCount: 0 } } }
        : { ok: true, status: 200, data: { invite: null } },
    ))
    const { AgencyInviteLinkCard } = await import('@/pages/agency-console/AgencyInviteLinkCard')
    render(<AgencyInviteLinkCard />)
    await screen.findByTestId('agency-invite-kakao')
    expect(agencyRequest.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(1)
  })

  it('살아 있는 링크가 있으면 새로 만들지 않는다(옛 링크를 끊지 않는다)', async () => {
    agencyRequest.mockResolvedValue({ ok: true, status: 200, data: { invite: { url: `https://urdeal.kr/store/agency/${TOKEN}`, useCount: 3 } } })
    const { AgencyInviteLinkCard } = await import('@/pages/agency-console/AgencyInviteLinkCard')
    render(<AgencyInviteLinkCard />)
    await screen.findByText('이 링크로 맡긴 매장 3곳')
    expect(agencyRequest.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(0)
  })

  it('[카카오톡으로 보내기] 가 에이전시 이름 · 링크 · [매장 맡기기] 버튼이 든 카드를 보낸다', async () => {
    agencyRequest.mockResolvedValue({ ok: true, status: 200, data: { invite: { url: `https://urdeal.kr/store/agency/${TOKEN}`, useCount: 0 } } })
    sendKakaoShare.mockReturnValue(true)
    const { AgencyInviteLinkCard } = await import('@/pages/agency-console/AgencyInviteLinkCard')
    render(<AgencyInviteLinkCard />)
    fireEvent.click(await screen.findByTestId('agency-invite-kakao'))
    await waitFor(() => expect(sendKakaoShare).toHaveBeenCalledTimes(1))
    const p = sendKakaoShare.mock.calls[0][0] as { content: { title: string; link: { webUrl: string } }; buttons: Array<{ title: string }> }
    expect(p.content.title).toBe('동네매장 에이전시가 매장 운영을 맡겠다고 해요')
    expect(p.content.link.webUrl).toBe(`https://urdeal.kr/store/agency/${TOKEN}`)
    expect(p.buttons[0].title).toBe('매장 맡기기')
  })
})

describe('①② 마이 에이전시 구역 — 영입 버튼은 늘 판 위에', () => {
  const panel = code('src/pages/agency-console/AgencyStoresPanel.tsx')
  // 🧑‍🤝‍🧑 2026-10-31 대표 *"모두 진행해줘"* — 직원도 영입 링크를 보낸다(만들기·끊기만 관리자). 조건 없이 늘 선다.
  it('버튼이 조건 없이 서고, 맡은 매장 분기(로딩·고른 매장·빈 화면)보다 앞에 있다', () => {
    const entry = panel.indexOf('data-testid="agency-invite-entry"')
    expect(entry, '영입 버튼이 사라졌다').toBeGreaterThan(0)
    expect(panel.slice(Math.max(0, entry - 400), entry)).toMatch(/\{\}\s*<button type="button" onClick=\{\(\) => setSheet\('invite'\)\}\s*$/)
    expect(entry, '빈 화면/고른 매장 분기 안으로 들어가면 매장이 생기는 순간 사라진다').toBeLessThan(panel.indexOf('rows === null ?'))
  })
  it('영입 시트는 영입 링크만 연다(대신 등록은 따로)', () => {
    const inv = panel.slice(panel.indexOf("{sheet === 'invite' && ("), panel.indexOf("{sheet === 'register' && canManage && ("))
    expect(inv).toContain('<AgencyInviteLinkCard canManage={canManage} />')
    expect(inv).not.toContain('AgencyRegisterStoreCard')
  })
  it('관리자 여부를 응답 전에 캐시된 역할로 그린다(버튼이 늦게 끼어들어 아래를 밀지 않게)', () => {
    const model = code('src/pages/agency-console/agency-stores-model.ts')
    expect(model).toMatch(/useState\(\(\) => readAgencyProfile\(\)\?\.staff\.role === 'admin'\)/)
  })
})

describe('⑤ 링크로 들어와 가입하면 바로 연결된다', () => {
  it('매장이 없는 사장님은 링크에서 토큰을 실은 등록 화면으로 간다', () => {
    const page = code('src/pages/StoreAgencyInvitePage.tsx')
    expect(page).toMatch(/`\/store\/new\?\$\{AGENCY_INVITE_QUERY\}=\$\{encodeURIComponent\(token\)\}`/)
    expect(page, '종전 문구 — 링크를 다시 찾게 만든다').not.toContain('이 링크를 다시 열어 주세요')
    expect(AGENCY_INVITE_QUERY).toBe('agency_invite')
  })
  it('등록 화면은 토큰을 검증하고, 등록이 끝나면 같은 맡기기 API 를 부른다(중개 등록은 빠진다)', () => {
    const page = code('src/pages/StoreClaimPage.tsx')
    expect(page).toMatch(/isAgencyInviteToken\(v\) \? v : null/)
    expect(page).toContain("api.post('/api/store-agency-invite/accept', { token: inviteToken, seller_id: sellerId })")
    const handoff = page.indexOf('if (opts?.ownerClaimCode) { setHandoff(opts.ownerClaimCode); return }')
    const entrust = page.indexOf('await entrustToInviter(sellerId)')
    expect(handoff).toBeGreaterThan(0)
    expect(entrust, '중개 등록(주인 아님)보다 먼저 맡기면 NOT_OWNER 로 실패한다').toBeGreaterThan(handoff)
    // 🎯 2026-10-31 재조준: 착륙 줄이 `takePartnerReturn() ?? MY_PATH` 가 됐다(제휴 위젯 되돌아오기) — 순서 불변식 그대로.
    const land = page.indexOf('navigate(takePartnerReturn() ?? MY_PATH, { replace: true })', handoff)
    expect(land).toBeGreaterThan(0)
    expect(entrust).toBeLessThan(land)
  })
})
