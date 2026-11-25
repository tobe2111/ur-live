/** 🚫 2026-11-25 유어애즈 — 수신거부·반송 표시가 사라지거나 무시되던 길 — 가드: src/tests/unit/ads-suppression-2026-11-25.test.ts */
const T = 'src/tests/unit/ads-suppression-2026-11-25.test.ts'

export default [
  {
    name: '[ads-sup] 병합이 지워지는 행의 수신거부를 버린다',
    file: 'src/features/marketing/api/influencer-merge-suppression.ts',
    find: "    optedOut: rows.some((r) => Number(r.opted_out) === 1) || sticky === 'opt_out' ? 1 : 0,",
    replace: "    optedOut: Number(rows[0]?.opted_out) === 1 ? 1 : 0,",
    test: T,
    why: '수신거부한 주소가 병합 뒤 다시 "보낼 수 있는 리드" 가 된다.',
  },
  {
    name: '[ads-sup] 병합이 거절(rejected)을 new 로 되돌린다',
    file: 'src/features/marketing/api/influencer-maintenance.ts',
    find: "rows.find(r => r.status === 'rejected')?.status ?? keep.status)",
    replace: "keep.status)",
    test: T,
    why: '거절한 사람이 다시 발송 대기열에 든다(대기열은 status=new 를 본다).',
  },
  {
    name: '[ads-sup] 수신거부 기록 PATCH 가 다시 아무것도 안 적는다',
    file: 'src/features/marketing/api/admin-ads-influencers.routes.ts',
    find: "if (b.opted_out === 1 || b.opted_out === true) sets.push(\"opted_out = 1\", \"email_status = 'opt_out'\")",
    replace: "if (false) sets.push(\"opted_out = 1\", \"email_status = 'opt_out'\")",
    test: T,
    why: '운영 문서대로 수신거부를 적어도 400 "변경 항목 없음" 으로 사라진다.',
  },
  {
    name: "[ads-sup] '발송함' 업로드가 반송 표시를 덮는다",
    file: 'src/features/marketing/api/outreach-status-ingest.ts',
    find: "      return { sql: `email_status = CASE WHEN email_status IN (${STICKY}) THEN email_status ELSE 'sent' END, contacted_at = COALESCE(contacted_at, ?)`, usesAt: true }",
    replace: "      return { sql: \"email_status = 'sent', contacted_at = COALESCE(contacted_at, ?)\", usesAt: true }",
    test: T,
    why: '반송된 주소가 다시 발송 대상이 된다(반송률 차단기도 그 표시를 센다).',
  },
  {
    name: '[ads-sup] 콜드 발송이 수신거부를 안 본다',
    file: 'src/features/marketing/api/admin-ads-influencers.routes.ts',
    find: "      ${NOT_SUPPRESSED_SQL} AND COALESCE(is_brand, 0) = 0 AND contacted_at IS NULL AND",
    replace: "      AND",
    test: T,
    why: '수신거부한 사람 · 브랜드 계정 · 이미 연락한 리드에게 광고 메일이 간다.',
  },
  {
    name: '[ads-sup] 판매자 제안 메일 드립이 밤에도 보낸다',
    file: 'src/features/marketing/api/outreach-email.ts',
    find: "  if (isNightKST(Date.now())) return",
    replace: "  if (false) return",
    test: T,
    why: '야간(21~08시) 광고성 정보 전송 금지 위반.',
  },
  {
    name: '[ads-sup] 읽기 전용 어드민이 명단을 내려받는다',
    file: 'src/worker/middleware/admin-rbac.ts',
    find: " || isLeadExportPath(pathname);",
    replace: ";",
    test: T,
    why: '조회 전용 계정이 연락처 수만 건을 받아 가고, 받는 순간 "내보냄" 도장이 찍혀 배치가 소진된다.',
  },
]
