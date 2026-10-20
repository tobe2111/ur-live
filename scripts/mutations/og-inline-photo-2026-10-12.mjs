/**
 * 🖼️ OG 카드 사진 인라인 (2026-10-12 대표 신고 *"유어샵 링크 공유했는데 이렇게 보이면 너무 투박하잖아"*)
 * — 주입 매니페스트. 가드: src/tests/unit/og-inline-photo-2026-10-12.test.ts
 *
 * 라이브 실측으로 드러난 것: 카드가 투박한 게 아니라 **사진이 한 장도 안 박히고 있었다**
 * (`/api/og/curator/jiwon1228` → 1,694B · `<image>` 0개). 아래 주입들은 그 수리가 **조용히**
 * 되돌아가는 것을 막는다 — 되돌려도 에러가 안 나고 카드는 계속 200 으로 나간다.
 */
const T = 'src/tests/unit/og-inline-photo-2026-10-12.test.ts'
const F = 'src/worker/utils/og-inline-image.ts'

export default [
  {
    name: '🖼️OG cf.image 를 떼어 다시 /cdn-cgi 만 쓴다 (워커 안에서는 안 먹는다)',
    file: F,
    // 🔁 2026-10-12 재조준: `fit`/`gravity` 가 `cfFit(fitOpts)` 로 빠졌다(유달이를 `contain` 으로
    //   받으려고 — 같은 날 유어샵 카드 작업). 지키려던 결함은 그대로 — cf.image 줄을 떼면
    //   워커 안에서 원본이 와서 상한에 걸리고 사진이 0장으로 돌아간다.
    find: "      cf: { image: { width, height, ...cfFit(fitOpts), quality: 70, format: 'jpeg' } },\n",
    replace: '',
    test: T,
    why: '`/cdn-cgi/image/…` 는 들어오는 요청에 대한 엣지 기능이라 워커 서브리퀘스트는 그 파이프라인을 안 탄다. 떼면 원본이 와서 상한에 걸리고 사진이 0장으로 돌아간다.',
  },
  {
    name: '🖼️OG 워커가 자기 자신을 다시 부른다 (/api/media R2 매핑 제거)',
    file: F,
    find: '  return m ? `${R2_PUBLIC_HOST}/${m[1]}` : abs',
    replace: '  return abs',
    test: T,
    why: '타일이 `/api/media/<key>` 라 매핑이 없으면 워커가 자기 자신을 다시 부른다(서브리퀘스트 낭비 + 리사이즈 불가).',
  },
  {
    name: '🖼️OG 그림이 아닌 응답(SPA HTML)을 jpeg 라고 박는다',
    file: F,
    find: "  if (!ct) return true\n  return ct.startsWith('image/')",
    replace: '  return true',
    test: T,
    why: '자기-자신 호출이 SPA 셸을 200 으로 돌려주면 깨진 그림이 카드에 박힌다 — 빈 칸보다 나쁘고 에러는 0이다.',
  },
  {
    name: '🖼️OG cf.image 결과를 틀린 MIME 으로 박는다 (렌더러가 못 읽는다)',
    file: F,
    find: '      if (buf.byteLength && buf.byteLength <= OG_INLINE_MAX_BYTES) {\n        return `data:image/jpeg;base64,',
    replace: '      if (buf.byteLength && buf.byteLength <= OG_INLINE_MAX_BYTES) {\n        return `data:image/svg+xml;base64,',
    test: T,
    why: 'jpeg 를 svg 라고 적으면 카톡 렌더러가 통째로 버린다 — 사진 자리만 비고 에러는 0이다.',
  },
  {
    name: '🖼️OG 바인딩 경로가 다시 자기-자신 주소를 받는다',
    file: F,
    find: "      const srcRes = await fetchImpl(src, { headers: { Accept: 'image/*' } })",
    replace: "      const srcRes = await fetchImpl(abs, { headers: { Accept: 'image/*' } })",
    test: T,
    why: 'Images 바인딩이 연결되는 날 그 경로만 다시 워커를 부르게 된다 — 한쪽만 고치면 반쪽이 샌다.',
  },
]
