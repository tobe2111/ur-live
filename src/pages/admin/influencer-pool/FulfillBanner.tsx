import { useState } from 'react'
import { toast } from '@/hooks/useToast'

/**
 * 🎯 서비스몰 주문 이행 컨텍스트 배너 (2026-07-27 대표 운영수칙 ①)
 *   접수함 "풀에서 이행" 딥링크(?store=&q=&category=)로 열렸을 때만 표시.
 *   발송 명의 규칙(유어애즈 명의 + "의뢰: ○○매장" 병기 — 사칭 소지 제거·브랜드 일관)과
 *   수신거부 문구가 포함된 **협찬 제안 템플릿**을 원클릭 복사 — 발송 모드에서 붙여넣어 사용.
 *   (AI 초안은 유어딜 자체 입점 영업용 명의라 매칭 주문엔 이 템플릿이 정답.)
 */
export default function FulfillBanner() {
  const [sp] = useState(() => new URLSearchParams(window.location.search))
  const store = (sp.get('store') || '').trim()
  if (!store) return null
  const region = (sp.get('q') || '').trim()
  const cat = (sp.get('category') || '').trim()

  const template = `안녕하세요, {인플루언서명}님.
유어애즈(UR Team) 매칭 담당자입니다. (의뢰: ${store}${region ? ` · ${region}` : ''})

${region ? `${region} 지역` : '지역'}에서 ${cat || '로컬'} 콘텐츠를 다루시는 ${'{인플루언서명}'}님 채널과 결이 잘 맞아, ${store}의 협찬(방문 리뷰) 제안을 대신 전달드립니다.

- 내용: 매장 방문 체험 후 콘텐츠 1건 (조건·일정은 협의)
- 관심 있으시면 회신 주세요. 매장과 바로 연결해 드립니다.

— 유어애즈(UR Team) 드림
※ 이런 제안을 원치 않으시면 "수신거부"라고 회신 주세요. 목록에서 즉시 제외되며 다시 연락드리지 않습니다.`

  return (
    <div className="mb-3 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-[13px] text-indigo-900">
          <b>🎯 주문 이행 중</b> — 의뢰 매장: <b>{store}</b>{region ? ` · ${region}` : ''}{cat ? ` · ${cat}` : ''}
          <div className="text-[11px] text-indigo-700 mt-0.5">발송 명의 규칙: <b>유어애즈 명의 + "의뢰: {store}" 병기</b>(매장 사칭 금지) · 수신거부 문구 필수 — 아래 템플릿에 반영됨</div>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(template).then(() => toast.success('협찬 제안 템플릿 복사됨 — 발송 모드에서 붙여넣고 {인플루언서명}만 바꿔 보내세요')) }}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold shrink-0">📋 제안 템플릿 복사</button>
      </div>
    </div>
  )
}
