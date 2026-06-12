/**
 * 📥 2026-06-12 (사용자 요청 — "엑셀로 대량 등록, 이상적으로"): 표 파일 공용 리더.
 *
 *   해결하는 두 가지 실사용 사고:
 *   1) 한국 Excel 의 기본 CSV 저장 = CP949(ANSI) — 기존 `file.text()`(UTF-8 고정)로는
 *      한글이 전부 �로 깨진 채 업로드됨. → UTF-8(fatal) 시도 후 실패 시 EUC-KR 자동 디코드.
 *   2) .xlsx 직접 업로드 불가 — "CSV 로 다시 저장" 단계에서 이탈/실수.
 *      → 외부 라이브러리 0 으로 xlsx(zip) 를 직접 파싱해 CSV 문자열로 변환,
 *        기존 서버 업로드 경로(parseCsv)를 **무변경**으로 그대로 태운다.
 *
 *   xlsx 파싱 범위: 우리가 배포하는 양식 기반의 단순 표 데이터(공유문자열/인라인문자열/숫자).
 *   수식 결과(<v>)는 값으로 읽힘. 날짜 서식·병합셀 등 고급 기능은 비범위(양식에 없음).
 *   zip: STORED(무압축, 서버 buildXlsx 산출물) + DEFLATE(실제 Excel) 모두 지원 —
 *   DEFLATE 는 표준 DecompressionStream('deflate-raw') 사용 (모던 브라우저/Node 18+).
 */

// ── 인코딩 자동감지 텍스트 디코드 ─────────────────────────────────────────
export function decodeTextSmart(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    // 한국 Excel 기본 저장(CP949/EUC-KR). 브라우저/Node TextDecoder 가 'euc-kr' 지원.
    try {
      return new TextDecoder('euc-kr').decode(buf)
    } catch {
      return new TextDecoder('utf-8').decode(buf) // 최후 — 손상 글자 포함이라도 반환
    }
  }
}

// ── XML 헬퍼 (정규식 기반 — 기계 생성 xlsx XML 한정, DOMParser 불요 → 어디서나 테스트 가능) ──
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

/** <si> 안의 <t> 들을 합침 (rich text run 대응). */
function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g
  let m: RegExpExecArray | null
  while ((m = siRe.exec(xml))) {
    let text = ''
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g
    let tm: RegExpExecArray | null
    while ((tm = tRe.exec(m[1]))) text += unescapeXml(tm[1])
    // <t/> 빈 태그만 있는 경우
    out.push(text)
  }
  return out
}

/** 'B7' → 1 (0-base 열 인덱스). */
export function colIndex(cellRef: string): number {
  let idx = 0
  for (const ch of cellRef) {
    if (ch >= 'A' && ch <= 'Z') idx = idx * 26 + (ch.charCodeAt(0) - 64)
    else break
  }
  return Math.max(0, idx - 1)
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = []
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g
  let rm: RegExpExecArray | null
  while ((rm = rowRe.exec(xml))) {
    const cells: string[] = []
    // 셀: <c r="A1" t="s"><v>0</v></c> | <c t="inlineStr"><is><t>x</t></is></c> | <c r="B1"/><c .../>
    const cRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm: RegExpExecArray | null
    while ((cm = cRe.exec(rm[1]))) {
      const attrs = cm[1] || ''
      const inner = cm[2] || ''
      const rAttr = /r="([A-Z]+)\d+"/.exec(attrs)?.[1]
      const type = /t="(\w+)"/.exec(attrs)?.[1]
      const col = rAttr ? colIndex(rAttr) : cells.length
      let value = ''
      if (type === 's') {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
        value = v !== undefined ? (shared[Number(v)] ?? '') : ''
      } else if (type === 'inlineStr') {
        let text = ''
        const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g
        let tm: RegExpExecArray | null
        while ((tm = tRe.exec(inner))) text += unescapeXml(tm[1])
        value = text
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1]
        value = v !== undefined ? unescapeXml(v) : ''
      }
      while (cells.length < col) cells.push('')
      cells[col] = value
    }
    rows.push(cells)
  }
  // 트레일링 빈 행 제거
  while (rows.length && rows[rows.length - 1].every(c => !c.trim())) rows.pop()
  return rows
}

// ── zip 컨테이너 (EOCD → central directory → entry) ─────────────────────
interface ZipEntry { name: string; method: number; data: Uint8Array }

function readZipEntries(buf: ArrayBuffer): ZipEntry[] {
  const u8 = new Uint8Array(buf)
  const view = new DataView(buf)
  // EOCD(0x06054b50) 를 뒤에서 검색 (코멘트 최대 64KB)
  let eocd = -1
  const min = Math.max(0, u8.length - 65557)
  for (let i = u8.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('zip EOCD 없음 — 올바른 xlsx 파일이 아닙니다')
  const count = view.getUint16(eocd + 10, true)
  let off = view.getUint32(eocd + 16, true)
  const entries: ZipEntry[] = []
  for (let n = 0; n < count; n++) {
    if (view.getUint32(off, true) !== 0x02014b50) break
    const method = view.getUint16(off + 10, true)
    const compSize = view.getUint32(off + 20, true)
    const nameLen = view.getUint16(off + 28, true)
    const extraLen = view.getUint16(off + 30, true)
    const commentLen = view.getUint16(off + 32, true)
    const localOff = view.getUint32(off + 42, true)
    const name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nameLen))
    // 로컬 헤더의 name/extra 길이는 central 과 다를 수 있음 — 로컬에서 다시 읽음
    const lNameLen = view.getUint16(localOff + 26, true)
    const lExtraLen = view.getUint16(localOff + 28, true)
    const dataStart = localOff + 30 + lNameLen + lExtraLen
    entries.push({ name, method, data: u8.subarray(dataStart, dataStart + compSize) })
    off += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function inflateEntry(entry: ZipEntry): Promise<string> {
  if (entry.method === 0) return new TextDecoder().decode(entry.data) // STORED
  if (entry.method === 8) {
    // DEFLATE — 표준 DecompressionStream (Chrome 80+/Safari 16.4+/Firefox 113+/Node 18+).
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('이 브라우저는 .xlsx 직접 업로드를 지원하지 않아요 — 엑셀에서 "CSV(쉼표로 분리)"로 저장해 올려주세요.')
    }
    // Blob.stream() 대신 ReadableStream 직접 생성 — 브라우저/Node/테스트(jsdom) 모두 동작.
    // (DecompressionStream 의 BufferSource 제네릭과 lib.dom 타입이 어긋나 명시 캐스팅.)
    const ds = new DecompressionStream('deflate-raw') as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }
    const bytes = entry.data.slice()
    const src = new ReadableStream<Uint8Array>({ start(ctrl) { ctrl.enqueue(bytes); ctrl.close() } })
    const out = await new Response(src.pipeThrough(ds)).arrayBuffer()
    return new TextDecoder().decode(out)
  }
  throw new Error(`지원하지 않는 압축 방식 (${entry.method})`)
}

/** .xlsx ArrayBuffer → 2차원 문자열 표 (첫 시트). */
export async function parseXlsxToRows(buf: ArrayBuffer): Promise<string[][]> {
  const entries = readZipEntries(buf)
  const sharedEntry = entries.find(e => e.name === 'xl/sharedStrings.xml')
  const shared = sharedEntry ? parseSharedStrings(await inflateEntry(sharedEntry)) : []
  // 첫 워크시트 — sheet1 우선, 없으면 이름순 첫 번째
  const sheets = entries.filter(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  if (!sheets.length) throw new Error('워크시트가 없습니다')
  return parseSheet(await inflateEntry(sheets[0]), shared)
}

/** 2차원 표 → CSV 문자열 (기존 서버 parseCsv 가 그대로 처리). */
export function rowsToCsv(rows: string[][]): string {
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return rows.map(r => r.map(esc).join(',')).join('\r\n')
}

const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04] // 'PK\x03\x04'

/**
 * 업로드 파일 → CSV 문자열 (진입점).
 *   .xlsx(매직넘버 PK 또는 확장자) → zip 파싱 → CSV 변환 / 그 외 → 인코딩 자동감지 텍스트.
 */
export async function readTableFileAsCsv(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const u8 = new Uint8Array(buf)
  // 구버전 .xls (97-2003, OLE 컨테이너 D0 CF 11 E0) — 명확한 안내로 차단.
  if (u8.length > 4 && u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0) {
    throw new Error('구버전 엑셀(.xls) 파일이에요 — 엑셀에서 "다른 이름으로 저장 → Excel 통합 문서(.xlsx)"로 저장해 올려주세요.')
  }
  const isZip = u8.length > 4 && XLSX_MAGIC.every((b, i) => u8[i] === b)
  if (isZip || /\.xlsx$/i.test(file.name)) {
    const rows = await parseXlsxToRows(buf)
    return rowsToCsv(rows)
  }
  return decodeTextSmart(buf)
}
