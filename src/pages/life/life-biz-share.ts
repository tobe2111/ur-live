/** 🔗 업체 소개 페이지 링크 보내기 — 공유 창, 없으면 복사 (2026-10-26). */
import { toast } from '@/hooks/useToast'

export async function shareBizPage(id: number, name: string): Promise<void> {
  const url = `${window.location.origin}/life/biz/${id}`
  const title = `${name || '업체'} - 유어딜`
  try {
    if (navigator.share) { await navigator.share({ title, text: `${title}에서 소개와 후기를 보세요`, url }); return }
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return
  }
  try { await navigator.clipboard.writeText(url); toast.success('링크를 복사했어요') }
  catch { window.prompt('링크를 복사해 주세요', url) }
}
