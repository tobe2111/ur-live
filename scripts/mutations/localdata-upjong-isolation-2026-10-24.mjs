/**
 * 🧬 주입 — 인허가 수집: 한 업종의 실패가 그 날 전체를 끊지 않는다 (2026-10-24 라이브 실측)
 *    가드: src/tests/unit/ads-localdata-day-advance.test.ts
 *          src/tests/unit/ads-localdata-pending-rotation.test.ts
 *    대표 신고: "파트너풀 (B2B) 지금 완벽하지 않음. 업종 구별도 완벽하지 않음."
 */
const T1 = 'src/tests/unit/ads-localdata-day-advance.test.ts'
const T2 = 'src/tests/unit/ads-localdata-pending-rotation.test.ts'
const L = 'src/features/marketing/api/localdata-collect.ts'
const P = 'src/features/marketing/api/localdata-pending.ts'
export default [
  {
    name: '인허가 — 업종 에러가 그 날 전체를 끊는다(종전 교착으로 복귀)',
    file: L,
    find: '        if (msg && !count) { epErr = true; break }\n        if (!count) break\n        const rows: StoreProspect[] = items.map',
    replace: '        if (msg && !count) { stoppedAt = ei; break }\n        if (!count) break\n        const rows: StoreProspect[] = items.map',
    test: T1,
    why: '첫 업종이 522 를 뱉으면 나머지 15업종이 그 날 데이터를 한 번도 못 본다(라이브: pending 14일 전부 idx 0).',
  },
  {
    name: '인허가 백필 — 같은 교착으로 복귀',
    file: L,
    find: '        if (msg && !count) { epErr = true; break }\n        if (!count) break\n        const rows = items.map',
    replace: '        if (msg && !count) { stoppedAt = ei; break }\n        if (!count) break\n        const rows = items.map',
    test: T1,
    why: '두 레인은 대칭이어야 한다 — 한쪽만 고치면 백필이 조용히 옛 교착으로 돈다.',
  },
  {
    name: '인허가 — 전역장애 커서를 첫 실패가 아니라 마지막 실패에 둔다',
    file: L,
    find: 'if (++consecFail >= MAX_CONSEC_UPJONG_FAILS) { stoppedAt = firstFail; break } }\n      else consecFail = 0\n    }\n    // 예산으로 끊긴 지점은',
    replace: 'if (++consecFail >= MAX_CONSEC_UPJONG_FAILS) { stoppedAt = ei; break } }\n      else consecFail = 0\n    }\n    // 예산으로 끊긴 지점은',
    test: T1,
    why: '`ei` 에 두면 그 앞의 실패 업종들이 그 날 영영 건너뛰어진다 — 날짜 커서는 한 방향으로만 간다.',
  },
  {
    name: '인허가 — 못 끝낸 날을 꼬리로 돌리지 않는다(한 날이 모든 회차 독식)',
    file: L,
    find: '    if (stoppedAt != null) retried.push({ day: item.day, idx: stoppedAt })',
    replace: '    if (stoppedAt != null) leftover.push({ day: item.day, idx: stoppedAt })',
    test: T1,
    why: '실패한 날이 같은 자리에 남으면 다음 회차도 그 날부터 — 요청당 20초 타임아웃이 회차를 독식한다.',
  },
  {
    name: '인허가 — 상한 자르기를 옛 꼬리 slice 로 되돌린다',
    file: L,
    find: '  const nextPending = rotatePending(leftover, retried)',
    replace: '  const nextPending = [...leftover, ...retried].slice(-14)',
    test: T1,
    why: '꼬리 slice 는 회전시킨 오래된 실패 날을 살리고 더 새로운 미착수 날을 버려, 회전의 목적을 그 자리에서 되돌린다.',
  },
  {
    name: '큐 회전 — 못 끝낸 날을 머리에 되돌려 놓는다',
    file: P,
    find: '  const queued = [...untouched, ...retried]',
    replace: '  const queued = [...retried, ...untouched]',
    test: T2,
    why: '실패한 날이 다시 머리면 교착이 그대로다(다음 회차가 또 그 날부터).',
  },
  {
    name: '큐 회전 — 상한을 날짜가 아니라 위치로 자른다',
    file: P,
    find: "  const keep = new Set(queued.map(x => x.day).sort().slice(-max))\n  return queued.filter(x => keep.has(x.day))",
    replace: '  return queued.slice(-max)',
    test: T2,
    why: '위치로 자르면 회전시킨 오래된 날이 살아남고 미착수 날이 떨어진다(양보한 차례를 되돌린다).',
  },
  {
    name: '큐 회전 — 전역장애 안전판 상수를 1 로 낮춘다',
    file: P,
    find: 'export const MAX_CONSEC_UPJONG_FAILS = 3',
    replace: 'export const MAX_CONSEC_UPJONG_FAILS = 1',
    test: T2,
    why: '1 이면 업종 격리가 사실상 사라진다 — 첫 실패에 그 날이 끊기므로 종전 버그와 같아진다.',
  },
]
