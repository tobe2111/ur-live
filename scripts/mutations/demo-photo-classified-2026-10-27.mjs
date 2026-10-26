/**
 * 🧬 주입 — 데모 사진 분류 보충(2026-10-27). 가드: src/tests/unit/demo-photos-classified-2026-10-27.test.ts
 */
const T = 'src/tests/unit/demo-photos-classified-2026-10-27.test.ts'
export default [
  {
    name: 'demo-photo-cls — 미용·기타에도 음식 사진을 넣는다',
    file: 'src/worker/utils/kakao-place-photos.ts',
    find: "category === 'meal_voucher' ? ['FOOD', 'INDOOR', 'OUTDOOR'] : ['INDOOR', 'OUTDOOR']",
    replace: "category === 'meal_voucher' ? ['FOOD', 'INDOOR', 'OUTDOOR'] : ['FOOD', 'INDOOR', 'OUTDOOR']",
    test: T,
    why: '미용실 이용권에 남의 음식 사진이 앉는다(업종과 무관한 사진).',
  },
  {
    name: 'demo-photo-cls — 개수 0 인 태그도 부른다',
    file: 'src/worker/utils/kakao-place-photos.ts',
    find: '    if ((mine?.counts?.[key] ?? 0) <= 0) continue',
    replace: '    void key',
    test: T,
    why: '사진 없는 태그로 서브리퀘스트(무료 50)를 데모마다 헛되이 쓴다.',
  },
  {
    name: 'demo-photo-cls — 재조정이 종류를 안 넘긴다',
    file: 'src/worker/cron/demo-image-rehost.ts',
    find: '      category: row.category,             // 분류 사진 태그(식사=음식 먼저)',
    replace: '',
    test: T,
    why: '기존 식당 데모가 음식 사진 없이 가게 안·밖 사진만 받는다.',
  },
  {
    name: 'demo-photo-cls — 분류 사진 보충이 빠진다',
    file: 'src/worker/utils/demo-photo-set.ts',
    find: 'fetchKakaoPlacePhotos(opts.placeId, want, classifiedTagsFor(opts.category))',
    replace: 'fetchKakaoPlacePhotos(opts.placeId, want)',
    test: T,
    why: '업체 사진이 있는 15% 외에는 사진을 못 구해 3장이 안 채워진다(photoShort 309).',
  },
{
    name: 'demo-photo-cls — 발행이 사진 1장이어도 올린다',
    file: 'src/features/admin/api/admin-products.routes.ts',
    find: 'if (resolvedImgSets[i].length < DEMO_MIN_PHOTOS) { skippedNoPhoto++; continue; }',
    replace: 'if (resolvedImgSets[i].length < 1) { skippedNoPhoto++; continue; }',
    test: T,
    why: '새로 발행한 데모가 사진 1~2장으로 올라간다(대표: 발행 때 3장 보장).',
  },
  {
    name: 'demo-photo-cls — 숙소 발행이 사진 1장이어도 올린다',
    file: 'src/features/admin/api/admin-stays.routes.ts',
    find: 'if (imgs.length < DEMO_MIN_PHOTOS) { skippedNoPhoto++; continue }',
    replace: 'if (imgs.length === 0) { skippedNoPhoto++; continue }',
    test: T,
    why: '숙소 데모만 사진 3장 기준이 빠진다.',
  },
  {
    name: 'demo-photo-cls — 카카오가 막히면 0장으로 보고 교체한다',
    file: 'src/worker/utils/kakao-place-photos.ts',
    find: '  if (!c) return null',
    replace: '  if (!c) return 0',
    test: T,
    why: '카카오가 잠깐 막힌 날 멀쩡한 데모가 통째로 다른 매장으로 바뀐다.',
  },
  {
    name: 'demo-photo-cls — 교체 후보의 사진 수를 안 본다',
    file: 'src/worker/cron/demo-store-swap.ts',
    find: '    if (imgs.length < DEMO_MIN_PHOTOS) continue',
    replace: '    if (imgs.length < 1) continue',
    test: T,
    why: '사진 1~2장인 매장으로 옮겨 3장 보장이 깨진다.',
  },
  {
    name: 'demo-photo-cls — 교체를 회차 제한 없이 한다',
    file: 'src/worker/cron/demo-image-rehost.ts',
    find: 'const SWAP_PER_RUN = 1',
    replace: 'const SWAP_PER_RUN = 99',
    test: T,
    why: '한 회차에 외부 요청이 몰려 서브리퀘스트 한도(무료 50)를 넘겨 다른 작업까지 죽는다.',
  },
]
