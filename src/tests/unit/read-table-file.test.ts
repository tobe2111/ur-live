/**
 * 📥 2026-06-12: 표 파일 공용 리더 단위 테스트.
 *   xlsx round-trip 은 서버 buildXlsx(STORED zip, inlineStr)를 fixture 로 사용 —
 *   실제 Excel(DEFLATE/sharedStrings)은 운영 E2E 영역이나, zip 컨테이너·행렬 파싱·
 *   인코딩 폴백의 회귀는 여기서 잡힌다.
 */
import { describe, it, expect } from 'vitest'
import { decodeTextSmart, colIndex, parseXlsxToRows, rowsToCsv, readTableFileAsCsv } from '../../lib/read-table-file'
import { buildXlsx } from '../../features/supply/api/xlsx'

describe('decodeTextSmart (인코딩 자동감지)', () => {
  it('UTF-8 (BOM 포함) 정상 디코드', () => {
    const buf = new TextEncoder().encode('﻿상품명,공급가\r\n참치김밥,5000')
    expect(decodeTextSmart(buf.buffer as ArrayBuffer)).toContain('참치김밥')
  })
  it('EUC-KR(CP949) — Excel 기본 CSV 저장 — 한글 복구', () => {
    // '상품명' 의 EUC-KR 바이트 (BBF3 C7B0 B8ED)
    const eucKr = new Uint8Array([0xbb, 0xf3, 0xc7, 0xb0, 0xb8, 0xed, 0x2c, 0x31, 0x30, 0x30])
    const out = decodeTextSmart(eucKr.buffer as ArrayBuffer)
    expect(out).toBe('상품명,100')
  })
})

describe('colIndex', () => {
  it('A→0, B→1, Z→25, AA→26, AB→27', () => {
    expect(colIndex('A1')).toBe(0)
    expect(colIndex('B7')).toBe(1)
    expect(colIndex('Z3')).toBe(25)
    expect(colIndex('AA10')).toBe(26)
    expect(colIndex('AB2')).toBe(27)
  })
})

describe('parseXlsxToRows — buildXlsx round-trip (STORED zip + inlineStr)', () => {
  it('한글/숫자/특수문자 행렬 보존', async () => {
    const headers = ['상품명', '공급가', '비고']
    const rows = [
      ['참치김밥 (대)', 5000, 'A&B "세트"'],
      ['샐러드', 12000, ''],
    ]
    const xlsx = buildXlsx(headers, rows as never)
    const parsed = await parseXlsxToRows(xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength) as ArrayBuffer)
    expect(parsed[0]).toEqual(['상품명', '공급가', '비고'])
    expect(parsed[1][0]).toBe('참치김밥 (대)')
    expect(parsed[1][1]).toBe('5000')
    expect(parsed[1][2]).toBe('A&B "세트"')
    expect(parsed[2][0]).toBe('샐러드')
  })
  it('zip 아닌 입력은 throw', async () => {
    await expect(parseXlsxToRows(new TextEncoder().encode('not a zip').buffer as ArrayBuffer)).rejects.toThrow()
  })
})

// ── DEFLATE zip 빌더 (테스트 전용) — 실제 Excel 저장 파일과 동일한 압축 방식(method=8) 재현 ──
async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw') as unknown as { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> }
  const bytes = data.slice()
  const src = new ReadableStream<Uint8Array>({ start(ctrl) { ctrl.enqueue(bytes); ctrl.close() } })
  const out = await new Response(src.pipeThrough(cs)).arrayBuffer()
  return new Uint8Array(out)
}

async function buildDeflatedZip(files: Array<{ name: string; data: Uint8Array }>): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const comp = await deflateRaw(f.data)
    const nameB = enc.encode(f.name)
    const local = new Uint8Array(30 + nameB.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, 8, true) // method = DEFLATE
    lv.setUint32(18, comp.length, true)
    lv.setUint32(22, f.data.length, true)
    lv.setUint16(26, nameB.length, true)
    local.set(nameB, 30)
    chunks.push(local, comp)
    const cen = new Uint8Array(46 + nameB.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, 8, true)
    cv.setUint32(20, comp.length, true)
    cv.setUint32(24, f.data.length, true)
    cv.setUint16(28, nameB.length, true)
    cv.setUint32(42, offset, true)
    cen.set(nameB, 46)
    central.push(cen)
    offset += local.length + comp.length
  }
  const cenStart = offset
  const cenLen = central.reduce((s, c) => s + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, cenLen, true)
  ev.setUint32(16, cenStart, true)
  const total = [...chunks, ...central, eocd]
  const out = new Uint8Array(total.reduce((s, c) => s + c.length, 0))
  let p = 0
  for (const c of total) { out.set(c, p); p += c.length }
  return out
}

describe('parseXlsxToRows — DEFLATE(실제 Excel 압축 방식) round-trip', () => {
  it('sharedStrings + 일반 셀 — 압축 해제 후 행렬 보존', async () => {
    const enc = new TextEncoder()
    const sheet = `<?xml version="1.0"?><worksheet><sheetData>` +
      `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>` +
      `<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>5000</v></c></row>` +
      `</sheetData></worksheet>`
    const shared = `<?xml version="1.0"?><sst><si><t>상품명</t></si><si><t>공급가</t></si><si><t>김밥 세트</t></si></sst>`
    const zip = await buildDeflatedZip([
      { name: 'xl/sharedStrings.xml', data: enc.encode(shared) },
      { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet) },
    ])
    const rows = await parseXlsxToRows(zip.buffer as ArrayBuffer)
    expect(rows[0]).toEqual(['상품명', '공급가'])
    expect(rows[1]).toEqual(['김밥 세트', '5000'])
  })
})

describe('구버전/비지원 파일 가드', () => {
  it('.xls(OLE 컨테이너) → 명확한 안내 에러', async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    const file = new File([ole], 'old.xls')
    await expect(readTableFileAsCsv(file)).rejects.toThrow(/xlsx/)
  })
})

describe('buildXlsx 수식 셀 (📐 자동계산 양식)', () => {
  it('formula 셀은 <f> 로 기록되고, 파서는 캐시값 없으면 빈칸으로 안전 처리', async () => {
    const xlsx = buildXlsx(
      ['상품명', '공급가', '권장가', '공급률(%)'],
      [
        ['김', 5000, 9900, { formula: 'ROUND(B2/C2*100,1)' }],
        ['', '', '', { formula: 'IF(OR($B3="",$C3=""),"",ROUND($B3/$C3*100,1))' }], // 미입력 행 가드
      ] as never,
    )
    const rows = await parseXlsxToRows(xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength) as ArrayBuffer)
    expect(rows[1].slice(0, 3)).toEqual(['김', '5000', '9900'])
    expect(rows[1][3] ?? '').toBe('') // 수식 캐시값 없음 → 빈칸 (업로드 파서가 무시)
    // 미입력 가드 행은 전부 빈칸 → 트레일링 정리로 제거됨 (업로드에 오류행 안 생김)
    expect(rows.length).toBe(2)
  })
})

describe('rowsToCsv', () => {
  it('쉼표/따옴표/개행 이스케이프', () => {
    expect(rowsToCsv([['a,b', 'x"y', 'z']])).toBe('"a,b","x""y",z')
  })
})

describe('readTableFileAsCsv (진입점)', () => {
  it('.xlsx 파일 → CSV 변환 (서버 parseCsv 가 그대로 처리 가능한 형태)', async () => {
    const xlsx = buildXlsx(['상품명', '공급가'], [['김', 5000]] as never)
    const file = new File([xlsx.slice()], 'products.xlsx')
    const csv = await readTableFileAsCsv(file)
    expect(csv.split('\r\n')[0]).toBe('상품명,공급가')
    expect(csv).toContain('김,5000')
  })
  it('CP949 CSV 파일 → 한글 복구된 텍스트', async () => {
    const eucKr = new Uint8Array([0xbb, 0xf3, 0xc7, 0xb0, 0xb8, 0xed]) // '상품명'
    const file = new File([eucKr], 'products.csv')
    expect(await readTableFileAsCsv(file)).toBe('상품명')
  })
})
