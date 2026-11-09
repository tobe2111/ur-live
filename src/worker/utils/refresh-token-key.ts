/**
 * 🔐 2026-11-09 — 재발급(refresh) 토큰은 **로그인 토큰과 다른 키**로 서명한다.
 *
 * 종전엔 재발급 토큰이 로그인 토큰과 같은 키·같은 클레임(type:'admin'/'seller')에 만료만 길었다(어드민 30일 · 셀러 90일).
 * 그래서 재발급 토큰을 그대로 Bearer 로 보내면 로그인 토큰으로 통했다 — 그리고 토큰을 직접 확인하는 곳이
 * 레포에 30곳 가까이 있어 한 곳씩 막으면 반드시 빠진다. ⇒ 키를 갈라 **로그인 검사 어디서도 서명이 맞지 않게** 한다
 * (에이전시 좌석 토큰 `agencySigningKey` 와 같은 처방).
 *
 * 이행: 이미 발급된 옛 재발급 토큰(옛 키)은 **재발급 주소에서만** 계속 받아 준다 — 사용자를 강제로 로그아웃시키지 않는다.
 * 그 옛 토큰은 만료(최대 90일)까지 로그인 토큰으로도 통하므로, 완전한 차단은 그 기간이 지나야 한다.
 */
import { sign, verify } from 'hono/jwt'

export const REFRESH_TOKEN_USE = 'refresh' as const

export function refreshSigningKey(jwtSecret: string): string {
  return `${jwtSecret}::refresh-token:v1`
}

export async function signRefreshToken(payload: Record<string, unknown>, jwtSecret: string): Promise<string> {
  return sign({ ...payload, token_use: REFRESH_TOKEN_USE }, refreshSigningKey(jwtSecret))
}

/** 새 키 → 옛 키 순으로 확인. 둘 다 실패하면 던진다(호출부의 기존 catch 그대로). */
export async function verifyRefreshToken(token: string, jwtSecret: string): Promise<Record<string, unknown>> {
  try {
    return (await verify(token, refreshSigningKey(jwtSecret), 'HS256')) as Record<string, unknown>
  } catch {
    return (await verify(token, jwtSecret, 'HS256')) as Record<string, unknown> // 이행기: 옛 키로 발급된 재발급 토큰
  }
}
