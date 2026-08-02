import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🎛️ **회차 조건** — 권역 · 우선업종 비중 · 페이지 · 예산.
 *
 *   ⚠️ 여기서 정하는 값은 **서버가 clamp** 한다. 화면이 상한을 뚫을 방법을 두지 않는 게 핵심이다 —
 *   슬라이스를 무제한 올릴 수 있게 만들면 그건 *CPU 한도로 죽는 문을 화면에 다는 것*이고,
 *   이 레포엔 그 전례가 둘 있다(NEIS 6→3 · NPS 100→40, 둘 다 올린 날 죽어서 되돌렸다).
 *
 *   그래서 **효과를 같은 화면에 띄운다** — 직전 회차의 `elapsed_ms`/`stopped_by`/`spent`.
 *   숫자를 바꿀 수 있게 하면서 그 결과를 안 보여주면, 대표는 추측으로 조정하게 된다.
 */
export interface StoreCollectConfig { regions: string[]; voucher_share: number; max_pages: number; budget: number }
export interface LastRun { elapsed_ms?: number; stopped_by?: string; spent?: number; found?: number; saved?: number }

const STOPPED_LABEL: Record<string, string> = {
  budget: '예산 소진(정상)', deadline: '시간 초과 — 슬라이스를 줄이세요', limit: '플랫폼 한도', done: '전량 완료',
}

export default function CollectConfigPanel({ lastRun }: { lastRun?: LastRun | null }) {
  const [cfg, setCfg] = useState<StoreCollectConfig | null>(null)
  const [groups, setGroups] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/store-prospects/config')
      if (r.data?.success) { setCfg(r.data.config); setGroups(r.data.groups || []) }
    } catch { /* 상태줄이 이미 수집 상태를 보여준다 */ }
  }, [])
  useEffect(() => { if (open) load() }, [open, load])

  async function save(next: StoreCollectConfig) {
    setSaving(true)
    try {
      const r = await api.patch('/api/admin/store-prospects/config', next)
      // ⚠️ 서버가 clamp 한 **결과**를 반영한다 — 내가 보낸 값을 그대로 믿고 그리면
      //   화면과 실제가 갈라진다(60 을 보냈는데 서버가 60 으로 잘랐을 때 화면만 100 이 된다).
      if (r.data?.success) { setCfg(r.data.config); toast.success('저장됨 — 다음 회차부터 적용') }
    } catch { toast.error('저장 실패') } finally { setSaving(false) }
  }

  const toggleGroup = (g: string) => {
    if (!cfg) return
    const has = cfg.regions.includes(g)
    save({ ...cfg, regions: has ? cfg.regions.filter(x => x !== g) : [...cfg.regions, g] })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-4">
      <details onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-gray-800">
          🎛️ 회차 조건
          <span className="ml-2 font-normal text-xs text-gray-500">
            {cfg ? `${cfg.regions.length ? cfg.regions.join('·') : '전국'} · 우선업종 ${Math.round(cfg.voucher_share * 100)}% · ${cfg.max_pages}페이지 · 예산 ${cfg.budget}` : '권역·비중·페이지·예산'}
          </span>
        </summary>
        <div className="px-4 pb-4 space-y-3">
          {!cfg && <div className="py-4 text-center text-xs text-gray-400">불러오는 중…</div>}
          {cfg && (
            <>
              <div>
                <div className="mb-1 text-[11px] font-medium text-gray-600">지역 권역 <span className="font-normal text-gray-400">— 아무것도 안 고르면 전국</span></div>
                <div className="flex flex-wrap gap-1">
                  {groups.map(g => {
                    const on = cfg.regions.includes(g)
                    return (
                      <button key={g} onClick={() => toggleGroup(g)} disabled={saving}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium disabled:opacity-40 ${on ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >{g}</button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-[11px] text-gray-600">
                  우선업종 몫 <b className="text-gray-800">{Math.round(cfg.voucher_share * 100)}%</b>
                  <input type="range" min={10} max={90} step={5} value={Math.round(cfg.voucher_share * 100)} disabled={saving}
                    onChange={e => setCfg({ ...cfg, voucher_share: Number(e.target.value) / 100 })}
                    onMouseUp={() => save(cfg)} onTouchEnd={() => save(cfg)}
                    className="mt-1 w-full" />
                  <span className="text-gray-400">나머지는 무인 블록</span>
                </label>
                <label className="text-[11px] text-gray-600">
                  키워드당 페이지 <b className="text-gray-800">{cfg.max_pages}</b>
                  <input type="range" min={1} max={3} step={1} value={cfg.max_pages} disabled={saving}
                    onChange={e => setCfg({ ...cfg, max_pages: Number(e.target.value) })}
                    onMouseUp={() => save(cfg)} onTouchEnd={() => save(cfg)}
                    className="mt-1 w-full" />
                  <span className="text-gray-400">낮추면 넓게, 높이면 깊게</span>
                </label>
                <label className="text-[11px] text-gray-600">
                  회차 예산 <b className="text-gray-800">{cfg.budget}</b>
                  <input type="range" min={5} max={60} step={5} value={cfg.budget} disabled={saving}
                    onChange={e => setCfg({ ...cfg, budget: Number(e.target.value) })}
                    onMouseUp={() => save(cfg)} onTouchEnd={() => save(cfg)}
                    className="mt-1 w-full" />
                  <span className="text-gray-400">서버가 5~60 으로 자릅니다</span>
                </label>
              </div>

              {/* 효과를 바로 옆에 — 숫자만 바꾸게 하고 결과를 안 보여주면 추측으로 조정하게 된다. */}
              {lastRun && (
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                  직전 회차 · {formatNumber(lastRun.elapsed_ms ?? 0)}ms · 사용 {lastRun.spent ?? 0} ·
                  발굴 {formatNumber(lastRun.found ?? 0)} / 저장 {formatNumber(lastRun.saved ?? 0)}
                  {lastRun.stopped_by && (
                    <span className={lastRun.stopped_by === 'deadline' ? ' font-semibold text-amber-600' : ''}>
                      {' · '}{STOPPED_LABEL[lastRun.stopped_by] || lastRun.stopped_by}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </details>
    </div>
  )
}
