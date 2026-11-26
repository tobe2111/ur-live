/**
 * 🗣️ 근무 보고를 대표가 읽는 쉬운 한 줄로 (2026-11-26 대표 "이런 문구들이 너무 복잡하지 않아?").
 *   보고 원문에는 등급([E4])·커밋 해시·PR 번호·마크다운·영어 약어가 섞여 있다 — 화면에는 첫 문장만, 그 장식 없이 보여 준다.
 *   원문은 지우지 않는다(누르면 전체를 본다). 순수 함수(시험 대상).
 */
export function plainSummary(raw: string | null | undefined, max = 48): string {
  if (!raw) return ''
  let t = raw
    .replace(/\[(E\d)\]\s*/g, '')                       // 등급 표시
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')    // 마크다운 링크 → 글자만
    .replace(/https?:\/\/\S+/g, '')                      // 남은 주소
    .replace(/[*`_#>]+/g, '')                            // 굵게·코드·제목 기호
    .replace(/(?:PR\s*)?#\d{2,6}/gi, '')                // PR #2525 · #2525
    .replace(/\b[0-9a-f]{7,40}\b/g, '')                  // 커밋 해시
    .replace(/\s*[—–]\s*/g, ' · ')                       // 긴 줄표
    .replace(/\s+/g, ' ')
    .trim()
  // 괄호 속 덧붙임은 뺀다(대개 근거·번호) — 두 번(중첩 대비)
  t = t.replace(/\s*\([^()]*\)/g, '').replace(/\s*\([^()]*\)/g, '').replace(/\s*\([^)]*$/, '') // 닫히지 않은 괄호(잘린 원문)도
  // 첫 문장만 — 마침표·물음표·느낌표 뒤에서 자른다
  t = t.split(/(?<=[.!?])\s+/)[0]
  // 그래도 길면 첫 묶음(" · " 앞)만
  if (t.length > max && t.includes(' · ')) t = t.split(' · ')[0]
  t = t.replace(/^[·\s,]+|[·\s,]+$/g, '')
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}
