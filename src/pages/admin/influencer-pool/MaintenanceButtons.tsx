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
  const [scoring, setScoring] = useState(false)
  const [maintaining, setMaintaining] = useState(false)
  const [routingBiz, setRoutingBiz] = useState(false)

  async function mergeDuplicates() {
    if (!window.confirm('중복 리드를 통합할까요?\n① 같은 이메일 ② 같은 인스타 핸들 ③ 공유 링크(linktr.ee/블로그/유튜브 교차링크) ④ 이름+카테고리(⚠️동명이인 방지: 이메일·인스타 둘 다 없는 잔여, 2개+ 플랫폼일 때만)\n상태·정보가 가장 앞선 1건만 남기고 나머지 삭제.')) return
    setMerging(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/merge-duplicates', {})
      if (r.data?.success) {
        if (r.data.started) toast.success('🧬 중복 통합을 백그라운드에서 시작했어요 — 잠시 후 통계를 새로고침하면 반영됩니다')
        else {
          const em = r.data.mergedEmail ?? 0, ig = r.data.mergedInsta ?? 0, lk = r.data.mergedLink ?? 0, nm = r.data.mergedName ?? 0
          toast.success(`중복 통합 완료 — ${formatNumber(r.data.merged)}건 정리 (이메일 ${formatNumber(em)} · 인스타 ${formatNumber(ig)} · 링크 ${formatNumber(lk)} · 이름 ${formatNumber(nm)})`)
        }
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

  // 🏅 품질 패스 — 야간 자동 정비와 **같은 함수**(SSOT). 평소엔 매일 밤 자동 실행이라 누를 필요 없고,
  //   배포 직후처럼 즉시 반영이 필요할 때만 사용. 커서 순환이라 반복 클릭 안전(멱등).
  async function qualityPass() {
    setScoring(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/quality-pass', {})
      if (r.data?.success) {
        if (r.data.started) toast.success('🏅 브랜드 태깅 + 리드 점수 계산을 시작했어요 — 잠시 후 새로고침하면 반영됩니다')
        else toast.success(`🏅 ${formatNumber(r.data.scanned)}명 채점${r.data.branded ? ` · 브랜드 태깅 +${formatNumber(r.data.branded)}` : ''}${r.data.done ? ' (전체 완료)' : ' (다음 회차에 이어서)'}`)
        await onChanged()
      } else toast.error('채점 실패')
    } catch { toast.error('채점 실패') } finally { setScoring(false) }
  }

  // 🧰 전체 정비 — 개별 버튼을 순서 맞춰 누르는 대신 야간 cron 과 **같은 파이프라인**을 그대로 실행.
  //   순서(병합 → 재추출 → 재분류 → 점수 → 라이브 재보정)가 정해져 있고 틀리면 낭비라 사람 손에 맡기지 않는다.
  async function maintainAll() {
    if (!window.confirm('전체 정비를 실행할까요?\n야간 자동 정비와 같은 순서로 한 번에 돕니다 — 중복 통합 → 연락처 재추출 → 카테고리 재분류 → 리드 점수 → 라이브 재보정.\n백그라운드로 진행되며 페이지를 떠나도 계속됩니다.')) return
    setMaintaining(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/maintain-all', {})
      if (!r.data?.success) { toast.error(r.data?.error || '정비 시작 실패'); return }
      // 🔒 이미 돌고 있으면 새로 시작하지 않았다고 정직하게 알린다(연타해도 겹치지 않음).
      if (r.data.busy) { toast.info('이미 정비가 진행 중입니다 — 새로 시작하지 않았어요. 끝나면 통계에 반영됩니다'); return }
      toast.success(r.data.skipped_rescan
        // 라이브 재보정은 수집과 같은 하루 YouTube 예산을 쓴다 → 수집 중이면 신규 발굴에 양보(정직하게 알림).
        ? '🧰 전체 정비를 시작했어요 — 수집이 진행 중이라 라이브 재보정만 건너뜁니다(같은 YouTube 예산)'
        : '🧰 전체 정비를 시작했어요 — 백그라운드로 진행되며 페이지를 떠나도 계속됩니다')
      await onChanged()
    } catch { toast.error('정비 시작 실패') } finally { setMaintaining(false) }
  }

  const cls = 'px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50'
  /**
   * 🔀 업체형 블로그/카페 → B2B 파트너풀 이관. **먼저 dry-run 으로 표본을 보여주고**, 사람이 확인한 뒤에만 실제 저장.
   *   (인플루언서 풀은 숨김 태깅만 — 삭제 아님. 오탐이어도 되돌릴 수 있다.)
   */
  async function routeBizBlogs() {
    setRoutingBiz(true)
    try {
      const dry = await api.post('/api/admin/ads/influencer-pool/route-biz', {})
      const st = dry.data?.stats as { scanned?: number; matched?: number; withPhone?: number; samples?: string[]; done?: boolean } | undefined
      if (!dry.data?.success || !st) { toast.error(dry.data?.error || '검사 실패'); return }
      if (!st.matched) { toast.success(`업체형 블로그 없음 (${formatNumber(st.scanned || 0)}건 검사${st.done ? ' · 전체 완료' : ''})`); return }
      const ok = window.confirm(
        `업체형 블로그/카페 ${formatNumber(st.matched)}건을 찾았습니다 (${formatNumber(st.scanned || 0)}건 검사 · 이름/소개글에서 전화 확보 ${formatNumber(st.withPhone || 0)}건).\n\n`
        + `표본:\n${(st.samples || []).slice(0, 10).map(x => `· ${x}`).join('\n')}\n\n`
        + '이들을 B2B 파트너풀로 넘길까요?\n'
        + '· 저장은 파트너풀에만 — 전화/이메일은 파트너풀 보강 레인이 이어서 채웁니다\n'
        + '· 인플루언서 풀에서는 숨김 처리만(삭제 아님)',
      )
      if (!ok) return
      const r = await api.post('/api/admin/ads/influencer-pool/route-biz?apply=1', {})
      const a2 = r.data?.stats as { routed?: number; tagged?: number; done?: boolean } | undefined
      if (r.data?.success && a2) {
        toast.success(`🔀 파트너풀로 ${formatNumber(a2.routed || 0)}건 이관 · 인플루언서 풀에서 ${formatNumber(a2.tagged || 0)}건 숨김${a2.done ? ' · 전체 완료' : ' — 이어서 하려면 다시 누르세요'}`)
        await onChanged()
      } else toast.error(r.data?.error || '이관 실패')
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '이관 실패')
    } finally { setRoutingBiz(false) }
  }

  return (
    <>
      <button onClick={maintainAll} disabled={maintaining} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50" title="야간 자동 정비와 동일한 순서로 한 번에 실행 — 중복 통합 → 연락처 재추출 → 카테고리 재분류 → 리드 점수 → 라이브 재보정. 아래 개별 버튼은 특정 단계만 다시 돌릴 때만 쓰세요.">{maintaining ? '정비 시작 중…' : '🧰 전체 정비'}</button>
      <button onClick={mergeDuplicates} disabled={merging || !canMerge} className={cls} title="같은 이메일 중복 리드 통합">{merging ? '통합 중…' : '🧬 중복 통합'}</button>
      <button onClick={sheetsSync} disabled={sheetsSyncing} className="px-4 py-2 rounded-lg border border-green-300 bg-green-50 text-green-700 text-sm font-medium disabled:opacity-50" title="풀 전체를 구글 스프레드시트 pool 탭에 미러(서비스계정 설정 필요 — 매시간 자동 + 이 버튼 즉시)">{sheetsSyncing ? '시트 동기화 중…' : '📊 구글시트 동기화'}</button>
      <button onClick={recategorize} disabled={recategorizing} className="px-4 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium disabled:opacity-50" title="유튜브 전 풀의 카테고리를 라이브(channels.list 배치)로 한 번에 재보정 — 규칙+YouTube 신호, 버튼 한 번">{recategorizing ? '재보정 중…' : '🧭 카테고리 전체 재보정'}</button>
      <button onClick={reclassify} disabled={reclassifying} className={cls} title="채널 이름·소개글 신호로 카테고리 재분류(저장 소개글 기반 — 라이브 재보정으로 안 되는 네이버/티스토리 보조, 멱등)">{reclassifying ? '재분류 중…' : '🏷️ 카테고리 재분류(저장)'}</button>
      <button onClick={reextract} disabled={reextracting} className={cls} title="기존 리드의 저장된 소개글에서 연락처 재추출(신규 @핸들·유튜브/블로그 포착 — 비어있는 것만 채움, API 재호출 0)">{reextracting ? '재추출 중…' : '🔗 연락처 재추출'}</button>
      <button onClick={qualityPass} disabled={scoring} className="px-4 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-sm font-medium disabled:opacity-50" title="브랜드 공식 채널 태깅 + 리드 점수(0~100) 재계산 — 매일 밤 자동 실행되므로 평소엔 불필요, 즉시 반영이 필요할 때만">{scoring ? '채점 중…' : '🏅 리드 점수·브랜드 태깅'}</button>
      <button onClick={routeBizBlogs} disabled={routingBiz} className="px-4 py-2 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 text-sm font-medium disabled:opacity-50" title="블로그/카페 중 업체(사업자) 계정을 찾아 B2B 파트너풀(광고주 리드)로 넘깁니다 — 먼저 표본을 보여주고 확인 후 실행. 인플루언서 풀에서는 숨김 처리만(삭제 아님)">{routingBiz ? '검사 중…' : '🔀 업체 블로그 → 파트너풀'}</button>
      <button onClick={refetchLive} disabled={refetching} className="px-4 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium disabled:opacity-50" title="유튜브 채널의 현재 라이브 About을 다시 불러 이메일·카테고리 교정(재추출로 안 되는 케이스 — 현재 About에만 개인메일. YouTube API 사용)">{refetching ? '라이브 재조회 중…' : '🔄 유튜브 라이브 재조회'}</button>
    </>
  )
}
