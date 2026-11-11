/** 🧬 주입 — /videos?v= 첫 화면 표지. 가드: src/tests/unit/videos-first-cover-2026-11-11.test.ts */
const T = 'src/tests/unit/videos-first-cover-2026-11-11.test.ts'
export default [
  { name: '영상표지 — v 를 검사 없이 받는다(주소 글자가 HTML 에 들어간다)', file: 'src/shared/videos-first.ts', find: "  return v && /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null", replace: "  return v || null", test: T, why: '주소는 남이 만든다.' },
  { name: '영상표지 — 서버가 다른 폭의 표지를 그린다(사진을 두 번 받는다)', file: 'src/worker/utils/videos-first-screen.ts', find: "  const src = videosCoverSrc(videoId).replace(", replace: "  const src = videosCoverSrc(videoId).replace('width=640', 'width=320').replace(", test: T, why: '서버 그림과 앱 그림의 주소가 갈리면 깜빡인다.' },
  { name: '영상표지 — 워커 첫 화면 배선을 뺀다(다시 검은 화면)', file: 'src/worker/index.ts', find: "const videosFirst = buildVideosFirstScreen(videosStartIdOf(url.search) as string);", replace: "const videosFirst = '';", test: T, why: '공유 링크 첫 화면.' },
  { name: '영상표지 — 로딩 중 로더로 되돌린다(표지 → 어두운 화면 → 영상)', file: 'src/pages/VideosPage.tsx', find: "    if (startCoverId) return <div className={VIDEOS_FS_CLS.page}", replace: "    if (false) return <div className={VIDEOS_FS_CLS.page}", test: T, why: '서버가 그린 표지를 로더가 덮는다.' },
  { name: '영상표지 — 앱이 덮개를 비운 채 시작한다(목록이 오면 표지가 사라진다)', file: 'src/pages/VideosPage.tsx', find: "    initialCoverId: startCoverId,\n", replace: "", test: T, why: '재생기가 켜질 때까지 검은 화면.' },
  { name: '영상표지 — 첫 덮개도 넘김 시간으로 걷는다', file: 'src/pages/videos/useSlideTransition.ts', find: "moved.current ? COVER_MAX_MS : INITIAL_COVER_MAX_MS", replace: "COVER_MAX_MS", test: T, why: '느린 폰에서 재생기보다 덮개가 먼저 걷힌다.' },
]
