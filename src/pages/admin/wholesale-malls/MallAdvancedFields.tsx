/**
 * ⚙️ **고급 설정 (접힘)** 〔2026-08-04 대표 "기능 토글이며 이런거 복잡해. 카테고리도 불편해"〕
 *
 * 이 폼은 **도매몰 시절에 만들어졌다** — 카테고리 JSON · 기능 토글 JSON · 인허가 · 예치금 계좌 ·
 * 회사(푸터) 정보 11칸이 전부 첫 화면에 펼쳐져 있었다. 그런데 지금 이 화면으로 만드는 건
 * 거의 전부 **공구 몰**이고, 공구 몰에 필요한 건 **이름 · 주소 · 로고 · 색** 넷뿐이다.
 *
 * ⇒ **지우지 않고 접는다.** 도매몰은 존치(2026-08-03 대표 확정)라 기존 몰을 수정할 때
 *   이 값들에 **도달할 수 있어야 한다** — 지우면 그 몰의 푸터·인허가 설정을 영영 못 고친다.
 *
 * 🔴 여기 있는 것 중 **`소비자 도메인에서 열기` 만 성격이 다르다** — 나머지는 "안 쓰면 그만"인데
 *   이건 **꺼지면 몰이 404 가 된다.** 그래서 기본을 켬으로 두고(`mall-form.ts` EMPTY),
 *   누가 끄면 **그 자리에서 결과를 경고**한다.
 *
 * 라이트 고정 테마(대시보드 — `dark:` 없음).
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { COMPANY_FIELDS, type MallForm } from './mall-form'

type SetForm = React.Dispatch<React.SetStateAction<MallForm>>

const INPUT = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400'
const AREA = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none focus:border-gray-400 font-mono'
const LABEL = 'block text-xs font-semibold text-gray-700 mb-1.5'

export default function MallAdvancedFields({ form, setForm }: { form: MallForm; setForm: SetForm }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-gray-200">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <span className="text-sm font-semibold text-gray-700">고급 설정</span>
        <span className="text-[11px] text-gray-400">— 도매몰·규제몰용. 공구 몰은 안 건드려도 됩니다</span>
        {/* 🔴 접힌 상태에서도 '안 열림'은 보여야 한다 — 접혀 있다고 404 를 모르면 안 된다. */}
        {!form.consumer_path && (
          <span className="ml-auto text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
            손님 링크 꺼짐
          </span>
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
          {/* 🏬 소비자 도메인 경로 개방 — 기본 켜짐(mall-form.ts). 끄면 그 몰은 404 가 된다. */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 font-semibold">
              <input type="checkbox" checked={form.consumer_path} onChange={(e) => setForm((f) => ({ ...f, consumer_path: e.target.checked }))} className="w-4 h-4" />
              소비자 도메인에서 열기 — <code className="text-xs bg-gray-100 px-1 rounded">urdeal.kr/{form.slug || '{주소}'}</code>
            </label>
            <p className="text-[11px] text-gray-400">
              공구 몰은 <b>켠 채로 둡니다</b>(기본값). 자기 도메인을 쓰는 도매몰만 끕니다.
            </p>
            {!form.consumer_path && (
              <p className="flex items-start gap-1.5 text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-[1px] text-amber-500" />
                <span>
                  지금 상태로 만들면 <b>손님 링크가 열리지 않습니다</b> — <code className="bg-white/70 px-1 rounded">urdeal.kr/{form.slug || '{주소}'}</code> 는 404 가 됩니다.
                </span>
              </p>
            )}
          </div>

          <div>
            <label className={LABEL}>호스트(들)</label>
            <input value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} maxLength={300}
              className={INPUT} placeholder="food.utongstart.com, www.food.com" />
            <p className="text-[11px] text-gray-400 mt-1">쉼표로 여러 호스트. 비우면 호스트 라우팅 없음.</p>
          </div>

          <div>
            <label className={LABEL}>브랜드명</label>
            <input value={form.brand_name} onChange={(e) => setForm((f) => ({ ...f, brand_name: e.target.value }))} maxLength={80}
              className={INPUT} placeholder="헤더 워드마크 (미입력 시 몰 이름)" />
          </div>

          <div>
            <label className={LABEL}>카테고리 (JSON)</label>
            <textarea value={form.categories_json} onChange={(e) => setForm((f) => ({ ...f, categories_json: e.target.value }))} rows={2}
              className={AREA} placeholder='[{"id":"food","label":"식품"}]' />
            <p className="text-[11px] text-gray-400 mt-1">비우면 기본 카테고리 사용 — <b>대부분 비워 두면 됩니다.</b></p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>입금 계좌</label>
              <input value={form.deposit_account} onChange={(e) => setForm((f) => ({ ...f, deposit_account: e.target.value }))} maxLength={500}
                className={INPUT} placeholder="국민 123-45-6789 (예금주)" />
            </div>
            <div>
              <label className={LABEL}>수수료율 (%)</label>
              <input type="number" step="0.1" value={form.commission_rate} onChange={(e) => setForm((f) => ({ ...f, commission_rate: e.target.value }))}
                className={INPUT} placeholder="10" />
              <p className="text-[11px] text-gray-400 mt-1">비우면 전역 수수료 사용.</p>
            </div>
          </div>

          {/* 🏥 규제 몰(인허가) — 가입 시 신고번호 필수 여부 + 필드 라벨 */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-2.5">
            <label className="flex items-center gap-2 text-sm text-gray-700 font-semibold">
              <input type="checkbox" checked={form.requires_license} onChange={(e) => setForm((f) => ({ ...f, requires_license: e.target.checked }))} className="w-4 h-4" />
              가입 시 인허가(신고번호) 필수 — 규제 몰
            </label>
            {form.requires_license && (
              <input value={form.license_label} onChange={(e) => setForm((f) => ({ ...f, license_label: e.target.value }))} maxLength={80}
                className={INPUT} placeholder="인허가 필드 라벨 — 예: 의료기기 판매업 신고번호" />
            )}
          </div>

          {/* 🧩 기능 토글(제외 레이어) — {"키": false} 로 이 몰에서 기능 숨김. 비우면 전 기능 ON. */}
          <div>
            <label className={LABEL}>기능 토글 (JSON — 이 몰에서 뺄 기능)</label>
            <textarea value={form.features_json} onChange={(e) => setForm((f) => ({ ...f, features_json: e.target.value }))} rows={2}
              className={AREA} placeholder='{"dropship": false}' />
            <p className="text-[11px] text-gray-400 mt-1">비우면 전 기능 켜짐 — <b>대부분 비워 두면 됩니다.</b></p>
          </div>

          {/* 🏬 2026-08-10 몰 운영자 지정 — `/mall-admin` 콘솔의 유일한 열쇠(비우면 어드민 전용). */}
          <div className="rounded-lg border border-gray-200 p-3">
            <label className={LABEL}>몰 운영자 회원번호 <span className="font-normal text-gray-400">(users.id · 비우면 어드민 전용)</span></label>
            <input value={form.operator_user_id} onChange={(e) => setForm((f) => ({ ...f, operator_user_id: e.target.value.replace(/\D/g, '') }))}
              maxLength={12} inputMode="numeric" className={INPUT} placeholder="예: 1024" />
            <p className="text-[11px] text-gray-400 mt-1">
              지정하면 그 회원이 카카오 로그인 후 <code>/mall-admin</code> 에서 이 몰의 공지를 직접 올릴 수 있습니다.
              (첫 진입 시 운영자 약관 동의) 없는 회원번호는 저장되지 않습니다.
            </p>
          </div>

          {/* 📣 2026-08-09 몰별 마케팅/고지. 전부 선택(비우면 미사용). */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-3">
            <p className="text-xs font-bold text-gray-700">마케팅 · 고지 <span className="font-normal text-gray-400">— 운영자 몰용. 비우면 미사용</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>GA4 측정 ID</label>
                <input value={form.ga_id} onChange={(e) => setForm((f) => ({ ...f, ga_id: e.target.value }))} maxLength={30}
                  className={INPUT} placeholder="G-XXXXXXXXXX" />
                <p className="text-[11px] text-gray-400 mt-1">몰 방문이 운영자의 GA 속성으로도 집계됩니다.</p>
              </div>
              <div>
                <label className={LABEL}>네이버 소유확인 값</label>
                <input value={form.naver_verification} onChange={(e) => setForm((f) => ({ ...f, naver_verification: e.target.value }))} maxLength={80}
                  className={INPUT} placeholder="naver-site-verification content 값" />
                <p className="text-[11px] text-gray-400 mt-1">몰 페이지 head 에 메타로 주입 — 커스텀 도메인 연결 시 유효.</p>
              </div>
            </div>
            <div>
              <label className={LABEL}>이용·개인정보 안내문 (방문자 고지)</label>
              <textarea value={form.privacy_md} onChange={(e) => setForm((f) => ({ ...f, privacy_md: e.target.value }))} rows={4}
                className={AREA.replace(' font-mono', '')} placeholder={'예: 본 몰의 주문·픽업 안내, 개인정보 수집·이용 안내 …'} />
              <p className="text-[11px] text-gray-400 mt-1">입력하면 몰 푸터에 "이용·개인정보 안내" 열람 버튼이 생깁니다.</p>
            </div>
          </div>

          {/* 🏢 회사(푸터) 정보 — 비운 칸은 기본(유통스타트) 정보로 폴백. */}
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-bold text-gray-700 mb-2">푸터 사업자 정보 <span className="font-normal text-gray-400">— 비운 칸은 기본 정보 사용</span></p>
            <div className="grid grid-cols-2 gap-2.5">
              {COMPANY_FIELDS.map((cf) => (
                <div key={cf.key} className={cf.key === 'address' || cf.key === 'mailOrderNo' ? 'col-span-2' : ''}>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">{cf.label}</label>
                  <input value={form.company[cf.key] || ''} maxLength={300}
                    onChange={(e) => setForm((f) => ({ ...f, company: { ...f.company, [cf.key]: e.target.value } }))}
                    className="w-full h-9 px-2.5 rounded-lg border border-gray-200 text-[13px] text-gray-900 outline-none focus:border-gray-400" placeholder={cf.ph} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
