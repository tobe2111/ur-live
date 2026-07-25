import { toast } from '@/hooks/useToast'

/**
 * 📤 현재 필터 **전체** CSV 내보내기 — 화면에 로드된 행(기본 200)만 나가던 결함 수리.
 *   페이지 API 를 500개씩 끝까지 루프해 필터 결과 전량(안전 상한 20,000)을 받는다.
 *   열 구성은 구글시트/서버 엑셀과 동일 세계(성과·컨택 이력·동의 포함 22열).
 */
export interface CsvLead {
  platform: string; name: string; handle: string | null; url: string
  subscriber_count: number; email: string | null; instagram: string | null; tiktok: string | null; links: string | null
  category: string | null; source_keyword: string | null; status: string
  contact_channel?: string | null; contacted_at?: string | null; follow_up_at?: string | null
  source?: string | null; consented_at?: string | null; memo?: string | null; collected_at: string
  recent_avg_views?: number | null; recent_avg_comments?: number | null; recent_posts_30d?: number | null
}

const PLAT: Record<string, string> = { youtube: '유튜브', naver_blog: '네이버블로그', naver_cafe: '네이버카페', tistory: '티스토리', instagram: '인스타그램', tiktok: '틱톡' }
const CH: Record<string, string> = { email: '이메일', dm: '인스타DM', note: '네이버쪽지', kakao: '카톡', call: '전화', other: '기타' }
const HEAD = ['플랫폼', '이름', '핸들', 'URL', '구독자', '평균조회수', '평균댓글', '月포스팅', '이메일', '인스타', '틱톡', '기타링크', '카테고리', '수집키워드', '상태', '컨택채널', '컨택일', '팔로업', '출처', '동의일', '메모', '수집일']

// 수식 인젝션 가드(선행 = + - @ 탭 CR) + 따옴표/줄바꿈 이스케이프.
function csvEscapeCell(v: unknown): string {
  const s = String(v ?? '')
  const g = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g
}

/** 리드 배열 → BOM 포함 CSV 문자열(순수 — 테스트 가능). */
export function buildFilteredCsv(leads: CsvLead[]): string {
  const rows = leads.map(l => [
    PLAT[l.platform] || l.platform, l.name, l.handle || '', l.url, l.subscriber_count || 0,
    l.recent_avg_views ?? '', l.recent_avg_comments ?? '', l.recent_posts_30d ?? '',
    l.email || '', l.instagram || '', l.tiktok || '', l.links || '', l.category || '', l.source_keyword || '',
    l.status, CH[l.contact_channel || ''] || '', l.contacted_at || '', l.follow_up_at || '',
    l.source || '', l.consented_at || '', l.memo || '', (l.collected_at || '').slice(0, 10),
  ].map(csvEscapeCell).join(','))
  return '﻿' + [HEAD.join(','), ...rows].join('\r\n')
}

/** 필터 전량 페치 → CSV 다운로드. 반환 = 내보낸 행수(0 이면 대상 없음 안내 후 미다운로드).
 *  🛡️ 2026-07-23: 상한 20000→60000(28k 풀에서 조용히 잘리던 것) + 상한 도달 시 잘림 안내(무음 누락 금지). */
export async function exportFilteredCsv(fetchPage: (offset: number) => Promise<CsvLead[]>, cap = 60000): Promise<number> {
  const all: CsvLead[] = []
  let truncated = true // 루프가 '마지막 페이지'로 끝나면 false — cap 도달로 끝나면 true 유지
  for (let off = 0; off < cap; off += 500) {
    const page = await fetchPage(off)
    all.push(...page)
    if (page.length < 500) { truncated = false; break }
  }
  if (truncated) toast.error(`⚠️ 상한 ${cap.toLocaleString()}건에서 잘렸습니다 — 필터를 좁혀 나눠 내보내세요`)
  if (!all.length) { toast.error('내보낼 리드가 없습니다 (현재 필터 0건)'); return 0 }
  const url = URL.createObjectURL(new Blob([buildFilteredCsv(all)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `influencer-pool-filtered-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url)
  return all.length
}
