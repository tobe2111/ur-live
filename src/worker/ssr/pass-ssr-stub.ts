/**
 * 🧊 `virtual:pass-ssr` 의 빈 자리 — 서버 렌더 번들(`dist/ssr-pass/pass-detail-entry.js`)이 없을 때
 * 워커 빌드가 이걸 묶는다(로컬 단독 워커 빌드·pre-commit). 그러면 워커는 종전 손그림 첫 화면을 쓴다.
 * 실제 배포 빌드(`npm run build`)는 `build:ssr-pass` 가 그 번들을 먼저 만든다.
 */
export const renderPassApp: undefined | ((product: { id: number } & Record<string, unknown>, url: string) => Promise<string>) = undefined
