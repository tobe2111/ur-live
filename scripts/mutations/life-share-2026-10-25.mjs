// 🔗 생활 요청 공유 페이지 (2026-10-25) — `src/tests/unit/life-share-2026-10-25.test.ts` 가 잡아야 하는 결함.
const TEST = 'src/tests/unit/life-share-2026-10-25.test.ts'
export default [
  {
    name: '🔗 공유 페이지가 메모 칸을 값으로 내보낸다',
    file: 'src/shared/home-service-share.ts',
    find: "    if (f.type === 'textarea' || f.type === 'text') { hasMemo = true; continue }",
    replace: "    if (f.type === 'textarea' || f.type === 'text') { hasMemo = true }",
    test: TEST,
    why: '메모 칸은 "가게 이름" 을 받는다 — 공개 페이지에 나가면 손님 가게가 특정된다.',
  },
  {
    // 📷 2026-11-04 재조준 — 대표 *"사진도 말이야"* 로 사진은 이제 보인다. 지키는 것은 **올린 사진 모양의 주소만** 나간다는 것.
    name: '🔗 공유 페이지가 아무 주소나 사진으로 내보낸다',
    file: 'src/shared/home-service-share.ts',
    find: 'photos = all.filter(isRequestPhotoUrl).slice(0, SHARE_PHOTOS_MAX)',
    replace: 'photos = all.slice(0, SHARE_PHOTOS_MAX)',
    test: TEST,
    why: '업로드 경로가 아닌 주소(외부 링크·다른 사람 파일)가 공개 카드에 실린다.',
  },
  {
    name: '🔗 이름을 통째로 보인다',
    file: 'src/shared/home-service-share.ts',
    find: ".trim().slice(0, 1) || '손님'}**`",
    replace: ".trim() || '손님'}**`",
    test: TEST,
    why: '대표 "이름 마스킹" — 첫 글자만.',
  },
  {
    name: '🔗 지역이 번지까지 나간다',
    file: 'src/shared/home-service-share.ts',
    find: "  const region = (d[regionKey] || '').split(/\\s+/).slice(0, 3).join(' ')",
    replace: "  const region = (d[regionKey] || '')",
    test: TEST,
    why: '상세 주소 마스킹 — 동까지만.',
  },
  {
    name: '🔗 사이트맵이 마감된 요청도 제출한다',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: "WHERE status = 'open' AND quote_count < max_quotes AND share_token IS NOT NULL",
    replace: "WHERE share_token IS NOT NULL",
    test: TEST,
    why: '마감은 noindex 인데 제출하면 "색인 요청 ↔ noindex" 모순.',
  },
  {
    name: '🔗 마감 요청도 색인된다',
    file: 'src/worker/utils/life-share-ssr.ts',
    find: '    noindex: !v.open,',
    replace: '    noindex: false,',
    test: TEST,
    why: '검색에서 와도 할 수 있는 일이 없는 페이지가 색인된다.',
  },
  {
    name: '🔗 주소 검색창이 React 글자를 다시 지운다',
    file: 'src/pages/life/request/AddressSheet.tsx',
    find: '      setReady(true)\n',
    replace: '      box.current.innerHTML = \'\'\n      setReady(true)\n',
    test: 'src/tests/unit/life-address-sheet-2026-10-25.test.tsx',
    why: '주소를 고르는 순간 removeChild 오류로 오류 화면(대표 신고 2026-10-25).',
  },
]
