/**
 * 📷 매장 계산대 **안 B** (2026-11-03 대표 확정 *"안 B로 해줘"*) — 카메라가 화면 전체를 채운다.
 * 대표: *"너무 필요이상으로 글자가 많아. 심플하고 간결하며 세련되게"*.
 *   · 글자는 네모 아래 한 줄("이용권 QR을 네모 안에")뿐이다.
 *   · 아래 두 칩 [사진] [코드 입력]. 코드 입력은 누르면 입력줄이 열린다(평소엔 안 보인다).
 *   · 되돌릴 수 없다는 경고는 사용 처리 **확인창**(`UseConfirmSheet`)이 한다 — 이 화면엔 쓰지 않는다.
 *   · 결과(통과/오류)는 위에 떠서 1초 안에 읽힌다 — 이 화면에서 가장 중요한 신호다.
 * 상태·카메라 로직은 전부 `VoucherScanner` 가 갖고, 이 파일은 **그리기만** 한다(셀러 대시보드 계산대는 종전 모양 그대로).
 */
import { useState, type RefObject } from 'react'
import { Keyboard, Loader2, Image as ImageIcon, X } from 'lucide-react'
import { OkIcon, BadIcon } from '@/components/icons/urdeal-icons'
import { useTranslation } from '@/lib/i18n-lite'
import ScanFrame from './ScanFrame'

export interface FullScanViewProps {
  videoRef: RefObject<HTMLVideoElement>
  cameraOn: boolean
  cameraError: string | null
  busy: boolean
  locked: boolean
  latest?: { ok: boolean; message: string; productName?: string; code: string; restaurantName?: string; at: string }
  flashKey: number
  help: React.ReactNode
  photoBusy: boolean
  onPickPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void
  manualCode: string
  setManualCode: (v: string) => void
  canSubmit: boolean
  onSubmitManual: (e: React.FormEvent) => void
}

const CHIP = 'flex flex-1 items-center justify-center gap-2 rounded-full bg-white/15 py-3 text-[15px] font-medium text-white backdrop-blur-md active:bg-white/25'

export default function FullScanView(p: FullScanViewProps) {
  const { t } = useTranslation()
  const [typing, setTyping] = useState(false)
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={p.videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted />
      {!p.cameraOn && !p.cameraError && (
        <div className="absolute inset-0 flex items-center justify-center text-[15px] text-white/70">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('seller.scan.cameraStarting', { defaultValue: '카메라 시작 중…' })}
        </div>
      )}
      {p.cameraOn && <ScanFrame locked={p.locked} />}
      {p.cameraOn && (
        <p className="pointer-events-none absolute inset-x-0 top-[calc(50%+128px)] text-center text-[13px] text-white/75">
          {t('seller.scan.aimHint', { defaultValue: '이용권 QR을 네모 안에' })}
        </p>
      )}

      {/* 위 — 결과·오류·도움말이 카메라 위에 뜬다 */}
      <div className="absolute inset-x-4 top-4 space-y-2">
        {p.cameraError && <p className="rounded-2xl bg-tone-warn-bg px-4 py-3 text-[15px] text-tone-warn">{p.cameraError}</p>}
        {p.latest && (
          <div key={p.flashKey} className={`ur-rise flex items-center gap-2 rounded-2xl px-4 py-3 ${p.latest.ok ? 'bg-tone-ok-bg' : 'bg-tone-bad-bg'}`}>
            {p.latest.ok ? <OkIcon className="ur-popin h-7 w-7 shrink-0 text-tone-ok" /> : <BadIcon className="h-7 w-7 shrink-0 text-tone-bad" />}
            <div className="min-w-0">
              <p className={`text-[15px] font-bold ${p.latest.ok ? 'text-tone-ok' : 'text-tone-bad'}`}>{p.latest.message}</p>
              <p className="mt-1 truncate text-[12px] text-gray-600 dark:text-gray-400">{p.latest.productName || p.latest.code} · {p.latest.at}</p>
            </div>
          </div>
        )}
        {p.help}
      </div>

      {p.busy && (
        <div className="absolute inset-x-0 bottom-28 text-center text-[15px] text-white">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{t('seller.scan.processing', { defaultValue: '사용 처리 중…' })}
        </div>
      )}

      {/* 아래 — 두 칩. 코드 입력은 누르면 그 자리가 입력줄로 바뀐다. */}
      <div className="absolute inset-x-4 bottom-[max(24px,env(safe-area-inset-bottom))]">
        {typing ? (
          <form onSubmit={(e) => { p.onSubmitManual(e); setTyping(false) }} className="light-island flex gap-2"> {/* light-fixed: 카메라(검정) 위 흰 입력줄 — 테마와 무관하게 늘 밝다 */}
            <input
              autoFocus
              value={p.manualCode}
              onChange={(e) => p.setManualCode(e.target.value)}
              // ⚠️ 이 넷이 빠지면 폰 키보드가 소문자로 시작하고 자동수정이 코드를 망친다(VoucherScanner 의 실사고).
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('seller.scan.manualPlaceholder', { defaultValue: '코드 직접 입력 (123456)' })}
              className="min-w-0 flex-1 rounded-full bg-white px-4 py-3 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none" // light-fixed: 카메라 위
            />
            <button type="submit" disabled={p.busy || !p.canSubmit} className="rounded-full bg-brand px-5 py-3 text-[15px] font-bold text-white disabled:opacity-40">
              {t('seller.scan.useBtn', { defaultValue: '사용 처리' })}
            </button>
            <button type="button" aria-label={t('common.close', { defaultValue: '닫기' })} onClick={() => setTyping(false)} className="rounded-full bg-white/15 px-3 text-white">
              <X className="h-5 w-5" />
            </button>
          </form>
        ) : (
          <div className="flex gap-2">
            <label className={`${CHIP} cursor-pointer`}>
              {p.photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              {t('seller.scan.photoChip', { defaultValue: '사진' })}
              {/* `capture` 를 붙이지 않는다 — 노트북 스크린샷이나 이미 찍어 둔 사진도 받아야 한다. */}
              <input type="file" accept="image/*" className="hidden" onChange={p.onPickPhoto} disabled={p.photoBusy} />
            </label>
            <button type="button" onClick={() => setTyping(true)} className={CHIP}>
              <Keyboard className="h-4 w-4" />{t('seller.scan.codeChip', { defaultValue: '코드 입력' })}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
