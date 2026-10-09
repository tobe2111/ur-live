/**
 * 🛍️ 유어샵 카톡 공유 카드 (2026-09-28 대표 *"이 형태 너무한데?"*) — 주입 매니페스트.
 * 가드: src/tests/unit/ushop-og-card-2026-09-28.test.ts
 */
const TEST = 'src/tests/unit/ushop-og-card-2026-09-28.test.ts'
const CARD = 'src/worker/utils/og-curator-card.ts'
const INLINE = 'src/worker/utils/og-inline-image.ts'
const ROUTE = 'src/worker/routes/og-image.routes.ts'
const WORKER = 'src/worker/index.ts'

export default [
  {
    name: '🛍️ 카드가 사진을 다시 바깥에서 불러온다 (라이브를 까맣게 만든 그 결함)',
    file: ROUTE,
    find: 'inlineImage(t, origin, tw, TILE_H)',
    replace: 't',
    test: TEST,
    why:
      '카톡 스크래퍼는 SVG 를 굽기만 하고 그 안의 외부 사진은 안 가져온다. 되돌리면 카드가 다시 ' +
      '글자만 남은 까만 판이 된다 — 에러도 로그도 없고 공유해 본 사람만 안다.',
  },
  {
    name: '🛍️ 프로필 사진만 다시 외부 참조로',
    file: ROUTE,
    find: 'inlineImage(curator.profile_image, origin, 232, 232)',
    replace: 'curator.profile_image',
    test: TEST,
    why: '타일만 고치고 프로필을 빠뜨리면 얼굴 자리가 빈 원으로 남는다. 절반만 고친 상태가 제일 헷갈린다.',
  },
  {
    name: '🛍️ 사진이 0장일 때 빈 칸 4개를 보여준다',
    file: CARD,
    find: 'const tiles = tileUris.filter(Boolean).slice(0, 4)',
    replace: 'const tiles = [0, 1, 2, 3].map(i => tileUris[i] || \'\')',
    test: TEST,
    why:
      '종전 카드가 정확히 이랬다 — 사진을 못 받으면 빈 사각형 4개가 남는데, 바탕과 색이 비슷해 ' +
      '"디자인이 원래 저런가" 로 보인다. 사진이 없으면 타일 줄 자체를 빼야 한다.',
  },
  {
    name: '🛍️ 타일이 줄을 안 채우고 오른쪽이 휑해진다',
    file: CARD,
    find: 'return n > 0 ? (TILE_ROW_W - TILE_GAP * (n - 1)) / n : 0',
    replace: 'return n > 0 ? 236 : 0',
    test: TEST,
    why:
      '고정 폭이면 4장일 때만 줄이 맞고 1~3장이면 오른쪽이 빈다. 첫 렌더에서 실제로 그랬고, ' +
      '핀을 3개만 꽂은 사람(=대부분)이 그 카드를 받는다.',
  },
  {
    name: '🛍️ 받는 크기를 카드와 다른 식으로 정한다',
    file: ROUTE,
    find: 'const tw = Math.round(tileWidth(thumbs.length))',
    replace: 'const tw = 300',
    test: TEST,
    why:
      '정사각으로 받아 가로로 긴 타일에 늘려 넣으면 피사체가 잘리거나 흐려진다. 카드와 요청이 ' +
      '같은 식을 쓰지 않으면 디자인을 바꿀 때마다 조용히 어긋난다.',
  },
  {
    name: '🛍️ 이름을 안 잘라 카드 밖으로 넘친다',
    file: CARD,
    find: 'const name = clamp(curator.name || curator.handle, 15)',
    replace: 'const name = String(curator.name || curator.handle)',
    test: TEST,
    why: '18자로 뒀을 때 실제로 카드 오른쪽을 넘었다. 넘친 글자는 잘려 나가 이름이 틀리게 보인다.',
  },
  {
    name: '🛍️ 까만 바탕으로 되돌아간다',
    file: CARD,
    find: '<rect width="1200" height="630" fill="#F8F7FC"/>',
    replace: '<rect width="1200" height="630" fill="#11141C"/>',
    test: TEST,
    why:
      '카톡 대화방은 대개 어둡다. 다크 카드는 배경에 묻혀 "링크가 깨진 것처럼" 보이고, ' +
      '그게 대표가 신고한 화면이다.',
  },
  {
    name: '🛍️ 이름·소개의 태그를 이스케이프하지 않는다',
    file: CARD,
    find: "return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')",
    replace: 'return s.replace(/\\u0000/g, "")',
    test: TEST,
    why: '유저가 정한 이름·소개가 그대로 들어간다 — `<` 하나로 SVG 가 깨져 카드가 통째로 안 나온다.',
  },
  {
    name: '🛍️ 과대 이미지도 그대로 박는다',
    file: INLINE,
    find: 'if (!buf.byteLength || buf.byteLength > OG_INLINE_MAX_BYTES) return null',
    replace: 'if (!buf.byteLength) return null',
    test: TEST,
    why:
      '리사이저를 못 탄 원본(수 MB)이 그대로 base64 로 박히면 SVG 가 MB 단위가 된다. ' +
      '스크래퍼가 타임아웃으로 포기하면 카드가 아예 안 뜬다.',
  },
  {
    name: '🛍️ 사진을 못 받았는데 실패를 안 삼킨다',
    file: INLINE,
    find: '  } catch {\n    return null\n  }',
    replace: '  } catch (e) {\n    throw e\n  }',
    test: TEST,
    why:
      '사진 한 장을 못 받았다고 OG 라우트가 500 을 내면 카드가 **통째로** 사라진다. ' +
      '사진은 있으면 좋은 것이고 카드는 없어도 나와야 한다.',
  },
  {
    name: '🛍️ AVIF/WebP 로 받아 굽는 쪽이 못 읽는다',
    file: INLINE,
    find: 'quality=70,format=jpeg',
    replace: 'quality=70,format=auto',
    test: TEST,
    why:
      '`format=auto` 는 Accept 를 보고 AVIF/WebP 를 준다. 우리 화면이 아니라 **남의 렌더러**가 ' +
      '굽는 자리라, 여기서 아끼는 바이트보다 "안 보인다"의 대가가 훨씬 크다.',
  },
  {
    name: '🛍️ 카드 주소의 판 번호를 뺀다',
    file: WORKER,
    find: "/api/og/curator/${encodeURIComponent(cur.handle || '')}?v=3",
    replace: "/api/og/curator/${encodeURIComponent(cur.handle || '')}",
    test: TEST,
    why:
      '카카오는 스크랩 결과를 캐시한다. 주소가 그대로면 고쳐 배포해도 옛 까만 카드가 계속 나가고, ' +
      '잘못 나간 카드는 회수할 방법이 우리에게 없다.',
  },
]
