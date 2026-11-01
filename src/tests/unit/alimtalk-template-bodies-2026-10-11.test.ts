/**
 * 🧾 알림톡 본문 = 카카오에 등록할 본문 (2026-10-11 대표 "템플릿 문구들도 빠짐없이 다 정리해서 만들어줘")
 *
 * 알림톡은 **등록한 본문과 글자 하나까지 같아야** 나간다. 변수(`#{...}`) 자리만 바뀔 수 있고, 줄이
 * 생겼다 없어졌다 하면 그 순간 "템플릿 불일치"로 거절된다 — 에러는 알리고 쪽에만 남고 우리는 조용하다.
 * 그래서 본문 안에 **조건부 줄**(`${x ? `\n…` : ''}`)을 두지 않는다. 값이 없으면 '-' 같은 자리값을 넣는다.
 *
 * ⚠️ 못 보는 것: 등록한 본문과 코드 본문의 실제 일치(콘솔은 레포 밖) — `docs/alimtalk-register-list.md` 가 그 짝이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')
/** `const message = \`…\`` / `const msg = \`…\`` 템플릿 리터럴 본문만 뽑는다(중첩 백틱은 조건부 줄의 흔적이라 그대로 걸린다). */
function bodies(src: string): string[] {
  const out: string[] = []
  const re = /const (?:message|msg) =\s*\n?\s*`/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 0
    for (; i < src.length; i++) {
      const ch = src[i]
      if (ch === '\\') { i++; continue }
      if (ch === '$' && src[i + 1] === '{') { depth++; i++; continue }
      if (ch === '}' && depth > 0) { depth--; continue }
      if (ch === '`' && depth === 0) break
    }
    out.push(src.slice(m.index + m[0].length, i))
  }
  return out
}
const CONDITIONAL_LINE = /\?\s*`\s*\n|\?\s*`\\n/

describe('본문에 조건부 줄이 없다', () => {
  const files = [
    'src/features/group-buy/api/helpers.ts',
    'src/worker/cron/appointment-reminder.ts',
    'src/shared/home-service.ts',
  ]
  for (const f of files) {
    it(f, () => {
      const bs = bodies(read(f))
      expect(bs.length).toBeGreaterThan(0) // 0이면 추출이 고장 — 통과가 아니라 실패
      for (const b of bs) expect(b).not.toMatch(CONDITIONAL_LINE)
    })
  }
  it('추출기 자신이 조건부 줄을 잡는다(헛도는 검사 방지)', () => {
    const bad = 'const message = `a\n"${p}"${ts ? `\n사용 시각: ${ts}` : \'\'}\nb`'
    expect(bodies(bad).some(b => CONDITIONAL_LINE.test(b))).toBe(true)
  })
})

describe('고정 문구', () => {
  const h = read('src/features/group-buy/api/helpers.ts')
  it('사용 시각 줄은 항상 있다(값이 없으면 -)', () => {
    expect(h.match(/사용 시각: \$\{ts \|\| '-'\}/g)?.length).toBe(2)
  })
  it('사용 완료는 음식 전용 문구를 쓰지 않는다(뷰티·숙박도 같은 템플릿)', () => {
    expect(h).not.toMatch(/맛있게 드세요/)
  })
  it('예약 안내 링크는 https 로 시작한다', () => {
    for (const f of ['src/worker/cron/appointment-reminder.ts', 'src/features/appointments/api/appointments.routes.ts', 'src/worker/cron/appointment-noshow-alert.ts']) {
      expect(read(f)).not.toMatch(/[^/]urdeal\.kr\/(?:my-appointments|seller\/appointments)/)
    }
  })
})

describe('만료 안내 알림톡은 30일 전 한 번만 (2026-10-11 대표 "30일 전만 하지뭐")', () => {
  it('발송 조건이 daysLeft === 30 이다(7·3·1일 전은 앱 알림만)', () => {
    expect(read('src/worker/cron/voucher-expire.ts')).toMatch(/if \(r\.user_phone && daysLeft === 30\) \{/)
  })
  it('만료일이 없는 이용권은 대상이 아니다', () => {
    expect(read('src/worker/cron/voucher-expire.ts')).toMatch(/v\.expires_at IS NOT NULL/)
  })
})

describe('교환권(딜 결제)은 이용권 발급 알림을 보내지 않는다', () => {
  it('/join 의 voucher_issued 발송이 deal_only 를 거른다', () => {
    expect(read('src/features/group-buy/api/group-buy.routes.ts'))
      .toMatch(/userRow\?\.phone && Number\(\(product as \{ deal_only\?: number \| null \}\)\.deal_only\) !== 1/)
  })
})
