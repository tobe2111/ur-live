import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🧰 인플루언서 풀 유지보수 버튼群 — 중복통합·구글시트·카테고리 재분류·연락처 재추출.
 *   페이지 600줄 캡 준수를 위해 추출. onChanged = 완료 후 목록·통계 재조회(부모).
 *   전부 멱등 백필/동기화(API 재호출 없이 저장된 데이터에 재적용 — reextract/reclassify).
 */
export default function MaintenanceButtons({ onChanged, canMerge }: { onChanged: () => Promise<void>; canMerge: boolean }) {
  const [merging, setMerging] = useState(false)
  const [sheetsSyncing, setSheetsSyncing] = useState(false)
  const [reclassifying, setReclassifying] = useState(false)
  const [reextracting, setReextracting] = useState(false)
  const [refetching, setRefetching] = useState(false)
  const [recategorizing, setRecategorizing] = useState(false)

  async function mergeDuplicates() {
    if (!window.confirm('중복 리드를 통합할까요?\n① 같은 이메일 ② 같은 인스타 핸들 ③ 공유 링크(linktr.ee/블로그/유튜브 교차링크) ④ 이름+카테고리(⚠️동명이인 방지: 이메일·인스타 둘 다 없는 잔여, 2개+ 플랫폼일 때만)\n상태·정보가 가장 앞선 1건만 남기고 나머지 삭제.')) return
    setMerging(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/merge-duplicates', {})
      if (r.data?.success) {
        const em = r.data.mergedEmail ?? 0, ig = r.data.mergedInsta ?? 0, lk = r.data.mergedLink ?? 0, nm = r.data.mergedName ?? 0
        toast.success(`중복 통합 완료 — ${formatNumber(r.data.merged)}건 정리 (이메일 ${formatNumber(em)} · 인스타 ${formatNumber(ig)} · 링크 ${formatNumber(lk)} · 이름 ${formatNumber(nm)})`)
        await onChanged()
      } else toast.error('통합 실패')
    } catch { toast.error('통합 실패') } finally { setMerging(false) }
  }
  async function sheetsSync() {
    setSheetsSyncing(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/sheets-sync', {})
      if (r.data?.success) toast.success(`📊 구글시트에 ${formatNumber(r.data.rows)}행 반영 완료`)
      else toast.error(r.data?.error || '시트 동기화 실패')
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '시트 동기화 실패')
    } finally { setSheetsSyncing(false) }
  }
  async function reclassify() {
    if (!window.confirm('풀 전체를 채널 이름·소개글 기반으로 재분류할까요?\n(콘텐츠 신호가 있고 현재와 다를 때만 변경 — 멱등)')) return
    setReclassifying(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/reclassify', {})
      if (r.data?.success) { toast.success(`🏷️ ${formatNumber(r.data.scanned)}명 스캔 · ${formatNumber(r.data.changed)}명 재분류`); await onChanged() }
      else toast.error('재분류 실패')
    } catch { toast.error('재분류 실패') } finally { setReclassifying(false) }
  }
  async function reextract() {
    if (!window.confirm('기존 리드의 저장된 소개글에서 연락처를 다시 추출할까요?\n(비어있는 이메일·인스타·틱톡만 채우고 유튜브·블로그 링크 추가 — 기존값 보존, 멱등)')) return
    setReextracting(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/reextract', {})
      if (r.data?.success) { toast.success(`🔗 ${formatNumber(r.data.scanned)}명 스캔 · ${formatNumber(r.data.filled)}명 연락처 보강`); await onChanged() }
      else toast.error('재추출 실패')
    } catch { toast.error('재추출 실패') } finally { setReextracting(false) }
  }

  async function refetchLive() {
    if (!window.confirm('유튜브 채널을 라이브로 전체 재스캔해 카테고리·이메일·평균조회수를 실제 데이터로 재검증할까요?\n(현재 About + YouTube 자체분류로 카테고리 교정 · 개인메일/평균조회수 보강. 키워드 상속으로 잘못 분류된 채널은 재분류로 안 고쳐지고 이 버튼으로만 교정됩니다. YouTube API 사용 · 한 번에 100개 — 많으면 여러 번 눌러주세요)')) return
    setRefetching(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/refetch-live', { passes: 5 })
      if (r.data?.success) {
        if (r.data.started) toast.success('🔄 라이브 재조회를 백그라운드에서 시작했어요 — 잠시 후 통계를 새로고침하면 교정 결과가 반영됩니다')
        else toast.success(`🔄 ${formatNumber(r.data.processed)}개 채널 라이브 재조회 완료 (이메일·카테고리 교정)`)
        await onChanged()
      } else toast.error(r.data?.error || '라이브 재조회 실패')
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '라이브 재조회 실패')
    } finally { setRefetching(false) }
  }

  async function recategorize() {
    if (!window.confirm('유튜브 전체 풀의 카테고리를 라이브로 한 번에 재보정할까요?\n(channels.list 배치로 전 채널의 현재 About + YouTube 자체분류를 받아 카테고리 교정 — 수천 개도 버튼 한 번, 반복 클릭 불필요. 백그라운드 약 1분 후 새로고침하면 반영. + "평균 0회" 채널은 cron 자동 재측정 큐에 올려 시간당 자동으로 실제 조회수로 채워집니다. YouTube 쿼터 소량.)')) return
    setRecategorizing(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/recategorize', {})
      if (r.data?.success) {
        if (r.data.started) toast.success('🧭 카테고리 전체 재보정 시작 — 약 1분 후 새로고침하면 반영됩니다. "평균 0회"는 cron이 자동으로 채웁니다(클릭 불필요)')
        else toast.success(`🧭 ${formatNumber(r.data.scanned)}개 스캔 · ${formatNumber(r.data.changed)}개 카테고리 교정`)
        await onChanged()
      } else toast.error(r.data?.error || '재보정 실패')
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '재보정 실패')
    } finally { setRecategorizing(false) }
  }

  const cls = 'px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50'
  return (
    <>
      <button onClick={mergeDuplicates} disabled={merging || !canMerge} className={cls} title="같은 이메일 중복 리드 통합">{merging ? '통합 중…' : '🧬 중복 통합'}</button>
      <button onClick={sheetsSync} disabled={sheetsSyncing} className="px-4 py-2 rounded-lg border border-green-300 bg-green-50 text-green-700 text-sm font-medium disabled:opacity-50" title="풀 전체를 구글 스프레드시트 pool 탭에 미러(서비스계정 설정 필요 — 매시간 자동 + 이 버튼 즉시)">{sheetsSyncing ? '시트 동기화 중…' : '📊 구글시트 동기화'}</button>
      <button onClick={recategorize} disabled={recategorizing} className="px-4 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium disabled:opacity-50" title="유튜브 전 풀의 카테고리를 라이브(channels.list 배치)로 한 번에 재보정 — 수천 개도 버튼 한 번, 반복 클릭 불필요">{recategorizing ? '재보정 중…' : '🧭 카테고리 전체 재보정'}</button>
      <button onClick={reclassify} disabled={reclassifying} className={cls} title="채널 이름·소개글 신호로 카테고리 재분류(저장 소개글 기반 — 라이브 재보정으로 안 되는 네이버/티스토리 보조, 멱등)">{reclassifying ? '재분류 중…' : '🏷️ 카테고리 재분류(저장)'}</button>
      <button onClick={reextract} disabled={reextracting} className={cls} title="기존 리드의 저장된 소개글에서 연락처 재추출(신규 @핸들·유튜브/블로그 포착 — 비어있는 것만 채움, API 재호출 0)">{reextracting ? '재추출 중…' : '🔗 연락처 재추출'}</button>
      <button onClick={refetchLive} disabled={refetching} className="px-4 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium disabled:opacity-50" title="유튜브 채널의 현재 라이브 About을 다시 불러 이메일·카테고리 교정(재추출로 안 되는 케이스 — 현재 About에만 개인메일. YouTube API 사용)">{refetching ? '라이브 재조회 중…' : '🔄 유튜브 라이브 재조회'}</button>
    </>
  )
}
