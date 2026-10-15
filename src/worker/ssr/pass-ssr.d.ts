/** 🧊 워커 빌드가 `dist/ssr-pass/pass-detail-entry.js`(있으면) 또는 스텁으로 푼다 — scripts/build-worker.js 의 플러그인. */
declare module 'virtual:pass-ssr' {
  export const renderPassApp: undefined | ((product: { id: number } & Record<string, unknown>, url: string) => Promise<string>)
}
