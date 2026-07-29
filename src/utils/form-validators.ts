/**
 * 🔢 2026-06-26 가입폼 공통 검증 헬퍼 (대표 신고: 미완성 전화/이메일이 가입폼 통과).
 *   도매몰 가입폼(제조사 SupplierRegisterPage · 판매사 WholesaleJoinPage)이 동일 규칙을 쓰도록 단일화.
 *   순수함수 — 단위테스트로 "010"/"010-9135"/"utonggori@naver" 미통과를 고정.
 */
export const digitsOnly = (s: string): string => String(s ?? '').replace(/\D/g, '')

/** 한국 휴대폰 — 010 은 11자리(010+8), 011/016~019 는 10~11자리. "010"·"010-9135"·10자리 010 등 미완성은 false. */
export const isValidKrPhone = (s: string): boolean => /^01(?:0\d{8}|[16789]\d{7,8})$/.test(digitsOnly(s))

/** 이메일 — @ + 도메인 + TLD(영문 2자 이상). "utonggori@naver"(TLD 없음)는 false. */
export const isValidEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(s ?? '').trim())
