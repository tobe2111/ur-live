/**
 * 🔐 2026-11-09 — 공유 비밀(헤더 토큰) 비교는 **상수 시간**으로 한다.
 *
 * `provided !== expected` 는 앞에서부터 다른 글자를 만나면 바로 끝나 응답 시간이 일치 길이를 흘린다.
 * 이 레포의 응급·cron·웹훅 토큰 비교 여러 곳이 그렇게 돼 있었다. 기대값이 없으면 늘 false(닫힘).
 */
export function secretEquals(expected: string | undefined | null, provided: string | undefined | null): boolean {
  if (!expected) return false
  const a = String(expected)
  const b = String(provided ?? '')
  let diff = a.length ^ b.length
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i % a.length) ^ (b.charCodeAt(i) || 0))
  return diff === 0
}
