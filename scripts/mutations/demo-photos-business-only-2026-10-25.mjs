/**
 * 🧬 주입 — 데모 사진은 지도 등록 사진뿐 + 최소 3장 영구 재시도 (2026-10-25)
 */
const T = 'src/tests/unit/demo-photos-business-only-2026-10-25.test.ts'
export default [
  {
    name: '데모사진 — 이름이 안 맞으면 첫 결과(다른 가게)로 떨어진다',
    file: 'src/worker/utils/naver-place-photo.ts',
    find: "  }) || null\n}",
    replace: "  }) || list[0] || null\n}",
    test: T,
    why: '검색 첫 결과는 다른 가게일 수 있다 — 그 가게의 사진이 데모에 박힌다.',
  },
  {
    name: '데모사진 — 리뷰·블로그 사진도 업체 사진으로 센다',
    file: 'src/worker/utils/naver-place-photo.ts',
    find: "const BUSINESS_PHOTO_HOST = /^https:\\/\\/ldb-phinf\\.pstatic\\.net\\//i",
    replace: "const BUSINESS_PHOTO_HOST = /^https:\\/\\//i",
    test: T,
    why: '업체가 고른 사진이 아니라 영수증·얼굴이 섞인 방문자 사진이 들어온다.',
  },
  {
    name: '데모사진 — 3장 미만이어도 재시도를 예약하지 않는다',
    file: 'src/worker/cron/demo-image-rehost.ts',
    find: "demo_photo_retry_after: gallery.length < DEMO_MIN_PHOTOS ? retryAt() : '',",
    replace: "demo_photo_retry_after: '',",
    test: T,
    why: '"최소 3장" 이 다시 한 번 맞추고 끝나는 규칙이 된다(대표가 지적한 그 결함).',
  },
  {
    name: '데모사진 — 시도 소진이 영구 포기가 된다',
    file: 'src/worker/cron/demo-image-rehost.ts',
    find: "demo_cond_tries: '0', demo_photo_retry_after: retryAt() }",
    replace: "demo_cond_tries: '0' }",
    test: T,
    why: '세 번 실패한 데모는 영영 다시 안 채워진다.',
  },
  {
    name: '데모사진 — 3장 미만 개수를 하트비트에 안 남긴다',
    file: 'src/worker/cron/demo-image-rehost.ts',
    find: 'result.photoShort = await countDemoPhotoShort(env).catch(() => -1)',
    replace: 'void countDemoPhotoShort',
    test: T,
    why: '수를 안 세면 규칙이 깨져도 아무도 모른다 — 지금까지가 그랬다.',
  },
]
