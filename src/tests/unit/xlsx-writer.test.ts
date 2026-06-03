import { describe, it, expect } from 'vitest'
import { buildXlsx } from '@/features/supply/api/xlsx'

describe('xlsx writer (의존성 0 OOXML stored-zip)', () => {
  it('유효한 zip 시그니처(PK) + EOCD 로 끝남', () => {
    const data = buildXlsx(['a', 'b'], [['x', 1], ['y', 2]])
    expect(data.length).toBeGreaterThan(100)
    // local file header magic
    expect([data[0], data[1], data[2], data[3]]).toEqual([0x50, 0x4b, 0x03, 0x04])
    // EOCD magic 가 마지막 22바이트 시작에 위치
    const eocd = data.subarray(data.length - 22)
    expect([eocd[0], eocd[1], eocd[2], eocd[3]]).toEqual([0x50, 0x4b, 0x05, 0x06])
  })

  it('숫자/문자/빈 셀 혼합 + 한글 인코딩 처리', () => {
    const data = buildXlsx(['상품명', '가격'], [['커피', 5000], ['', null]])
    expect(data.length).toBeGreaterThan(0)
    // 중앙 디렉토리 엔트리 수 = 5개 파일 (EOCD offset 8 에 little-endian uint16)
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const entries = dv.getUint16(data.length - 22 + 10, true)
    expect(entries).toBe(5)
  })
})
