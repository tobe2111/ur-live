/**
 * 🛡️ 2026-05-13: PC 3컬럼 레이아웃 중앙 — 셀러 본인 카메라 미리보기.
 *
 * 송출 시작 전 셀러가 자기 모습 (각도/조명/배경) 확인용. 0초 지연 로컬 video.
 * 시청자가 보는 영상 (YouTube iframe, 3-5s 지연) 과 별개 — 셀러가 시청자 영상을 보면
 * 마이크가 자기 소리를 다시 잡아 에코/하울링 발생하므로 반드시 로컬 video 사용.
 *
 * - getUserMedia 권한 없으면 안내 표시
 * - 모바일 (~< 1024px) 에선 노출 안 함 (lg+ 에서만)
 * - 송출 도구 (BrowserBroadcaster) 가 mount 되면 그 video 가 우선 — 본 컴포넌트는 송출 전 단계에서만
 */
import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, MicOff, Mic } from 'lucide-react'

interface Props {
  className?: string
}

export default function SellerCameraPreview({ className = '' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'idle' | 'requesting' | 'on' | 'denied' | 'unsupported'>('idle')
  const [camOff, setCamOff] = useState(false)
  const [micMuted, setMicMuted] = useState(true)  // 기본 음소거 (에코 방지)

  const start = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported')
      return
    }
    try {
      setStatus('requesting')
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      streamRef.current = s
      if (videoRef.current) {
        videoRef.current.srcObject = s
        await videoRef.current.play().catch(() => {})
      }
      setStatus('on')
    } catch {
      setStatus('denied')
    }
  }

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }

  useEffect(() => {
    return () => { stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!streamRef.current) return
    streamRef.current.getVideoTracks().forEach(t => { t.enabled = !camOff })
  }, [camOff])

  return (
    <div className={`rounded-2xl bg-gray-900 border border-gray-200 overflow-hidden ${className}`}>
      <div className="relative aspect-[9/16] bg-black flex items-center justify-center">
        {status === 'on' && !camOff ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
          <div className="text-center px-4">
            <Camera className="w-12 h-12 mx-auto text-gray-600 mb-3" />
            {status === 'idle' && (
              <>
                <p className="text-sm text-gray-400 mb-3">송출 시작 전 본인 화면을 확인하세요</p>
                <button
                  onClick={start}
                  className="px-4 py-2 rounded-full bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition-colors"
                >
                  📷 카메라 켜기
                </button>
              </>
            )}
            {status === 'requesting' && <p className="text-sm text-gray-400">카메라 권한 요청 중...</p>}
            {status === 'denied' && (
              <>
                <p className="text-sm text-red-400 mb-2">카메라 권한이 거부됐어요</p>
                <p className="text-xs text-gray-500">브라우저 주소창의 카메라 아이콘 클릭 → 허용</p>
              </>
            )}
            {status === 'unsupported' && <p className="text-sm text-gray-400">이 브라우저는 카메라 미지원</p>}
            {camOff && status === 'on' && <p className="text-sm text-gray-400">카메라 OFF</p>}
          </div>
        )}

        {/* 상태 배지 */}
        {status === 'on' && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            미리보기
          </div>
        )}
      </div>

      {status === 'on' && (
        <div className="p-3 flex items-center justify-between bg-gray-50">
          <div className="flex gap-2">
            <button
              onClick={() => setCamOff(v => !v)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                camOff ? 'bg-red-500 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
              aria-label={camOff ? '카메라 켜기' : '카메라 끄기'}
            >
              {camOff ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMicMuted(v => !v)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                !micMuted ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
              aria-label={micMuted ? '마이크 켜기' : '마이크 끄기'}
              title="송출 시 BrowserBroadcaster 가 별도로 마이크 잡으므로 여기선 표시만"
            >
              {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={stop}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
          >
            끄기
          </button>
        </div>
      )}
    </div>
  )
}
