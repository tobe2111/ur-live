/**
 * 🛡️ 2026-05-17: 공구권 지역 선택 모달 — 당근/배민 스타일 2-column picker.
 *
 * 시안 (사용자 제공 2026-05-17):
 *   좌측: 시/도 sidebar (서울, 경기, 인천, ...)
 *   우측: 선택된 시/도의 동/역 그룹 목록 + 상단 "전체 >" 행
 *
 * 라이트/다크 테마 모두 지원.
 */

import { useState, useEffect } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { KOREA_REGIONS } from '@/shared/constants/korea-regions'

interface Props {
  open: boolean
  regionKey: string | null
  districtKey: string | null
  onClose: () => void
  /** 사용자가 "전체" 또는 동/역 그룹 선택 시 호출. district=null 이면 시/도 전체 */
  onSelect: (region: string | null, district: string | null) => void
}

export default function RegionPickerModal({ open, regionKey, districtKey, onClose, onSelect }: Props) {
  // 좌측 패널 활성 시/도 — 첫 진입 시 props 의 regionKey 우선, 없으면 첫 번째 (서울)
  const [activeRegion, setActiveRegion] = useState<string>(regionKey || KOREA_REGIONS[0].key)

  useEffect(() => {
    if (open) setActiveRegion(regionKey || KOREA_REGIONS[0].key)
  }, [open, regionKey])

  if (!open) return null

  const region = KOREA_REGIONS.find(r => r.key === activeRegion) || KOREA_REGIONS[0]

  return (
    <div
      className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-[#0A0A0A] w-full h-full sm:h-[600px] sm:max-w-2xl sm:rounded-2xl border border-gray-200 dark:border-[#2A2A2A] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="지역 선택"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 -ml-1 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1A1A1A]"
              aria-label="닫기"
            >
              <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <span className="text-base font-bold text-gray-900 dark:text-white">지역 선택</span>
          </div>
        </div>

        {/* Body: 2 column */}
        <div className="flex-1 flex min-h-0">
          {/* 좌측 시/도 sidebar */}
          <div className="w-[88px] sm:w-[100px] border-r border-gray-100 dark:border-[#1A1A1A] overflow-y-auto bg-gray-50 dark:bg-[#0A0A0A]">
            {KOREA_REGIONS.map(r => {
              const active = r.key === activeRegion
              return (
                <button
                  key={r.key}
                  onClick={() => setActiveRegion(r.key)}
                  className={`w-full text-center py-3.5 px-2 text-[13px] font-semibold transition-colors whitespace-pre-line leading-tight ${
                    active
                      ? 'bg-white dark:bg-[#111] text-gray-900 dark:text-white border-l-[3px] border-pink-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>

          {/* 우측 동/역 그룹 panel */}
          <div className="flex-1 overflow-y-auto">
            {/* "전체 >" 행 */}
            <button
              onClick={() => {
                onSelect(region.key, null)
                onClose()
              }}
              className={`w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1A1A1A] transition-colors ${
                regionKey === region.key && !districtKey
                  ? 'bg-pink-50 dark:bg-pink-950/30'
                  : 'hover:bg-gray-50 dark:hover:bg-[#111]'
              }`}
            >
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">{region.label.replace('\n', ' ')}</span>
              <span className="flex items-center gap-1 text-[13px] text-gray-500 dark:text-gray-400">
                전체 <ChevronRight className="w-4 h-4" />
              </span>
            </button>

            {/* 동/역 그룹 목록 */}
            {region.districtGroups.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {region.label.replace('\n', ' ')} 세부 지역은 곧 추가됩니다.
                </p>
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-2">
                  '전체' 를 선택해 전체 매물을 보세요.
                </p>
              </div>
            ) : (
              <ul className="py-1">
                {region.districtGroups.map(g => {
                  const active = regionKey === region.key && districtKey === g.key
                  return (
                    <li key={g.key}>
                      <button
                        onClick={() => {
                          onSelect(region.key, g.key)
                          onClose()
                        }}
                        className={`w-full text-left px-5 py-3 text-[14px] transition-colors ${
                          active
                            ? 'text-pink-600 dark:text-pink-400 font-bold bg-pink-50/50 dark:bg-pink-950/20'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#111]'
                        }`}
                      >
                        {g.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
