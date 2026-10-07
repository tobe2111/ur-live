/**
 * 🦦 로딩 화면의 유달이 — 서버가 그린 정적 로더와 앱 로더가 **같은 그림·같은 크기·같은 위상**이어야 한다
 * (2026-10-07 대표 허가 "로딩 화면"). 둘이 하나라도 다르면 로더가 바뀌는 순간 화면이 튄다 —
 * 대표가 2026-07-01 에 금지한 "로딩 화면 2~3개" 클래스다.
 *
 * 그래서 값은 여기 한 곳에만 둔다: 워커(`src/worker/index.ts` 의 `urdealLoaderHtml`)와
 * `BrandLoader` 가 같이 읽는다.
 *
 * ⚠️ 이미지가 해시 없는 고정 경로인 이유: 워커는 Vite 가 붙인 해시를 모른다. 대신 파일명에 버전(`-v2`)을
 *    박았다 — `/assets/*` 는 1년 immutable 캐시라 **그림을 바꾸면 반드시 다음 버전(v3) 새 파일**을 만들 것
 *    (같은 이름에 덮어쓰면 1년 동안 옛 그림이 나간다). 원본: `public/assets/mascot/`.
 */
export const UDAL_LOADER_SRC = '/assets/mascot/udal-loader-v2.webp'

/** 로고 크기(px)에 맞춘 유달이 가로(px). 기본 로고 34 → 68. */
export function udalLoaderWidth(logoSize: number): number {
  return Math.round(logoSize * 2)
}

/** 원본 204×220(달리는 수달 전신). width/height 를 같이 줘야 그림이 오기 전에도 자리가 잡혀 로고가 안 밀린다. */
export function udalLoaderHeight(logoSize: number): number {
  return Math.round(udalLoaderWidth(logoSize) * (220 / 204))
}

/**
 * `.ur-udal-hop` 주기(초) — `src/index.css` 와 같아야 위상 계산이 맞는다(loader-continuity 가드).
 * 🦦 2026-10-07 v2 (대표 확정 시안 ① "이용권을 들고 달리는 수달이 통통 튄다 0.7초 반복"): 흉상 둥실(3.2s) → 전신 통통(0.7s).
 */
export const UDAL_HOP_PERIOD_S = 0.7
