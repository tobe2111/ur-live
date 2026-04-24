/**
 * InlineCameraPreview — getUserMedia 미니 카메라 preview
 *
 * 셀러가 어느 송출 도구를 쓰든 (OBS/Prism/YouTube Studio), 우리 앱 안에서
 * 자기 얼굴/카메라를 확인할 수 있게 해주는 작은 블록.
 * 실제 방송은 아님 — 순수 로컬 preview.
 */

import { useEffect, useRef, useState } from 'react'
import { VideoIcon, MicOff, Mic, CameraOff, RefreshCw } from 'lucide-react'

export function InlineCameraPreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedCam, setSelectedCam] = useState<string>('')

  async function start(deviceId?: string) {
    setErr(null)
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false, // 하울링 방지, 마이크 시각화는 별도
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setActive(true)
      // 카메라 목록 로드
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter(d => d.kind === 'videoinput'))
    } catch (e: unknown) {
      const err = e as Error
      setErr(err.message || '카메라 접근 실패')
      setActive(false)
    }
  }

  function stop() {
    try {
      streamRef.current?.getTracks().forEach(t => t.stop())
    } catch { /* ignore */ }
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setActive(false)
  }

  useEffect(() => {
    return () => stop()
  }, [])

  if (!active) {
    return (
      <button onClick={() => start()}
        className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-blue-300 text-left">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
          <VideoIcon className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">카메라 미리보기 켜기</p>
          <p className="text-xs text-gray-500">방송 전 내 화면 확인 (로컬 미리보기, 방송에 영향 없음)</p>
        </div>
        {err && <span className="text-[10px] text-red-500 shrink-0">{err}</span>}
      </button>
    )
  }

  return (
    <div className="bg-black rounded-xl overflow-hidden relative">
      <video ref={videoRef} autoPlay playsInline muted={muted}
        className="w-full aspect-video object-cover" />
      <div className="absolute top-2 right-2 flex gap-1.5">
        {devices.length > 1 && (
          <select value={selectedCam}
            onChange={e => { setSelectedCam(e.target.value); stop(); start(e.target.value) }}
            className="bg-black/60 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm">
            {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || '카메라'}</option>)}
          </select>
        )}
        <button onClick={() => setMuted(m => !m)}
          className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-md backdrop-blur-sm"
          title="소리 토글">
          {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
        <button onClick={() => { stop(); start(selectedCam) }}
          className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-md backdrop-blur-sm"
          title="새로고침">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={stop}
          className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-md backdrop-blur-sm"
          title="끄기">
          <CameraOff className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-md backdrop-blur-sm">
        🔒 로컬 미리보기
      </div>
    </div>
  )
}
