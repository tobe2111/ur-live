import type { D1Database } from '@cloudflare/workers-types'
import { ensureInfluencerSchema } from './influencer-discovery'
import { ensureQualityColumns } from './influencer-quality'
import { ensurePerfExtraColumns } from './influencer-performance'
import { ensureOutreachColumns } from './outreach-webhook'
// ⚖️ 법적 문구는 **발송 경로와 같은 SSOT** 를 쓴다 — 여기서 따로 쓰면 법이 바뀔 때 한쪽만 고쳐진다.
import { dedupeByEmail } from './outreach-queue'
import { outreachSubject, outreachBody } from './outreach-template'

/**
 * 🎯 인플루언서 풀 전체 다운로드 응답 빌더 (admin-ads-influencers.routes 에서 추출 — 600줄 캡 준수).
 *   xls = SpreadsheetML(엑셀이 여는 XML) **카테고리별 시트 분리** + 전체 시트. csv = BOM 단일 파일(엑셀 호환).
 *   화면 500개 제한과 무관하게 전체(안전 상한 60,000) 내보냄. 텍스트 셀은 String 타입이라 수식 실행 없음(csv 는 가드).
 *   ⚠️ 수만 행 × (전체 + 카테고리별 = 행 2배) 를 하나의 문자열로 연결하면 ~40MB → Worker 128MB 메모리 초과(OOM)로
 *   "내보내기 실패". xls 는 pull 기반 ReadableStream 으로 시트/256행 단위로 흘려보내 피크 메모리를 한 청크로 억제.
 *
 *   📋 2026-07-27 양식 개선(대표 "모두 개선해줘"):
 *     · 열 확장 22→29 — 🏅점수(lead_score)·롱폼중앙값·쇼츠%·마지막글·메일상태(반송/스팸신고 안전)·분류근거·브랜드
 *     · 정렬 = 카테고리 → 리드점수 DESC(미채점 후순위) — 시트 열면 컨택 우선순위가 바로 위에서부터
 *     · 숫자 열은 ss:Type="Number" — 엑셀 정렬/필터/피벗이 텍스트가 아닌 숫자로 동작
 *     · 상태/출처/메일상태/분류근거 한국어 라벨 + 헤더 볼드 스타일 + 파일명 날짜 스탬프
 */

// ── 한국어 라벨 맵(엑셀 다운로드용 — 시트 미러(sheets-sync)는 기계값 유지) ──────
export const STATUS_KO: Record<string, string> = { new: '신규', contacted: '컨택함', interested: '관심', contracted: '계약', rejected: '거절', hold: '보류' }
export const MAIL_KO: Record<string, string> = { delivered: '발송됨', opened: '개봉', bounced: '반송⚠️', complained: '스팸신고⚠️', opt_out: '수신거부⚠️' }
export const CATSRC_KO: Record<string, string> = { content: '콘텐츠분석', topic: '주제태그', keyword: '수집키워드' }

/** 매체별 내려받기 화이트리스트 — 파일명/시트에도 쓰인다(임의 문자열 바인딩 방지). */
export const EXPORT_PLATFORMS: Record<string, string> = {
  youtube: '유튜브', naver_blog: '네이버블로그', naver_cafe: '네이버카페',
  tistory: '티스토리', instagram: '인스타그램', tiktok: '틱톡',
}

/**
 * 📇 2026-07-28 `contactable` 필터 — 대표가 **수기로 제휴 제안을 보내는** 워크플로용(자동 발송 안 씀).
 *   전체 3.6만 행을 받아 손으로 거르는 대신 "지금 연락할 사람"만 뽑는다:
 *     · 이메일 보유(수기 발송의 전제)          · 브랜드 공식채널 제외(제휴 대상 아님)
 *     · 아직 연락 안 한 사람(contacted_at 없음)  · 반송·스팸신고 이력 제외(보내면 튕긴다)
 *   정렬은 기존과 동일(점수순) — 파일 위에서부터 순서대로 연락하면 된다. 미지정 시 기존 동작(전체) 불변.
 */
export async function buildInfluencerExportResponse(DB: D1Database, poolId: number, format: string, platform?: string, opts?: { contactable?: boolean; minScore?: number; coreFirst?: boolean }): Promise<Response> {
  await ensureInfluencerSchema(DB)  // 성과/컨택 컬럼 보장(미보강 DB 에서 'no such column' 빈 파일 방지)
  await ensureQualityColumns(DB)    // lead_score/is_brand/category_source — SELECT·정렬이 참조
  await ensurePerfExtraColumns(DB)  // median_long_views/shorts_ratio/last_post_at
  await ensureOutreachColumns(DB)   // email_status(반송·스팸신고 — 발송 안전 정보)
  // 🛡️ 2026-07-23 전수조사: 단일 SELECT LIMIT 20000 하드캡 — 28k 풀에서 8천 명이 조용히 누락되던 것.
  //   5천행 페이지 읽기(D1 응답크기 안전)로 전환 + 상한 60000(현 풀 2배 여유 — 초과 시에만 잘림).
  type ExpRow = { id: number; platform: string; name: string; handle: string | null; url: string; subscriber_count: number; email: string | null; instagram: string | null; tiktok: string | null; links: string | null; category: string | null; region: string | null; source_keyword: string | null; status: string; collected_at: string; recent_avg_views: number | null; recent_avg_comments: number | null; recent_posts_30d: number | null; contact_channel: string | null; contacted_at: string | null; follow_up_at: string | null; source: string | null; consented_at: string | null; memo: string | null; lead_score: number | null; median_long_views: number | null; shorts_ratio: number | null; is_brand: number | null; email_status: string | null; last_post_at: string | null; category_source: string | null; opted_out: number | null }
  const rows: ExpRow[] = []
  // 🎯 매체별 분리 다운로드(2026-07-28 대표 요청) — 화이트리스트 밖 값은 무시하고 전체(기존 동작).
  const plat = platform && EXPORT_PLATFORMS[platform] ? platform : ''
  const platFilter = plat ? ' AND platform = ?' : ''
  // 값 바인딩 없는 정적 조건만(문자열 조립 안전) — 임의 입력이 SQL 에 닿지 않는다.
  // 📇 수기 제휴 제안용 "지금 연락할 사람". 2026-07-29 **죽은 채널 제외** 추가 —
  //   블로거 활동성 측정(`recent_posts_30d`)이 이제 실제로 쌓이기 시작했는데(핸들 복구 수리 이후),
  //   목록은 여전히 이메일·브랜드·미접촉만 보고 있었다. 몇 년 전에 멈춘 블로그에 제안을 보내는 건
  //   순수 낭비이고, 회신이 없으니 문안 성과 판단까지 흐린다.
  //   ⚠️ **측정된 것 중 죽은 것만** 뺀다(`perf_checked_at IS NOT NULL AND recent_posts_30d = 0`).
  //      미측정(대부분)은 남긴다 — 안 그러면 아직 측정 못 한 리드가 통째로 사라진다.
  const contactFilter = opts?.contactable
    // 🚫 제안 거부를 명시한 사람 제외 — 발송 큐(`buildSendQueueWhere`)와 같은 기준.
    ? " AND email IS NOT NULL AND email != '' AND COALESCE(is_brand,0) = 0 AND COALESCE(opted_out,0) = 0 AND contacted_at IS NULL"
      + " AND (email_status IS NULL OR email_status NOT IN ('bounced','complained'))"
      + " AND NOT (perf_checked_at IS NOT NULL AND COALESCE(recent_posts_30d, -1) = 0)"
    : ''
  const minScore = Number.isFinite(opts?.minScore) ? Math.max(0, Math.min(100, Number(opts?.minScore))) : null
  const scoreFilter = minScore != null ? ` AND COALESCE(lead_score,0) >= ${minScore}` : ''
  // 🎯 유어딜 적합 카테고리 우선(2026-07-29) — 라이브 실측에서 **연락 대상 상위 20명이 전부 '기타'**였다
  //   (인문학 채널·주식 단타·부업 노하우…). 점수 공식은 적합도에 100점 중 20점만 주므로 "구독자 많고
  //   이메일 있는 채널"이 "구독자 적은 맛집 블로거"를 이긴다. 동네 매장 이용권을 파는 서비스에서
  //   그 순서로 제안을 보내면 회신이 없을 뿐 아니라 브랜드 신뢰가 깎인다.
  //   ⚠️ 점수 공식은 건드리지 않는다(전체 순위가 흔들린다) — **정렬 앞단에 카테고리 우선순위만** 얹는다.
  //   목록 자체는 그대로라 밑으로 내려가면 나머지도 있다(잘라내지 않음).
  const coreCats = ['맛집', '외식창업', '숙소', '뷰티', '네일', '여행', '푸드', '카페'] // 리터럴만 — 인젝션 무관
  const coreFirst = opts?.coreFirst
    ? `CASE WHEN category IN (${coreCats.map(c => `'${c}'`).join(',')}) THEN 0 ELSE 1 END, `
    : ''
  const PAGE = 5000, CAP = 60000
  for (let off = 0; off < CAP; off += PAGE) {
    // 정렬: 카테고리별 시트 분리 유지 + 시트 안은 리드점수순(미채점 후순위) — "누구부터 컨택?"이 파일 순서로 답 됨.
    const page = (await DB.prepare(`SELECT id, platform, name, handle, url, subscriber_count, email, instagram, tiktok, links, category, region, source_keyword, status, collected_at,
        recent_avg_views, recent_avg_comments, recent_posts_30d, contact_channel, contacted_at, follow_up_at, source, consented_at, memo,
        lead_score, median_long_views, shorts_ratio, is_brand, email_status, last_post_at, category_source, opted_out
      FROM ad_influencer_leads WHERE account_id = ?${platFilter}${contactFilter}${scoreFilter} ORDER BY ${coreFirst}category, (lead_score IS NULL) ASC, lead_score DESC, subscriber_count DESC, id DESC LIMIT ? OFFSET ?`)
      .bind(...(plat ? [poolId, plat, PAGE, off] : [poolId, PAGE, off])).all<ExpRow>().catch(() => null))?.results || []
    rows.push(...page)
    if (page.length < PAGE) break
  }
  // 🧹 연락 대상 목록만 같은 주소 중복 제거 — 발송 큐와 **같은 규칙**(`dedupeByEmail` SSOT).
  //   ⚠️ 전체 내보내기(contactable 아님)는 건드리지 않는다 — 그건 *풀의 사본*이라 행이 사라지면
  //   대표가 "왜 내 리드가 없지?" 가 된다. 중복이 해로운 건 **보낼 때**뿐이다.
  const outRows = opts?.contactable ? dedupeByEmail(rows) : rows
  const PLAT: Record<string, string> = { youtube: '유튜브', naver_blog: '네이버블로그', naver_cafe: '네이버카페', tistory: '티스토리', instagram: '인스타그램', tiktok: '틱톡' }
  const CH_KO: Record<string, string> = { email: '이메일', dm: '인스타DM', note: '네이버쪽지', kakao: '카톡', call: '전화', other: '기타' }
  const HEAD = ['ID', '플랫폼', '이름', '핸들', 'URL', '🏅점수', '구독자', '평균조회수', '롱폼중앙값', '쇼츠%', '평균댓글', '月포스팅', '마지막글', '이메일', '메일상태', '인스타그램', '틱톡', '기타링크', '✉️제목(광고표기)', '✉️본문틀', '📍지역', '카테고리', '분류근거', '제외태그', '수집키워드', '상태', '컨택채널', '컨택일', '팔로업', '출처', '동의일', '메모', '수집일']
  /**
   * ⚖️ **수기 발송용 제목·본문틀** (2026-07-29) — 이 레포의 법적 장치는 전부 *대표가 안 쓰는* 경로에만
   *   있었다: AI 초안(ANTHROPIC_API_KEY 필요 — 이번에 AI 기능을 숨김) · 서버 캠페인 발송(Resend 미사용).
   *   실제 워크플로는 **엑셀 내보내기 → 메일 클라이언트에서 직접 발송**인데 거기엔 아무 문구도 없었다.
   *   수집한 이메일(사전동의 없음)로 영리 목적 제안을 대량 발송하는 경로라, 표기 의무를 코드가 채워 준다.
   *   `(광고)` 표기 · 수신거부 안내 · 전송자 정보 — 셋 다 발송 경로와 **같은 함수**(SSOT)로 만든다.
   *   ⚠️ 이건 표기 의무를 돕는 것이지 사전동의를 대체하지 않는다. 발송 여부·범위는 대표 판단이다.
   */
  // ✉️ 문안은 `outreach-template.ts` SSOT — 발송 큐 화면과 **같은 문구**를 쓴다(두 벌이면 조용히 갈라진다).
  const noSub = (p: string) => ['naver_blog', 'naver_cafe', 'tistory'].includes(p) // 구독자 지표 없는 플랫폼
  // 셀 값: number 는 숫자 그대로(xls Number 타입/csv 는 문자열화), 빈값은 '' — "null"/0 오염 없음.
  const cells = (r: ExpRow): (string | number)[] => [r.id, PLAT[r.platform] || r.platform, r.name, r.handle || '', r.url,
    r.lead_score ?? '', noSub(r.platform) ? '' : (r.subscriber_count || 0),
    r.recent_avg_views ?? '', r.median_long_views ?? '', r.shorts_ratio ?? '', r.recent_avg_comments ?? '', r.recent_posts_30d ?? '', r.last_post_at || '',
    r.email || '', MAIL_KO[r.email_status || ''] || r.email_status || '', r.instagram ? `@${r.instagram}` : '', r.tiktok ? `@${r.tiktok}` : '', r.links || '',
    outreachSubject(r.name), outreachBody(r.name, r.platform, r.category), r.region || '', r.category || '기타', r.category ? (CATSRC_KO[r.category_source || 'keyword'] || r.category_source || '') : '',
    // 🚫 거부 명시가 브랜드보다 강한 신호 — 한 칸에 우선순위로 표기(열 추가 없이 헤더 정렬 유지).
    r.opted_out ? '제안거부🚫' : r.is_brand ? '브랜드⚠️' : '',
    r.source_keyword || '', STATUS_KO[r.status] || r.status,
    CH_KO[r.contact_channel || ''] || '', r.contacted_at || '', r.follow_up_at || '', r.source === 'inbound' ? '신청·동의' : '자동수집', r.consented_at || '', r.memo || '', (r.collected_at || '').slice(0, 10)]
  const stamp = new Date().toISOString().slice(0, 10) // 파일명 날짜 — 다운로드 반복 시 버전 구분
  const fname = `influencer-pool${plat ? '-' + plat : ''}-${stamp}` // 매체별 파일은 이름으로 구분(같은 폴더에 섞여도 헷갈리지 않게)

  if (format === 'csv') {
    const csvEscapeCell = (v: string | number) => { const s = String(v ?? ''); const g = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g }
    const body = [HEAD.join(','), ...outRows.map(r => cells(r).map(csvEscapeCell).join(','))].join('\r\n')
    return new Response('﻿' + body, { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': `attachment; filename="${fname}.csv"` } })
  }

  // SpreadsheetML — 카테고리별 시트 + 전체 시트. 시트명은 엑셀 제약(31자·특수문자) 정리.
  const xe = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // 숫자는 Number 타입(정렬/피벗), 텍스트는 String 타입(수식 실행 없음 — 인젝션 가드 불필요).
  const cellXml = (v: string | number) => typeof v === 'number' && Number.isFinite(v) ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${xe(String(v))}</Data></Cell>`
  const rowXml = (vals: (string | number)[]) => `<Row>${vals.map(cellXml).join('')}</Row>`
  const headXml = `<Row>${HEAD.map(h => `<Cell ss:StyleID="h"><Data ss:Type="String">${xe(h)}</Data></Cell>`).join('')}</Row>`
  const sheetName = (name: string) => xe(name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || '기타')
  const byCat = new Map<string, typeof outRows>()
  for (const r of outRows) { const k = r.category || '기타'; const arr = byCat.get(k) || []; arr.push(r); byCat.set(k, arr) }
  const sheetPlan = [{ name: `전체 (${outRows.length})`, rs: outRows }, ...Array.from(byCat.entries()).map(([k, rs]) => ({ name: `${k} (${rs.length})`, rs }))]
  const enc = new TextEncoder()
  function* chunks(): Generator<string> {
    yield `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#EEF2F7" ss:Pattern="Solid"/></Style></Styles>`
    for (const { name, rs } of sheetPlan) {
      yield `<Worksheet ss:Name="${sheetName(name)}"><Table>${headXml}`
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
  return new Response(stream, { headers: { 'Content-Type': 'application/vnd.ms-excel', 'Content-Disposition': `attachment; filename="${fname}.xls"` } })
}
