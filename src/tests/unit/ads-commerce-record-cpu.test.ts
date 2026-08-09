/**
 * ⚡ **레코드당 CPU 를 줄인다 — 결과는 한 글자도 바뀌지 않는다** (2026-08-09).
 *
 * ## 왜
 * `collect-commerce` 가 CPU 한도로 죽는 원인은 **레코드당 정규식 폭풍**이다. 한 회차가 1,499건을 훑고,
 * 건마다 `anyEmail` 이 **모든 필드**에 `stripTag`(정규식 replace) + `EMAIL_RE`(정규식 match)를 돌렸다.
 * 필드 ~50개면 회차당 **15만 번**이고, 그중 이메일 후보는 한둘이다.
 *
 * 앞서 마감선을 6초로 내려 죽는 건 막았지만 그 대가로 **수확이 1,499 → 499** 로 줄었다.
 * 수확을 되찾는 유일한 길은 마감선을 올리는 게 아니라(여유를 볼 수 없으니 올리면 도박이다)
 * **같은 시간에 더 많이 처리하는 것** — 그게 이 변경이다.
 *
 * ## 이 파일이 지키는 것 — **동치성**
 * 최적화는 "빠른 길"을 추가하는 것이라 **조용히 결과를 바꿀 수 있다.** 그래서 속도가 아니라
 * **옛 구현과 새 구현이 같은 답을 내는가**를 고정한다. 참조 구현을 여기 그대로 박아 두고 대조한다.
 *
 * ## ⚠️ 이 테스트가 **못** 하는 것
 *  · **빨라졌다는 것을 증명하지 않는다.** 마이크로벤치는 이 러너에서 노이즈가 커서 거짓 초록/빨강을 만든다.
 *    실제 이득은 라이브 회차의 `found`(회차당 처리량)로만 판정된다 — handoff 의 판정 명령 참조.
 *  · 그러므로 **이 변경을 근거로 마감선·레코드 상한을 올리지 말 것.** 올릴 근거는 라이브 실측뿐이다
 *    (그 천장은 `ads-commerce-deadline-calibration.test.ts` 가 지킨다).
 */
import { describe, it, expect } from 'vitest'
import { mapCommerceLead, type RawCommerce } from '@/features/marketing/api/commerce-notify-collect'

// ── 참조 구현(최적화 전) — 이것과 답이 갈리면 최적화가 동작을 바꾼 것이다 ──────────────
const EMAIL_RE_REF = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const stripTagRef = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()
function anyEmailRef(it: RawCommerce): string {
  for (const v of Object.values(it)) {
    const s = stripTagRef(v)
    if (!s || s.includes('*')) continue
    const m = s.match(EMAIL_RE_REF)
    if (m && !/@(?:example|test|sample)\./i.test(m[0])) return m[0].toLowerCase()
  }
  return ''
}

/** 까다로운 값들 — 태그·마스킹·비문자열·'@' 없음·대소문자·공백 전부 섞는다. */
const VALUES: unknown[] = [
  'ceo@shop.co.kr', 'CEO@Shop.CO.KR', '  spaced@x.com  ', '<b>tagged@x.com</b>',
  'dduki0**@naver.com', 'ab**cd@x.com', 'no-at-here', '', null, undefined, 0, 42, true,
  { nested: 'obj' }, ['arr'], '<p>태그만 있고 메일 없음</p>', 'test@example.com', 'a@b',
  'shop.co.kr', 'http://shop.co.kr', '연락 bad@sample.org 참고', '한글 <i>강조</i> ceo@corp.kr',
]
const KEYS = ['bzmnNm', 'rprsvNm', 'rprsvEmladr', 'domnCn', 'rnAddr', 'chrgDeptTelno', 'etc1', 'etc2']

/** 결정론적 의사난수 — 러너에서 재현 가능해야 실패를 좇을 수 있다(Math.random 금지). */
function corpus(n: number): RawCommerce[] {
  const out: RawCommerce[] = []
  let seed = 12345
  const next = () => (seed = (seed * 1103515245 + 12345) >>> 0)
  for (let i = 0; i < n; i++) {
    const rec: RawCommerce = {}
    for (const k of KEYS) rec[k] = VALUES[next() % VALUES.length]
    out.push(rec)
  }
  return out
}

describe('anyEmail 최적화 — 빠른 길이 답을 바꾸지 않는다', () => {
  it('🔒 무작위 코퍼스 400건에서 참조 구현과 **완전히 동일**', () => {
    let checked = 0
    for (const rec of corpus(400)) {
      // 명명 필드 경로를 비워 anyEmail 폴백을 강제한다(그 경로가 이번 최적화의 대상이다).
      const forced: RawCommerce = { ...rec, rprsvEmladr: undefined }
      expect(mapCommerceLead(forced).email).toBe(anyEmailRef(forced) || null)
      checked++
    }
    // 🛡️ 측정 0 = 통과 금지 — 코퍼스가 비면 이 테스트는 아무것도 안 보고 초록이 된다.
    expect(checked).toBe(400)
  })

  it('🔒 태그가 감싼 이메일을 여전히 찾는다 — 빠른 길이 태그 앞에서 멈추면 안 된다', () => {
    expect(mapCommerceLead({ etc1: '<b>tagged@x.com</b>' }).email).toBe('tagged@x.com')
  })

  it('🔒 마스킹된 주소는 여전히 버린다 — 잘린 가짜 이메일을 만들지 않는다', () => {
    expect(mapCommerceLead({ etc1: 'ab**cd@x.com' }).email).toBeNull()
  })

  it("🔒 '@' 없는 값은 건너뛴다 — 그게 빠른 길이고, 결과는 원래도 빈값이었다", () => {
    expect(mapCommerceLead({ etc1: 'no-at-here', etc2: '<p>태그만</p>' }).email).toBeNull()
  })

  it('🔒 stripTag 는 태그 없는 값을 그대로 돌려준다(빠른 길) — trim 은 유지', () => {
    // 태그 없는 값의 trim 이 사라지면 상호명에 공백이 붙어 중복 판정이 어긋난다.
    expect(mapCommerceLead({ bzmnNm: '  가게이름  ' }).company_name).toBe('가게이름')
    expect(mapCommerceLead({ bzmnNm: ' <b>가게</b> ' }).company_name).toBe('가게')
  })
})
