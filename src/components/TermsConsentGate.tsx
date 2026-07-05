/**
 * 📜 2026-07-05 약관 동의 게이트 — 카카오 유저 첫 로그인 직후 자체 동의 스텝 + 개정 재동의 골격.
 *
 * 동작:
 *  1. 로그인 상태에서 마운트되면, localStorage 에 현행 버전 서명(ur_terms_ok_v1)이 있으면 no-op(0 API).
 *  2. 없으면 GET /api/terms/status → needs_consent(필수 문서의 현행 버전 동의 부재)면 모달 표시.
 *     — 신규 유저(첫 로그인)와 약관 개정(버전 업 → 서명 불일치 + 서버 미동의) 모두 이 하나로 커버.
 *  3. 필수(이용약관/개인정보) 개별 체크 + 선택(위치/마케팅) 분리(PIPA). POST /api/terms/agree —
 *     버전은 서버가 SSOT 에서 스탬프. 성공 시 서명 저장 → 재표시 없음.
 *
 * 카카오싱크 동의화면과 별개로 자체 로그를 남기는 이유: 자사 약관(버전 포함) 동의 증적은
 * 카카오가 아니라 우리 DB(terms_agreements)에 있어야 분쟁 시 효력 주장 가능.
 */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Z } from '@/constants/z-index'
import { TERMS_DOC_VERSIONS } from '@/shared/constants/terms-versions'

const LS_KEY = 'ur_terms_ok_v1'
const versionSignature = () => JSON.stringify(TERMS_DOC_VERSIONS)

// 동의 모달을 띄우지 않는 표면 — 결제/콜백/대시보드(별도 약관 체계) 흐름 방해 금지.
const SKIP_PREFIXES = ['/auth', '/oauth', '/checkout', '/payment', '/points/charge', '/toss', '/seller', '/admin', '/agency', '/wholesale', '/supplier', '/ads', '/blog']

export default function TermsConsentGate() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [checks, setChecks] = useState({ service: false, privacy: false, location: false, marketing: false })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    try {
      if (SKIP_PREFIXES.some((p) => location.pathname.startsWith(p))) return
      if (localStorage.getItem(LS_KEY) === versionSignature()) return
      // 로그인 여부 동기 판별 (비로그인 → 게이트 없음; 로그인/가입 후 재마운트 시 재평가)
      import('@/utils/auth').then(({ isLoggedInSync }) => {
        if (!isLoggedInSync()) return
        import('@/lib/api').then(({ default: api }) => {
          api.get('/api/terms/status').then((r) => {
            if (!r.data?.success) return
            if (r.data.data?.needs_consent) {
              const st = r.data.data.status || {}
              setChecks({
                service: !!st.service, privacy: !!st.privacy,
                location: !!st.location, marketing: !!st.marketing,
              })
              setOpen(true)
            } else {
              localStorage.setItem(LS_KEY, versionSignature())
            }
          }).catch(() => { /* 네트워크 실패 — 다음 방문에서 재시도 */ })
        }).catch(() => {})
      }).catch(() => {})
    } catch { /* SSR/프라이빗 모드 */ }
    // 첫 마운트 1회만 — 라우트 이동마다 재조회하지 않음 (로그인 직후는 전체 리로드라 재평가됨)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!open) return null

  const requiredOk = checks.service && checks.privacy
  const allChecked = requiredOk && checks.location && checks.marketing

  const submit = async () => {
    if (!requiredOk || submitting) return
    setSubmitting(true)
    try {
      const { default: api } = await import('@/lib/api')
      const r = await api.post('/api/terms/agree', {
        agreements: [
          { doc_type: 'service', agreed: checks.service },
          { doc_type: 'privacy', agreed: checks.privacy },
          { doc_type: 'location', agreed: checks.location },
          { doc_type: 'marketing', agreed: checks.marketing },
        ],
      })
      if (r.data?.success) {
        localStorage.setItem(LS_KEY, versionSignature())
        setOpen(false)
      }
    } catch { /* 실패 시 모달 유지 — 재시도 가능 */ }
    setSubmitting(false)
  }

  const Row = ({ k, label, required, href }: { k: keyof typeof checks; label: string; required?: boolean; href?: string }) => (
    <label className="flex items-center gap-2.5 py-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checks[k]}
        onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))}
        className="w-4 h-4 accent-gray-900 dark:accent-white"
      />
      <span className="flex-1 text-[13px] text-gray-800 dark:text-gray-200">
        <span className={required ? 'font-bold' : ''}>{required ? '[필수] ' : '[선택] '}{label}</span>
      </span>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" className="text-[11px] text-gray-400 dark:text-gray-500 underline underline-offset-2 shrink-0">보기</a>
      )}
    </label>
  )

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ zIndex: Z.MODAL_BACKDROP }}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#121212] rounded-t-2xl sm:rounded-2xl p-5 border border-gray-100 dark:border-[#2A2A2A]" style={{ zIndex: Z.MODAL_BODY }}>
        <h2 className="text-base font-extrabold text-gray-900 dark:text-white">약관에 동의해주세요</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          유어딜을 이용하려면 아래 약관 동의가 필요해요. 동의 내역은 버전과 함께 안전하게 기록됩니다.
        </p>
        <div className="mt-3 border-b border-gray-100 dark:border-[#1A1A1A] pb-1">
          <label className="flex items-center gap-2.5 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => {
                const v = e.target.checked
                setChecks({ service: v, privacy: v, location: v, marketing: v })
              }}
              className="w-4 h-4 accent-gray-900 dark:accent-white"
            />
            <span className="text-sm font-bold text-gray-900 dark:text-white">전체 동의</span>
          </label>
        </div>
        <div className="mt-1">
          <Row k="service" label="서비스 이용약관" required href="/terms" />
          <Row k="privacy" label="개인정보 수집·이용" required href="/privacy" />
          <Row k="location" label="위치기반 서비스 (내 동네 딜 추천)" />
          <Row k="marketing" label="혜택·이벤트 알림 받기" />
        </div>
        <button
          type="button"
          disabled={!requiredOk || submitting}
          onClick={submit}
          className="mt-4 w-full py-3 rounded-xl text-sm font-bold bg-gray-900 text-white dark:bg-white dark:text-gray-900 disabled:opacity-40 active:scale-[0.99] transition-all"
        >
          {submitting ? '저장 중…' : '동의하고 시작하기'}
        </button>
      </div>
    </div>
  )
}
