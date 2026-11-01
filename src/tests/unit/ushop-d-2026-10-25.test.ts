/**
 * 🛍️ 2026-10-25 (대표 *"유어샵은 D 대로 해줘"*) — 유어샵 D안(크기 위계·간격).
 *   시안: https://claude.ai/artifact/Ghiv1iHiF9TB4sUw4R9CZw "유어샵 D".
 *   ① 줄: 사진 88 · 위아래 20 · 상품명 15px **중간 굵기**(한 덩어리에 굵은 제목은 하나 — 굵기 ⑨) ·
 *      순번은 가게 줄 앞("1 · 가게")
 *   ② 탭: 선택만 굵게 + 잉크 밑줄, 나머지는 보통 굵기 회색(교환권 밑줄 탭과 같은 문법)
 *   ③ 옆 여백 20px(px-5)
 *   🔑 값은 `src/shared/ushop-row.ts` 한 곳 — 부품(DealRow plain·PinCategoryChips)과 워커 첫 화면이 같이 쓴다.
 *   ⚠️ 못 보는 것: 실제 렌더(그림) — `node scripts/visual-preview.mjs --route=/u/jiwon1228`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLAIN_CLS, PLAIN_THUMB_CLS, USHOP_TAB_CLS } from '@/shared/ushop-row'
import { CURATOR_FS_CLASS } from '@/worker/utils/curator-ssr-body'
import { readCode } from '../helpers/source-text'

const read = (p: string) => readFileSync(p, 'utf8')

describe('유어샵 D안', () => {
  it('① 줄 값 — 상품명은 중간 굵기, 사진 88, 위아래 20', () => {
    expect(PLAIN_CLS.title).toMatch(/\bfont-medium\b/)
    expect(PLAIN_CLS.title).not.toMatch(/\bfont-(bold|semibold|extrabold|black)\b/)
    expect(PLAIN_CLS.eyebrow, '가게 줄은 보통 굵기').not.toMatch(/\bfont-/)
    expect(PLAIN_THUMB_CLS).toBe('w-[88px] h-[88px]')
    expect(PLAIN_CLS.skin).toBe('px-0 py-5')
  })

  it('② 탭 — 굵기는 선택에만', () => {
    expect(USHOP_TAB_CLS, '공용 탭 클래스에 굵기가 없다(선택 분기만 굵게)').not.toMatch(/\bfont-/)
    const chips = read('src/pages/curator-page/PinCategoryChips.tsx')
    expect(chips).toMatch(/on \? 'border-brand font-bold/)
  })

  it('③ 옆 여백 20px — 헤더·칩 줄·목록', () => {
    const header = read('src/pages/curator-page/CuratorHeader.tsx')
    const page = read('src/pages/CuratorPage.tsx')
    // 🔄 2026-11-01 (2안): 옆 여백 20px(px-5) 은 그대로이고 **위 여백만** 조였다(pt-4→3 · mt-4→3 · pt-6→3).
    //   이 검사의 불변식은 '옆 여백 20px' 이므로 `px-5` 를 계속 묻고 위 여백 값은 따라간다.
    expect(header).toContain('flex items-center gap-4 px-5 pt-3')
    expect(header).toContain('mt-3 px-5 flex items-center justify-between gap-2')
    expect(page).toContain('max-w-3xl mx-auto px-5 pt-3 border-b border-rule')
    expect(page).toContain('max-w-3xl mx-auto px-5 pb-4 divide-y')
  })

  it('④ 워커 첫 화면이 같은 상수를 쓴다(두 벌 금지)', () => {
    expect(CURATOR_FS_CLASS.rowTitle).toBe(PLAIN_CLS.title)
    expect(CURATOR_FS_CLASS.rowEyebrow).toBe(PLAIN_CLS.eyebrow)
    expect(CURATOR_FS_CLASS.chip).toBe(USHOP_TAB_CLS)
    expect(CURATOR_FS_CLASS.rowThumb).toContain(PLAIN_THUMB_CLS)
    expect(CURATOR_FS_CLASS.row).toContain(PLAIN_CLS.skin)
    const dealRow = read('src/components/deal/DealRow.tsx')
    expect(dealRow).toMatch(/plain \? PLAIN_CLS\.title/)
  })
})

describe('PC 이름 한 줄 (2026-10-25 대표 "왜 정지원 이름이 1줄로 안되고 2줄이지?")', () => {
  const H = readFileSync('src/pages/curator-page/CuratorHeader.tsx', 'utf-8')
  /**
   * 🔄 2026-11-01 재조준 (대표 확정 **2안** — *"아무리 길어도 1줄"*).
   *   두 단언이 지키던 것은 **"이름이 한 줄로 읽힌다"** 하나였고, 수단이 둘이었다:
   *     ⓐ `break-keep` — 두 줄이 되더라도 음절 **중간**에서 끊지 않는다
   *     ⓑ `lg:flex-wrap` + `lg:basis-full` — PC 300px 열에서 버튼 줄을 아래로 내려 이름 칸 확보
   *   2안은 그 **수단 둘을 모두 대체**한다 — 버튼 묶음이 이름 줄을 떠나 로고 줄로 올라가고
   *   (폰·PC 공통), 이름은 `truncate` 로 **언제나 한 줄**이며 크기는 `ushopNameSizePx` 가 정한다.
   *   ⇒ 불변식을 수단이 아니라 **결과**로 다시 쓴다. 되돌리면 빨간불이 된다.
   */
  it('이름은 언제나 한 줄이다 — 크기는 SSOT 가 정하고, 넘치면 말줄임이 받는다', () => {
    expect(H, '한 줄 강제').toMatch(/truncate">\{curator\.name\}/)
    expect(H, '두 줄 허용으로 되돌아가지 않았다').not.toMatch(/line-clamp-2[^"]*">\{curator\.name\}/)
    expect(H, '크기는 SSOT 함수가 정한다').toMatch(/style=\{\{ fontSize: nameSize \}\}/)
    expect(H).toMatch(/const nameSize = ushopNameSizePx\(curator\.name\)/)
  })
  it('버튼 줄이 이름 줄 밖에 있다 — 폰·PC 모두(서버 첫 화면도 같은 클래스)', () => {
    expect(H, '이름 줄은 얼굴 + 이름뿐').toMatch(/gap-4 px-5 pt-3/)
    expect(H, '버튼 묶음은 오른쪽 끝').toMatch(/const cluster = \([\s\S]{0,120}ml-auto flex items-center gap-2 shrink-0/)
    // 🩸 판정은 **주석 제거본**으로 — 바로 위 주석이 그 두 클래스를 인용하므로 원문을 보면
    //   제 설명에 걸려 거짓 빨간불이 난다(이 레포가 반복해 밟은 자리).
    expect(readCode('src/pages/curator-page/CuratorHeader.tsx'), 'PC 만 내리던 장치는 되살리지 않는다')
      .not.toMatch(/lg:basis-full|lg:flex-wrap/)
    const S = readFileSync('src/worker/utils/curator-ssr-body.ts', 'utf-8')
    expect(S).toContain("nameRow: 'flex items-center gap-4 px-5 pt-3'")
    expect(S).toContain("cluster: 'ml-auto flex items-center gap-2 shrink-0'")
  })
})
