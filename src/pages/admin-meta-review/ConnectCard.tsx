/**
 * 🎬 로그인 카드 — 앱 ID·시크릿 저장(처음 한 번) + "Log in with …" 버튼(실제 메타 로그인 화면으로 이동).
 * ⚠️ 라이트 대시보드 — dark: variant 금지.
 */
import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Loader2, LogIn, LogOut, Save } from 'lucide-react'
import { apiErr, field, getData, type ProviderStatus } from './shared'
import { BASE } from './shared'

export default function ConnectCard({ provider, s, onChange }: { provider: 'threads' | 'facebook'; s: ProviderStatus; onChange: () => void }) {
  const [appId, setAppId] = useState(s.app_id || '')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const name = provider === 'threads' ? 'Threads' : 'Facebook (Instagram)'

  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn() } finally { setBusy(null) } }
  const save = () => run('save', async () => {
    try { await api.put(`${BASE}/app/${provider}`, { app_id: appId.trim(), app_secret: secret.trim() || undefined }); setSecret(''); toast.success('Saved / 저장됨'); onChange() }
    catch (e) { toast.error(apiErr(e, '저장하지 못했어요')) }
  })
  const login = () => run('login', async () => {
    try { const d = await getData<{ url: string }>(`${BASE}/connect/${provider}`); window.location.href = d.url }
    catch (e) { toast.error(apiErr(e, '로그인을 시작하지 못했어요')) }
  })
  const logout = () => run('logout', async () => {
    try { await api.post(`${BASE}/disconnect/${provider}`); toast.success('Disconnected'); onChange() } catch (e) { toast.error(apiErr(e, '해제하지 못했어요')) }
  })

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-gray-900">{name}</p>
        {s.connected
          ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Connected as @{s.username || s.account_id}</span>
          : <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Not connected</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={login} disabled={!s.app_id || !s.app_secret_set || busy !== null}>
          {busy === 'login' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <LogIn className="mr-1 h-4 w-4" />}
          {provider === 'threads' ? 'Log in with Threads' : 'Log in with Facebook'}
        </Button>
        {s.connected && (
          <Button variant="outline" onClick={logout} disabled={busy !== null}><LogOut className="mr-1 h-4 w-4" />Disconnect</Button>
        )}
      </div>

      <details className="mt-3 text-xs text-gray-600" open={!s.app_id || !s.app_secret_set}>
        <summary className="cursor-pointer">App settings (처음 한 번만 · 녹화 전에 닫아 두세요)</summary>
        <div className="mt-2 space-y-2">
          <input className={field} placeholder={provider === 'threads' ? 'Threads app ID' : 'Meta app ID'} value={appId} onChange={e => setAppId(e.target.value)} inputMode="numeric" />
          <input className={field} placeholder={s.app_secret_set ? 'App secret (saved — leave blank to keep)' : 'App secret'} value={secret} onChange={e => setSecret(e.target.value)} type="password" autoComplete="off" />
          <p>Redirect URI (메타 앱에 등록): <code className="break-all text-gray-800">{s.redirect_uri}</code></p>
          <p>Scopes: <code className="break-all text-gray-800">{s.scopes.join(', ')}</code></p>
          <Button size="sm" variant="outline" onClick={save} disabled={!appId.trim() || busy !== null}><Save className="mr-1 h-4 w-4" />Save</Button>
        </div>
      </details>
    </div>
  )
}
