/**
 * 🧬 매장 등록 뒤 화면들(사진 필수 · 내 사진 우선 · ⑥⑦ 소비자 화면) — 되돌려-검증 주입 (2026-11-03).
 * 지키는 계약: `src/tests/unit/store-new-photos-2026-11-03.test.ts` 머리말.
 */
const T = 'src/tests/unit/store-new-photos-2026-11-03.test.ts'
export default [
  {
    name: '📷 사진 없이도 이용권이 올라간다 (대표 "사진이 없으면 막자")',
    file: 'src/pages/store-new/FirstVoucherPage.tsx',
    find: "const blockReason = photos.length === 0 ? '사진을 1장 이상 올려 주세요' : null",
    replace: 'const blockReason = null as string | null',
    test: T,
    why: '사진 없는 이용권은 카드에 아이콘만 뜬다 — 대표가 막으라고 정한 자리다.',
  },
  {
    name: '📷 네이버 사진이 자동으로 담긴다 (남의 사진이 사장님 확인 없이 대표 사진이 된다)',
    file: 'src/pages/store-new/VoucherPhotos.tsx',
    find: 'searchNaverPhotos(baseQuery, 9).then((u) => { if (alive) setSuggest(u) })',
    replace: "searchNaverPhotos(baseQuery, 9).then((u) => { if (alive) { setSuggest(u); onChange(u.slice(0, 1).map((url) => ({ url, from: 'naver' as const }))) } })",
    test: T,
    why: '네이버 이미지 검색 결과는 블로그 사진일 수 있다 — 사장님이 고른 것만 넣는다.',
  },
  {
    name: '📷 업로드 실패가 data URL 사진으로 위장된다',
    file: 'src/pages/store-new/upload-photo.ts',
    find: "    return { ok: false, message: '사진을 올리지 못했어요. 다시 시도해 주세요' }\n  } catch",
    replace: "    return { ok: true, url: 'data:image/webp;base64,' }\n  } catch",
    test: T,
    why: '필수 칸을 안 올라간 사진으로 채우면 막은 의미가 없다.',
  },
  {
    name: '🏦 가려진 계좌(****1234)가 칸에 채워져 그대로 저장된다',
    file: 'src/pages/store-new/StoreBankPage.tsx',
    find: "        if (d.account_holder) setHolder(String(d.account_holder))",
    replace: "        if (d.account_holder) setHolder(String(d.account_holder))\n        if (d.bank_account) setAccount(String(d.bank_account))",
    test: T,
    why: '서버는 계좌를 가려서 준다 — 그 값을 칸에 넣으면 사장님이 모르고 가린 값을 저장해 정산이 멈춘다.',
  },
]
