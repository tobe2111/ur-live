/** 🧬 주입 — 조용히 죽은 계측 감시 · 유입 종류 (2026-11-13) · 가드: src/tests/unit/funnel-silence-and-inflow-kind-2026-11-13.test.ts */
const T = 'src/tests/unit/funnel-silence-and-inflow-kind-2026-11-13.test.ts'
export default [
  { name: 'silence: 다음 단계 0 을 못 본다', file: 'src/worker/utils/funnel-silence.ts',
    find: '    if (n(prev) >= min && n(next) === 0) out.push(', replace: '    if (false) out.push(', test: T,
    why: "'로그인 성공' 이 석 달 0 이던 것처럼 계측이 죽어도 아무도 모른다." },
  { name: 'silence: 다이제스트에 안 붙는다', file: 'src/worker/cron/ops-daily-digest.ts',
    find: '      lines.push(...funnelSilenceWarnings(await loadFunnel7d(DB)))', replace: '      void funnelSilenceWarnings; void loadFunnel7d', test: T,
    why: '경고를 계산만 하고 아무도 못 본다.' },
  { name: 'silence: 유어샵 방문이 링크 클릭으로 섞인다', file: 'src/utils/affiliate-track.ts',
    find: "      ref_type: source === 'ushop' ? 'ushop_visit' : 'link',", replace: "      ref_type: 'curator',", test: T,
    why: '대표 유어샵 방문이 "인플루언서 링크 클릭" 으로 보고된다(2026-11-12 오보).' },
]
