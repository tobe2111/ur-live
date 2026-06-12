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
