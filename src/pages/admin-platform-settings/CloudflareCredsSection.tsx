import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { CREDENTIAL_KEYS } from './settings-payload'

/**
 * ☁️ **Cloudflare 진단 자격** — 값은 `platform_settings` 에 있는데 **넣을 칸이 없었다**(2026-07-29 발견).
 *
 *   이 페이지는 `SETTINGS_FIELDS`/`COMMISSION_BUDGET_FIELDS` 라는 **고정 목록**만 렌더한다.
 *   저장 API(`PUT /api/admin/tools/settings`)는 임의 키를 받으므로 서버는 문제가 없었고,
 *   **화면에만 자리가 없어** 토큰이 만료됐을 때 대표가 갱신할 방법이 없었다.
 *
 *   용도: 세션이 라이브 인프라를 **조회**할 때 쓴다(빌드로그·배포상태·D1 읽기).
 *   ⚠️ 스코프는 **읽기 전용**이면 충분하다 — CLAUDE.md 가 "플랫폼 쓰기는 세션이 하지 않는다"로 정해 뒀다.
 *
 * 🔒 표시 규칙: 이미 저장돼 있으면 **값을 화면에 뿌리지 않고** "설정됨"만 보여 준다(어깨너머 노출 방지).
 *   비워 두면 기존 값이 그대로 유지되고, 새로 입력할 때만 교체된다 — 실수로 지워지지 않는다.
 */
export default function CloudflareCredsSection({ settings, setSettings, savedTick, onSave, saving }: { settings: Record<string, string>; setSettings: (fn: (prev: Record<string, string>) => Record<string, string>) => void; savedTick: number; onSave: () => void; saving: boolean }) {
  const has = (k: string) => !!(settings[k] || '').trim()
  const [edit, setEdit] = useState<Record<string, boolean>>({})
  // 저장이 끝나면 입력칸을 닫아 '설정됨 · 끝4자리' 로 되돌린다 — 그래야 반영을 눈으로 확인할 수 있다.
  useEffect(() => { if (savedTick) setEdit({}) }, [savedTick])
  const FIELDS: { key: typeof CREDENTIAL_KEYS[number]; label: string; hint: string }[] = [
    // 🔑 2026-08-25 실측으로 확정된 권한 — 종전 안내는 "D1 = Read 하나면 됩니다" 였는데
    //   그대로 만들면 **주간 백업이 안 된다**(wrangler d1 export 는 D1 = Edit 이 필요).
    //   화면 안내가 좁아서 좁게 만들어진 토큰이 3주간 백업을 죽인 적이 있다.
    { key: 'cf_api_token', label: 'Cloudflare API 토큰', hint: 'My Profile → API Tokens → Custom Token · 만료일은 비워 두세요(무기한). 권한: Account → D1 / Workers Scripts / Workers KV / Workers R2 / Pages = Edit · Account Settings = Read · User → API Tokens · User Details = Read. 값은 생성 화면에서 한 번만 보입니다.' },
    { key: 'cf_account_id', label: 'Cloudflare 계정 ID', hint: '대시보드 우측 사이드바에 표시됩니다.' },
  ]
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-6">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">☁️ Cloudflare 진단 자격 (선택)</h2>
        <p className="text-xs text-gray-400 mt-0.5">라이브 인프라 조회용. 없어도 서비스는 정상 동작합니다.</p>
      </div>
      <div className="divide-y divide-gray-100">
        {FIELDS.map(f => (
          <div key={f.key} className="px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{f.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{f.hint}</p>
              </div>
              {has(f.key) && !edit[f.key] ? (
                <div className="flex items-center gap-2 shrink-0">
                  {/* 🔎 끝 4자리 — 값이 **바뀌었는지**를 눈으로 구분할 유일한 수단이다. "설정됨" 만으로는
                      옛 토큰과 새 토큰을 못 가린다(둘 다 길이가 같으면 화면이 완전히 동일하다 —
                      2026-08-02 에 실제로 이래서 죽은 토큰이 남아 있는 줄 몰랐다). */}
                  <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                    설정됨 · …{(settings[f.key] || '').slice(-4)}
                  </span>
                  <button onClick={() => { setEdit(p => ({ ...p, [f.key]: true })); setSettings(p => ({ ...p, [f.key]: '' })) }}
                    className="text-xs px-3 py-2 rounded-lg border border-gray-300 text-gray-700">교체</button>
                </div>
              ) : (
                <input
                  type="password" autoComplete="off" placeholder="붙여넣기"
                  value={settings[f.key] ?? ''}
                  onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {/**
        * 💾 2026-08-25 — **이 카드에 저장 버튼이 없었다.**
        *   페이지의 유일한 저장 버튼이 맨 위 헤더에 있어서, 맨 아래인 이 칸에 토큰을 붙여넣고
        *   저장을 찾다가 못 찾는다(그날 대표가 실제로 그랬고 왕복이 여러 번 났다).
        *   같은 `save()` 를 부르므로 동작은 헤더 버튼과 동일하다 — 손이 닿는 자리에 하나 더 둘 뿐이다.
        */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {Object.keys(edit).some(k => edit[k])
            ? '값을 붙여넣고 저장하세요. 성공하면 토스트에 “API 토큰 교체됨” 이 뜹니다.'
            : '바꾸려면 위의 교체를 누르세요.'}
        </p>
        <button onClick={onSave} disabled={saving}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          저장
        </button>
      </div>
    </div>
  )
}
