/**
 * 🌐 유통스타트 — 붙여넣기 파서(buyKorea/tradeKorea/EC21 등 구매리드 리스트·상세, CSV/TSV).
 *   순수함수 모듈 — buyer-discovery(엔진)에서 분리(god 파일 방지). BuyerLead 타입·INTENT_TIERS 만 의존.
 */
import type { BuyerLead } from "./buyer-discovery"
import { INTENT_TIERS } from "./buyer-discovery"
const INTENT_KEYS = Object.keys(INTENT_TIERS)

/* ── 붙여넣기 일괄 파싱(buyKorea 바이어 목록 복붙 → 리드) ───────────────────────── */

// 열 이름 별칭 → 표준 필드(한/영, 소문자 비교). buyKorea/엑셀/시트 복붙 헤더를 유연 매핑.
const COL_ALIAS: Record<string, string> = {
  company: 'company', 회사: 'company', 회사명: 'company', buyer: 'company', name: 'company', company_name: 'company', 바이어: 'company',
  country: 'country', 국가: 'country', 국가명: 'country',
  category: 'category', 카테고리: 'category', 품목: 'category', product: 'category', item: 'category',
  target_market: 'target_market', market: 'target_market', 시장: 'target_market',
  intent: 'intent', 의도: 'intent',
  imports_from_korea: 'imports_from_korea', korea: 'imports_from_korea', 수입이력: 'imports_from_korea', 한국수입: 'imports_from_korea',
  email: 'email', 이메일: 'email', 'e-mail': 'email',
  phone: 'phone', tel: 'phone', 전화: 'phone', 연락처: 'phone',
  contact: 'decision_maker', contact_name: 'decision_maker', 담당자: 'decision_maker', decision_maker: 'decision_maker', 담당자명: 'decision_maker',
  title: 'decision_maker_title', 직책: 'decision_maker_title', position: 'decision_maker_title',
  contact_email: 'decision_maker_email', 담당자이메일: 'decision_maker_email',
  website: 'website', url: 'website', 홈페이지: 'website', homepage: 'website', link: 'website', linkedin: 'website',
  volume: 'est_volume', 물량: 'est_volume', 규모: 'est_volume', est_volume: 'est_volume',
  description: 'description', note: 'description', memo: 'description', 메모: 'description', 요청: 'description', 요청사항: 'description', inquiry: 'description',
}

/** 탭/쉼표 구분 복붙 텍스트를 리드로 파싱(첫 줄=헤더). 순수함수 — 회사명 없는 행 skip, 최대 500. */
export function parseBulkBuyers(text: string): BuyerLead[] {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const delim = lines[0].includes('\t') ? '\t' : ','
  const split = (line: string) => line.split(delim).map(c => c.trim().replace(/^"|"$/g, ''))
  const header = split(lines[0]).map(h => COL_ALIAS[h.toLowerCase()] || '')
  if (!header.includes('company')) return []
  const out: BuyerLead[] = []
  for (const line of lines.slice(1, 501)) {
    const cells = split(line)
    const row: Record<string, string> = {}
    header.forEach((f, i) => { if (f && cells[i] != null) row[f] = cells[i] })
    const company = (row.company || '').trim()
    if (company.length < 2) continue
    const ik = (row.imports_from_korea || '').toLowerCase()
    const intent = INTENT_KEYS.includes(row.intent) ? row.intent : 'buying_lead'
    out.push({
      source: 'buykorea', intent_signal: intent, company: company.slice(0, 200),
      country: row.country || null, target_market: row.target_market || null, category: row.category || null,
      imports_from_korea: ['1', 'y', 'yes', 'true', 'o', '수입', 'korea'].includes(ik) ? 1 : (ik ? 0 : null),
      website: row.website || null, email: row.email || null, phone: row.phone || null,
      decision_maker: row.decision_maker || null, decision_maker_title: row.decision_maker_title || null,
      decision_maker_email: row.decision_maker_email || null, est_volume: row.est_volume || null,
      description: (row.description || '').slice(0, 800), source_keyword: 'buykorea-paste',
    })
  }
  return out
}

/* ── buyKorea 붙여넣기 (리스트 / 상세) → 자동 추출 ─────────────────────────────── */

// 한글 국가명 → 영어(매칭 스코어가 영어 타깃과 맞도록). 미매핑은 원문 유지.
const KO_COUNTRY: Record<string, string> = {
  '나이지리아': 'Nigeria', '인도': 'India', '일본': 'Japan', '중화인민공화국': 'China', '중국': 'China',
  '미국': 'United States', '독일': 'Germany', '베트남': 'Vietnam', '인도네시아': 'Indonesia', '태국': 'Thailand',
  '싱가포르': 'Singapore', '아랍에미리트': 'United Arab Emirates', '말레이시아': 'Malaysia', '필리핀': 'Philippines',
  '대만': 'Taiwan', '홍콩': 'Hong Kong', '영국': 'United Kingdom', '프랑스': 'France', '러시아': 'Russia',
  '브라질': 'Brazil', '멕시코': 'Mexico', '사우디아라비아': 'Saudi Arabia', '튀르키예': 'Turkey', '터키': 'Turkey',
  '스페인': 'Spain', '이탈리아': 'Italy', '캐나다': 'Canada', '호주': 'Australia', '파라과이': 'Paraguay',
  '케냐': 'Kenya', '요르단': 'Jordan', '파키스탄': 'Pakistan', '우즈베키스탄': 'Uzbekistan', '에콰도르': 'Ecuador',
  '콜롬비아': 'Colombia', '캄보디아': 'Cambodia', '이집트': 'Egypt', '도미니카 공화국': 'Dominican Republic',
  '스위스': 'Switzerland', '핀란드': 'Finland', '에스토니아': 'Estonia', '남아프리카 공화국': 'South Africa',
  '루마니아': 'Romania', '모로코': 'Morocco', '우크라이나': 'Ukraine', '말라위': 'Malawi', '이스라엘': 'Israel',
}
function normCountry(s: string | null | undefined): string | null {
  // 괄호 병기 제거(예: "튀르키예(터키)" → "튀르키예") 후 매핑.
  const t = String(s || '').replace(/\s*\(.*?\)\s*/g, '').trim()
  return t ? (KO_COUNTRY[t] || t) : null
}

// buyKorea 최상위 카테고리 18종(대표 제공 순서 = 사이트 표기). 자동 분류 라벨.
export const BK_CATEGORIES = [
  '생활건강', '가구/홈데코', '미용', '스포츠/완구/취미', '패션', '식음료/농업', 'ICT', '가전/전기전자부품',
  '건설기자재', '기계중장비', '기초소재', '반도체/디스플레이', '의료기기', '자동차 부품', '전력플랜트',
  '제약', '조선기자재', '항공부품', '서비스',
]
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** 붙여넣은 buyKorea 페이지의 최상위 카테고리 판별 — 리스트 H1("미용\n전체 88") 우선, 상세 브레드크럼(일반상품 다음) 폴백. */
export function detectBkCategory(text: string): string | null {
  const t = String(text || '')
  for (const cat of BK_CATEGORIES) if (new RegExp(escRe(cat) + '\\s*\\n\\s*전체\\s*\\d').test(t)) return cat
  const after = t.split(/일반상품/)[1] || ''
  for (const cat of BK_CATEGORIES) if (new RegExp('(^|[\\s>\\]])' + escRe(cat) + '([\\s<\\n]|$)').test(after)) return cat
  return null
}

// 지원 B2B 무역 소스 호스트(구매리드/인콰이어리 리스트 붙여넣기). buyKorea 외 tradeKorea·EC21 등 겸용.
const B2B_HOST_RE = /buykorea\.org|tradekorea\.com|kita\.org|gobizkorea\.com|ec21\.com|ecplaza\.net/
function b2bSource(url: string): string {
  if (/buykorea\.org/.test(url)) return 'buykorea'
  if (/tradekorea\.com|kita\.org/.test(url)) return 'tradekorea'
  if (/gobizkorea\.com/.test(url)) return 'gobizkorea'
  if (/ec21\.com/.test(url)) return 'ec21'
  if (/ecplaza\.net/.test(url)) return 'ecplaza'
  return 'feed'
}
const SRC_LABEL: Record<string, string> = { buykorea: 'buyKorea', tradekorea: 'tradeKorea', gobizkorea: 'GoBizKorea', ec21: 'EC21', ecplaza: 'ECPlaza' }

/**
 * B2B 무역 소스 *리스트* 페이지 붙여넣기 → 요청건별 리드(제품·국가·상세링크). buyKorea/tradeKorea/EC21/ECPlaza/
 *   GoBizKorea 겸용(호스트 자동판별). 회사명·연락처는 각 상세에 있음(상세 붙여넣기로 보강).
 */
export function parseB2BLeadList(text: string): BuyerLead[] {
  const raw = String(text || '')
  if (!B2B_HOST_RE.test(raw)) return []
  // [제목](…지원호스트…) 다음 줄의 국가 캡처.
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]*(?:buykorea\.org|tradekorea\.com|kita\.org|gobizkorea\.com|ec21\.com|ecplaza\.net)[^)]*)\)[^\n]*\n\s*[*\-]?\s*([^\n*]+)/g
  const pageCat = detectBkCategory(raw) // 페이지 카테고리 자동 분류(전 항목 공통)
  const out: BuyerLead[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) {
    const url = m[2].trim()
    if (seen.has(url)) continue
    seen.add(url)
    const title = m[1].trim().replace(/^\(공개\)\s*/, '')
    if (title.length < 2 || /^(HOME|인콰이어리|일반상품|이용약관|개인정보|facebook|linkedIn)$/i.test(title)) continue
    const country = normCountry(m[3])
    const src = b2bSource(url)
    out.push({
      source: src, intent_signal: 'buying_lead', company: title.slice(0, 200),
      country, target_market: country, category: pageCat, imports_from_korea: null,
      website: url, email: null, phone: null,
      decision_maker: null, decision_maker_title: null, decision_maker_email: null,
      est_volume: null, description: `${SRC_LABEL[src] || src} 구매요청: ${title}`, source_keyword: src,
    })
  }
  return out
}
/** @deprecated parseB2BLeadList 로 통합(buyKorea 포함). 하위호환 별칭. */
export const parseBuyKoreaList = parseB2BLeadList

/* ── plain-text 리스트 붙여넣기(Ctrl+A → Ctrl+C → Ctrl+V) → 리드 ─────────────────
 *   브라우저에서 리스트를 통째 복사해 <textarea> 에 붙이면 마크다운 링크가 사라진 *순수 텍스트*가 됨:
 *     제목 / 국가 / "게시기간 : 2026.07.15~2027.01.11" / 메세지0 / Favorites0 / view8  (항목당 블록)
 *   parseB2BLeadList(링크 필요)가 0 을 반환하는 케이스 — 날짜줄을 앵커로 역추적한다. */
const DATE_ANCHOR_RE = /^게시기간|^(?:19|20)\d{2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}/
const LEAD_NOISE_RE = /^(메세지|favorites|view|게시기간|정렬|필터|검색|카테고리|국가|전체|열기|닫기|새로|등록순|인기순|home|인콰이어리|일반상품|소재|서비스|search|message|my ?page|레이어|기업대표|goodsctgry|https?:|\d+$|ㄱ|ㅎ)/i

/** 리스트 순수 텍스트(링크 제거됨) → 리드. 날짜줄(게시기간/날짜범위) 위 두 줄 = [제목, 국가]. 최대 500. */
export function parseDatedLeadList(text: string): BuyerLead[] {
  const raw = String(text || '')
  const lines = raw.split(/\r?\n/).map(l => l.replace(/^[\s>*\-•·]+/, '').trim())
  const pageCat = detectBkCategory(raw)
  const isNoise = (s: string) => !s || s.length < 2 || LEAD_NOISE_RE.test(s) || BK_CATEGORIES.includes(s)
  const out: BuyerLead[] = []
  const seen = new Set<string>()
  for (let i = 2; i < lines.length; i++) {
    if (!DATE_ANCHOR_RE.test(lines[i])) continue
    const country = lines[i - 1]
    const title = lines[i - 2].replace(/^\(공개\)\s*/, '')
    if (isNoise(title) || isNoise(country)) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const c = normCountry(country)
    out.push({
      source: 'buykorea', intent_signal: 'buying_lead', company: title.slice(0, 200),
      country: c, target_market: c, category: pageCat, imports_from_korea: null,
      website: null, email: null, phone: null,
      decision_maker: null, decision_maker_title: null, decision_maker_email: null,
      est_volume: null, description: `구매요청: ${title}`.slice(0, 800), source_keyword: 'buykorea-paste',
    })
    if (out.length >= 500) break
  }
  return out
}

/* ── buyKorea 인콰이어리 상세 통째 붙여넣기 → 자동 추출 ──────────────────────── */

// buyKorea 상세 라벨(한글) → 표준 필드.
const BK_LABELS: Record<string, string> = {
  '회사명': 'company',
  '국가 / 도시': 'country', '국가/도시': 'country', '국가': 'country',
  '카테고리': 'category_raw',
  '웹사이트': 'website',
  '현재 수입국가': 'current_import', '현재수입국가': 'current_import',
  '수량': 'est_volume',
  '사용처': 'use',
  '이름': 'decision_maker',
  '이메일': 'email',
  '휴대번호': 'phone', '전화': 'phone', '연락처': 'phone',
}
const BK_LABEL_SET = new Set(Object.keys(BK_LABELS))

/** buyKorea 인콰이어리 상세를 통째로 복붙한 텍스트에서 리드 추출(라벨:값 표 인식). 여러 건(인콰이어리 번호 기준 분할) 지원. */
export function parseBuyKoreaInquiries(text: string): BuyerLead[] {
  const raw = String(text || '')
  if (!raw.includes('회사명') && !raw.includes('인콰이어리')) return []
  // 여러 건(인콰이어리 번호 마커 2개 이상)만 분할 — 단건은 제목이 마커 앞에 있어 통째로 둔다.
  const markerCount = (raw.match(/인콰이어리\s*번호/g) || []).length
  const chunks = markerCount >= 2 ? raw.split(/(?=인콰이어리\s*번호)/).map(b => b.trim()).filter(Boolean) : [raw]
  const pageCat = detectBkCategory(raw) // 브레드크럼 기반 카테고리 자동 분류
  const out: BuyerLead[] = []
  for (const chunk of chunks) {
    const cells = chunk.split(/[\t\n]+/).map(c => c.trim()).filter(Boolean)
    const row: Record<string, string> = {}
    let title = ''
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      if (BK_LABEL_SET.has(cell)) {
        const val = (cells[i + 1] || '').trim()
        // 마스킹(***) 값·다음 라벨은 건너뜀.
        if (val && !BK_LABEL_SET.has(val) && !val.includes('*')) row[BK_LABELS[cell]] = val
        i++
      } else if (!title && cell.length > 3 && !/인콰이어리|게시기간|번호|[:：]/.test(cell)) {
        title = cell // 제목(=원하는 제품)
      }
    }
    const company = (row.company || '').trim()
    if (company.length < 2) continue
    const country = normCountry((row.country || '').split('/')[0].trim())
    const desc = [title, row.use, row.category_raw, row.current_import ? `현재 수입국: ${row.current_import}` : ''].filter(Boolean).join(' · ')
    out.push({
      source: 'buykorea', intent_signal: 'buying_lead', company: company.slice(0, 200),
      country, target_market: country, category: pageCat, imports_from_korea: null,
      website: row.website || null, email: null, phone: null,
      decision_maker: null, decision_maker_title: null, decision_maker_email: null,
      est_volume: row.est_volume ? row.est_volume.slice(0, 60) : null,
      description: desc.slice(0, 800), source_keyword: 'buykorea-paste',
    })
  }
  return out
}
