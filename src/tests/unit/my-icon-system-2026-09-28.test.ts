import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 🎨 마이의 **뜻 아이콘은 유어딜 것**, lucide 는 조작만 (2026-09-28 — 대표 *"앞으로 아이콘은
 *   모두 저 컨셉이야 명심해줘"*).
 *
 * ## 무엇이 잘못됐었나 (세어 본 값)
 * 탭 다섯은 유어딜 아이콘으로 바꿔 놓고 **그 바로 아래 본문은 통째로 lucide** 였다 —
 * 마이 한 화면에 lucide **36종 · 87건**, 유어딜 아이콘 **0종**. 획 두께(2 vs 1.6)도 모서리도
 * 갈리는데, 둘이 **같은 화면 같은 열**에 있어서 그 차이가 그대로 보인다.
 *
 * ## 정본 — 경계는 "뜻이냐 조작이냐"
 * - **뜻**(내 이용권 · 찜 · 정산 · 설정 · 가게 …) → `@/components/icons/urdeal-icons`.
 *   이건 우리 물건의 이름이라 남의 세트에 맞는 그림이 애초에 없다.
 * - **조작**(화살표 · 닫기 · 검색 · 확인 · 더하기 · 로딩) → lucide 그대로.
 *   어느 앱에서나 같은 모양이고 직접 그릴 값이 없다. 아래 `OPERATION` 이 그 전부다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - **그림이 좋은지**. 이름만 본다 — `HeartIcon` 이 하트처럼 안 생겨도 통과한다.
 *   그건 그려서 봐야 한다: `node scripts/visual-preview.mjs --route=/user/profile --stores=1`.
 * - 마이 밖 화면(홈·상세·유어샵). 범위를 넓히려면 `SURFACES` 에 폴더를 더한다.
 * - 인라인 `<svg>` 를 손으로 그려 넣는 경우. 그건 세트 밖이라 이름으로 안 잡힌다.
 */
const SURFACES = [
  'src/pages/UserProfilePage.tsx',
  ...readdirSync('src/pages/user-profile').filter(f => f.endsWith('.tsx')).map(f => `src/pages/user-profile/${f}`),
  ...readdirSync('src/pages/user-profile/seller-section').filter(f => f.endsWith('.tsx')).map(f => `src/pages/user-profile/seller-section/${f}`),
]

/** lucide 로 남아도 되는 것 — **조작**뿐이다. 뜻을 가진 이름을 여기 추가하지 말 것. */
const OPERATION = new Set([
  'ChevronRight', 'ChevronDown', 'ChevronLeft', 'ChevronUp',
  'X', 'Search', 'Check', 'Plus', 'Minus', 'ExternalLink', 'Loader2',
  'LucideIcon', // 타입
])

const read = (f: string) => codeOnly(readFileSync(f, 'utf-8'))

function lucideNames(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'lucide-react'/g)) {
    for (const raw of m[1].split(',')) {
      const n = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (n) out.push(n)
    }
  }
  return out
}

describe('마이 — 아이콘 체계', () => {
  it('🎨 lucide 로 남은 것은 조작 아이콘뿐이다 (뜻 아이콘 0)', () => {
    const bad: string[] = []
    let seen = 0
    for (const f of SURFACES) {
      for (const n of lucideNames(read(f))) {
        seen++
        if (!OPERATION.has(n)) bad.push(`${f.split('/').pop()}: ${n}`)
      }
    }
    expect(seen, 'lucide import 를 하나도 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(20)
    expect(bad, `뜻 아이콘이 lucide 로 남았다: ${[...new Set(bad)].join(' · ')}`).toEqual([])
  })

  it('🎨 유어딜 아이콘을 실제로 쓴다 — import 만 바꾸고 안 쓰면 의미가 없다', () => {
    const used = new Set<string>()
    for (const f of SURFACES) {
      for (const m of read(f).matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/components\/icons\/urdeal-icons'/g)) {
        for (const raw of m[1].split(',')) {
          const n = raw.trim()
          if (n) used.add(n)
        }
      }
    }
    // 실측 24종(2026-09-28). 줄어들면 lucide 로 되돌아갔다는 뜻이다.
    expect(used.size, `유어딜 아이콘 사용 종류: ${[...used].sort().join(' ')}`).toBeGreaterThanOrEqual(20)
  })

  it('🎨 세트가 계약을 지킨다 — 24 그리드 · currentColor · stroke 1.6 · round', () => {
    const src = readFileSync('src/components/icons/urdeal-icons.tsx', 'utf-8')
    // `base` 한 곳이 모든 아이콘의 계약이다. 여기가 흔들리면 전부가 흔들린다.
    expect(src).toMatch(/viewBox:\s*'0 0 24 24'/)
    expect(src).toMatch(/stroke:\s*'currentColor'/)
    expect(src).toMatch(/strokeWidth:\s*1\.6/)
    expect(src).toMatch(/strokeLinecap:\s*'round'/)
    // 계약을 우회해 자기 값을 박은 아이콘이 없는지(획 두께는 세트의 정체성이다).
    const body = codeOnly(src)
    expect(body.match(/strokeWidth=/g) ?? [], '아이콘이 자기 stroke-width 를 따로 박았다').toEqual([])
  })

  it('🎨 목록 행이 쓰는 아이콘은 전부 세트에 실재한다 (이름만 맞고 없는 것 금지)', () => {
    const iconSrc = readFileSync('src/components/icons/urdeal-icons.tsx', 'utf-8')
    const exported = new Set([...iconSrc.matchAll(/export const (\w+) = forwardRef/g)].map(m => m[1]))
    expect(exported.size, '세트에서 export 를 하나도 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(25)
    const missing: string[] = []
    for (const f of SURFACES) {
      for (const m of read(f).matchAll(/import\s*\{([^}]*)\}\s*from\s*'@\/components\/icons\/urdeal-icons'/g)) {
        for (const raw of m[1].split(',')) {
          const n = raw.trim()
          if (n && !exported.has(n)) missing.push(`${f.split('/').pop()}: ${n}`)
        }
      }
    }
    expect(missing, `세트에 없는 아이콘을 import 한다: ${missing.join(' · ')}`).toEqual([])
  })
})

/**
 * 👤 헤더는 **모바일과 PC 가 같은 문법**이다 (2026-09-28 — 대표 *"시안들을 모바일, pc 각각"* 로 받아
 *   나란히 놓고 보다가 드러났다).
 *
 * 같은 날 모바일 헤더만 [줄 전체가 눌림 + 화살표] 로 고치고 **PC 를 빠뜨렸다** — PC 는 별도 마크업이라
 * 회색 `프로필 편집` 알약이 그대로 남아 있었다. 같은 뜻의 줄이 기기마다 다르게 생긴 것, 그게
 * 이 화면이 계속 "허술해" 보이던 클래스 그 자체다.
 *
 * ⚠️ 이 시험이 못 막는 것: 생김새가 *같은지*는 못 본다(마크업 두 벌이 각자 존재하는 한 언제든 갈린다).
 *    보는 것은 **둘 다 알약이 아니라 눌리는 줄인가** 하나뿐이다.
 */
describe('마이 — 헤더 문법은 모바일·PC 가 같다', () => {
  const MOBILE = 'src/pages/UserProfilePage.tsx'
  /**
   * 🔁 **2026-10-11 재조준(안 5) — PC 헤더가 파일을 옮겼다.**
   *   대표 확정 안 5 로 PC 프로필 줄이 `AccountPcPane`(좁은 오른쪽 칸의 흰 판 카드) →
   *   `AccountPcBand`(전폭 머리 띠)로 이사했다. **불변식은 한 글자도 안 바뀐다** —
   *   *"둘 다 알약이 아니라 눌리는 줄인가"* · *"모바일과 PC 가 같은 문법인가"*. 앵커만 따라간다.
   *   ⚠️ 지우지 않는다: 이사한 자리에서 같은 것을 계속 지켜야 09-28 에 갈렸던 그 상태로 안 돌아간다.
   */
  const PC = 'src/pages/user-profile/AccountPcBand.tsx'

  /**
   * 🔁 **2026-10-11 재조준 — 대표 지시로 "라벨 0" 전제가 바뀌었다.**
   *
   * 종전 단언은 *"화면에 라벨을 그리면 알약이 된 것"* 이었다. 그런데 대표가 마이 스크린샷을 보내며
   * *"오른쪽 버튼은 눌렀을 때 기껏해야 이름이랑 전화번호 변경이네? **프로필 편집이라고 바꾸던지**"*
   * 라고 했다 — 맨 `>` 는 무엇이 열리는지 말하지 않는다는 지적이다.
   *
   * 🔑 **이 시험이 지키려던 것은 라벨의 유무가 아니다**(머리말이 스스로 적어 둔 대로):
   *   *"둘 다 알약이 아니라 **눌리는 줄**인가"* · *"모바일과 PC 가 같은 문법인가"*. 그 둘은 그대로다 —
   *   라벨은 **같은 버튼 안의 글자**이고, 09-28 에 없앤 것은 이름·이메일 **아래 셋째 줄**의
   *   회색 알약(별도 `<button>`)이었다. 그래서 단언을 그 셋으로 옮긴다:
   *     ① 라벨은 **있다**(모바일·PC 둘 다 — 한쪽만 있으면 그게 09-28 에 갈렸던 그 상태다)
   *     ② 라벨은 `<span>` 이다(별도 `<button>`/`<Link>` 알약이 아니다)
   *     ③ 줄 전체가 눌린다 — 편집 진입 버튼이 `aria-label` 을 그대로 갖는다
   */
  it('👤 `프로필 편집` 라벨이 **모바일·PC 둘 다** 있고, 알약이 아니라 눌리는 줄 안의 글자다', () => {
    for (const f of [MOBILE, PC]) {
      const src = read(f)
      const labels = src.match(/<(\w+)[^>]*>\{t\('userProfile\.editProfile'/g) ?? []
      expect(labels.length, `${f.split('/').pop()}: 화면에 보이는 '프로필 편집' 라벨이 없다`).toBe(1)
      expect(labels[0], `${f.split('/').pop()}: 라벨이 별도 알약(button/Link)이다`).toMatch(/^<span/)
      expect(src, `${f.split('/').pop()}: 편집 진입의 aria-label 이 없다`).toMatch(/aria-label=\{t\('userProfile\.editProfile'/)
    }
  })

  /**
   * 🔁 **2026-10-25 재조준(대표 확정 위쪽 안 3)** — 이름 아래 줄이 이메일 → `프로필 편집 ›` 이 됐다.
   *   불변식은 그대로다: *"같은 줄이 기기마다 다른 크기면 두 벌이 갈린 것"* — 이제 그 줄이 편집 라벨이다.
   */
  it('👤 둘 다 이름 아래 줄(프로필 편집)을 13px 로 쓴다 — 같은 줄이 기기마다 다른 크기면 두 벌이 갈린 것이다', () => {
    for (const f of [MOBILE, PC]) {
      const src = read(f)
      const m = src.match(/text-\[(\d+)px\][^>]*>\{t\('userProfile\.editProfile'/)
      expect(m?.[1], `${f.split('/').pop()}: 이름 아래 줄 크기를 못 찾았다`).toBe('13')
      expect(src, `${f.split('/').pop()}: 이메일이 이름 아래로 돌아왔다(그 자리는 편집 라벨이다)`).not.toMatch(/>\{localStorage\.getItem\('user_email'\)/)
    }
  })
})
