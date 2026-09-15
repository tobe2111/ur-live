/**
 * 🎨 시안 갤러리 `/design/variants` — **구조가 다른 안들을 같은 데이터로 나란히** (2026-09-15 신설).
 *
 * 대표: *"각 페이지마다 이렇게 지금 UI들이 공통적으로 잡혀있는데 어떻게 다른 디자인 시안들로 더 받을 수 있을까?"*
 * 배경·규칙·추가 방법은 `registry.ts` 머리말에 있다.
 *
 * ## 이 화면이 하는 일 셋
 *   ① **같은 데이터**로 안들을 그린다 — 데이터가 다르면 비교가 아니라 착시다.
 *   ② **데이터 상태를 바꾼다**(장사됨 ↔ 비어 있음) — 대표가 불편해한 화면은 대부분 0 일 때 무너진다.
 *   ③ **폭을 고정한다**(폰 430 ↔ 전체) — 레이아웃 판단은 폭이 정해져야 가능하다.
 *
 * ## 🎨 라이트 고정
 *   시안(대시보드)이 라이트 고정이라 **껍데기가 테마를 따라가면 판단이 흐려진다** — 같은 안이 다크
 *   껍데기 위에서 달라 보인다. `force-light-theme`(런타임 강제) + 중립 회색 유틸로 고정한다. light-fixed
 *
 * ## 🔒 안 하는 일
 *   API 호출 0 · 쓰기 0 · 로그인 0. 시안은 전부 가짜 데이터다. 그래서 이 화면은 무엇도 망가뜨릴 수 없다.
 */
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import { SET_INDEX, SET_LOADERS, type VariantSet } from './registry'

const WIDTHS = [
  { id: 'phone', label: '폰 430', px: 430 },
  { id: 'tablet', label: '태블릿 768', px: 768 },
  { id: 'pc', label: '전체', px: 0 },
] as const

export default function DesignVariantsPage() {
  const [params, setParams] = useSearchParams()
  const setId = params.get('set') || SET_INDEX[0].id
  const dataMode = params.get('data') === 'empty' ? 'empty' : 'full'
  const widthId = params.get('w') || 'phone'
  // 🩸 2026-09-15 — 기본값을 뒤집었다. 처음엔 "하나씩"이 기본이라 첫 안(= **지금 쓰는 화면 그대로**)만
  //   떴고, 대표가 열어 보고 *"시안이 안보이는데?"* 했다. 맞는 말이다 — 이미 아는 화면 한 장이 떠 있었다.
  //   이 화면의 목적은 **비교**이므로 기본은 전부 나란히다. 한 안만 크게 보고 싶으면 `?side=0`.
  const side = params.get('side') !== '0'
  const [set, setSet] = useState<VariantSet | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setSet(null); setFailed(false)
    const load = SET_LOADERS[setId]
    if (!load) { setFailed(true); return }
    load().then(m => { if (alive) setSet(m.default) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [setId])

  const width = useMemo(() => WIDTHS.find(w => w.id === widthId) || WIDTHS[0], [widthId])
  const activeId = params.get('v') || set?.variants[0]?.id
  const shown = set ? (side ? set.variants : set.variants.filter(v => v.id === activeId)) : []

  const put = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    setParams(next, { replace: true })
  }

  return (
    <div className="force-light-theme min-h-[100dvh] bg-gray-100">
      {/* 🔒 어디에서도 링크하지 않지만, 주소가 새어도 색인되지 않게 스스로 선언한다. */}
      <SEO title="시안 갤러리" description="내부 디자인 시안 비교 화면" url="/design/variants" noindex />

      <header className="sticky top-0 z-10 border-b border-black/10 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[13px] font-extrabold text-gray-900">시안 갤러리</span>

          <Picker label="화면" value={setId} onPick={(v) => { const n = new URLSearchParams(params); n.set('set', v); n.delete('v'); setParams(n, { replace: true }) }}
            options={SET_INDEX.map(s => ({ id: s.id, label: s.label }))} />

          <Picker label="데이터" value={dataMode} onPick={(v) => put('data', v)}
            options={[{ id: 'full', label: '장사됨' }, { id: 'empty', label: '비어 있음' }]} />

          <Picker label="폭" value={width.id} onPick={(v) => put('w', v)}
            options={WIDTHS.map(w => ({ id: w.id, label: w.label }))} />

          <Picker label="보기" value={side ? '1' : '0'} onPick={(v) => put('side', v)}
            options={[{ id: '1', label: '나란히' }, { id: '0', label: '하나씩' }]} />
        </div>
        {set && (
          <p className="mx-auto mt-2 max-w-[1600px] text-[11.5px] leading-relaxed text-gray-500">
            <span className="font-bold text-gray-700">{set.route}</span>, 안 {set.variants.length}개 · {set.problem}
          </p>
        )}
      </header>

      {failed && <p className="p-8 text-center text-[13px] text-gray-500">그런 시안 세트가 없어요. 주소의 <code>?set=</code> 을 확인해 주세요.</p>}
      {!set && !failed && <p className="p-8 text-center text-[13px] text-gray-400">시안을 불러오는 중…</p>}

      {set && (
        <>
          {!side && (
            <div className="mx-auto flex max-w-[1600px] flex-wrap gap-2 px-4 pt-4">
              {set.variants.map(v => (
                <button key={v.id} onClick={() => put('v', v.id)}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${v.id === activeId ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}>
                  {v.label}
                </button>
              ))}
            </div>
          )}

          <div className={`mx-auto flex max-w-[1600px] flex-wrap items-start gap-6 p-4 ${side ? '' : 'justify-center'}`}>
            {shown.map(v => (
              <figure key={v.id} className="min-w-0" style={width.px ? { width: width.px } : { flex: '1 1 100%' }}>
                <figcaption className="mb-2">
                  <p className="text-[13px] font-extrabold text-gray-900">{v.label}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-gray-500">{v.note}</p>
                </figcaption>
                {/* 시안은 자기 스코프 안에서 그려야 실제와 같은 토큰을 받는다(대시보드 = 라이트 고정). */}
                <div className={`${set.themeClass || ''} overflow-hidden rounded-xl border border-black/10 bg-gray-50 shadow-sm`}>
                  <div className="p-4">
                    <Suspense fallback={<div className="h-40" />}>{v.render({ data: dataMode })}</Suspense>
                  </div>
                </div>
              </figure>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Picker({ label, value, options, onPick }: {
  label: string; value: string; options: { id: string; label: string }[]; onPick: (v: string) => void
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[11px] font-bold text-gray-400">{label}</span>
      <span className="flex rounded-lg bg-gray-100 p-0.5">
        {options.map(o => (
          <button key={o.id} onClick={() => onPick(o.id)}
            className={`rounded-md px-2.5 py-1 text-[12px] font-bold ${o.id === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {o.label}
          </button>
        ))}
      </span>
    </span>
  )
}
