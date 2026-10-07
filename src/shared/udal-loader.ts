/**
 * 🦦 로딩 화면의 유달이 — 서버가 그린 정적 로더와 앱 로더가 **같은 그림·같은 크기·같은 위상**이어야 한다
 * (2026-10-07 대표 허가 "로딩 화면"). 둘이 하나라도 다르면 로더가 바뀌는 순간 화면이 튄다 —
 * 대표가 2026-07-01 에 금지한 "로딩 화면 2~3개" 클래스다.
 *
 * 그래서 값은 여기 한 곳에만 둔다: 워커(`src/worker/index.ts` 의 `urdealLoaderHtml`)와
 * `BrandLoader` 가 같이 읽는다.
 *
 * ⚠️ 이미지가 해시 없는 고정 경로인 이유: 워커는 Vite 가 붙인 해시를 모른다. 대신 파일명에 버전(`-v1`)을
 *    박았다 — `/assets/*` 는 1년 immutable 캐시라 **그림을 바꾸면 반드시 v2 로 새 파일**을 만들 것
 *    (같은 이름에 덮어쓰면 1년 동안 옛 그림이 나간다). 원본: `public/assets/mascot/`.
 */
export const UDAL_LOADER_SRC = '/assets/mascot/udal-loader-v1.webp'

/** 로고 크기(px)에 맞춘 유달이 가로(px). 기본 로고 34 → 71. */
export function udalLoaderWidth(logoSize: number): number {
  return Math.round(logoSize * 2.1)
}

/** 원본 176×193. width/height 를 같이 줘야 그림이 오기 전에도 자리가 잡혀 로고가 안 밀린다. */
export function udalLoaderHeight(logoSize: number): number {
  return Math.round(udalLoaderWidth(logoSize) * (193 / 176))
}

/** `.ur-udal-bob` 주기(초) — `src/index.css` 와 같아야 위상 계산이 맞는다(loader-continuity 가드). */
export const UDAL_BOB_PERIOD_S = 3.2

/** 원본이 흉상이라 아래 끝을 바탕으로 녹인다(부품 `Udal` 과 같은 마스크). */
export const UDAL_FADE_MASK = 'linear-gradient(to bottom, black 86%, transparent)'
