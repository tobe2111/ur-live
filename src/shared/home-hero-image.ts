/**
 * 🏔️ 홈 히어로 사진 — 클라이언트 렌더와 워커 preload 가 **반드시 같아야 하는 값들**.
 *
 * preload 는 URL 이 byte-일치할 때만 쓰인다. 폭·품질이 한쪽에서만 바뀌면 preload 가 버려지고
 * 96KB 를 두 번 받는다 — 에러도 없고 화면도 멀쩡한데 더 느려진다. 그래서 상수를 한곳에 둔다.
 */

/** `cfImage` 요청 폭. 2026-08-22 에 900 → 1280 으로 올렸다(레티나에서 흐렸다). */
export const HOME_HERO_REQUEST_WIDTH = 1280
export const HOME_HERO_QUALITY = 76

/**
 * 사진이 실제로 보이는 구간. `HomeHeroDefault` 의 사진 컨테이너가 `hidden md:block` 이므로 768px.
 * ⚠️ 이 값을 컨테이너와 다르게 두면 폰이 안 보이는 96KB 를 받거나, PC 가 preload 를 못 받는다.
 */
export const HOME_HERO_MEDIA_QUERY = '(min-width: 768px)'
