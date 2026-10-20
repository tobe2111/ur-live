/**
 * 🎫 표면 클래스 철자 SSOT — 시험이 **hex 가 아니라 표면**을 가리키게 한다 (2026-09-15)
 *
 * ## 왜 생겼나
 * 코레일톡 체계의 두 표면은 값이 하나씩이다: **카드** `--surface`(#FFFFFF / #1D1F29) ·
 * **페이지** `--bg`(#F8F7FC / #11141C). 그런데 소스에는 **같은 값이 두 철자**로 적혀 있다:
 *
 * | 표면 | 토큰 철자 | 벌려 쓴 철자 |
 * |---|---|---|
 * | 카드 | `bg-surface` | `bg-white dark:bg-[#1D1F29]` |
 * | 페이지 | `bg-warm` | `bg-gray-50`·`bg-[#F8F7FC]` + `dark:bg-[#11141C]` |
 *
 * 2026-09-15 색 정리가 431곳을 토큰으로 접었고, **벌려 쓴 철자를 정규식에 박아 둔 시험 6건이
 * 정상인데 빨간불**이 났다(`voucher-wallet-split`·`dashboard-rinda-shell`·`consumer-popups-dark`
 * ×4·`deal-card-shapes`·`stay-detail-pc-booking-panel`).
 *
 * ⚠️ 그 시험들이 지키려던 것은 **"저 hex 가 적혀 있다"가 아니라 "이 자리가 다크를 아는 표면이다"** 다.
 * 그래서 지우지도, 한 철자만 남기지도 않고 **둘 다 받는 조각**을 여기 한 번만 적는다.
 * 다음에 또 접히면 고칠 곳은 이 파일 하나다.
 *
 * ## 쓰는 법 — 정규식 **조각**이라 앞뒤로 이어 쓸 수 있다
 * ```ts
 * expect(src).toMatch(new RegExp(`rounded-2xl ${CARD_BG} shadow-lift`))
 * expect(src).toMatch(CARD_BG_RE)
 * ```
 *
 * ## 이 파일이 **못** 하는 것
 * 그 자리가 정말 카드여야 하는지(페이지인지)는 안 본다 — 그건 눈과 시안의 몫이다.
 * 여기서 고정하는 것은 "철자가 달라졌다고 시험이 깨지지 않는다" 하나뿐이다.
 */

/** 카드 표면(`--surface`) — 토큰 또는 벌려 쓴 철자. */
export const CARD_BG = String.raw`(?:bg-surface\b|bg-white dark:bg-\[#1D1F29\])`

/** 페이지 표면(`--bg`) — 토큰 또는 벌려 쓴 철자. */
export const PAGE_BG = String.raw`(?:bg-warm\b|bg-(?:gray-50|\[#F8F7FC\]) dark:bg-\[#11141C\])`

/** 테두리(`--line`) — 토큰 또는 벌려 쓴 철자. */
export const LINE_BORDER = String.raw`(?:border-line\b|border-gray-200 dark:border-\[#2C2F35\])`

export const CARD_BG_RE = new RegExp(CARD_BG)
export const PAGE_BG_RE = new RegExp(PAGE_BG)

/**
 * "이 자리가 다크를 아는 배경을 갖는가" — 두 표면 어느 쪽이든.
 * 종전의 `/dark:bg-\[#/` 처럼 **다크 대응 유무만** 묻던 자리에 쓴다.
 */
export const DARK_AWARE_BG = String.raw`(?:bg-surface\b|bg-warm\b|dark:bg-\[#)`
export const DARK_AWARE_BG_RE = new RegExp(DARK_AWARE_BG)
