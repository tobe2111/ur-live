/**
 * 📱 대시보드 세션(기기) 관리 모달 — 2026-08-12 대표 지시 "제대로 만들기".
 *
 * 왜 있는가: 대시보드는 원래 **단일 세션**이라 다른 브라우저에서 로그인하면 기존 세션이 끊겼다.
 *   불편하지만 그건 **도용 탐지 신호**이기도 했다(남이 내 계정으로 들어오면 내가 튕겨서 안다).
 *   동시 로그인을 허용하면 그 신호가 사라지므로, 이 화면이 **대체 장치**다 —
 *   "지금 어디서 들어와 있나"를 보고 낯선 기기를 **개별로** 끊는다.
 *
 * ⚠️ 어드민 화면이라 `dark:` variant 를 쓰지 않는다(대시보드는 라이트 고정 — CLAUDE.md 테마 규칙).
 */
import { useState } from 'react'
import { X, Monitor, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface SessionRow {
  iat: number
  first_seen: string | null
  user_agent: string | null
  ip: string | null
  revoked: number
  multi_session: number
  active: boolean
}

/** UA 문자열에서 사람이 알아볼 만한 것만 뽑는다 — 전체를 보여주면 아무도 안 읽는다. */
function prettyUa(ua: string | null): string {
  if (!ua) return '알 수 없는 기기'
  const os = /Windows/i.test(ua) ? 'Windows' : /Macintosh|Mac OS/i.test(ua) ? 'Mac'
    : /iPhone|iPad/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : ''
  const br = /Edg\//i.test(ua) ? 'Edge' : /Chrome\//i.test(ua) ? 'Chrome'
    : /Safari\//i.test(ua) ? 'Safari' : /Firefox\//i.test(ua) ? 'Firefox' : ''
  return [os, br].filter(Boolean).join(' · ') || ua.slice(0, 40)
}

export default function SessionManagerModal({
  adminId, adminEmail, currentIat, onClose,
}: {
  adminId: number
  adminEmail: string
  /** 지금 이 브라우저의 토큰 iat — "현재 기기" 를 표시해 자기 세션을 실수로 끊는 걸 막는다. */
  currentIat?: number | null
  onClose: () => void
}) {
  const [rows, setRows] = useState<SessionRow[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` } })

  const load = async () => {
    try {
      const res = await api.get(`/api/admin/admins/${adminId}/sessions`, authHeader())
      setRows(res.data?.data?.sessions ?? [])
    } catch {
      toast.error('세션 목록을 불러오지 못했습니다')
      setRows([])
    }
  }
  if (rows === null) void load()

  const revoke = async (iat: number) => {
    if (currentIat && iat === currentIat) {
      toast.error('지금 쓰고 있는 기기입니다 — 로그아웃 버튼을 쓰세요')
      return
    }
    setBusy(iat)
    try {
      await api.post(`/api/admin/admins/${adminId}/sessions/${iat}/revoke`, {}, authHeader())
      toast.success('해당 기기를 로그아웃시켰습니다')
      await load()
    } catch {
      toast.error('세션 종료에 실패했습니다')
    } finally {
      setBusy(null)
    }
  }

  const live = (rows ?? []).filter(r => r.active)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">로그인된 기기</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{adminEmail} · 접속 중 {live.length}대</p>

        {rows === null ? (
          <div className="py-10 text-center text-gray-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />불러오는 중…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">기록된 기기가 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const isMe = !!currentIat && r.iat === currentIat
              return (
                <li key={r.iat} className={`flex items-center gap-3 rounded-lg border p-3 ${r.active ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}>
                  <Monitor className={`w-5 h-5 shrink-0 ${r.active ? 'text-gray-700' : 'text-gray-300'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {prettyUa(r.user_agent)}
                      {isMe && <span className="ml-2 text-[11px] font-bold text-emerald-600">현재 기기</span>}
                      {!r.active && <span className="ml-2 text-[11px] text-gray-400">종료됨</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {r.ip || 'IP 미상'} · {r.first_seen ? r.first_seen.replace('T', ' ').slice(0, 16) : '시각 미상'}
                    </p>
                  </div>
                  {r.active && !isMe && (
                    <button
                      onClick={() => revoke(r.iat)}
                      disabled={busy === r.iat}
                      className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {busy === r.iat ? '처리 중…' : '로그아웃'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-gray-400">
          기록은 로그인할 때 남습니다. 낯선 기기가 보이면 즉시 로그아웃시키고 비밀번호를 바꾸세요.
        </p>
      </div>
    </div>
  )
}
