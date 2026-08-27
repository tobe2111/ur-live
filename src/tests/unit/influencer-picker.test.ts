import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { sanitizeChannels, sanitizeList, maxFollowers, parseChannels } from '@/worker/utils/influencer-profile'

/**
 * 🔎 2026-08-27 — 매장이 소개자를 **찾을 수 있어야** 한다, 그리고 **아무나 노출되면 안 된다.**
 *
 * ## 배경
 * 딜 제안 화면이 인플루언서 **유저 ID 를 손으로 타이핑**하게 돼 있었다(`'user_12345'`).
 * 사장님이 남의 계정 ID 를 알 방법이 없으니 쓸 수 없는 화면이었고, 딜 0건의 원인 중 하나다.
 * 검색을 붙이려니 **모수가 없어서**(공개 프로필 개념 자체가 없었다) 프로필 opt-in 을 신설했다.
 *
 * ## 이 테스트가 지키는 두 축
 *   ① **프라이버시** — 공개(opt-in)한 사람만, 연락처는 절대 응답에 넣지 않는다
 *   ② **저장형 XSS** — 채널 URL 은 http(s) 만. `javascript:` 를 저장해 두면 셀러가 그 링크를
 *      누르는 순간 스크립트가 된다. 화면에서 막는 걸론 부족하고 **저장 시점**에 걸러야 한다
 *
 * ## 못 막는 것
 *   - 실제 쿼리 실행 결과(D1 없이 문자열/순수함수만 본다)
 *   - 렌더 동작
 */
// 2026-08-27: 파일크기 래칫으로 marketing.routes.ts 에서 분리됐다(이동만 — 로직 불변).
const ROUTES = 'src/features/group-buy/api/marketing/discovery.ts'
const read = (p: string) => readFileSync(p, 'utf-8')

function pickerHandler(src: string): string {
  const start = src.indexOf("sellerApp.get('/influencers'")
  expect(start, '소개자 검색 라우트를 못 찾았다 — 옮겼으면 이 테스트도 따라 옮길 것').toBeGreaterThan(-1)
  const rest = src.slice(start)
  const end = rest.indexOf('\nsellerApp.')  // 다음 셀러 라우트 전까지
  return end > 0 ? rest.slice(0, end) : rest.slice(0, 4000)
}

describe('소개자 검색 — 프라이버시', () => {
  it('① 가입자 전원이 아니라 **활동한 사람**만 검색된다', () => {
    // 🩸 2026-08-27 재조준(대표 "어차피 공개가 되어있잖아"): 모수 기준이 별도 공개 토글에서
    //   **행동**(유어샵에 담았는가)으로 바뀌었다. 지키는 가치는 그대로다 —
    //   핸들은 가입 시 자동 발급이라, 활동 조건이 빠지면 결국 가입자 전원 노출이 된다.
    const h = pickerHandler(read(ROUTES))
    expect(h, '활동(핀) 조건이 사라지면 가입자 전원이 사업자에게 노출된다')
      .toContain('pin.n > 0 OR COALESCE(p.is_open, 0) = 1')
    expect(h, '옵트아웃이 사라지면 "빼 달라"는 사람을 뺄 수 없다')
      .toContain('COALESCE(p.is_open, 1) = 1')
  })

  it('② 연락처를 SELECT 하지 않는다', () => {
    const h = pickerHandler(read(ROUTES))
    // ⚠️ 앵커는 **실제 FROM 절**이어야 한다. 예전엔 `FROM influencer_profiles` 로 잘랐는데
    //   쿼리가 `FROM users` 로 바뀌자 indexOf 가 -1 이 되어 slice 가 파일 끝까지를 집었고,
    //   그래도 통과해서 **헛돌고 있었다**(초록인데 아무것도 안 지킴).
    const from = h.indexOf('FROM users')
    expect(from, '검색 쿼리의 FROM 절을 찾지 못했다 — 이 검사는 헛돈다').toBeGreaterThan(-1)
    const cols = h.slice(h.indexOf('SELECT'), from)
    for (const banned of ['email', 'phone']) {
      expect(cols, `연락처(${banned})가 검색 응답에 실리면 플랫폼 밖 콜드 연락의 통로가 된다`)
        .not.toContain(banned)
    }
  })
})

describe('소개자 프로필 — 저장 정규화', () => {
  it('③ javascript: URL 은 저장되지 않는다 (저장형 XSS)', () => {
    const out = sanitizeChannels([
      { kind: 'instagram', url: 'javascript:alert(1)' },
      { kind: 'blog', url: 'https://blog.example.com' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].url).toBe('https://blog.example.com')
  })

  it('④ 모르는 채널 종류·상대경로·개수 초과를 걸러낸다', () => {
    expect(sanitizeChannels([{ kind: 'myspace', url: 'https://a.com' }])).toHaveLength(0)
    expect(sanitizeChannels([{ kind: 'blog', url: '/relative' }])).toHaveLength(0)
    const many = Array.from({ length: 9 }, () => ({ kind: 'blog', url: 'https://a.com' }))
    expect(sanitizeChannels(many).length).toBeLessThanOrEqual(5)
  })

  it('⑤ 카테고리·지역은 화이트리스트 밖 값을 버린다', () => {
    // LIKE 로 JSON 배열을 검색하므로, 임의 문자열이 들어가면 검색이 오탐한다.
    expect(sanitizeList(['meal_voucher', '<script>'], ['meal_voucher', 'beauty_voucher'])).toEqual(['meal_voucher'])
  })

  it('⑥ 팔로워는 음수·비숫자를 null 로, 정렬값은 최대치', () => {
    const ch = sanitizeChannels([
      { kind: 'blog', url: 'https://a.com', followers: -5 },
      { kind: 'youtube', url: 'https://b.com', followers: 1200 },
    ])
    expect(ch[0].followers).toBeNull()
    expect(maxFollowers(ch)).toBe(1200)
  })

  it('⑦ 깨진 JSON 이 저장돼 있어도 화면이 죽지 않는다', () => {
    expect(parseChannels('{{not json')).toEqual([])
    expect(parseChannels(null)).toEqual([])
  })
})
