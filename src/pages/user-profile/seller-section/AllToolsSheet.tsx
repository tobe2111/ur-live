/**
 * 🧰 전체 도구 — 마이에서 **모든** 판매 화면으로 (2026-09-26, 설계 §20)
 *   대표: *"모두 마이에서 하도록"*
 *
 * ## 65개를 시트로 다시 만들지 않는다
 * 셀러 화면은 65개다. 전부 시트로 복제하면 두 벌이 갈리고, 그 순간부터 한쪽에만 고쳐진 화면이 생긴다.
 * 여기서 하는 일은 **모든 도구를 마이에서 찾아 들어갈 수 있게** 하는 것이다 — 사장님이
 * "셀러 대시보드라는 게 따로 있다" 를 몰라도 되게. 들어간 화면 맨 위에는 `BackToMyBar` 가
 * "마이로 돌아가기" 를 띄우므로, 나갔다 와도 마이가 출발점이자 도착점이다.
 *
 * ## 목록을 손으로 적지 않는다
 * `useSellerNavModel().commandItems` — 대시보드 사이드바·더보기·⌘K 가 쓰는 **같은 색인**이다.
 * 여기서 따로 적으면 도구가 하나 늘 때마다 두 곳을 고쳐야 하고, 반드시 한쪽을 잊는다.
 * 그 색인은 역할·게이트 필터를 이미 통과한 것이라 **이 좌석에 없는 도구는 애초에 안 들어온다.**
 *
 * ⚠️ 좌석은 호출부(`openTool`)가 이미 맞춰 놓고 연다. 여기서는 고른 주소로 **진입만** 요청한다.
 */
import { useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { useSellerNavModel } from '@/components/seller-layout/useSellerNavModel'
import Sheet from './Sheet'

export default function AllToolsSheet({ storeName, onPick, onClose }: {
  storeName: string
  /** 고른 도구의 주소 — 호출부가 좌석을 확인하고 귀환 표시를 붙여 보낸다. */
  onPick: (path: string) => void
  onClose: () => void
}) {
  const { commandItems } = useSellerNavModel()
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const seen = new Set<string>()
    const out = new Map<string, { path: string; label: string; icon: typeof ChevronRight }[]>()
    for (const it of commandItems) {
      // 같은 화면이 색인에 두 번 들어오는 경우가 있다(탭 형제 ∪ 그룹) — 먼저 온 것만 쓴다.
      if (seen.has(it.path)) continue
      seen.add(it.path)
      if (needle && !it.label.toLowerCase().includes(needle)) continue
      const key = it.group || '기타'
      if (!out.has(key)) out.set(key, [])
      out.get(key)!.push({ path: it.path, label: it.label, icon: it.icon })
    }
    return [...out.entries()]
  }, [commandItems, q])

  const total = groups.reduce((n, [, items]) => n + items.length, 0)

  return (
    <Sheet title="전체 도구" onClose={onClose}>
      <div className="px-4 pt-3 pb-2">
        <p className="text-[12.5px] text-gray-500 dark:text-gray-400 mb-2">
          <span className="font-semibold text-gray-900 dark:text-white">{storeName}</span> 의 판매 도구예요.
          열면 그 화면 위에 마이로 돌아오는 버튼이 있어요.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="도구 찾기"
            aria-label="도구 찾기"
            className="w-full h-11 rounded-xl border border-rule-strong bg-transparent pl-9 pr-3 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      {total === 0 && (
        <p className="px-4 py-10 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          찾는 도구가 없어요. 다른 말로 찾아 보세요.
        </p>
      )}

      <div className="px-4 pb-4 space-y-4">
        {groups.map(([group, items]) => (
          <section key={group}>
            {group && <h3 className="px-1 mb-1.5 text-[12px] font-bold text-gray-400">{group}</h3>}
            <div className="overflow-hidden rounded-xl bg-surface shadow-lift">
              {items.map(({ path, label, icon: Icon }) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => onPick(path)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 text-left border-b border-rule last:border-b-0 active:opacity-70"
                >
                  <Icon size={18} strokeWidth={1.8} className="shrink-0 text-gray-400" aria-hidden="true" />
                  <span className="flex-1 truncate text-[14px] font-semibold text-gray-900 dark:text-white">{label}</span>
                  <ChevronRight size={16} className="shrink-0 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  )
}
