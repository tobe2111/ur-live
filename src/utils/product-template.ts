/**
 * 상품 대량등록용 CSV 템플릿 생성 및 다운로드 유틸리티
 */

const SELLER_HEADERS = [
  '상품명*',
  '상품설명',
  '판매가격*',
  '재고수량*',
  '카테고리*',
  '이미지URL',
  '라이브특가',
  '옵션타입',
  '옵션값',
  '옵션추가금액',
  '옵션재고',
]

const ADMIN_HEADERS = [
  '상품명*',
  '상품설명',
  '상세설명',
  '판매가격*',
  '비교가격',
  '공급가격',
  '재고수량*',
  '카테고리*',
  '상품타입*',
  '이미지URL',
  '옵션타입',
  '옵션값',
  '옵션추가금액',
  '옵션재고',
]

const SELLER_EXAMPLE = [
  '프리미엄 무선 이어폰',
  '고음질 블루투스 이어폰입니다',
  '39000',
  '100',
  'electronics',
  '',
  '35000',
  '색상',
  '화이트',
  '0',
  '50',
]

const SELLER_EXAMPLE2 = [
  '프리미엄 무선 이어폰',
  '고음질 블루투스 이어폰입니다',
  '39000',
  '100',
  'electronics',
  '',
  '35000',
  '색상',
  '블랙',
  '0',
  '50',
]

const ADMIN_EXAMPLE = [
  'Ur 특가 스킨케어 세트',
  '인기 스킨케어 3종 세트',
  '촉촉한 피부를 위한 스킨+로션+크림 세트입니다.',
  '45000',
  '59000',
  '25000',
  '200',
  'beauty',
  'featured',
  '',
  '구성',
  '기본세트',
  '0',
  '100',
]

const ADMIN_EXAMPLE2 = [
  'Ur 특가 스킨케어 세트',
  '인기 스킨케어 3종 세트',
  '촉촉한 피부를 위한 스킨+로션+크림 세트입니다.',
  '45000',
  '59000',
  '25000',
  '200',
  'beauty',
  'featured',
  '',
  '구성',
  '프리미엄세트',
  '5000',
  '50',
]

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function buildCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => row.map(escapeCsvCell).join(',')),
  ]
  return '\uFEFF' + lines.join('\n')
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 셀러용 상품 대량등록 템플릿 다운로드
 * - 카테고리: fashion, beauty, food, electronics, lifestyle
 * - 옵션이 여러 개인 경우 같은 상품명으로 행을 추가 (예시 포함)
 */
export function downloadSellerTemplate() {
  const csv = buildCsv(SELLER_HEADERS, [SELLER_EXAMPLE, SELLER_EXAMPLE2])
  downloadCsv(csv, '상품_대량등록_템플릿_셀러.csv')
}

/**
 * 어드민용 상품 대량등록 템플릿 다운로드
 * - 카테고리: fashion, beauty, food, electronics, lifestyle
 * - 상품타입: live (라이브 전용), featured (Ur 특가)
 * - 옵션이 여러 개인 경우 같은 상품명으로 행을 추가 (예시 포함)
 */
export function downloadAdminTemplate() {
  const csv = buildCsv(ADMIN_HEADERS, [ADMIN_EXAMPLE, ADMIN_EXAMPLE2])
  downloadCsv(csv, '상품_대량등록_템플릿_어드민.csv')
}
