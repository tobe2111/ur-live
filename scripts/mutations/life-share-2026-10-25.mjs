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
    name: '🔗 공유 페이지가 사진 주소를 내보낸다',
    file: 'src/shared/home-service-share.ts',
    find: "    if (f.type === 'photos') { photoCount = v.split(',').filter(Boolean).length; continue }",
    replace: "    if (f.type === 'photos') { photoCount = v.split(',').filter(Boolean).length }",
    test: TEST,
    why: '현장 사진은 가입한 업체에게만 — 공개 페이지에는 장수만.',
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
]
