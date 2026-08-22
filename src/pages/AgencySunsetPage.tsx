/**
 * 🌇 에이전시 신규 가입 종료 안내 (2026-08-19)
 *
 * 배경: 에이전시 대시보드 일몰(`AGENCY_DASHBOARD_SUNSET`). 매장 운영은 "별도 대시보드"가 아니라
 *       **셀러 대시보드 안의 관계(위임)** 로 통합된다. 설계: docs/design/store-operator-model.md
 *
 * ⚠️ 404 로 두지 않고 안내 페이지를 남기는 이유: `/agency/register` 는 랜딩·검색·기존 안내 메일에
 *    이미 링크가 나가 있다. 죽은 링크는 "서비스가 망한 것"처럼 보이고, 무엇보다 **다음에 어디로
 *    가야 하는지**를 알려주지 못한다.
 */
import { Link } from 'react-router-dom'
import SEO from '@/components/SEO'
import { Store, ArrowRight, Home } from 'lucide-react'

export default function AgencySunsetPage() {
  return (
    <div className="force-light-theme min-h-[100dvh] bg-gray-50 flex items-center justify-center px-4 py-12">
      <SEO
        title="에이전시 신규 가입 종료 - 유어딜"
        description="에이전시 신규 가입이 종료되었습니다. 매장 운영 위임은 셀러 대시보드에서 진행됩니다."
        url="/agency/register"
      />
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-7 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
          <Store className="w-7 h-7 text-gray-500" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-3">
          에이전시 신규 가입이 종료되었습니다
        </h1>

        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          매장을 대신 운영하시는 분은 이제 <b className="text-gray-900">별도 대시보드 없이</b>{' '}
          매장 사장님에게 <b className="text-gray-900">운영 위임</b>을 받아 셀러 대시보드에서
          그 매장을 관리합니다. 매장의 사업자·정산 정보는 매장에 그대로 남고, 사장님이 직접
          운영하기로 하면 위임만 회수하면 됩니다.
        </p>

        <div className="space-y-2">
          <Link
            to="/seller/register"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold transition"
          >
            셀러 대시보드 시작하기
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/agency/login"
            className="block w-full py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            기존 에이전시 계정으로 로그인
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-1.5 w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            <Home className="w-4 h-4" />
            홈으로
          </Link>
        </div>
      </div>
    </div>
  )
}
