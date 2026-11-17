/**
 * 🧬 주입 — 남의·가짜 연락처 정리 + DB 섞임 금지 (2026-11-17)
 *    가드: src/tests/unit/company-contact-quality-2026-11-17.test.ts
 */
const T = 'src/tests/unit/company-contact-quality-2026-11-17.test.ts'
const Q = 'src/features/marketing/api/company-contact-quality.ts'
export default [
  { name: '연락처 — 업종 문턱을 없앤다(지점 묶음까지 비운다)', file: Q,
    find: 'export const SHARED_MIN_CATEGORIES = 3', replace: 'export const SHARED_MIN_CATEGORIES = 1', test: T,
    why: '같은 브랜드 지점들의 진짜 연락처가 지워진다.' },
  { name: '연락처 — NULL 출처를 다시 빠뜨린다', file: Q,
    find: "       AND COALESCE(contact_source, '') NOT IN (${AUTH_SQL})\n     GROUP BY email", replace: "       AND contact_source NOT IN (${AUTH_SQL})\n     GROUP BY email", test: T,
    why: '54만 행(출처 NULL)이 판정에서 통째로 빠진다.' },
  { name: '연락처 — 가짜 전화 판정을 끈다', file: Q,
    find: "  if (/^(\\d)\\1{7}$/.test(last8)) return true", replace: '  if (false) return true', test: T,
    why: '010-0000-0000 이 제휴 연락처로 남는다.' },
  { name: 'DB 섞임 — 등록부 대조가 억제 표를 서브쿼리로 다시 부른다', file: 'src/features/marketing/api/registry-email-match.ts',
    find: '         SET email = CASE WHEN ? IS NOT NULL THEN COALESCE(email, ?) ELSE email END,', replace: '         SET email = CASE WHEN ? IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ad_email_suppress s WHERE s.email = ?) THEN COALESCE(email, ?) ELSE email END,', test: T,
    why: '업체 DB 에는 억제 표가 없어 매칭 묶음 전체가 no such table 로 실패한다.' },
  { name: '위생 스윕 — 조회 실패에 커서를 넘긴다', file: 'src/features/marketing/api/company-hygiene-sweep.ts',
    find: '  if (!rowsRes) return { scanned: 0, fixed: 0, cursor: st.cursor, done: false }', replace: '', test: T,
    why: '칸이 아직 없을 때 5만 칸씩 건너뛰어 그 구간을 영영 안 본다.' },
  { name: '보강 순서 — 우선 업종 줄을 버린다', file: 'src/features/marketing/api/enrich-lane.ts',
    find: '  const targets = interleaveTargets(prio, general, targetCap)', replace: '  const targets = general', test: T,
    why: '사이트 보유 행이 계속 앞줄을 차지해 이사·청소·법무사 이메일이 안 찾아진다.' },
  { name: '보강 순서 — 번갈아 세우지 않는다', file: Q,
    find: '    const takePrio = (out.length % 2 === 0 && i < prio.length) || j >= general.length', replace: '    const takePrio = i < prio.length', test: T,
    why: '우선 줄이 회차를 통째로 차지해 다른 업종 보강이 멈춘다.' },
  { name: '정리 결과 — 어드민에 안 넘긴다', file: 'src/features/marketing/api/partner-pool.routes.ts',
    find: ' contactQuality: { shared: sharedSweep, hygiene: hygieneSweep },', replace: '', test: T,
    why: '정리가 돌았는지 화면에서 알 수 없다.' },
]
