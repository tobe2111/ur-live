import type { D1Database } from '@cloudflare/workers-types'
import { ensureInfluencerSchema } from './influencer-discovery'

/**
 * 🎯 인플루언서 풀 전체 다운로드 응답 빌더 (admin-ads-influencers.routes 에서 추출 — 600줄 캡 준수).
 *   xls = SpreadsheetML(엑셀이 여는 XML) **카테고리별 시트 분리** + 전체 시트. csv = BOM 단일 파일(엑셀 호환).
 *   화면 500개 제한과 무관하게 전체(안전 상한 20,000) 내보냄. 셀은 String 타입이라 수식 실행 없음(csv 는 가드).
 *   ⚠️ 20k 행 × (전체 + 카테고리별 = 행 2배) 를 하나의 문자열로 연결하면 ~40MB → Worker 128MB 메모리 초과(OOM)로
 *   "내보내기 실패". xls 는 pull 기반 ReadableStream 으로 시트/256행 단위로 흘려보내 피크 메모리를 한 청크로 억제.
 */
export async function buildInfluencerExportResponse(DB: D1Database, poolId: number, format: string): Promise<Response> {
  await ensureInfluencerSchema(DB) // 성과/컨택 컬럼 보장(미보강 DB 에서 'no such column' 빈 파일 방지)
  // 🛡️ 2026-07-23 전수조사: 단일 SELECT LIMIT 20000 하드캡 — 28k 풀에서 8천 명이 조용히 누락되던 것.
  //   5천행 페이지 읽기(D1 응답크기 안전)로 전환 + 상한 60000(현 풀 2배 여유 — 초과 시에만 잘림).
  type ExpRow = { platform: string; name: string; handle: string | null; url: string; subscriber_count: number; video_count: number; email: string | null; instagram: string | null; tiktok: string | null; links: string | null; category: string | null; source_keyword: string | null; status: string; collected_at: string; recent_avg_views: number | null; recent_avg_comments: number | null; recent_posts_30d: number | null; contact_channel: string | null; contacted_at: string | null; follow_up_at: string | null; source: string | null; consented_at: string | null; memo: string | null }
  const rows: ExpRow[] = []
  const PAGE = 5000, CAP = 60000
  for (let off = 0; off < CAP; off += PAGE) {
    const page = (await DB.prepare(`SELECT platform, name, handle, url, subscriber_count, video_count, email, instagram, tiktok, links, category, source_keyword, status, collected_at,
        recent_avg_views, recent_avg_comments, recent_posts_30d, contact_channel, contacted_at, follow_up_at, source, consented_at, memo
      FROM ad_influencer_leads WHERE account_id = ? ORDER BY category, subscriber_count DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(poolId, PAGE, off).all<ExpRow>().catch(() => null))?.results || []
    rows.push(...page)
    if (page.length < PAGE) break
  }
  const PLAT: Record<string, string> = { youtube: '유튜브', naver_blog: '네이버블로그', naver_cafe: '네이버카페', tistory: '티스토리', instagram: '인스타그램', tiktok: '틱톡' }
  const CH_KO: Record<string, string> = { email: '이메일', dm: '인스타DM', note: '네이버쪽지', kakao: '카톡', call: '전화', other: '기타' }
  // 📈 성과(평균조회/댓글/月포스팅)·컨택 이력·출처/동의·메모 — 구글시트/필터CSV 와 동일 22열 세계.
  const HEAD = ['플랫폼', '이름', '핸들', 'URL', '구독자', '평균조회수', '평균댓글', '月포스팅', '이메일', '인스타그램', '틱톡', '기타링크', '카테고리', '수집키워드', '상태', '컨택채널', '컨택일', '팔로업', '출처', '동의일', '메모', '수집일']
  const noSub = (p: string) => ['naver_blog', 'naver_cafe', 'tistory'].includes(p) // 구독자 지표 없는 플랫폼
  const cells = (r: typeof rows[number]) => [PLAT[r.platform] || r.platform, r.name, r.handle || '', r.url, noSub(r.platform) ? '' : String(r.subscriber_count || 0),
    r.recent_avg_views != null ? String(r.recent_avg_views) : '', r.recent_avg_comments != null ? String(r.recent_avg_comments) : '', r.recent_posts_30d != null ? String(r.recent_posts_30d) : '',
    r.email || '', r.instagram ? `@${r.instagram}` : '', r.tiktok ? `@${r.tiktok}` : '', r.links || '', r.category || '기타', r.source_keyword || '', r.status,
    CH_KO[r.contact_channel || ''] || '', r.contacted_at || '', r.follow_up_at || '', r.source || '', r.consented_at || '', r.memo || '', (r.collected_at || '').slice(0, 10)]

  if (format === 'csv') {
    const csvEscapeCell = (v: string) => { const s = String(v ?? ''); const g = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g }
    const body = [HEAD.join(','), ...rows.map(r => cells(r).map(csvEscapeCell).join(','))].join('\r\n')
    return new Response('﻿' + body, { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': `attachment; filename="influencer-pool.csv"` } })
  }

  // SpreadsheetML — 카테고리별 시트 + 전체 시트. 시트명은 엑셀 제약(31자·특수문자) 정리.
  const xe = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const rowXml = (vals: string[]) => `<Row>${vals.map(v => `<Cell><Data ss:Type="String">${xe(v)}</Data></Cell>`).join('')}</Row>`
  const sheetName = (name: string) => xe(name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || '기타')
  const byCat = new Map<string, typeof rows>()
  for (const r of rows) { const k = r.category || '기타'; const arr = byCat.get(k) || []; arr.push(r); byCat.set(k, arr) }
  const sheetPlan = [{ name: `전체 (${rows.length})`, rs: rows }, ...Array.from(byCat.entries()).map(([k, rs]) => ({ name: `${k} (${rs.length})`, rs }))]
  const enc = new TextEncoder()
  function* chunks(): Generator<string> {
    yield `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`
    for (const { name, rs } of sheetPlan) {
      yield `<Worksheet ss:Name="${sheetName(name)}"><Table>${rowXml(HEAD)}`
      let buf = ''
      for (let i = 0; i < rs.length; i++) { buf += rowXml(cells(rs[i])); if ((i & 255) === 255) { yield buf; buf = '' } } // 256행마다 flush
      if (buf) yield buf
      yield '</Table></Worksheet>'
    }
    yield '</Workbook>'
  }
  const it = chunks()
  const stream = new ReadableStream({
    pull(ctrl) { const { value, done } = it.next(); if (done) { ctrl.close(); return } ctrl.enqueue(enc.encode(value)) },
  })
  return new Response(stream, { headers: { 'Content-Type': 'application/vnd.ms-excel', 'Content-Disposition': `attachment; filename="influencer-pool.xls"` } })
}
