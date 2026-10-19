/**
 * 🧬 주입 — 홈 배너 옆 장 사진 미루기 · 숙소 대표색 (2026-10-19 대표 "홈 부분 우선적으로")
 */
const T = 'src/tests/unit/home-banner-defer-stays-color-2026-10-19.test.tsx'
export default [
  {
    name: '배너미루기 — 옆 장 사진을 첫 화면과 같이 받는다',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: 'deferImg={!warm && i >= perView}',
    replace: 'deferImg={false}',
    test: T,
    why: '안 보이는 2·3장(장당 ~45KB)이 맨 위 배너(LCP)와 회선을 나눠 쓴다.',
  },
  {
    name: '배너미루기 — 손이 닿아도 옆 장을 안 받는다',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: 'const hold = () => { setWarm(true); setHeldUntil',
    replace: 'const hold = () => { setHeldUntil',
    test: T,
    why: 'load 전에 넘기면 빈 장이 보인다.',
  },
  {
    name: '배너미루기 — 미룬 사진을 영영 안 받는다',
    file: 'src/components/home/HomeBannerStrip.tsx',
    find: 'useEffect(() => (many ? runAfterLoad(() => setWarm(true)) : undefined), [many])',
    replace: 'useEffect(() => undefined, [many])',
    test: T,
    why: '자동 넘김이 빈 장을 보여 준다.',
  },
  {
    name: '숙소대표색 — 검색 응답이 대표색을 안 싣는다',
    file: 'src/features/group-buy/api/stays-public.routes.ts',
    find: 'SELECT p.id, p.name, p.image_url, p.seller_id, p.dominant_color,',
    replace: 'SELECT p.id, p.name, p.image_url, p.seller_id,',
    test: T,
    why: '새 브라우저마다 숙소 전부의 색을 다시 뽑아 서버로 보낸다(POST 2회 · 서버는 버린다).',
  },
]
