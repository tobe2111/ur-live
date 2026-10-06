/**
 * 🍽️ 승인 카드의 **영업신고증** 칸 (2026-09-21 대표 *"1번은 알겠어. 판매 전으로 하자."*).
 *
 * ## 🩸 왜 생겼나 — 실측
 * 승인 화면에는 **사업자등록증만** 있었다. 영업신고증은 `seller_meta.food_permit_url` 에
 * 저장될 자리가 있는데 **승인하는 사람이 볼 방법이 없었다** — 확인 없이 승인하라는 셈이다.
 * (라이브 보유 0건 · 셀러 7곳. 그리고 판매 승인은 지금도 서류를 안 본다.)
 *
 * ## 🚧 막지 않는다
 * 대표 확정: *"등록증이 없어도 승인 되게끔 해줘. 어차피 내가 보고 승인해야하잖아."*
 * ⇒ 이 부품은 **보여 주기만** 한다. 승인 버튼을 비활성으로 만들거나 경고로 가로막지 않는다.
 * 음식 업종으로 보이면 한 줄 띄울 뿐이고, 그 판단(`needsFoodPermit`)이 틀려도 아무것도 안 막힌다.
 *
 * 🎫 사업자등록증 칸과 **같은 모양**을 쓴다(회색 면 + 제목 + 사진). 나란히 놓이는 두 서류가
 *   서로 다르게 생기면 어느 쪽을 보고 있는지 매번 다시 읽어야 한다.
 */
import { ExternalLink, FileWarning } from 'lucide-react'
import { safeHttpHref } from '@/utils/safe-external-url'

export default function FoodPermitBlock({ url, needed }: {
  url?: string | null
  /** 음식 업종으로 **보이는가**(표시용 힌트) — `shared/food-permit.ts` */
  needed?: boolean
}) {
  // 안 냈고 음식 업종도 아니면 칸 자체를 안 만든다 — 미용실 카드에 빈 상자를 얹지 않는다.
  if (!url && !needed) return null
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-gray-700">영업신고증</p>
        {needed && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border border-rule text-gray-600">
            음식 업종
          </span>
        )}
      </div>
      {url ? (
        <a href={safeHttpHref(url)} target="_blank" rel="noopener noreferrer" className="block">
          <img src={url} alt="영업신고증" className="w-full max-h-56 object-contain rounded-md border border-gray-200 bg-white" />
          <p className="text-[10px] text-gray-700 mt-1 inline-flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> 원본 보기
          </p>
        </a>
      ) : (
        <p className="text-[11px] leading-relaxed text-gray-600 inline-flex items-start gap-1.5">
          <FileWarning className="w-3.5 h-3.5 shrink-0 mt-[1px] text-gray-400" aria-hidden />
          {/* ⚠️ "승인 불가" 라고 쓰지 않는다 — 실제로 막지 않기 때문이다. 화면이 거짓말을 하면 아무도 안 본다. */}
          아직 안 냈어요. 사장님은 대시보드 › 사업자 정보 › 서류 에서 올릴 수 있어요.
        </p>
      )}
    </div>
  )
}
