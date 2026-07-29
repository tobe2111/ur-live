import { toast } from '@/hooks/useToast'

/**
 * 📤 현재 필터 **전체** CSV 내보내기 — 화면에 로드된 행(기본 200)만 나가던 결함 수리.
 *   페이지 API 를 500개씩 끝까지 루프해 필터 결과 전량(안전 상한 60,000)을 받는다.
 *   열 구성은 서버 엑셀(influencer-pool-export.ts)과 동일 세계(29열 — 🏅점수·롱폼중앙값·쇼츠%·마지막글·
 *   메일상태·분류근거·브랜드 포함). 라벨 맵은 서버와 값 일치(클라 번들에 서버 모듈 유입 방지 위해 사본).
 */
export interface CsvLead {
  platform: string; name: string; handle: string | null; url: string
  subscriber_count: number; email: string | null; instagram: string | null; tiktok: string | null; links: string | null
  category: string | null; source_keyword: string | null; status: string
  contact_channel?: string | null; contacted_at?: string | null; follow_up_at?: string | null
  source?: string | null; consented_at?: string | null; memo?: string | null; collected_at: string
  recent_avg_views?: number | null; recent_avg_comments?: number | null; recent_posts_30d?: number | null
  lead_score?: number | null; median_long_views?: number | null; shorts_ratio?: number | null
  is_brand?: number | null; email_status?: string | null; last_post_at?: string | null; category_source?: string | null
}

const PLAT: Record<string, string> = { youtube: '유튜브', naver_blog: '네이버블로그', naver_cafe: '네이버카페', tistory: '티스토리', instagram: '인스타그램', tiktok: '틱톡' }
const CH: Record<string, string> = { email: '이메일', dm: '인스타DM', note: '네이버쪽지', kakao: '카톡', call: '전화', other: '기타' }
const STATUS_KO: Record<string, string> = { new: '신규', contacted: '컨택함', interested: '관심', contracted: '계약', rejected: '거절', hold: '보류' }
const MAIL_KO: Record<string, string> = { delivered: '발송됨', opened: '개봉', bounced: '반송⚠️', complained: '스팸신고⚠️', opt_out: '수신거부⚠️' }
const CATSRC_KO: Record<string, string> = { content: '콘텐츠분석', topic: '주제태그', keyword: '수집키워드' }
const HEAD = ['플랫폼', '이름', '핸들', 'URL', '🏅점수', '구독자', '평균조회수', '롱폼중앙값', '쇼츠%', '평균댓글', '月포스팅', '마지막글', '이메일', '메일상태', '인스타', '틱톡', '기타링크', '카테고리', '분류근거', '브랜드', '수집키워드', '상태', '컨택채널', '컨택일', '팔로업', '출처', '동의일', '메모', '수집일']

// 수식 인젝션 가드(선행 = + - @ 탭 CR) + 따옴표/줄바꿈 이스케이프.
function csvEscapeCell(v: unknown): string {
  const s = String(v ?? '')
  const g = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g
}

/** 리드 배열 → BOM 포함 CSV 문자열(순수 — 테스트 가능). */
export function buildFilteredCsv(leads: CsvLead[]): string {
  const rows = leads.map(l => [
    PLAT[l.platform] || l.platform, l.name, l.handle || '', l.url,
    l.lead_score ?? '', l.subscriber_count || 0,
    l.recent_avg_views ?? '', l.median_long_views ?? '', l.shorts_ratio ?? '', l.recent_avg_comments ?? '', l.recent_posts_30d ?? '', l.last_post_at || '',
    l.email || '', MAIL_KO[l.email_status || ''] || l.email_status || '', l.instagram || '', l.tiktok || '', l.links || '',
    l.category || '', l.category ? (CATSRC_KO[l.category_source || 'keyword'] || l.category_source || '') : '', l.is_brand ? '브랜드⚠️' : '',
    l.source_keyword || '', STATUS_KO[l.status] || l.status, CH[l.contact_channel || ''] || '', l.contacted_at || '', l.follow_up_at || '',
    l.source === 'inbound' ? '신청·동의' : '자동수집', l.consented_at || '', l.memo || '', (l.collected_at || '').slice(0, 10),
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
  const a = document.createElement('a'); a.href = url; a.download = `influencer-pool-filtered-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
  return all.length
}
