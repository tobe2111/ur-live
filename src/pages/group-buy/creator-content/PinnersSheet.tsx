/**
 * 🎬 "유어딜 N명이 추천해요" 를 누르면 — 이 이용권을 자기 유어샵에 담아 파는 사람들. 누르면 그 사람 유어샵(`/u/:handle`).
 * 그 유어샵에서 사면 그 사람에게 소개가 잡힌다(담기·소개 레일 그대로 — 이 창은 길만 연다).
 */
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, X } from 'lucide-react'
import type { PinPerson } from '@/shared/creator-content'

export default function PinnersSheet({ pinners, onClose }: { pinners: PinPerson[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label="유어딜에서 추천하는 사람" className="fixed inset-0 z-[80] flex items-end">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default border-0 bg-black/45" />
      <div className="relative max-h-[70dvh] w-full overflow-y-auto rounded-t-2xl bg-surface px-5 pt-5 shadow-lift"
        style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-gray-900 dark:text-white">유어딜에서 추천해요</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-gray-500 dark:text-gray-400"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">이 이용권을 자기 유어샵에서 판매 중인 사람들이에요</p>
        <ul className="mt-3 divide-y divide-rule">
          {pinners.map((p) => (
            <li key={p.user_id}>
              <Link to={`/u/${p.handle}`} onClick={onClose} className="flex items-center gap-3 py-3 active:opacity-70">
                <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-warm">
                  {p.avatar && <img src={p.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-gray-900 dark:text-white">{p.name || p.handle}</span>
                  <span className="block truncate text-[13px] text-gray-500 dark:text-gray-400">@{p.handle} · 유어샵 보기</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
