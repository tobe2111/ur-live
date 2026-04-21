import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Ticket, CheckCircle, XCircle, Loader2, QrCode } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'

/**
 * Parse voucher code from QR scanned content.
 * QR encodes: https://live.ur-team.com/v/{voucher_code}
 * Also accepts raw voucher codes.
 */
function parseVoucherCode(input: string): string {
  const trimmed = input.trim()
  // Match QR URL pattern
  const urlMatch = trimmed.match(/\/v\/([A-Za-z0-9-]+)$/)
  if (urlMatch) return urlMatch[1].toUpperCase()
  // Try full URL parse
  try {
    const url = new URL(trimmed)
    const pathMatch = url.pathname.match(/\/v\/([A-Za-z0-9-]+)$/)
    if (pathMatch) return pathMatch[1].toUpperCase()
  } catch {
    // Not a URL, treat as raw code
  }
  return trimmed.toUpperCase()
}

export default function VoucherVerifyPage() {
  const { code: urlCode } = useParams<{ code: string }>()
  const [code, setCode] = useState(urlCode || '')
  const [pin, setPin] = useState('')
  const [voucher, setVoucher] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // 바우처 조회
  async function lookupVoucher() {
    if (!code.trim()) return
    const parsedCode = parseVoucherCode(code)
    setCode(parsedCode)
    setLoading(true)
    setResult(null)
    try {
      const res = await api.get(`/api/vouchers/verify/${parsedCode}`)
      if (res.data.success) {
        setVoucher(res.data.data)
      } else {
        setResult({ success: false, message: res.data.error || '바우처를 찾을 수 없습니다' })
      }
    } catch {
      setResult({ success: false, message: '바우처를 찾을 수 없습니다' })
    } finally {
      setLoading(false)
    }
  }

  // 바우처 사용 처리
  async function useVoucher() {
    if (!pin.trim()) return
    setVerifying(true)
    try {
      const res = await api.post(`/api/vouchers/${code.trim()}/use`, { pin: pin.trim() })
      setResult({ success: res.data.success, message: res.data.message || res.data.error || '' })
      if (res.data.success) setVoucher(null)
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      setResult({ success: false, message: err_.response?.data?.error || '처리 중 오류가 발생했습니다' })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-5">
      <SEO title="식사권 확인" description="QR 코드로 식사권을 확인합니다" url={urlCode ? `/v/${urlCode}` : '/v'} noindex />
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
            <Ticket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-gray-900">식사권 인증</h1>
          <p className="text-sm text-gray-500 mt-1">고객의 바우처 코드를 확인하세요</p>
        </div>

        {/* 결과 표시 */}
        {result && (
          <div className={`mb-5 p-4 rounded-xl flex items-start gap-3 ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {result.success ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
            <p className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>{result.message}</p>
          </div>
        )}

        {!voucher ? (
          /* Step 1: 코드 입력 */
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">바우처 코드</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onPaste={e => {
                e.preventDefault()
                const pasted = e.clipboardData.getData('text')
                setCode(parseVoucherCode(pasted))
              }}
              placeholder="UR-XXXX-XXXX"
              className="w-full px-4 py-3.5 border border-gray-300 rounded-xl text-center text-lg text-gray-900 font-mono font-bold tracking-widest focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              maxLength={60}
            />
            <div className="flex items-center gap-1.5 mt-2 justify-center">
              <QrCode className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs text-gray-400">QR 스캔 결과를 붙여넣기하면 자동으로 코드가 추출됩니다</p>
            </div>
            <button
              onClick={lookupVoucher}
              disabled={!code.trim() || loading}
              className="w-full mt-4 py-3.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl disabled:opacity-40 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '조회하기'}
            </button>
          </div>
        ) : voucher.status !== 'unused' ? (
          /* 이미 사용/만료된 바우처 */
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-900 font-bold">{voucher.status === 'used' ? '이미 사용된 바우처' : '만료된 바우처'}</p>
            <p className="text-sm text-gray-500 mt-1">{voucher.product_name}</p>
            <button onClick={() => { setVoucher(null); setCode(''); setResult(null) }} className="mt-4 text-sm text-pink-500 font-medium">다른 바우처 조회</button>
          </div>
        ) : (
          /* Step 2: 바우처 확인 + 비밀번호 입력 */
          <div>
            {/* 바우처 정보 카드 */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              {voucher.product_image && (
                <img src={voucher.product_image} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />
              )}
              <p className="text-base font-bold text-gray-900">{voucher.product_name}</p>
              {voucher.restaurant_name && (
                <p className="text-sm text-gray-500 mt-0.5">📍 {voucher.restaurant_name}</p>
              )}
              <div className="mt-2 bg-white rounded-lg px-3 py-2 text-center">
                <code className="text-lg font-mono font-bold text-pink-500">{voucher.code}</code>
              </div>
              {voucher.expires_at && (
                <p className="text-xs text-gray-400 mt-2 text-center">유효기간: {new Date(voucher.expires_at).toLocaleDateString('ko-KR')}까지</p>
              )}
            </div>

            {/* 비밀번호 입력 */}
            <label className="block text-sm font-medium text-gray-700 mb-2">인증 비밀번호</label>
            <input
              value={pin}
              onChange={e => setPin(e.target.value)}
              type="password"
              placeholder="비밀번호 입력"
              className="w-full px-4 py-3.5 border border-gray-300 rounded-xl text-center text-xl text-gray-900 tracking-[0.5em] focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
              maxLength={10}
            />
            <button
              onClick={useVoucher}
              disabled={!pin.trim() || verifying}
              className="w-full mt-4 py-3.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl disabled:opacity-40 active:scale-[0.98]"
            >
              {verifying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '사용 확인'}
            </button>
            <button onClick={() => { setVoucher(null); setCode(''); setPin(''); setResult(null) }} className="w-full mt-2 py-2 text-sm text-gray-500">취소</button>
          </div>
        )}
      </div>
    </div>
  )
}
