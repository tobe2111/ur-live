/**
 * ⌨️ 키보드가 화면을 줄일 때 · 🔑 등록 2단계 계좌 PIN 〔2026-11-11 대표 신고 두 건〕
 *
 * ① "검색창 때문에 화면이 제대로 안 보이는 문제" — `/store/new` 는 화면 높이를 꽉 잡는다(`h-dvh`). 키보드가 열리면 그만큼 줄고,
 *    입력칸 위의 초대 배너·안내·큰 제목이 자리를 먹어 검색 결과가 한 줄도 안 남았다. 입력 중엔 그 장식을 접는다
 *    (`.ur-kb-scope:has(input:focus) .ur-kb-hide`, 폰만).
 * ② "계좌 변경은 PIN 인증이 필요합니다" 토스트에서 멈춤 — `/store/bank` 가 412 `PIN_REQUIRED` 를 처리하지 않았다.
 *    마이의 `BankSheet` 처럼 그 자리에서 `PinSheet`(없으면 걸고 → 확인)를 열고, 끝나면 저장을 다시 한다.
 * 못 보는 것: 실제 기기 키보드 높이(그려서 봐야 한다) · `:has()` 를 모르는 아주 옛 브라우저(접히지 않을 뿐 깨지진 않는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')

describe('① 입력 중엔 장식을 접는다', () => {
  it('규칙 — 폰만, 입력 포커스일 때', () => {
    const css = read('src/index.css')
    expect(css).toMatch(/@media \(max-width: 1023\.98px\) \{\s*\.ur-kb-scope:has\(input:focus, textarea:focus\) \.ur-kb-hide \{ display: none; \}/)
  })
  it('/store/new — 단계 칸이 범위 · 초대 배너·안내·제목이 접힌다', () => {
    const page = read('src/pages/StoreClaimPage.tsx')
    expect(page).toMatch(/className=\{`ur-kb-scope flex-1 min-h-0 flex flex-col/)
    expect(page).toMatch(/<div className="ur-kb-hide"><AgencyInviteBanner/)
    expect(page).toMatch(/<div className="ur-kb-hide">\s*<p className="text-\[13px\] font-medium text-brand-text lg:hidden">매장 이용권 판매 등록/)
  })
  it('네이버 사진 시트도 같은 규칙', () => {
    const sheet = read('src/pages/store-new/NaverPhotoSheet.tsx')
    expect(sheet).toMatch(/className="ur-kb-scope ur-glass-solid/)
    expect(sheet).toMatch(/className="ur-kb-hide px-5 pt-4/)
  })
})

describe('② 등록 2단계 계좌 — PIN 을 그 자리에서', () => {
  it('412 PIN_REQUIRED 면 PinSheet 를 열고, 끝나면 다시 저장', () => {
    const page = read('src/pages/store-new/StoreBankPage.tsx')
    expect(page).toMatch(/res\?\.code === 'PIN_REQUIRED' && seat/)
    expect(page).toMatch(/setPinFor\(seat\)/)
    expect(page).toMatch(/onDone=\{\(\) => \{ setPinFor\(null\); void submit\(\) \}\}/)
  })
})
