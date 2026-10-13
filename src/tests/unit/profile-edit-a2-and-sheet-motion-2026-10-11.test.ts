/**
 * 👤🎬 프로필 편집 A-2 · 시트가 올라온다 〔2026-10-11 대표 확정〕
 *
 * 대표: *"오른쪽 버튼 눌렀을 때 또 설정할 것들 없어?"* → *"A-2로 하되 이렇게 올라오는 경우
 * 부드럽게 올라올 수 있나?"*
 *
 * 두 가지를 고정한다:
 *   ① **A-2** — 사람에 관한 것(사진·이름·소개·전화번호·내 주소·SNS)이 **한 곳**에 있고,
 *      입력칸을 늘어놓는 대신 **줄 목록**으로 담는다.
 *   ② **시트가 올라온다** — 네 시트가 같은 동작을 쓰고, PC 에서는 그 동작을 **쓰면 안 된다**.
 *
 * ## 🔴 PC 함정은 측정으로 확인했다 (추측 아님)
 * `ur-slide-up` 은 `transform` 을 `translateY(100%) → none` 으로 끝내고 `fill-mode: both` 로
 * 그 값을 유지한다. PC 다이얼로그는 가운데 정렬을 **같은 속성**(`-translate-x-1/2 -translate-y-1/2`)
 * 으로 하므로, 애니메이션이 그걸 덮는다. 1280×800 브라우저 실측:
 *
 *   가운데 상자 + `overlay-in`  → left 490, top 320   (정상)
 *   가운데 상자 + `slide-up`    → left 640, top 400   (= 가운데에서 150·80px 튐)
 *
 * ⇒ PC 는 `transform` 을 안 건드리는 `overlay-in` 만 쓴다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - **실제로 부드럽게 보이는지**: 0.24초 곡선이 좋은지는 눈으로 본다. 여기서 재는 건 배선뿐이다.
 * - **닫힐 때**: 지금은 올라오기만 한다(닫히면 즉시 사라진다). 내려가는 동작은 *swap*
 *   (`ToolPageSheet` 닫기 → `AllToolsSheet` 복귀)에서 **두 시트 사이에 빈 틈**을 만들기 때문에
 *   같이 설계해야 하고, 그래서 이 PR 에 넣지 않았다. 넣을 때 이 주석을 지울 것.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(readFileSync(p, 'utf-8'))

const EDIT = 'src/pages/user-profile/profile-edit/ProfileEditSheet.tsx'
const ROW = 'src/pages/user-profile/profile-edit/EditRow.tsx'
const PAGE = 'src/pages/UserProfilePage.tsx'
const MANAGE = 'src/pages/UShopManagePage.tsx'
const CSS = 'src/index.css'

/** 바닥에서 올라오는 시트 전부. 하나라도 빠지면 그 화면만 툭 뜬다(한 앱 안에서 두 가지 동작). */
const SHEETS = [
  'src/components/notifications/NotificationSheet.tsx',
  'src/pages/user-profile/StoreSwitchSheet.tsx',
  'src/pages/user-profile/seller-section/Sheet.tsx',
  EDIT,
] as const

describe('① 시트가 올라온다', () => {
  it('측정이 비어 있지 않다 — 네 파일이 다 있고 내용이 있다', () => {
    for (const f of SHEETS) {
      expect(existsSync(f), f).toBe(true)
      expect(read(f).length, f).toBeGreaterThan(800)
    }
  })

  it('네 시트 모두 **우리 클래스**로 등장한다 — 유틸을 직접 쓰지 않는다', () => {
    for (const f of SHEETS) {
      const src = read(f)
      expect(src, `${f}: 시트가 툭 뜬다`).toMatch(/\bur-sheet-in\b/)
      /* 🔴 유틸 직접 사용 금지. 둘을 막는다:
         ⓐ PC 가운데 정렬(transform)을 `ur-slide-up` 이 덮어 다이얼로그가 튄다
         ⓑ 변형 클래스(`max-lg:animate-slide-up`)는 **동작 줄이기로 못 끈다**(둘 다 실측 — index.css 머리말) */
      expect(src, `${f}: animate-slide-up 유틸을 직접 쓴다`).not.toMatch(/\banimate-slide-up\b/)
      expect(src, `${f}: animate-overlay-in 유틸을 직접 쓴다`).not.toMatch(/\banimate-overlay-in\b/)
    }
  })

  it('뒷 배경은 **같이 흐려진다** — 시트만 움직이면 어둠이 툭 켜진다', () => {
    for (const f of SHEETS) {
      const src = read(f)
      // 셸이 스스로 배경을 그리는 시트만 본다(`Sheet` 를 쓰는 자식들은 셸이 대신 그린다).
      if (!/fixed inset-0 bg-black\//.test(src)) continue
      expect(src, `${f}: 배경이 페이드 없이 켜진다`).toMatch(/fixed inset-0 bg-black\/\d+ ur-sheet-veil/)
    }
  })

  /**
   * 🔴 **PC 함정** — 브라우저 실측(1280×800): 가운데 상자에 `ur-slide-up` 이 걸리면
   *    410,200 → 640,400 으로 튄다. `.ur-sheet-in` 이 lg+ 에서 투명도만 쓰게 소유하므로
   *    호출부는 그 실수를 할 수 없다. 여기서는 **그 소유가 유지되는지**를 본다.
   */
  it('PC 가운데 다이얼로그가 튀지 않는다 — lg+ 는 transform 을 안 건드린다', () => {
    let checked = 0
    for (const f of SHEETS) {
      if (!/lg:-translate-[xy]-1\/2/.test(read(f))) continue
      checked++
    }
    // 0곳이면 통과가 아니라 고장이다(경로가 낡으면 위 루프가 통째로 비어도 초록이 뜬다).
    expect(checked, 'PC 다이얼로그를 가진 시트를 한 개도 못 찾았다').toBeGreaterThanOrEqual(2)

    const css = readFileSync(CSS, 'utf-8')
    // 폰: 올라온다 / lg+: 투명도만 — 두 줄이 쌍이다(한쪽만 있으면 PC 가 slide 를 물려받는다).
    expect(css, '.ur-sheet-in 기본이 slide-up 이 아니다').toMatch(/\.ur-sheet-in\s*\{[^}]*ur-slide-up/)
    expect(css, 'lg+ 에서 투명도 전환으로 갈아타지 않는다')
      .toMatch(/@media \(min-width:\s*1024px\)\s*\{\s*\.ur-sheet-in\s*\{[^}]*ur-overlay-in/)
  })

  /**
   * 🩸 **이 단언은 두 번 헛돌았고, 둘 다 브라우저 실측이 잡았다**(소스 검사만으론 못 본다).
   *   ① `.animate-slide-up { animation: none }` — 시트는 변형 클래스를 써서 선택자가 안 맞았다.
   *   ② `@keyframes` 재정의 — Tailwind 가 변형 블록 안에 같은 키프레임을 **더 뒤에** 다시 emit 한다.
   *   둘 다 *소스에 규칙이 있는지* 는 통과시켰다. ⇒ 우리 클래스를 끄는지로 바꾼다(정의가 이 파일
   *   안에 있어 순서를 우리가 정한다). 실측 390×844 reduce ON: 시작 y=444 = 끝 y=444(안 움직인다).
   */
  it('"동작 줄이기" 를 켠 사람에겐 꺼진다', () => {
    const css = readFileSync(CSS, 'utf-8')
    const blocks = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n?\}/g)]
      .map(m => m[1])
    expect(blocks.length, 'reduced-motion 블록을 한 개도 못 찾았다').toBeGreaterThan(0)
    const off = (sel: string) => blocks.some(b => new RegExp(`\\${sel}[^{]*\\{[^}]*animation:\\s*none`).test(b))
    expect(off('.ur-sheet-in'), '올라오는 동작이 안 꺼진다').toBe(true)
    expect(off('.ur-sheet-veil'), '배경 페이드가 안 꺼진다').toBe(true)
    // 그 규칙은 정의보다 **뒤**여야 이긴다(같은 특이도 — 순서가 전부다).
    expect(css.lastIndexOf('.ur-sheet-in, .ur-sheet-veil'))
      .toBeGreaterThan(css.indexOf('.ur-sheet-in {'))
  })
})

describe('② 프로필 편집 A-2 — 사람에 관한 것은 한 곳, 줄 목록으로', () => {
  const edit = read(EDIT)

  it('다섯 줄 + 사진이 전부 있다', () => {
    /* 🩸 첫 판은 `label="이름"` 처럼 **리터럴 라벨**을 찾았다 — 같은 날 문구를 `t()` 로 옮기자
       (옛 모달이 쓰던 6개 언어 키 재사용) 통째로 빨간불이 났다. 코드가 아니라 시험의 오류다.
       지키려는 것은 *한국어가 소스에 박혀 있는가* 가 아니라 **그 다섯 줄이 존재하는가** 다
       ⇒ `defaultValue`(= 화면에 뜨는 한국어)로 앵커한다. locale 에 키가 없으면 그 값이 쓰인다. */
    for (const label of ['이름', '한 줄 소개', '전화번호', '내 주소', 'SNS 링크']) {
      expect(edit, `'${label}' 줄이 없다`).toMatch(
        new RegExp(`label=\\{t\\([^)]*defaultValue: '${label.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}'`),
      )
    }
    expect(edit, '사진을 바꿀 수 없다').toContain('/api/upload/image')
    // 줄이 다섯이어야 한다 — 하나가 조용히 사라지면 그 설정은 어디서도 못 고친다.
    expect((edit.match(/<EditRow\b/g) || []).length, '줄 개수가 다섯이 아니다').toBe(5)
  })

  it('입력칸 나열이 아니라 **줄**이다 — 접히고, 누르면 펼쳐진다', () => {
    expect(edit).toMatch(/<EditRow\b/)
    const row = read(ROW)
    // 접힌 줄은 값(또는 '아직 없어요')을 보여 준다 — 빈칸으로 두면 "없음" 과 "못 불러옴" 이 같아진다.
    expect(row).toContain("'아직 없어요'")
    expect(row, '펼침 분기가 없다').toMatch(/if \(open\)/)
  })

  /**
   * 🩸 **이름을 `auth/profile` 로 보내면 안 된다.** 둘 다 `users.name` 을 쓰지만 그쪽은 공개
   *   유어샵 캐시를 purge 하지 않는다 — 이름을 바꿔도 남들에겐 한동안 옛 이름이 보인다(에러 0).
   */
  it('이름은 purge 하는 경로(curator)로 저장한다', () => {
    const save = edit.slice(edit.indexOf('async function saveName'), edit.indexOf('async function savePhone'))
    expect(save.length, 'saveName 을 못 찾았다').toBeGreaterThan(80)
    expect(save, '이름이 purge 없는 경로로 간다').not.toContain('/api/auth/profile')
    // 저장 자체는 공통 `patch()`(= curator/me/profile) 가 한다.
    expect(save).toMatch(/patch\(\{\s*name:/)
    expect(edit).toContain("api.patch('/api/curator/me/profile'")
  })

  it('전화번호는 형식까지 본다 — 빈칸만 막으면 "010" 도 통과한다', () => {
    expect(edit).toMatch(/\^01\[016789\]/)
    expect(edit).toContain("api.patch('/api/auth/profile', { phone: v })")
  })

  it('핸들이 없는 계정엔 `내 가게 주소` 묶음을 안 그린다', () => {
    expect(edit).toMatch(/\{me\?\.handle && \(/)
  })

  it('마이가 시트를 열고, 열지 않는 사람에겐 안 실린다(lazy)', () => {
    const page = read(PAGE)
    expect(page).toContain("lazy(() => import('./user-profile/profile-edit/ProfileEditSheet'))")
    expect(page).toMatch(/\{editOpen && \(/)
    // 종전 모달은 사라졌다 — 남겨 두면 다음 세션이 그걸 되살려 편집이 두 곳이 된다.
    expect(page, '옛 ProfileEditModal 이 아직 걸려 있다').not.toContain('<ProfileEditModal')
  })

  it('유어샵 관리는 진열대만 맡는다 — 같은 줄을 다시 그리지 않는다', () => {
    const manage = read(MANAGE)
    expect(manage, '편집이 두 곳이 됐다').not.toContain('<ShopInfoCards')
    // 🧭 2026-10-13 (대표 — 누르면 아래에서 올라오게, 이름은 "편집"): 마이로 화면을 넘기던 줄이
    //   **같은 시트**를 그 자리에서 연다. 불변식은 그대로다 — 편집 화면은 한 벌(ProfileEditSheet)이고,
    //   관리 화면은 그 저장을 직접 하지 않는다.
    expect(manage).toContain("lazy(() => import('./user-profile/profile-edit/ProfileEditSheet'))")
    expect(manage).toMatch(/<ProfileEditSheet\b/)
    expect(manage, '관리 화면이 프로필을 직접 저장한다 — 편집이 두 곳').not.toContain('/api/curator/me/profile')
  })
})
