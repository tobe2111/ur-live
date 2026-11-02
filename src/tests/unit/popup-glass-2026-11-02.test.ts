/**
 * 🪟 소비자 팝업 유리 통일 (2026-11-02 대표 확정 *"블러 없이 유리로 하자"*)
 *
 * 시안·결정 기록: `docs/design/popup-system-2026-11.md`.
 * 팝업(확인창·시트·알림)의 모양은 `src/index.css` 의 클래스 몇 개가 **한 곳에서** 정한다:
 *   `.ur-veil`(뒤 막 — 흐림 없음) · `.ur-glass`(유리 판) · `.ur-pop-card|sheet|toast`(모서리).
 *
 * 🩸 왜 시험이 됐나: 조사 때 소비자 팝업 61곳이 뒤 막 진하기 9종(`bg-black/40`~`/90`)으로 제각각이었다.
 *   각 화면이 막을 손으로 적으면 반드시 다시 갈린다(이 레포가 반복해 당한 클래스).
 *
 * ⚠️ 이 시험이 못 보는 것: 판이 실제로 읽기 좋은지(그려서 봐야 한다) · 변수로 조립한 className ·
 *   `.ur-veil` 없이 `bg-gray-900/50` 같은 다른 색으로 막을 그린 경우.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const CSS = readFileSync('src/index.css', 'utf-8')
const code = (f: string) =>
  readFileSync(f, 'utf-8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

describe('① 모양은 index.css 한 곳이 정한다', () => {
  it('유리 판 · 뒤 막 · 모서리 클래스가 있다', () => {
    expect(CSS).toMatch(/\.ur-veil \{ background: var\(--veil\); \}/)
    expect(CSS).toMatch(/\.ur-glass \{[^}]*background: var\(--glass\);[^}]*backdrop-filter: blur\(24px\)/s)
    expect(CSS).toMatch(/\.ur-pop-card \{ border-radius: 28px; \}/)
    expect(CSS).toMatch(/\.ur-pop-sheet \{ border-radius: 32px; \}/)
  })

  it('뒤 막은 흐리지 않는다 (대표 결정 — "블러 없이")', () => {
    const veil = CSS.match(/\.ur-veil \{[^}]*\}/)?.[0] ?? ''
    expect(veil).not.toMatch(/blur/)
  })

  it('흐림을 못 쓰는 브라우저 · 투명도 줄이기 기기는 불투명 판으로 떨어진다', () => {
    expect(CSS).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{\s*\.ur-glass \{ background: var\(--surface\); \}/)
    expect(CSS).toMatch(/@media \(prefers-reduced-transparency: reduce\) \{\s*\.ur-glass \{ background: var\(--surface\);/)
  })

  it('대시보드·light-island 위에서는 라이트 유리로 되박는다 (html.dark 에서 검은 유리 방지)', () => {
    const block = CSS.slice(CSS.indexOf('.light-island, .force-light-theme, .admin-light-theme'))
    const body = block.slice(0, block.indexOf('}'))
    expect(body).toMatch(/--glass: rgb\(255 255 255 \/ 0\.74\)/)
    expect(body).toMatch(/--veil: rgb\(10 12 18 \/ 0\.22\)/)
  })
})

describe('② 공용 부품 셋이 유리를 쓴다', () => {
  it('확인창(ConfirmHost) — 가운데 유리 카드 + 같은 뒤 막', () => {
    const s = code('src/components/ui/confirm-dialog.tsx')
    expect(s).toMatch(/grid place-items-center[^"]*ur-veil/)
    expect(s).toMatch(/className="ur-glass ur-dialog-in[^"]*ur-pop-card/)
    expect(s).not.toMatch(/\bbg-black\/\d{2}\b/) // 막(2자리 %) — 버튼 눌림 `active:bg-black/5` 는 막이 아니다
  })
  it('시트 셸 — 폰에서 떠 있는 유리 판', () => {
    const s = code('src/pages/user-profile/seller-section/Sheet.tsx')
    expect(s).toMatch(/fixed inset-0 ur-veil ur-sheet-veil/)
    expect(s).toMatch(/fixed inset-x-2 bottom-2 [^']*ur-pop-sheet ur-glass/)
  })
  it('알림(토스트) — 유리 알약', () => {
    const s = code('src/components/ToastContainer.tsx')
    expect(s).toMatch(/className="ur-glass [^"]*ur-pop-toast/)
  })
})

describe('③ 소비자 화면은 뒤 막을 손으로 적지 않는다', () => {
  /** 일부러 남긴 것과 그 이유. 여기에 새 파일을 더하는 것은 "그 화면만 다른 모양" 을 허락하는 결정이다. */
  const ALLOWED: Record<string, string> = {
    'src/components/AdminLayout.tsx': '어드민 사이드바(대시보드)',
    'src/components/BulkUploadModal.tsx': '셀러 대량 등록(대시보드 도구)',
    'src/components/auth/SellerPinPrompt.tsx': '셀러 PIN(대시보드 도구)',
    'src/components/voucher/VoucherScanner.tsx': '매장용 스캐너(카메라 위)',
    'src/pages/MallHomePage.tsx': '공구 서비스(운영자 몰) — 다른 서비스',
    'src/pages/StoreStatsPage.tsx': '전체화면 확대 보기',
    'src/pages/group-buy/DetailGallery.tsx': '전체화면 사진 보기',
    'src/pages/marketing/AdsTossPayModal.tsx': '유어애즈 — 다른 서비스',
  }
  const files = execSync("git ls-files 'src/*.tsx' 'src/**/*.tsx'", { encoding: 'utf-8' })
    .split('\n').filter(Boolean)
    .filter((f) => !/pages\/(Admin|Seller|Agency|admin|seller|agency|wholesale|supplier|agency-console)|components\/(admin|seller|agency|dashboard)|\/tests\//.test(f))

  it('측정이 헛돌지 않는다 — 유리를 쓰는 소비자 파일이 충분하다', () => {
    const users = files.filter((f) => /\bur-glass\b/.test(readFileSync(f, 'utf-8')))
    expect(users.length, '유리를 쓰는 파일이 거의 없다 — 이행이 되돌아갔거나 검사 대상이 비었다').toBeGreaterThan(30)
  })

  it('새 팝업이 bg-black/NN 뒤 막을 손으로 적지 않는다 (→ .ur-veil)', () => {
    const bad = files
      .filter((f) => !(f in ALLOWED))
      .filter((f) => /fixed inset-0[^"`]*\bbg-black\/\d+|absolute inset-0 bg-black\/\d+"/.test(code(f)))
    expect(bad, `손으로 적은 뒤 막: ${bad.join(', ')}\n→ ur-veil 을 쓰고, 판은 ur-glass + ur-pop-card|sheet`).toEqual([])
  })
})
