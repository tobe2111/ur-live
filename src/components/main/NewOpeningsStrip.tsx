/**
 * 🎉 홈 — 우리 동네 새 가게 스트립 (2026-07-27 대표 "남은 것 마저 — 홈 노출").
 *   공개 API(/api/public/new-openings, CDN 15분 캐시) 소비 — 가로 스크롤 카드 + 전체 보기.
 *   **데이터 없으면 null**(개업 수집이 차오르기 전까지 홈에 아무 영향 0 — 안전 롤아웃).
 *   SSR/로딩 잠금 무접촉: 홈 슬롯·피드와 독립된 additive 섹션(기프티콘 entry 와 동일 카드 톤).
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'

interface Opening { biz_name: string; category: string | null; uptae: string | null; region: string | null; apv_perm_ymd: string | null }

const dDay = (ymd: string | null): string => {
  if (!ymd || ymd.length !== 8) return ''
  const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8))
  const n = Math.max(0, Math.floor((Date.now() - t) / 86400_000))
  return n <= 1 ? 'NEW' : `D+${n}`
}
const CAT_EMOJI: Record<string, string> = {
  '일반음식점': '🍽️', '휴게음식점': '☕', '미용업': '💇', '숙박업': '🏨', '병원': '🏥', '학원': '🎓',
  '약국': '💊', '동물병원': '🐾', '이용업': '💈', '목욕장업': '🧖', '체력단련장': '💪', '노래연습장': '🎤',
}

export default function NewOpeningsStrip() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [rows, setRows] = useState<Opening[]>([])

  useEffect(() => {
    let alive = true
    api.get('/api/public/new-openings?days=30&limit=12')
      .then(r => { if (alive && r.data?.success) setRows(r.data.openings || []) })
      .catch(() => { /* 스트립 미표시로 폴백 */ })
    return () => { alive = false }
  }, [])

  if (!rows.length) return null

  return (
    <section className="ur-content-wide px-4 lg:px-8 mt-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">🎉 {t('home.newOpenings', { defaultValue: '우리 동네 새 가게' })}</h2>
        <button onClick={() => navigate('/new-openings')} className="text-[12px] text-gray-500 dark:text-gray-400">
          {t('common.viewAll', { defaultValue: '전체 보기' })} ›
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0">
        {rows.map((o, i) => (
          <button key={i} onClick={() => navigate('/new-openings')}
            className="shrink-0 w-[150px] text-left rounded-xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#1A1C21] p-3 active:scale-[0.98] transition-transform">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[16px]">{CAT_EMOJI[o.category || ''] || '🏪'}</span>
              <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${dDay(o.apv_perm_ymd) === 'NEW' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-gray-100 text-gray-500 dark:bg-[#243049] dark:text-gray-400'}`}>{dDay(o.apv_perm_ymd) || '개업'}</span>
            </div>
            <div className="mt-1.5 text-[12px] font-semibold text-gray-900 dark:text-white truncate">{o.biz_name}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{[o.region, o.uptae || o.category].filter(Boolean).join(' · ')}</div>
          </button>
        ))}
      </div>
    </section>
  )
}
