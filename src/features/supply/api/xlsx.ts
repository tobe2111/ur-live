/**
 * 🏭 2026-06-03 유통스타트 도매몰 — 의존성 0 .xlsx(OOXML) 생성기.
 *
 * 외부 라이브러리(xlsx/exceljs) 없이 STORED(무압축) zip 으로 진짜 .xlsx 를 만든다.
 * Cloudflare Workers 호환(Uint8Array + TextEncoder + DataView 만 사용). 단일 시트.
 *   - 다운로드 전용 export 에 사용. 재업로드(파싱)용 양식은 CSV 유지(왕복 파싱 용이).
 */

// CRC-32 (IEEE) — zip 무결성용.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const enc = new TextEncoder()
const xmlEsc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))

/** 0-base 열 인덱스 → 엑셀 열문자 (0→A, 25→Z, 26→AA). */
function colLetter(idx: number): string {
  let s = ''
  let n = idx
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return s
}

// 📐 2026-06-12 (사용자 요청): 수식 셀 지원 — { formula: 'ROUND(B2/C2*100,1)' } (= 제외).
//   캐시값 미기록 → 엑셀이 열 때 재계산(workbook calcPr fullCalcOnLoad). 사용자가 값을 채우면
//   그 자리에서 자동 계산되는 "살아있는 양식"용.
export type XlsxCell = string | number | null | undefined | { formula: string }
type Cell = XlsxCell

function sheetXml(rows: Cell[][]): string {
  const body = rows.map((row, r) => {
    const cells = row.map((cell, ci) => {
      const ref = `${colLetter(ci)}${r + 1}`
      if (cell != null && typeof cell === 'object' && 'formula' in cell) {
        return `<c r="${ref}"><f>${xmlEsc(cell.formula)}</f></c>`
      }
      if (typeof cell === 'number' && Number.isFinite(cell)) {
        return `<c r="${ref}"><v>${cell}</v></c>`
      }
      const text = cell == null ? '' : String(cell)
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(text)}</t></is></c>`
    }).join('')
    return `<row r="${r + 1}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

/** 헤더 + 행 → .xlsx Uint8Array (단일 시트). */
export function buildXlsx(headers: string[], rows: Cell[][], sheetName = 'Sheet1'): Uint8Array {
  const allRows: Cell[][] = [headers, ...rows]
  const files: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `</Types>`) },
    { name: '_rels/.rels', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`) },
    { name: 'xl/workbook.xml', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="${xmlEsc(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>` +
      // 📐 수식 셀에 캐시값이 없으므로 열 때 전체 재계산 강제 — 자동계산 컬럼이 항상 살아있게.
      `<calcPr fullCalcOnLoad="1"/></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `</Relationships>`) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheetXml(allRows)) },
  ]
  return zipStored(files)
}

/** STORED(무압축) zip 조립. */
function zipStored(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const crc = crc32(f.data)
    const size = f.data.length

    // Local file header (30 + name)
    const lh = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(lh.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)        // version needed
    lv.setUint16(6, 0, true)         // flags
    lv.setUint16(8, 0, true)         // method = stored
    lv.setUint16(10, 0, true)        // mod time
    lv.setUint16(12, 0x21, true)     // mod date (1980-01-01)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)     // compressed
    lv.setUint32(22, size, true)     // uncompressed
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)        // extra len
    lh.set(nameBytes, 30)
    chunks.push(lh, f.data)

    // Central directory header (46 + name)
    const ch = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(ch.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)        // version made by
    cv.setUint16(6, 20, true)        // version needed
    cv.setUint16(8, 0, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)        // extra
    cv.setUint16(32, 0, true)        // comment
    cv.setUint16(34, 0, true)        // disk start
    cv.setUint16(36, 0, true)        // internal attrs
    cv.setUint32(38, 0, true)        // external attrs
    cv.setUint32(42, offset, true)   // local header offset
    ch.set(nameBytes, 46)
    central.push(ch)

    offset += lh.length + size
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const cdOffset = offset
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, cdOffset, true)

  const total = offset + cdSize + 22
  const out = new Uint8Array(total)
  let p = 0
  for (const c of [...chunks, ...central, eocd]) { out.set(c, p); p += c.length }
  return out
}

/** .xlsx 다운로드 Response. */
export function xlsxResponse(data: Uint8Array, filename: string): Response {
  return new Response(data as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
