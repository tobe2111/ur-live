/**
 * 👁️ **미리보기** — 지금 고치고 있는 값이 손님에게 어떻게 보이는가 (2026-09-16, 당근 시안 우측 열).
 *
 * ## 왜 있는가
 * 업체 정보는 **입력 칸만 보면 결과를 상상해야 한다.** 당근이 편집 폼 오른쪽에 실제 카드 모양을
 * 띄워 두는 이유이고, 대표가 보내 준 화면의 절반이 이것이다.
 *
 * ## ⚠️ 이 카드는 **폼 상태만** 그린다 — 서버를 다시 부르지 않는다
 * 저장 전에도 타이핑하는 대로 즉시 바뀌어야 "미리보기" 다. 서버 값으로 그리면 저장 후에만
 * 맞는, 이름만 미리보기인 카드가 된다.
 *
 * ## ⚠️ 비공개 칸은 여기 없다
 * 매장 확인 PIN·담당자 전화번호는 손님 화면에 안 나간다. 미리보기에 넣으면 사장님이
 * "손님에게 보이는구나" 로 읽는다 — 그 오해가 곧 개인정보 사고다.
 */
import { Phone, MapPin, Store, Globe, MessageCircle } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import type { StoreInfoForm } from './useStoreInfo'

interface Props {
  form: StoreInfoForm
  /** 카카오 업종(예: "음식점 > 일식 > 돈까스,우동") — 편집 대상이 아니라 표시만. */
  category?: string
}

/** "서울특별시 서초구 방배동 919-20" → "방배동" — 당근 카드의 부제가 쓰는 조각. */
export function districtOf(address: string): string {
  const parts = String(address || '').trim().split(/\s+/)
  const dong = parts.find((p) => /(동|읍|면|가)$/.test(p) && p.length >= 2)
  return dong || parts[2] || parts[1] || ''
}

/** "음식점 > 일식 > 돈까스,우동" → "돈까스,우동" — 맨 끝이 사람이 아는 이름이다. */
export function categoryLeaf(category: string): string {
  const leaf = String(category || '').split('>').pop()
  return (leaf || '').trim()
}

export default function StorePreviewCard({ form, category }: Props) {
  const sub = [districtOf(form.address), categoryLeaf(category || '')].filter(Boolean).join(' · ')
  const links = [
    { key: 'website_url', icon: Globe, value: form.website_url },
    { key: 'kakao_chat_link', icon: MessageCircle, value: form.kakao_chat_link },
  ].filter((l) => l.value)

  return (
    <div className="rounded-xl bg-white shadow-lift overflow-hidden">
      <p className="px-4 pt-3 text-[11px] font-bold text-gray-400">손님에게 보이는 모습</p>

      {form.banner_url ? (
        <img
          src={cfImage(form.banner_url, { width: 640 })}
          onError={(e) => cfImageOnError(e.currentTarget, form.banner_url)}
          alt="" width={640} height={160}
          className="mt-2 w-full h-[104px] object-cover"
        />
      ) : (
        <div className="mt-2 w-full h-[104px] bg-gray-100" aria-hidden="true" />
      )}

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2.5 -mt-5">
          <div className="h-11 w-11 shrink-0 rounded-full bg-white p-0.5 shadow-lift overflow-hidden">
            {form.profile_image ? (
              <img
                src={cfImage(form.profile_image, { width: 88 })}
                onError={(e) => cfImageOnError(e.currentTarget, form.profile_image)}
                alt="" width={88} height={88}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="h-full w-full rounded-full bg-gray-100 flex items-center justify-center">
                <Store className="h-5 w-5 text-gray-400" strokeWidth={1.6} aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0 pt-5">
            <p className="truncate text-[15px] font-bold text-gray-900">
              {form.name || '매장 이름'}
            </p>
            {sub && <p className="truncate text-[11px] text-gray-500">{sub}</p>}
          </div>
        </div>

        {form.bio && (
          <p className="mt-3 text-[12px] leading-relaxed text-gray-700 whitespace-pre-wrap line-clamp-4">
            {form.bio}
          </p>
        )}

        <div className="mt-3 space-y-1.5">
          <Row icon={Phone} text={form.phone} placeholder="전화번호" />
          <Row icon={MapPin} text={form.address} placeholder="주소" />
          {links.map((l) => (
            <Row key={l.key} icon={l.icon} text={l.value} placeholder="" />
          ))}
        </div>

        {/* 좌표가 있으면 그 사실만 알린다 — 여기서 지도를 또 띄우면 편집 폼의 지도와 두 벌이 된다. */}
        {form.lat && form.lng && (
          <p className="mt-2 text-[10px] text-gray-400">
            지도에 표시됨 · {Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ icon: Icon, text, placeholder }: { icon: typeof Phone; text: string; placeholder: string }) {
  const empty = !text
  if (empty && !placeholder) return null
  return (
    <p className={`flex items-start gap-2 text-[12px] ${empty ? 'text-gray-300' : 'text-gray-700'}`}>
      <Icon className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={1.6} aria-hidden="true" />
      <span className="min-w-0 break-all">{text || placeholder}</span>
    </p>
  )
}
