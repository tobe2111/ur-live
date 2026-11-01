/**
 * 🧩 "홈페이지에 넣기" — 코드 만들기 화면(`/embed`)으로 보내는 주소 한 곳.
 *
 * 2026-11-01 대표 *"모두 이상적으로"*. 그전까지 위젯을 쓰려면 사장님·에이전시가 `/embed` 에 직접 들어가
 * **자기 아이디나 번호를 타이핑**해야 했다. 에이전시 번호는 **콘솔 어디에도 안 보여서**(로그인 응답엔
 * 있는데 화면에 안 썼다) 에이전시 위젯은 사실상 **쓸 방법이 없었다**.
 *
 * ⚠️ 번호를 *보여주는* 대신 **몰라도 되게** 만든다 — 버튼이 키를 싣고 간다.
 * ⚠️ `/embed` 는 워커가 그리는 화면이라 SPA 라우트가 아니다. 반드시 하드 이동(`<a href>` / `window.open`)으로.
 */
export type EmbedWidgetType = 'ushop' | 'agency' | 'store' | 'region' | 'partner' | 'pass'

export function embedCodePath(type: EmbedWidgetType, key: string | number): string {
  return `/embed?type=${encodeURIComponent(type)}&key=${encodeURIComponent(String(key))}`
}

/** 새 탭으로 연다. 사용자 클릭 핸들러 안에서만 부를 것(팝업 차단). */
export function openEmbedCode(type: EmbedWidgetType, key: string | number): void {
  window.open(embedCodePath(type, key), '_blank', 'noopener,noreferrer')
}
