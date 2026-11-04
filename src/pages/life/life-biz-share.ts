/**
 * 🔗 업체 소개 페이지 링크 보내기 (2026-10-26).
 * 💬 2026-11-04 대표 *"share card 로 공유가 안 되고 있는 것들 정리해서 share card 형태로"* — 카톡이면 **버튼 달린 카드**
 *   (업체 이름 · 소개 한 줄 · 대표 사진 + [업체 보기]). 못 보내면 공유 창, 그것도 없으면 복사.
 */
import { toast } from '@/hooks/useToast'
import { promptDialog } from '@/components/ui/confirm-dialog'

export async function shareBizPage(id: number, name: string, extra?: { description?: string | null; imageUrl?: string | null }): Promise<void> {
  const url = `${window.location.origin}/life/biz/${id}`
  const title = `${name || '업체'} - 유어딜`
  const img = extra?.imageUrl ? (extra.imageUrl.startsWith('http') ? extra.imageUrl : `${window.location.origin}${extra.imageUrl}`) : null
  try {
    // 📦 누를 때만 받는다(업체 화면 첫 화면 무게 — surface-budgets).
    const { feedPayload, sendKakaoShare, shareViaKakao } = await import('@/lib/kakao-share')
    const payload = feedPayload({ title, description: extra?.description || '소개와 후기를 보고 견적을 받아 보세요', imageUrl: img, url, buttons: [{ title: '업체 보기' }] })
    if (sendKakaoShare(payload) || await shareViaKakao(payload)) return
  } catch { /* 폴백 */ }
  try {
    if (navigator.share) { await navigator.share({ title, text: `${title}에서 소개와 후기를 보세요`, url }); return }
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return
  }
  try { await navigator.clipboard.writeText(url); toast.success('링크를 복사했어요') }
  catch { (await promptDialog({ message: '링크를 복사해 주세요', prompt: { defaultValue: url } })) }
}
