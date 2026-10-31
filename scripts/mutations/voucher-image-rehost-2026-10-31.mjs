/**
 * 🧬 주입 — 교환권 사진 원본 직행 + R2 이관(2026-10-31). 가드: src/tests/unit/voucher-image-rehost-2026-10-31.test.ts
 */
const T = 'src/tests/unit/voucher-image-rehost-2026-10-31.test.ts'
export default [
  {
    name: '교환권 사진 — giftishow 원본 직행을 없앤다',
    file: 'src/utils/cf-image.ts',
    find: '      if (isRawOnlyImageHost(host)) return src',
    replace: '      if (false && isRawOnlyImageHost(host)) return src',
    test: T,
    why: 'giftishow 가 CF 를 막아 리사이저가 83% 실패한다 — 다시 리사이저로 보내면 사진이 7초 기다렸다 깨진다.',
  },
  {
    name: '교환권 사진 — 이관 대상이 경로에 이름만 든 호스트까지 잡는다',
    file: 'src/worker/cron/voucher-image-rehost.ts',
    find: "      AND ${giftishowHostSql('p.image_url')}",
    replace: "      AND p.image_url LIKE 'https://%giftishow.com/%'",
    test: T,
    why: '경로에 giftishow.com 이 든 다른 호스트 사진을 우리 저장소로 옮겨 세탁하게 된다.',
  },
  {
    name: '교환권 사진 — 많이 팔린 순을 버린다',
    file: 'src/worker/cron/voucher-image-rehost.ts',
    find: '    ORDER BY COALESCE(p.sold_count, 0) DESC, p.id',
    replace: '    ORDER BY p.id',
    test: T,
    why: '2,260장을 옮기는 데 열흘 넘게 걸리는데, 사람들이 실제로 보는 사진이 맨 뒤로 밀린다.',
  },
  {
    name: '교환권 사진 — 성공 덮어쓰기에서 CAS 를 뺀다',
    file: 'src/worker/cron/voucher-image-rehost.ts',
    find: 'WHERE id = ? AND image_url = ?`)',
    replace: 'WHERE id = ? AND ? IS NOT NULL`)',
    test: T,
    why: '그 사이 어드민이 바꾼 사진 주소를 옛 사진으로 되덮는다.',
  },
]
