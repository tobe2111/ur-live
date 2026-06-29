/**
 * 🆕 2026-06-28 유어애즈 — 패널 데이터 로드 실패 인라인 배너 + 다시 시도.
 *   기존 패널들은 fetch 실패를 조용히 빈 상태로 보여줘(graceful) "데이터 0건"과
 *   "불러오기 실패"가 구분 안 됐음 → 라이브 키 검증 시 실패가 안 보임.
 *   이 작은 배너로 실패를 가시화하고 재시도 경로를 준다(돈 변경 없음).
 */
export default function PanelError({ onRetry, busy, label = '불러오기 실패' }: { onRetry: () => void; busy?: boolean; label?: string }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2">
      <span className="text-[11.5px] text-red-600 dark:text-red-400">{label} · 네트워크 또는 서버 오류</span>
      <button onClick={onRetry} disabled={busy}
        className="shrink-0 rounded border border-red-300 dark:border-red-500/40 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400 disabled:opacity-50">
        {busy ? '…' : '다시 시도'}
      </button>
    </div>
  )
}
