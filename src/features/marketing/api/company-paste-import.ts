/**
 * 📋 **붙여넣기 임포트** — 헤더 있는 표(CSV/TSV) → `CompanyLead[]` (`source='registry'`).
 *
 *   레인 B(공정위 정보공개서) · C(상인회 명부) 처럼 **API 가 없는 출처**를 어드민이 표로 붙여넣는 길이다.
 *   순수 함수다(DB·네트워크 무접촉) — `company-discovery.ts` 에서 **그대로 옮겨 왔고 로직은 byte-불변**이다.
 *
 *   🧱 2026-10-24 이관 사유: `company-discovery.ts` 가 606줄로 600 캡을 넘겼다(CLAUDE.md god 파일 래칫).
 *   이 블록은 그 파일에서 **가장 독립적인 조각**이라(타입 하나만 import) 먼저 떼어냈다.
 *   호출부는 `company-discovery` 의 재수출로 받으므로 **import 경로를 바꿀 필요가 없다**.
 */
import type { CompanyLead } from './company-discovery'

/** 헤더 한글/영문 → 필드. 앞에 오는 것이 이긴다(같은 필드에 여러 헤더가 맞으면 **첫 열**). */
const IMPORT_HEADER_MAP: { keys: string[]; field: keyof CompanyLead }[] = [
  { keys: ['회사명', '상호', '업체명', '브랜드', '영업표지', 'company', 'name'], field: 'company_name' },
  { keys: ['전화', '연락처', '대표번호', '전화번호', 'tel', 'phone'], field: 'phone' },
  { keys: ['이메일', '메일', 'email', 'e-mail'], field: 'email' },
  { keys: ['홈페이지', '사이트', 'website', 'url', 'homepage'], field: 'website' },
  { keys: ['주소', '소재지', 'address'], field: 'address' },
  { keys: ['지역', 'region'], field: 'region' },
  { keys: ['업종', '카테고리', 'category'], field: 'category' },
  { keys: ['세부', 'subcategory'], field: 'subcategory' },
]

export function parsePartnerPaste(text: string): CompanyLead[] {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const delim = (lines[0].match(/\t/g) || []).length >= (lines[0].match(/,/g) || []).length ? '\t' : ','
  const header = lines[0].split(delim).map(h => h.trim().toLowerCase())
  const col: Partial<Record<keyof CompanyLead, number>> = {}
  header.forEach((h, i) => {
    for (const m of IMPORT_HEADER_MAP) if (col[m.field] === undefined && m.keys.some(k => h.includes(k.toLowerCase()))) col[m.field] = i
  })
  if (col.company_name === undefined) return []
  const out: CompanyLead[] = []
  for (const line of lines.slice(1)) {
    const cells = line.split(delim)
    const get = (f: keyof CompanyLead): string => col[f] !== undefined ? String(cells[col[f] as number] || '').trim() : ''
    const name = get('company_name')
    if (name.length < 2) continue
    out.push({
      company_name: name,
      phone: get('phone') || null, email: get('email') || null, website: get('website') || null,
      address: get('address') || null, region: get('region') || null,
      category: get('category') || null, subcategory: get('subcategory') || null,
      source: 'registry', source_keyword: 'import',
    })
    if (out.length >= 2000) break
  }
  return out
}
