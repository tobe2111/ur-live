/** 🧬 주입 — 카카오 로그인 번호·마케팅 동의 (2026-11-04) */
const T = 'src/tests/unit/kakao-phone-terms-2026-11-04.test.ts'
const S = 'src/features/auth/services/kakao-login-scope.ts'
export default [
  { name: '카카오번호 — 스위치 없이도 phone_number 를 요청', file: S, find: "  if (env.KAKAO_PHONE_SCOPE_ENABLED === 'true') scopes.push('phone_number')", replace: "  scopes.push('phone_number')", test: T, why: '콘솔 검수 전이면 카카오가 로그인을 통째로 거부한다(KOE205).' },
  { name: '카카오번호 — 켜도 id_token 빠른 길을 탄다', file: 'src/features/auth/api/kakao.routes.ts', find: 'c.env.KAKAO_OIDC_ENABLED && !kakaoNeedsUserInfo(c.env) ? kakaoService.parseIdToken', replace: 'c.env.KAKAO_OIDC_ENABLED ? kakaoService.parseIdToken', test: T, why: '동의를 받아 놓고도 id_token 엔 번호가 없어 영영 비어 있다.' },
  { name: '카카오약관 — 미동의를 동의로 기록', file: 'src/features/auth/services/kakao-marketing-consent.ts', find: '    if (!tags.includes(tag)) return false\n', replace: '', test: T, why: '체크 안 한 손님에게 광고를 보낼 근거를 거짓으로 남긴다.' },
  { name: '카카오약관 — 카톡 간편로그인이 약관을 빠뜨린다', file: 'src/lib/kakao-talk-login.ts', find: '      ...(t.serviceTerms ? { serviceTerms: t.serviceTerms } : {}),', replace: '', test: T, why: '앱(카톡)으로 로그인한 손님에게만 약관이 안 뜬다.' },
]
