/**
 * 📋 **명부 붙여넣기** — 레인 B·C 수동 유입 (2026-08-03 분리).
 *   공정위 정보공개서·상인회 명부처럼 **API 가 없는 출처**를 손으로 넣는 통로다.
 *   ⚠️ 분리 이유: 부모 페이지가 파일크기 래칫(600줄)에 닿았다. `[SKIP_SIZE]` 우회 대신 자기완결 패널로 뺐다.
 */
export default function ImportPanel({ text, onText, busy, onSubmit }: {
  text: string; onText: (v: string) => void; busy: boolean; onSubmit: () => void
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
      <p className="text-xs text-gray-500 mb-2">헤더(회사명·전화·주소·홈페이지·이메일·업종…) 있는 표를 붙여넣으세요. 공정위 정보공개서·상인회 명부 CSV/TSV 자동 인식. 회사명 컬럼 필수.</p>
      <textarea value={text} onChange={e => onText(e.target.value)} rows={6}
        placeholder={'회사명\t전화\t주소\t홈페이지\nOO간판\t02-...\t서초구...\thttp://...'}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm font-mono" />
      <div className="flex justify-end mt-2">
        <button onClick={onSubmit} disabled={busy} className="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{busy ? '저장 중…' : '임포트'}</button>
      </div>
    </div>
  )
}
