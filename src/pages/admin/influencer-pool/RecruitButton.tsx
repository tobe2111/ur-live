import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

/**
 * 📣 모집 전환 버튼 (2026-07-27 — 수집 풀의 실질 가치화).
 *   수집만 된 리드는 신청(동의)해야 대행 상품의 재고가 된다. 이 버튼은
 *   ① 리드 전용 추적링크(→ /creators/apply) 발급 ② recruited_at 기록(전환율 분모)
 *   ③ 채널에 맞는 안내 문구를 클립보드에 담는다 — 전달은 사람이 공개 채널로.
 *   서버가 리드의 **현재 단계**를 보고 링크를 고른다: 미신청→신청(mode:'apply') / 신청완료→가입
 *   (mode:'join', /creators/start?ic=) / 가입완료→400(더 보낼 안내 없음).
 */
export default function RecruitButton({ leadId, name, hasEmail }: { leadId: number; name: string; hasEmail: boolean }) {
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const r = await api.post(`/api/admin/ads/influencer-pool/${leadId}/recruit`, {})
      if (!r.data?.success) { toast.error(r.data?.error || '모집 링크 생성 실패'); return }
      const link: string = r.data.url || `${window.location.origin}/l/${r.data.code}`
      // 짧게 — 인스타 DM·블로그 댓글에 그대로 붙일 수 있는 길이. 링크가 전환 측정의 유일한 키.
      const msg = r.data.mode === 'join'
        // 이미 신청한 사람 → 다음 단계는 '가입'. 링크에 추적코드가 들어 있어 가입·첫 판매까지 이어서 집계된다.
        ? `안녕하세요, ${name}님! 유어딜 제휴 담당자입니다.

신청해주신 크리에이터 제휴, 아래 링크에서 카카오 로그인 한 번이면 바로 시작하실 수 있어요(1분).
가입하면 내 링크샵이 자동으로 생기고, 소개하고 싶은 딜을 담아 링크만 공유하면 됩니다.

${link}

궁금한 점은 편하게 답장 주세요.`
        : `안녕하세요, ${name}님! 유어딜(urdeal.kr) 제휴 담당자입니다.

동네 맛집·뷰티·숙소 딜을 링크로 소개하고 판매액의 소개비를 받는 크리에이터를 모집하고 있어요.
팔로워 수보다 '동네 이웃에게 진짜 좋은 딜을 소개하는 것'을 봅니다.

관심 있으시면 여기서 신청해주세요(1분): ${link}

신청해두시면 ${name}님 채널과 맞는 매장 협찬 제안이 있을 때 우선 안내드립니다.`
      await navigator.clipboard?.writeText(msg).catch(() => null)
      const what = r.data.mode === 'join' ? '가입 안내' : '모집 안내'
      toast.success(`📣 ${what} 복사됨 — ${hasEmail ? '메일·' : ''}인스타 DM·블로그 댓글로 전달하세요 (전환은 통계에 자동 집계)`)
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string; already_joined?: boolean } } }
      toast.error(ax.response?.data?.error || '모집 링크 생성 실패')
    } finally { setBusy(false) }
  }

  return (
    <button onClick={run} disabled={busy} title="모집 안내 문구 + 전용 추적링크 복사 — 신청(동의)하면 자동 발송 대상이 됩니다"
      className="text-[12px] font-semibold text-rose-600 hover:underline disabled:opacity-40">📣</button>
  )
}
