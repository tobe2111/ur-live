/**
 * 🛡️ **소개받은 사람이 소개한 사람의 손님을 가로채면 안 된다** (2026-09-04 대표).
 *
 * 대표: *"누가 돈을 벌기 위해서 그 링크를 누구에게 공유했는데, 그 누구가 또 자신의 링크로
 * 판매를 다이렉트로 되게 하면 안 된다는거야. 유어딜 메인에서 발견한 이용권으로 직접 확인할 때만."*
 *
 * ## 🩸 실제로 열려 있던 구멍
 * `ProductDetailPage` 의 **"내 유어샵에 담기 + 추천 링크 복사"** 는 로그인만 했으면 무조건 떴다.
 * A 가 공유한 링크(`?ref=A`)로 들어온 B 에게도 떴고, 누르면 `?ref=B` 링크가 만들어진다.
 * ⇒ A 가 데려온 손님을 B 가 그대로 가져간다. **소개할 이유가 사라지는 구조.**
 *
 * ## 규칙
 * 담기 CTA 는 **남의 추천으로 들어온 화면에서는 안 그린다.** 유어딜에서 직접 발견했을 때만.
 * (몰 상품에 안 그리는 것과 같은 성격의 게이트 — 2026-08-02 `!mallProduct`.)
 *
 * ⚠️ **구매 귀속은 건드리지 않는다.** B 가 사면 그 매출은 여전히 A 에게 간다 —
 *   그게 A 가 공유한 이유다. 이 게이트는 *화면*만 가린다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: B 가 나중에 자기 유어샵(`/u/me/add`)에서 같은 상품을 담는 것.
 *   대표 요구는 "그 링크로 들어온 페이지에서" 이므로 진입 맥락만 막는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const DETAIL = 'src/pages/ProductDetailPage.tsx'
const TRACK = 'src/utils/affiliate-track.ts'

describe('① 담기 CTA 는 남의 추천 링크로 온 화면에서 안 뜬다', () => {
  const src = strip(readFileSync(DETAIL, 'utf8'))

  it('게이트가 담기 블록에 실제로 걸려 있다', () => {
    // 담기 버튼을 그리는 블록의 조건에 게이트가 있어야 한다 — 파일 아무 데나 있으면 안 된다.
    const gate = src.match(/\{!mallProduct[^\n]*\(\(\) => \{/)?.[0] ?? ''
    expect(gate, `${DETAIL}: 담기 블록 조건에 arrivedViaSomeoneElsesRef 게이트가 없다\n${gate}`)
      .toContain('arrivedViaSomeoneElsesRef')
  })

  it('그 블록이 실제로 담기 버튼을 그린다 (앵커가 낡지 않았는지)', () => {
    expect(src, `${DETAIL}: 담기 CTA 가 사라졌다면 이 테스트의 앵커를 고칠 것`)
      .toContain('/api/curator/me/pins')
  })
})

describe('② 판정 함수 — 화면만 가리고 귀속은 안 건드린다', () => {
  const src = strip(readFileSync(TRACK, 'utf8'))

  it('저장된 ref 를 읽기만 한다 — 지우지 않는다', () => {
    const fn = src.slice(src.indexOf('export function arrivedViaSomeoneElsesRef'))
      .slice(0, src.slice(src.indexOf('export function arrivedViaSomeoneElsesRef')).indexOf('\n}\n') + 3)
    expect(fn.length, '판정 함수를 못 찾았다 — 이름이 바뀌었는지 확인할 것').toBeGreaterThan(50)
    expect(fn, 'removeItem/clear 가 있으면 구매 귀속이 사라진다 — 화면만 가려야 한다')
      .not.toMatch(/removeItem|\.clear\(|setItem/)
  })

  it('만료된 ref 는 남의 추천으로 안 본다', () => {
    const fn = src.slice(src.indexOf('export function arrivedViaSomeoneElsesRef'))
    expect(fn.slice(0, 700), '유효기간 검사가 없으면 7일 지난 방문자도 영구히 담기를 못 한다')
      .toMatch(/EXP_KEY|expires/)
  })

  it('본인 ref 는 남의 추천이 아니다', () => {
    const fn = src.slice(src.indexOf('export function arrivedViaSomeoneElsesRef'))
    expect(fn.slice(0, 700)).toContain('user_id')
  })
})

describe('③ 적립 문구 — 담기도 판매도 아니라 "사용" 시 확정', () => {
  /**
   * 대표: *"담으면 N% 적립은 너무 모호하지 않아? 결국 이용권 판매 후 사용 당 계산이 될텐데?"*
   * 코드가 그렇다 — affiliate-credit 은 holding 으로 넣고 이용권이 `used` 가 돼야 granted 로 올린다
   * (2026-06-17 대표 결정 "예정→사용 시 확정"). "담으면 적립" 은 과약속이었다.
   */
  const FILES = [
    'src/pages/curator-page/LinkshopPinPicker.tsx',
    'src/pages/curator-page/PinManageList.tsx',
    'src/pages/ProductDetailPage.tsx',
  ] as const

  for (const f of FILES) {
    it(`${f.split('/').pop()} — 담기/판매만으로 적립되는 것처럼 쓰지 않는다`, () => {
      const src = strip(readFileSync(f, 'utf8'))
      expect(src, `${f}: '1판매당 … 적립' 은 사용 시 확정이라는 사실과 어긋난다`)
        .not.toMatch(/1판매당[^<]{0,20}적립/)
      expect(src, `${f}: '담으면 … 적립' 은 담기만으로 받는 것처럼 읽힌다`)
        .not.toMatch(/담으면[^<]{0,20}적립/)
    })
  }
})
