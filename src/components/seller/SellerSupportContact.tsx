/**
 * ☎️ **운영자 문의 경로** — 세션 ⑤ 선행 (체크리스트 O9 · X8 확정 ⓒ)
 *
 * 대표 확정(X8): *"ⓒ 파일럿은 대표 연락처. 운영자가 늘면 ⓐ 카톡 채널로 승격.
 * **티켓 화면(ⓑ)은 만들지 않는다.**"*
 *
 * 그런데 실측상 **표시할 곳이 없었다** — `Seller*.tsx` 전수에 접수 UI 0건,
 * *"관리자에게 문의해주세요"* 같은 **안내 텍스트뿐**이고 그 '관리자'에게 닿는 방법이 어디에도 없다.
 * ⇒ 확정은 됐는데 **구현이 0**이라 O9 가 🔴 로 남아 있었다. 이 컴포넌트가 그 한 칸이다.
 *
 * ## 🔴 티켓 화면이 아니다
 * 폼·스레드·상태 관리 **전부 없다.** 연락처를 **보여주기만** 한다 — 그게 ⓒ 그 자체다.
 * 나중에 ⓐ(카톡 채널)로 승격할 때도 **값만 바꾸면** 된다(아래 참조).
 *
 * ## 🔴 형식은 **카카오 오픈채팅 1:1 링크** (2026-08-02 대표 확정 ④)
 * 전화번호 노출은 **배제**한다 — 개인 번호가 공개 표면 근처로 새면 회수할 방법이 없다.
 * `toHref` 는 전화·이메일 스킴도 지원하지만, 그건 **폴백**이지 권장 형식이 아니다.
 * 대표가 오픈채팅 링크를 생성해 `platform_settings.operator_support_contact` 에 넣으면 이 카드가 뜬다.
 *
 * ## 🔴 값을 코드에 박지 않는다
 * 대표 연락처는 **개인정보**이고 바뀐다. `platform_settings.operator_support_contact` 에서 읽어
 * 어드민이 편집한다. **미설정이면 아무것도 안 그린다**(빈 껍데기 금지 — 기획 §2.1 과 같은 방침).
 * ⇒ 운영자가 늘어 카톡 채널로 옮길 때 **코드 변경 0**, 어드민에서 링크만 교체하면 된다.
 */
import { useEffect, useState } from 'react'
import { LifeBuoy } from 'lucide-react'
import api from '@/lib/api'

/** 링크로 만들 수 있는 값인가(카톡 채널 URL 등). 전화·이메일도 각각 스킴을 붙인다. */
function toHref(v: string): string | null {
  const s = v.trim()
  if (/^https?:\/\//i.test(s)) return s
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(s)) return `mailto:${s}`
  if (/^[\d+\-() ]{7,}$/.test(s)) return `tel:${s.replace(/[^\d+]/g, '')}`
  return null   // 그 외(안내 문장 등)는 링크로 만들지 않는다 — 잘못된 스킴은 안 누르니만 못하다
}

export default function SellerSupportContact() {
  const [contact, setContact] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api.get('/api/seller/support-contact')
      .then((r) => { if (alive) setContact((r.data?.contact as string) || null) })
      .catch(() => { /* 조회 실패 = 미노출. 문의 안내 때문에 대시보드가 시끄러워지지 않게 */ })
    return () => { alive = false }
  }, [])

  // 🔴 미설정이면 **아무것도 안 그린다.** "문의처: (없음)" 은 없느니만 못하다.
  if (!contact) return null

  const href = toHref(contact)
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
        <LifeBuoy className="w-4 h-4" /> 문제가 있으면 알려주세요
      </p>
      <p className="mt-1 text-xs text-gray-500">
        주문·정산·상품 등록에서 막히면 아래로 연락 주세요. 파일럿 기간에는 담당자가 직접 답변합니다.
      </p>
      <p className="mt-2 text-sm font-semibold text-gray-900 break-all">
        {href ? (
          <a href={href} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">{contact}</a>
        ) : contact}
      </p>
    </div>
  )
}
