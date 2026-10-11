/**
 * 🔎 상세 히어로를 진짜 <img> 로 (2026-10-11) — 주입 매니페스트.
 * 가드: src/tests/unit/detail-hero-img-2026-10-11.test.ts
 */
const TEST = 'src/tests/unit/detail-hero-img-2026-10-11.test.ts'

export default [
  {
    name: '🔎 히어로 — 서버가 <img> 를 안 그리고 CSS 배경으로 되돌아간다',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: '`<img src="${escAttr(heroUrl)}" alt="${escAttr(d.name)}" loading="eager" fetchpriority="high" decoding="async"` +\n            ` style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` +',
    replace: '`` +',
    test: TEST,
    why: '라이브가 정확히 이 상태였다 — 사진은 보이는데 구글 이미지가 그 페이지에 못 붙인다(에러 0, 화면도 멀쩡).',
  },
  {
    name: '🔎 히어로 — 서버 <img> 의 alt 가 비어 색인에 이름을 말하지 않는다',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: 'alt="${escAttr(d.name)}"',
    replace: 'alt=""',
    test: TEST,
    why: 'alt 없는 <img> 는 "사진이 있다"만 말하고 **무엇인지** 말하지 않는다 — 대표가 신고한 증상이 그대로 남는다.',
  },
  {
    name: '🔎 히어로 — 서버 <img> 가 배경과 다른 URL 을 받아 사진을 두 번 내려받는다',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: '`<img src="${escAttr(heroUrl)}"',
    replace: '`<img src="${escAttr(heroUrl)}?v=2"',
    test: TEST,
    why: '한 글자만 달라도 브라우저가 요청을 재사용하지 못한다 — 2026-09-02 에 같은 히어로를 세 벌 받던 그 사고.',
  },
  {
    name: '🔎 히어로 — 슬라이드에서 relative 가 빠져 절대배치 <img> 가 칸을 벗어난다',
    file: 'src/worker/utils/detail-ssr-body.ts',
    find: '`<div style="position:relative;flex:0 0 100%;',
    replace: '`<div style="flex:0 0 100%;',
    test: TEST,
    why: '포함 블록이 없으면 사진이 페이지 전체 기준으로 깔린다 — 빌드는 초록이고 폰에서만 깨진다.',
  },
  {
    name: '🔎 히어로 — React 슬라이드가 <img> 를 잃고 배경만 남아 서버와 어긋난다',
    file: 'src/pages/group-buy/DetailGallery.tsx',
    find: '                    src={hi}\n                    alt={alt}',
    replace: '                    src=""\n                    alt={alt}',
    test: TEST,
    why: '서버만 <img> 면 마운트 순간 사진이 사라진다 — 서버·React 가 같은 구조라야 안 밀린다.',
  },
  {
    name: '🔎 히어로 — React 슬라이드의 밑깔개 두 겹 배경이 사라져 체감이 느려진다',
    file: 'src/pages/group-buy/DetailGallery.tsx',
    find: '                  backgroundImage: hi ? layered(hi, src) : undefined,',
    replace: '                  backgroundImage: undefined,',
    test: TEST,
    why: '카드에서 이미 받은 저해상이 클릭 즉시 그려지던 것(2026-09-02)을 잃는다 — 추가 요청 없이 얻던 이득이다.',
  },
  {
    name: '🔎 히어로 — 보이는 <img> 에 onError 가 없어 죽은 사진이 깨진 아이콘으로 남는다',
    file: 'src/pages/group-buy/DetailGallery.tsx',
    find: '                    onError={() => setDead((prev) => (prev.has(src) ? prev : new Set(prev).add(src)))}\n                  />',
    replace: '                  />',
    test: TEST,
    why: '모바일 숨은 프로브를 이 <img> 가 대체했으므로, 여기서 onError 가 빠지면 감시가 통째로 사라진다.',
  },
]
