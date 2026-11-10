/**
 * `UrDealLogo` 미러 — 글자 + 로즈 원 마침표. 값은 그 컴포넌트(`components/brand/UrDealLogo.tsx`)의 식 그대로.
 * 유어샵 첫 화면(`curator-ssr-body.ts`)과 로그인 첫 화면(`login-first-screen.ts`)이 같이 쓴다(2026-11-09 분리).
 * ⚠️ 작은 파일로 따로 둔 이유: 첫 화면 CSS 생성기가 import 폐쇄의 **파일 본문**으로 클래스를 고르므로, 유어샵 모듈을
 *    통째로 import 하면 로그인 표면 CSS 에 유어샵 클래스가 전부 딸려 온다.
 */
/** @param tone `dark` = `UrDealLogo forceDark`(잉크 바탕 위 웜화이트 글자) — 랜딩 머리줄(2026-11-10). */
export function logoHtml(size: number, tone: 'auto' | 'dark' = 'auto'): string {
  const dot = Math.max(2, size * 0.18)
  return (
    `<span class="inline-flex items-baseline select-none ${tone === 'dark' ? 'text-[#F8F7FC]' : 'text-[#16181C] dark:text-[#F8F7FC]'}"` +
    ` style="font-family:'Poppins',system-ui,sans-serif;font-weight:800;font-size:${size}px;letter-spacing:-0.035em;line-height:1">` +
    'urdeal' +
    `<span class="bg-brand" style="display:inline-block;width:${dot}px;height:${dot}px;border-radius:50%;margin-left:${size * 0.08}px"></span>` +
    '</span>'
  )
}
