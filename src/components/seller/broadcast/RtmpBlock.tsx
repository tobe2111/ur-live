import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Copy } from 'lucide-react'
import api from '@/lib/api'
import type { ToolPreset } from '@/components/seller/broadcast/broadcast-types'

// ── 권장 프리셋 블록 (OBS/Prism 세팅 안내) ──────────────────────────
// 🛡️ 2026-04-23 배치 167: /api/platforms/streaming-tools/:tool/preset 로부터 로드.
//   사용자가 프리셋을 선택하면 해상도/비트레이트/키프레임/오디오 값을 한 번에 확인 가능.
export function RecommendedPresetBlock({ tool }: { tool: string }) {
  const { t } = useTranslation()
  const [presets, setPresets] = useState<ToolPreset[] | null>(null)
  const [selected, setSelected] = useState(1) // default: 1080p 30fps
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    api.get(`/api/platforms/streaming-tools/${tool}/preset`)
      .then(res => { if (active && res.data?.success) setPresets(res.data.data.presets || []) })
      .catch(() => { /* non-critical */ })
    return () => { active = false }
  }, [tool])

  if (!presets || presets.length === 0) return null
  const p = presets[Math.min(selected, presets.length - 1)]

  return (
    <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-left">
        <span className="text-xs font-semibold text-gray-700">⚙️ {t('seller.liveBroadcast.recommendedPreset')}</span>
        <span className="text-xs text-gray-500">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-white">
          <div className="flex gap-1">
            {presets.map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelected(i)}
                className={`flex-1 px-2 py-1 text-[11px] font-medium rounded border ${
                  selected === i ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-600'
                }`}>
                {preset.label.split(' ')[0]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <PresetRow label={t('seller.liveBroadcast.presetResolution')} value={`${p.resolution} @ ${p.fps}fps`} />
            <PresetRow label={t('seller.liveBroadcast.presetVideoBitrate')} value={`${p.video_bitrate_kbps.toLocaleString()} kbps`} />
            <PresetRow label={t('seller.liveBroadcast.presetAudioBitrate')} value={`${p.audio_bitrate_kbps} kbps`} />
            <PresetRow label={t('seller.liveBroadcast.presetKeyframe')} value={`${p.keyframe_interval_sec}s`} />
          </div>
          <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100">{p.recommended_for}</p>
        </div>
      )}
    </div>
  )
}

export function PresetRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono font-semibold text-gray-900">{value}</span>
    </div>
  )
}

// ── RTMP 복사 블록 ─────────────────────────────────────────────────
export function RtmpBlock({ label, value, fieldKey, copiedField, onCopy }: {
  label: string; value: string; fieldKey: string
  copiedField: string | null; onCopy: (v: string, k: string) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <div className="flex gap-2">
        <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono truncate">
          {value}
        </code>
        <button
          onClick={() => onCopy(value, fieldKey)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0"
        >
          {copiedField === fieldKey
            ? <CheckCircle2 className="w-4 h-4 text-green-500" />
            : <Copy className="w-4 h-4 text-gray-500" />}
        </button>
      </div>
    </div>
  )
}
