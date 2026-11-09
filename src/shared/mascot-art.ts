/**
 * 🦦 서버 첫 화면이 그리는 유달이 — 공개 주소 한 벌 (2026-11-09).
 *
 * 라이브 실측(아이폰13 · 느린 4G · CPU 4배, 로그인 전 `/user/profile`): 글자는 0.45초에 섰는데 유달이는 **2.3초**에 왔다.
 * 그림이 번들 자산(`src/assets/mascot/*.webp` → 해시 주소)이라 앱 코드가 다 와야 주소를 알았고, 서버 첫 화면은
 * 빈 칸만 그렸다. 그래서 그 그림은 `public/assets/mascot/` 로 옮겨 **서버와 앱이 같은 주소**를 쓴다(두 벌 아님 — 파일은 하나다).
 * 다른 표정은 번들 그대로다(첫 화면에 서는 그림만 공개 주소로 둔다 — `Udal.tsx` 의 `hello`).
 */
export const UDAL_HELLO_SRC = '/assets/mascot/udal-pose-stand.webp'
/** 원본 크기(332×487) — `Udal` 이 세로를 비율로 계산한다. */
export const UDAL_HELLO_ART = { w: 332, h: 487 } as const
