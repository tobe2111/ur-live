import { useEffect, useState } from 'react'
import { getTossPayments, getTossClientKey } from '@/lib/toss-preload'
import { detectTossClientKeyType } from '@/lib/toss-key-type'
import api from '@/lib/api'

/**
 * 🛡️ 2026-05-23 긴급 진단 페이지 — Toss 결제 상태 실시간 노출.
 *
 * 사용자 신고 (반복): 결제 위젯 무한 로딩 / "결제위젯 연동 키 미지원" 에러.
 * 원인 추측만으로 fix 가 계속 빗나가 ground truth 데이터 수집 필요.
 *
 * 본 페이지가 표시:
 *   1) 클라이언트 키 (VITE env) — 일부 마스킹 + prefix
 *   2) 서버가 응답한 키 — 일부 마스킹 + prefix
 *   3) detectTossClientKeyType 판정 결과 (widget / gck / unknown / missing)
 *   4) loadTossPayments() 호출 성공/실패
 *   5) tossPayments.widgets({customerKey}) 호출 성공/실패
 *   6) widgets.setAmount() 성공/실패
 *   7) widgets.renderPaymentMethods({variantKey:'DEFAULT'}) 성공/실패 + raw 에러
 *   8) variantKey 생략 fallback 시도 + raw 에러
 *
 * 운영자가 이 페이지 접속 → 스크린샷 공유 → 정확한 원인 즉시 식별 가능.
 */
export default function TossDebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [clientKeyEnv, setClientKeyEnv] = useState<string>('')
  const [clientKeyServer, setClientKeyServer] = useState<string>('')

  function mask(key: string): string {
    if (!key) return '(empty)'
    if (key.length <= 12) return key
    return `${key.slice(0, 12)}...${key.slice(-4)}`
  }

  function log(msg: string) {
    setLogs(prev => [...prev, `[${new Date().toISOString().slice(11, 19)}] ${msg}`])
  }

  useEffect(() => {
    const envKey = getTossClientKey()
    setClientKeyEnv(envKey)
    log(`VITE_TOSS_CLIENT_KEY: ${mask(envKey)} (type=${detectTossClientKeyType(envKey)})`)

    api.get('/api/payments/client-key')
      .then(r => {
        const key = r.data?.data?.clientKey || r.data?.clientKey
        const flow = r.data?.data?.flow
        setClientKeyServer(key || '')
        log(`server /api/payments/client-key → key=${mask(key)} (type=${detectTossClientKeyType(key)}) flow=${flow}`)
        return key || envKey
      })
      .catch(err => {
        log(`server clientKey fetch FAILED: ${err.message}`)
        return envKey
      })
      .then(async (key: string) => {
        if (!key) { log('[STOP] no clientKey'); return }

        log(`loadTossPayments(${mask(key)})...`)
        let toss
        try {
          toss = await getTossPayments(key)
          log('loadTossPayments → OK')
        } catch (e) {
          log(`loadTossPayments FAILED: ${(e as Error).message}`)
          return
        }

        const customerKey = `user_debug_${Date.now()}`
        log(`tossPayments.widgets({customerKey="${customerKey}"})...`)
        let widgets
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          widgets = (toss as any).widgets({ customerKey })
          log(`widgets() → ${widgets ? 'OK' : 'NULL'}`)
        } catch (e) {
          log(`widgets() FAILED: ${(e as Error).message}`)
          return
        }
        if (!widgets) return

        log('widgets.setAmount({currency:"KRW", value:1000})...')
        try {
          await widgets.setAmount({ currency: 'KRW', value: 1000 })
          log('setAmount → OK')
        } catch (e) {
          log(`setAmount FAILED: ${(e as Error).message}`)
        }

        log('widgets.renderPaymentMethods({variantKey:"DEFAULT"})...')
        try {
          await widgets.renderPaymentMethods({ selector: '#toss-debug-payment', variantKey: 'DEFAULT' })
          log('renderPaymentMethods(DEFAULT) → OK')
        } catch (e) {
          log(`renderPaymentMethods(DEFAULT) FAILED: ${(e as Error).message}`)
          log('  → variantKey 생략 fallback 시도...')
          try {
            await widgets.renderPaymentMethods({ selector: '#toss-debug-payment' })
            log('renderPaymentMethods(no variantKey) → OK')
          } catch (e2) {
            log(`renderPaymentMethods(no variantKey) FAILED: ${(e2 as Error).message}`)
          }
        }

        log('widgets.renderAgreement({variantKey:"AGREEMENT"})...')
        try {
          await widgets.renderAgreement({ selector: '#toss-debug-agreement', variantKey: 'AGREEMENT' })
          log('renderAgreement(AGREEMENT) → OK')
        } catch (e) {
          log(`renderAgreement(AGREEMENT) FAILED: ${(e as Error).message}`)
          log('  → variantKey 생략 fallback 시도...')
          try {
            await widgets.renderAgreement({ selector: '#toss-debug-agreement' })
            log('renderAgreement(no variantKey) → OK')
          } catch (e2) {
            log(`renderAgreement(no variantKey) FAILED: ${(e2 as Error).message}`)
          }
        }

        log('=== DIAGNOSTIC COMPLETE ===')
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-bold mb-4 text-gray-900">Toss 결제 진단</h1>
        <div className="space-y-2 mb-4 text-sm text-gray-700">
          <p><strong>VITE env key:</strong> <code>{mask(clientKeyEnv)}</code> (type={detectTossClientKeyType(clientKeyEnv)})</p>
          <p><strong>server response key:</strong> <code>{mask(clientKeyServer)}</code> (type={detectTossClientKeyType(clientKeyServer)})</p>
          <p><strong>두 키 일치:</strong> {clientKeyEnv === clientKeyServer ? '✅ 동일' : '⚠️ 다름'}</p>
        </div>

        <div className="bg-gray-900 text-green-400 font-mono text-xs p-4 rounded mb-4 max-h-96 overflow-auto">
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">renderPaymentMethods 영역:</p>
            <div id="toss-debug-payment" className="min-h-[120px] bg-gray-50 border border-gray-200 rounded" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">renderAgreement 영역:</p>
            <div id="toss-debug-agreement" className="min-h-[60px] bg-gray-50 border border-gray-200 rounded" />
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          이 페이지 전체 스크린샷을 운영자/개발자에게 공유해주세요.
        </p>
      </div>
    </div>
  )
}
