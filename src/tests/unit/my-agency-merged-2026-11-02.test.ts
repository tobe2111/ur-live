/**
 * 🧩 마이 — '내 가게' 와 '에이전시' 를 한 구역으로 (2026-11-02 대표 확정 · 통합 시안 v2 · 버튼 ①)
 *
 * 대표: *"에이전시 계정이니까 에이전시 계정 안에 저 업체들이 종속되는 형태잖아? 근데 왜 따로 노는 형태인거지?"*
 *   → *"버튼 1 기준으로 해줘"*.
 * 🩸 실측(라이브 D1): 대표 계정은 매장 4곳을 운영자로 맡고 그중 3곳이 에이전시에도 이어져 있었다 —
 *   같은 매장이 '내 가게' 판과 에이전시 '맡은 매장' 판에 두 번 그려졌다('이용권 등록·관리' 도 두 번).
 *
 * 지키는 것:
 *   ① 에이전시가 맡은 매장이 전부 '내 가게' 안에 있으면 에이전시 쪽 매장 판을 그리지 않는다
 *   ② 하나라도 밖에 있으면 그린다(반대 방향 — 그 매장으로 가는 길을 잃지 않게)
 *   ③ 에이전시 이름이 매장 판 **위** 구역 제목이다(내 가게가 있을 때만)
 * ⚠️ 못 보는 것: 화면이 실제로 보기 좋은지(`node scripts/visual-preview.mjs --route=/user/profile --stores=4` +
 *   에이전시 토큰 `--ls` · 스텁 `--stub-file`).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const PANEL = readCode('src/pages/agency-console/AgencyStoresPanel.tsx')
const PAGE = readCode('src/pages/UserProfilePage.tsx')
const TITLE = readCode('src/pages/user-profile/AgencyMergedTitle.tsx')

describe('마이 — 내 가게 + 에이전시 한 구역', () => {
  it('① 맡은 매장이 전부 내 가게 안이면 에이전시 매장 판을 숨긴다', () => {
    expect(PANEL).toMatch(/const coveredByMine = !!ownSellerIds && ownSellerIds\.length > 0 && !error\s*&& \(rows === null \|\| active\.every\(\(r\) => ownSellerIds\.includes\(r\.sellerId\)\)\)/)
    expect(PANEL).toContain("className={coveredByMine ? 'hidden' :")
  })
  it('② 하나라도 밖이면 그린다 — every 를 some 으로 바꾸면 그 매장의 길이 사라진다', () => {
    expect(PANEL, '하나만 겹쳐도 숨긴다').not.toMatch(/active\.some\(\(r\) => ownSellerIds/)
  })
  it('③ 에이전시 이름이 매장 판 위 구역 제목이다 (내 가게가 있을 때만)', () => {
    expect(PAGE).toMatch(/<AgencyMergedTitle storeCount=\{sellerSeats\.stores\.length\} \/>\s*<SellerSection/)
    expect(TITLE).toMatch(/if \(!on \|\| storeCount <= 0\) return null/)
  })
})
