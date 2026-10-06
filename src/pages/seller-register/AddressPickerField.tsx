/**
 * 📍 매장 주소 — **손으로 치지 않고 골라서 채운다** (2026-09-16 대표 지시)
 *
 * 대표: *"주소지는 자동으로 API로 입력하게끔 하는게 좋잖아."* — 맞다. 그리고 그 부품은
 * 이미 있었다: 매장 등록 모달(`/store/new`)은 **진작부터** `KakaoMapPicker` 로 주소를 채우는데
 * 가입 화면(`/seller/register/supplier`)만 빈 텍스트 칸이었다. 같은 일을 하는 문이 둘인데
 * 하나만 고쳐져 있던 것이다(이 세션에서 세 번째로 만난 클래스).
 *
 * 🔴 **국세청 API 로는 주소를 못 채운다.** `nts-business-verify.ts` 의 `/validate` 는
 *   진위(`valid`)와 휴·폐업(`status`)만 돌려준다 — 상호도 주소도 없다(레포 주석의 실측과 일치).
 *   그래서 주소의 출처는 **카카오 장소 검색**이고, 상호·대표자는 등록증 OCR 이 따로 맡는다.
 *
 * ⚡ **지도는 눌러야 뜬다.** 항상 띄우면 가입하러 온 모든 사장님이 카카오 지도 SDK 를 받는다 —
 *   이 화면은 폼이지 지도가 아니다. 참고 시안도 [주소 줄] → 누르면 [전체 지도] 였다.
 *
 * ⚠️ 키가 없으면(`VITE_KAKAO_JAVASCRIPT_KEY` 미설정) **직접 입력으로 조용히 떨어진다** —
 *   주소 한 칸 때문에 가입이 막히면 안 된다.
 *
 * 🔴 2026-09-21 (대표 확정 "안 B") — **고른 것을 통째로 올려보낸다.**
 *   종전 `onChange(p.road_address_name)` 한 줄이 상호·전화·업종·좌표·place_id **일곱을 버렸고**,
 *   그래서 사장님이 방금 고른 가게를 바로 위 칸에 손으로 다시 쳤다. 이제 두 번째 인자로
 *   `PickedStore` 를 함께 준다 — 직접 입력(키 없음/지도에 없는 가게)은 주소만 주므로 **선택 인자**다.
 */
import { lazy, Suspense, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { INPUT } from './RegisterFields'
import type { PickedStore } from '@/shared/store-place'

const KakaoMapPicker = lazy(() => import('@/components/KakaoMapPicker'))

export default function AddressPickerField({ value, onChange, id, placeholder }: {
  /** 지도에서 고르면 두 번째 인자가 온다. 손으로 치면 주소만 온다(그게 아는 전부다). */
  value: string; onChange: (v: string, place?: PickedStore) => void; id: string; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const kakaoJsKey = (import.meta.env?.VITE_KAKAO_JAVASCRIPT_KEY as string) || ''

  if (!kakaoJsKey) {
    return (
      <input id={id} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder || '예: 서울 마포구 양화로 162'} autoComplete="street-address" className={INPUT} />
    )
  }

  return (
    <>
      <button type="button" id={id} onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 text-left">
        <span className={`min-w-0 flex-1 truncate ${value ? 'text-[17px] font-bold tracking-[-.02em] text-gray-900' : 'text-[17px] text-gray-300'}`}>
          {value || placeholder || '가게 이름으로 찾기'}
        </span>
        <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[10600] flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="매장 주소 찾기">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-rule px-3">
            <MapPin className="h-4 w-4 text-brand-text" aria-hidden />
            <h2 className="flex-1 text-[15px] font-bold text-gray-900">매장 주소</h2>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-gray-600 hover:bg-gray-100">닫기</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Suspense fallback={<p className="py-10 text-center text-[13px] text-gray-500">지도를 불러오는 중…</p>}>
              <KakaoMapPicker
                kakaoJsKey={kakaoJsKey}
                onSelect={(p) => {
                  // 도로명이 있으면 도로명 — 손님이 찾아올 때 쓰는 주소다.
                  const address = p.road_address_name || p.address_name || ''
                  onChange(address, {
                    name: p.place_name || '',
                    address,
                    phone: p.phone || '',
                    category: p.category_name || '',
                    lat: p.y || '',
                    lng: p.x || '',
                    placeId: p.id || '',
                    // 카카오 place 상세 URL — 매장 등록 문이 저장하는 것과 같은 모양.
                    placeUrl: p.id ? `https://place.map.kakao.com/${p.id}` : '',
                  })
                  setOpen(false)
                }}
              />
            </Suspense>
          </div>
        </div>
      )}
    </>
  )
}
