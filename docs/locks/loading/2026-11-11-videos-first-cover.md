# 2026-11-11 [LOADING_ADDITIVE] `/videos?v=…` 서버 첫 화면 = 표지 한 장 (`src/worker/index.ts`)

- **왜**: 공유 링크로 영상에 곧장 들어오면 앱(1.5초)·목록·유튜브 재생기가 다 올 때까지 **검은 화면**이었다. #2313 의 목록 preload 는 요청만 앞당겼고 화면은 그대로였다(FCP 1.5~1.8s).
- **무엇**: 표지 주소는 영상 번호만으로 정해진다(`youTubeThumbUrl`) → 워커가 목록 없이 `#root` 에 검은 바탕 + 표지 한 장을 넣고(`videos-first-screen.ts`), 같은 사진을 `Link: rel=preload; as=image` 로 미리 보낸다. 폰 + 유효한 `v`(11자) 일 때만.
- **앱**: 로딩 중 로더 대신 같은 표지 · 덮개를 그 영상으로 시작해 재생이 시작될 때까지 잇는다(첫 영상은 `INITIAL_COVER_MAX_MS` 6초 상한).
- **성격**: 추가만. 기존 SSR 주입·HOT_PATHS·캐시 헤더 무변경, `index.ts` 2672줄 유지(기존 줄에 이어 붙임). 서버 HTML 은 데이터 조회 0(응답 시간 불변).
- **주소 SSOT**: `src/shared/videos-first.ts`(`videosStartIdOf` · `videosCoverSrc`) — 화면·워커·Link 가 같이 쓴다.
- **가드**: `videos-first-cover-2026-11-11.test.ts` 6건 + 주입 6건. 옛 주입 2건·시험 1건 재조준.
- **롤백**: 워커의 `/videos` 분기와 Link 한 조각 제거(앱 쪽은 서버 그림이 없어도 동작한다).
- **못 막는 것**: `v` 가 우리 목록에 없는 유튜브 영상이어도 그 표지가 잠깐 보인다 · 데이터 절약 모드 손님은 화질 값이 달라 사진을 한 번 더 받는다.
