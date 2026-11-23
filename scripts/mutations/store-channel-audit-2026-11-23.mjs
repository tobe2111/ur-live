/** 🧬 주입 — 매장 수수료 채널 점검 (2026-11-23) · 가드: src/tests/unit/store-channel-audit-2026-11-23.test.ts */
const T = 'src/tests/unit/store-channel-audit-2026-11-23.test.ts'
const F = 'src/worker/utils/store-channel-audit.ts'
export default [
  { name: 'channelaudit: 외부 에이전시 10% 를 못 본다', file: F,
    find: "  if (r.channel === 'direct') return external.length > 0 ? 'external_agency_direct' : null", replace: "  if (r.channel === 'direct') return null", test: T,
    why: '에이전시가 데려온 매장이 10% 로 저장돼도 아무 신호가 없다(11-16 의 23·24·29).' },
  { name: 'channelaudit: 유어팀이 고른 5% 를 경보로 올린다', file: F,
    find: "return r.agencies.length === 0 && !hasBroker ? 'brokered_no_recruiter' : null", replace: "return external.length === 0 ? 'brokered_no_recruiter' : null", test: T,
    why: '대표가 일부러 5% 로 한 매장이 매일 아침 경보로 뜬다(거짓 경보).' },
  { name: 'channelaudit: 판매 전 미지정까지 경보', file: F,
    find: "  return r.liveProducts > 0 ? 'live_unset' : null", replace: "  return 'live_unset'", test: T,
    why: '상품도 없는 매장이 전부 경보로 떠 진짜가 묻힌다.' },
  { name: 'channelaudit: 다이제스트 배선이 빠진다', file: 'src/worker/cron/ops-daily-digest.ts',
    find: '      lines.push(...storeChannelWarnings(await loadStoreChannelRows(DB)))', replace: '', test: T,
    why: '점검은 있는데 아무도 안 부른다.' },
  { name: 'channelaudit: 이름 변경에 감사 로그가 없다', file: 'src/features/agency-console/api/agency-admin.routes.ts',
    find: "      action: 'rename_agency_account', targetType: 'agency_account', targetId: String(id),", replace: "      action: 'x', targetType: 'agency_account', targetId: String(id),", test: T,
    why: '누가 에이전시 이름을 바꿨는지 남지 않는다.' },
]
