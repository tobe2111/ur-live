/**
 * 🏬 **몰 만들기 폼 데이터** — 타입 · 초기값 · 회사정보 필드표
 *
 * 페이지(`AdminWholesaleMallsPage`)에서 분리했다. 폼이 커진 이유는 **도매몰 시절의 설정이
 * 전부 한 화면에 있어서**인데, 지금 이 화면으로 만드는 건 대부분 **공구 몰**이다.
 * 그래서 화면은 `MallAdvancedFields` 로 접고, 데이터 정의만 여기 둔다.
 */

/** 🏢 몰별 회사(푸터) 정보 필드 — WholesaleFooter BUSINESS_INFO 키와 1:1. 비우면 기본(유통스타트) 폴백. */
export const COMPANY_FIELDS: { key: string; label: string; ph: string }[] = [
  { key: 'company', label: '상호', ph: '사람과고리' },
  { key: 'ceo', label: '대표자', ph: '송유미' },
  { key: 'bizRegNo', label: '사업자등록번호', ph: '108-20-56790' },
  { key: 'mailOrderNo', label: '통신판매신고', ph: '제 20174-서울중구-0242호' },
  { key: 'address', label: '주소', ph: '서울 중구 …' },
  { key: 'tel', label: '전화(고객센터)', ph: '02-2038-0996' },
  { key: 'fax', label: '팩스', ph: '0303-3443-4424' },
  { key: 'csEmail', label: '이메일', ph: 'cs@example.com' },
  { key: 'bankName', label: '입금 은행', ph: '우체국' },
  { key: 'bankNo', label: '입금 계좌번호', ph: '014084-02-129530' },
  { key: 'bankHolder', label: '예금주', ph: '사람과고리(송유미)' },
]

export interface MallForm {
  slug: string
  name: string
  host: string
  brand_name: string
  brand_color: string
  logo_url: string
  deposit_account: string
  commission_rate: string
  categories_json: string
  requires_license: boolean
  consumer_path: boolean
  license_label: string
  features_json: string
  company: Record<string, string>
  active: boolean
}

/**
 * 🔴 **`consumer_path` 기본값 = 켜짐** 〔2026-08-04 대표 "그냥 체크 없이도 열리게 해줘"〕
 *
 * 원래 기본이 **꺼짐**이었고 그건 도매몰이 소비자 도메인으로 새는 걸 막으려는 fail-closed 였다.
 * 그런데 **지금 이 화면으로 만드는 건 공구 몰이고, 공구 몰의 존재 이유가 `urdeal.kr/{슬러그}` 다.**
 * 안전 기본값이 **실제 사용에선 "만들면 404"** 로 나타났다(대표가 실제로 겪었다).
 *
 * ⇒ 기본을 켬으로 뒤집되 **스위치는 남긴다**(고급 설정). 도매몰을 새로 만들 일이 생기면 거기서 끈다.
 * ⚠️ **기존 몰은 안 건드린다** — 이건 새 폼의 초기값일 뿐이라 이미 있는 도매몰의 값은 그대로다.
 */
export const EMPTY: MallForm = {
  slug: '', name: '', host: '', brand_name: '', brand_color: '#111827',
  logo_url: '', deposit_account: '', commission_rate: '', categories_json: '',
  requires_license: false, consumer_path: true, license_label: '', features_json: '', company: {}, active: true,
}
