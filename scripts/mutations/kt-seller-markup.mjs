/**
 * 🧬 주입 — KT 교환권 **셀러 축** 마진율이 0 을 0 으로 읽는다 (2026-09-14)
 *
 * 소비자 축은 2026-09-02 에 고쳤는데 셀러 축 두 자리는 `Number(...) || 5` 로 남았다.
 * **당시 라이브 값이 `5` 라 결과가 같았고, 그래서 아무도 눈치채지 못했다** — 이 결함의
 * 성질이 그렇다. 어드민에서 0 을 저장하면 저장은 되고(`Number.isFinite` 검증) 읽는 쪽이
 * 5 로 되돌린다. 에러가 없어 "슬라이더를 0 으로 내렸는데 가격이 그대로"로만 보인다.
 */
const TEST = 'src/tests/unit/kt-alpha-markup-zero.test.ts'

export default [
  {
    name: '💰셀러 마진 조회가 0 을 삼키는 옛 형태로 되돌아간다',
    file: 'src/features/seller/api/seller-settlements.routes.ts',
    find: `    const markupPct = resolveKtSellerMarkupPct(settings?.value) // 0 은 0 (옛 \`|| 5\` 는 0 을 삼켰다 — markup.ts)`,
    replace: `    const markupPct = Number(settings?.value) || 5`,
    test: TEST,
    why:
      '`Number("0") === 0` 은 falsy 라 `|| 5` 가 5 로 되돌린다. 저장은 통과하고 읽기만 ' +
      '조용히 틀리는, 이 레포가 pagination 에서 이미 한 번 당한 클래스다.',
  },
  {
    name: '💰셀러 마진 두 번째 자리만 옛 형태로 남는다',
    file: 'src/features/seller/api/seller-settlements.routes.ts',
    find: `    const markupPct = resolveKtSellerMarkupPct(settingsMap.kt_alpha_markup_pct) // 0 은 0 (markup.ts)`,
    replace: `    const markupPct = Number(settingsMap.kt_alpha_markup_pct) || 5`,
    test: TEST,
    why:
      '한 자리만 고치면 화면마다 다른 마진이 나온다. 시험이 **개수 2**를 세는 이유이고, ' +
      '"둘 중 하나만" 이 실제로 빨간불인지 확인한다.',
  },
  {
    // 소비자 축에는 이 주입이 원래 있었는데 셀러 축엔 없었다 — 2026-09-14 CI 가
    // 그 비대칭을 드러내 주며 함께 채웠다(소비자 앵커가 두 곳에 걸린 그 실패).
    name: '💰셀러 클램프가 0 을 기본값으로 되돌린다 (함수 안에서 같은 함정 재발)',
    file: 'src/features/admin/api/admin-kt-alpha/markup.ts',
    find:
      `  if (!Number.isFinite(n)) return KT_SELLER_MARKUP_DEFAULT_PCT\n` +
      `  return Math.min(100, Math.max(0, n))\n`,
    replace:
      `  if (!Number.isFinite(n)) return KT_SELLER_MARKUP_DEFAULT_PCT\n` +
      `  return Math.min(100, Math.max(0, n || KT_SELLER_MARKUP_DEFAULT_PCT))\n`,
    test: TEST,
    why:
      '호출부만 지키면 함수 안에서 같은 형태로 되살아날 수 있다. 소비자 축은 이 자리를 ' +
      '이미 지키고 있었고, 셀러 축만 비어 있었다.',
  },
  {
    name: '💰셀러 기본값이 소비자 기본값(20)으로 뭉개진다',
    file: 'src/features/admin/api/admin-kt-alpha/markup.ts',
    find: `export const KT_SELLER_MARKUP_DEFAULT_PCT = 5`,
    replace: `export const KT_SELLER_MARKUP_DEFAULT_PCT = 20`,
    test: TEST,
    why:
      '두 축은 기본값이 다르다(소비자 20 · 셀러 5). 한 상수로 합치면 설정이 비어 있을 때 ' +
      '셀러 교환권 가격이 조용히 네 배 마진으로 뛴다.',
  },
]
