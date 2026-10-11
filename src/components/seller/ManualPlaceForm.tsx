/**
 * ✍️ **지도에 없는 가게** — 직접 적기 (2026-10-10, 가입 문을 `/store/new` 하나로 합치며)
 *
 * 옛 가입 폼(`/seller/register/supplier`)은 *"지도에 없는 가게(신규 개업·무점포)는 손으로 적는다"* 를
 * 지원했다. 새 문(`StoreRegisterModal`)은 카카오맵 검색만 있어서, 문을 하나로 합치면 **신규 개업한
 * 사장님이 등록할 길이 사라진다.** 서버(`POST /api/seller/stores`)는 원래 이름만 필수라 그대로 받는다.
 *
 * ⚠️ 좌표·플레이스 id 가 없으므로 그 매장은 지도에 핀이 안 뜬다 — 그 사실을 숨기지 않고 적는다
 *    (숨기면 "등록했는데 지도에 없어요" 가 고장으로 읽힌다). 주소를 적으면 나중에 업체 정보에서 보정된다.
 */
import { useState } from 'react'
import type { RegisterPlace } from './StoreRegisterModal'

export default function ManualPlaceForm({ onDone, onCancel }: {
  onDone: (p: RegisterPlace) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const nameOk = name.trim().length > 0 && name.trim().length <= 100
  const input = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400'
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-[12px] font-bold text-gray-700 mb-1">가게 이름</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus placeholder="예: 달빛한스푼" className={input} />
      </label>
      <label className="block">
        <span className="block text-[12px] font-bold text-gray-700 mb-1">주소 <span className="font-normal text-gray-400">(선택)</span></span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} placeholder="도로명 주소" className={input} />
      </label>
      <p className="text-[12px] text-gray-500 leading-relaxed">지도에 없는 가게는 핀이 바로 뜨지 않아요. 카카오맵에 등록되면 업체 정보에서 다시 고를 수 있어요.</p>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="ur-btn ur-btn-md ur-btn-secondary flex-1">지도에서 찾기</button>
        <button type="button" disabled={!nameOk} onClick={() => onDone({ name: name.trim(), address: address.trim() })}
          className="ur-btn ur-btn-md ur-btn-primary flex-1 disabled:opacity-40">이 가게로 진행</button>
      </div>
    </div>
  )
}
