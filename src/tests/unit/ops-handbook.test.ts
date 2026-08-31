/**
 * 📖 운영백서가 **스스로 최신을 유지하는가** (2026-08-31 대표 지시 — "구현하는대로 업데이트가 되어야 해")
 *
 * ## 막으려는 사고 (실제로 났다)
 *
 * 셀러 가이드가 라이브에서 *"에이전시 매출의 2%(영구) + 2단계 1% + 3단계 0.5% + 가입보너스 3만원"*
 * 이라고 말하고 있었다. 코드 기본값은 1%, 기간은 1년, 그리고 2026-08-31 에 폐지됐다.
 * **매장 사장님이 읽으면 자기 매출의 3.5%가 영구히 나간다고 믿는다.**
 *
 * 결정적으로 **2026-08-26 에 "폐기 기능 현행화" 작업이 한 번 있었는데도 살아남았다.**
 * ⇒ 사람이 훑는 방식은 실패한다. 숫자는 코드에서 뽑고, 이 테스트가 그 배선을 고정한다.
 *
 * ## 이 테스트가 못 막는 것
 * - 라이브 `platform_settings` 값이 코드 기본값과 다른 것. 그건 **정상**이고(어드민이 우선),
 *   문서도 그렇게 말한다. 배포 산출물은 라이브 DB 를 모른다.
 * - 산문이 낡는 것. 산문은 사람의 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf-8')

const wf = read('.github/workflows/verify.yml')
const auto = read('src/features/guides/api/ops-handbook-auto.ts')
const adminSeed = read('src/features/guides/api/guide-seed-admin.ts')
// 🧱 2026-08-31: 파일 크기 래칫 때문에 섹션 본문을 폴더로 뺐다 — 내용은 여기, 배선은 시드에서 본다.
const handbookSection = read('src/features/guides/api/guide-seed-admin/ops-handbook-section.ts')
const sellerSeed = read('src/features/guides/api/guide-seed-seller.ts')
const policy = read('src/shared/constants/policy.ts')

describe('운영백서 — 자동 갱신 배선', () => {
  it('CI 가 생성기를 --check 로 돌린다 (유일한 보장)', () => {
    // 🔑 pre-commit 훅은 보장이 못 된다 — 원격 세션은 컨테이너가 새로 떠서 훅이 없다(CLAUDE.md 실사고).
    expect(wf, 'CI 에 등록되지 않으면 다른 세션의 변경이 문서에 안 닿는다')
      .toContain('scripts/generate-ops-handbook.mjs --check')
  })

  it('어드민 가이드가 자동 생성분을 실제로 싣는다', () => {
    // 생성만 하고 안 실으면 아무 데도 안 보인다 — 이 레포가 반복해 당한 "만들고 안 부르기".
    expect(handbookSection).toContain("from '../ops-handbook-auto'")
    expect(handbookSection, '자동 생성분을 안 끼워 넣으면 표가 아무 데도 안 보인다')
      .toMatch(/\$\{OPS_HANDBOOK_AUTO\}/)
    // 분리한 섹션이 시드 배열에 실제로 들어가는지 — 빠지면 파일만 남고 화면엔 없다.
    expect(adminSeed).toContain('OPS_HANDBOOK_SECTION')
  })

  it('생성된 표가 코드 상수와 실제로 같다', () => {
    const pct = policy.match(/INFLUENCER_STORE_INTRO_PCT:\s*([\d.]+)/)?.[1]
    const months = policy.match(/INFLUENCER_STORE_INTRO_MONTHS:\s*(\d+)/)?.[1]
    expect(pct, 'policy.ts 에서 영입 요율을 못 읽었다 — 이 검사가 낡았다').toBeTruthy()
    expect(auto).toMatch(new RegExp(`INFLUENCER_STORE_INTRO_PCT[^\n]*\\*\\*${pct}\\*\\*`))
    expect(auto).toMatch(new RegExp(`INFLUENCER_STORE_INTRO_MONTHS[^\n]*\\*\\*${months}\\*\\*`))
  })

  it('표가 어드민 우선임을 말한다 (코드 상수만 보고 오판하지 않게)', () => {
    // policy.ts 주석이 직접 경고한다: "이 상수만 바꿔선 안 바뀐다".
    expect(auto).toContain('platform_settings')
    expect(auto).toMatch(/코드 기본값/)
  })
})

describe('셀러 가이드 — 틀린 돈 얘기가 되살아나지 않는다', () => {
  it('에이전시 3단 커미션·영구·가입보너스가 없다', () => {
    // 옛 표 그대로의 문구를 앵커로 — 넓게 훑으면 무관한 줄에 걸린다(첫 판이 실제로 그랬다).
    expect(sellerSeed).not.toContain('매출의 **2%** (영구)')
    expect(sellerSeed).not.toContain('tier1/2/3_commission_rate')
    // ⚠️ ₩30,000 자체는 **정정 안내가 인용**하고 있어 존재한다 — 존재 여부로 판정하면 헛돈다.
    //    대신 정정 안내가 살아 있는지를 본다(그게 지워지면 인용도 같이 사라진다).
    expect(sellerSeed, '정정 안내가 사라졌다 — 옛 문구가 되살아날 자리가 생긴다')
      .toContain('전부 사실이 아니었습니다')
  })

  it('영입 규칙을 지금 사실대로 말한다', () => {
    const i = sellerSeed.indexOf("key: 'introduction-commission'")
    expect(i, '영입 섹션이 사라졌다 — 이 검사가 낡았다').toBeGreaterThan(-1)
    const block = sellerSeed.slice(i, i + 2200)
    expect(block).toMatch(/1년/)
    expect(block).toMatch(/직접 입점/)
    expect(block, '매장이 2%를 부담한다고 오해하게 두면 안 된다').toMatch(/매장이 부담하지 않습니다|사장님 정산액은/)
  })

  it('종료된 라이브 기능의 사용법이 없다', () => {
    // 없는 기능의 OBS 설정법이 남아 있으면 읽는 사람만 혼란스럽다.
    expect(sellerSeed).not.toContain('OBS Studio')
    expect(sellerSeed).not.toContain('Prism Mobile')
  })
})
