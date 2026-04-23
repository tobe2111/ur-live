import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react'

interface Section {
  id: string
  title: string
  icon: string
  content: React.ReactNode
}

function Callout({ type, children }: { type: 'info' | 'warn' | 'danger' | 'ok'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }
  return <div className={`border rounded-lg p-3 text-sm ${styles[type]}`}>{children}</div>
}

function CodeBlock({ children }: { children: string }) {
  return <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-xs overflow-x-auto font-mono">{children}</pre>
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-gray-100 border border-gray-300 rounded">{children}</kbd>
}

export default function AdminOperationsGuidePage() {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState<string | null>('overview')

  const sections: Section[] = [
    {
      id: 'overview', title: '서비스 개요', icon: '📘',
      content: (<>
        <p><b>유어딜(ur-live)</b> 은 한국 시장을 타깃으로 한 라이브 커머스 플랫폼입니다. 세 가지 역할이 상호작용합니다:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>유저(구매자)</b> — 홈/쇼츠/라이브 시청, 장바구니·결제, 후원(donation)</li>
          <li><b>셀러</b> — 상품 등록, 라이브 방송, 정산 요청, 번들·공동구매·타임딜 생성</li>
          <li><b>에이전시</b> — 셀러 모집·관리, 수수료 수익, 성과 비교</li>
          <li><b>관리자(운영팀)</b> — 승인·정산·모더레이션·지표 모니터링</li>
        </ul>
        <p className="pt-2">플랫폼 구조: <code className="bg-gray-100 px-1 rounded">Cloudflare Pages + Workers + D1 + R2 + KV + Durable Objects</code>.
        프론트는 React + Vite, 모바일은 Capacitor 래핑.</p>
        <Callout type="info">
          <b>수익 모델</b>: 상품 판매 플랫폼 수수료(기본 10%, 셀러별 조정 가능) + 후원/기부 수수료(15%) + 알림톡 발송비 + 에이전시 수수료.
        </Callout>
      </>),
    },
    {
      id: 'daily', title: '일일 운영 체크리스트', icon: '✅',
      content: (<>
        <p className="font-semibold">매일 아침 (09:00 권장):</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li><b>대시보드</b> → 어제 매출·주문·신규 가입자 확인</li>
          <li><b>셀러 승인</b> → 대기중 신청 처리 (영업일 기준 24h 이내)</li>
          <li><b>정산</b> → REQUESTED 상태 신청 검토 및 처리 (3~5 영업일 내 입금)</li>
          <li><b>샘플 신청</b> → 에이전시에서 셀러에게 보낸 샘플 요청 승인</li>
          <li><b>리뷰 모더레이션</b> → 신고된 리뷰 확인·숨김 처리</li>
          <li><b>감사 로그</b> → 전날 관리자 행동 리뷰 (이상 행동 탐지)</li>
        </ol>
        <p className="font-semibold pt-2">매일 저녁 (18:00 권장):</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li><b>라이브 모니터</b> → 저녁 방송 진행 중 셀러 현황, 신고된 채팅 확인</li>
          <li><b>KV 모니터링</b> → 캐시 히트율, 레이트 리밋 카운터 점검</li>
          <li><b>주문 이상치</b> → 동일 유저 다중 주문, 비정상 고액 주문 검토</li>
        </ol>
        <Callout type="warn">
          <b>주말/공휴일 주의</b>: 정산 처리는 영업일 기준. 주말 신청은 월요일 처리. 라이브 방송은 주말에 더 활발 → 모니터링 강화.
        </Callout>
      </>),
    },
    {
      id: 'seller-ops', title: '셀러 관리', icon: '🏪',
      content: (<>
        <p><b>승인 프로세스</b>: <code>/admin/seller-approval</code></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>셀러 가입 → <b>status: pending</b> 상태로 대기</li>
          <li>관리자가 사업자번호, 계좌, 신분증 검증 → <b>approved</b> / <b>rejected</b></li>
          <li>거부 시 반드시 사유 기입 → 셀러에게 브랜드메시지 자동 발송</li>
        </ul>
        <p className="pt-2"><b>수수료율 조정</b>: <code>/admin/seller-approval</code> → 셀러 상세</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>기본 10% — 대형 셀러 / 전략 파트너는 5~8% 로 협상 가능</li>
          <li>후원 수수료 기본 15% — 인플루언서 셀러는 10% 까지 조정</li>
          <li>변경 시 감사 로그에 자동 기록됨 (롤백 가능)</li>
        </ul>
        <p className="pt-2"><b>정지 처분</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>허위 광고 / 지속적 배송 지연 / 부적절 콘텐츠 → <b>suspended</b></li>
          <li>정지 시 해당 셀러의 active 라이브는 즉시 종료, 대기 주문은 관리자가 판단</li>
        </ul>
        <Callout type="danger">
          <b>주의</b>: 셀러 삭제는 불가(소프트 삭제만). 사업자번호는 변경 불가 — 변경 필요 시 계정 새로 생성.
        </Callout>
      </>),
    },
    {
      id: 'agency-ops', title: '에이전시 관리', icon: '🤝',
      content: (<>
        <p><b>에이전시 = 여러 셀러를 대표하는 중개 조직</b>. 관리자 페이지: <code>/admin/agencies</code></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>에이전시 자체 가입 → <b>status: pending</b> → 관리자 승인 필요</li>
          <li>승인 후 에이전시는 <b>/seller/register?agency=&lt;id&gt;</b> 링크로 셀러 초대 가능</li>
          <li>초대로 가입한 셀러는 <b>agency_id</b> 가 자동 연결 → 에이전시 수수료 적용</li>
        </ul>
        <p className="pt-2"><b>에이전시 수수료</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>기본 2% (에이전시가 유치한 셀러의 매출에서 플랫폼 수수료와 별도)</li>
          <li>플랫폼 수익 = 총매출 × 10% — 에이전시 수익 = 총매출 × 2% — 셀러 수익 = 총매출 × 88%</li>
          <li>계약 변경 시 <code>/admin/agencies</code> → 에이전시 상세 → 수수료율 수정</li>
        </ul>
        <Callout type="info">
          셀러가 에이전시 소속인지 여부는 셀러 대시보드에 표시되며, 정산 시 에이전시 수수료가 자동 차감됩니다.
        </Callout>
      </>),
    },
    {
      id: 'orders', title: '주문 관리', icon: '📦',
      content: (<>
        <p><b>주문 상태 흐름</b>:</p>
        <CodeBlock>{`PENDING → PAID → SHIPPING → DELIVERED → DONE
                        ↓
                 CANCELLED / REFUNDED`}</CodeBlock>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>PENDING</b>: 결제 대기. 24시간 경과 시 cron 이 자동 취소</li>
          <li><b>PAID</b>: 결제 완료 — 셀러가 배송 처리 대기</li>
          <li><b>SHIPPING</b>: 운송장 등록 완료, 배송 중</li>
          <li><b>DELIVERED</b>: 배송 완료 — 14일 후 cron 이 자동 <b>DONE</b> 처리 (구매확정)</li>
          <li><b>DONE</b>: 구매확정 — 셀러 정산 가능 상태</li>
          <li><b>CANCELLED</b>: 결제 전/후 취소</li>
          <li><b>REFUNDED</b>: 환불 완료 (부분 환불 포함)</li>
        </ul>
        <p className="pt-2"><b>관리자 개입 시나리오</b>:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>셀러가 배송 지연 사유 없이 3일 이상 미처리 → 셀러에게 알림 발송</li>
          <li>유저가 환불 요청했으나 셀러 무응답 → 관리자 직권으로 환불 처리</li>
          <li>결제 시스템 오류로 결제는 되었으나 주문 미생성 → <code>/admin/orders</code> 에서 수동 재생성</li>
        </ol>
        <Callout type="warn">
          Toss 결제 취소는 <b>7일 이내</b>만 자동 처리 가능. 그 이후는 수동 송금 환불.
        </Callout>
      </>),
    },
    {
      id: 'settlement', title: '정산 처리', icon: '💰',
      content: (<>
        <p><b>정산 프로세스</b>: <code>/admin/settlement</code></p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>셀러가 정산 신청 → 상태 <b>REQUESTED</b></li>
          <li>관리자 검토 → 승인 시 <b>APPROVED</b> 상태로 전환</li>
          <li>실제 송금 완료 시 <b>PAID</b> 로 변경 — 이체 증빙 업로드</li>
          <li>문제 있으면 <b>REJECTED</b> + 사유 기입 → 셀러에게 알림</li>
        </ol>
        <p className="pt-2"><b>일괄 처리</b>: <code>/admin/settlements-bulk</code></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>매주 수요일 일괄 정산 권장 — CSV 다운로드 → 은행 일괄이체 → 완료 후 업로드</li>
          <li>금액 = 총매출 − 플랫폼 수수료(10%) − 에이전시 수수료(2%) − 환불액 − 배송비 정산</li>
        </ul>
        <p className="pt-2"><b>정산 검증 포인트</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>DONE 상태 주문만 집계됨 (구매확정 14일 경과)</li>
          <li>환불된 주문은 자동 차감</li>
          <li>셀러 크레딧 잔액(알림톡 선구매 등)은 별도 회계</li>
        </ul>
        <Callout type="danger">
          <b>주의</b>: 정산 완료(PAID) 후 수정 불가. 오류 발견 시 다음 정산분에서 조정.
        </Callout>
      </>),
    },
    {
      id: 'live', title: '라이브 방송 운영', icon: '🔴',
      content: (<>
        <p><b>실시간 모니터링</b>: <code>/admin/live-monitor</code></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>현재 방송 중(status=live) 스트림 목록 + 시청자 수 실시간 표시</li>
          <li>각 스트림 클릭 시 채팅/구매 흐름 확인 가능</li>
          <li>YouTube 채널 연동 상태, RTMP 연결 상태 점검</li>
        </ul>
        <p className="pt-2"><b>방송 중 개입 권한</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>채팅 메시지 <b>숨김</b> — 욕설/스팸/광고 메시지 제거</li>
          <li>방송 <b>강제 종료</b> — 정책 위반 시 (허위 광고, 성희롱 등)</li>
          <li>셀러 <b>일시 정지</b> — 재발 시 계정 정지</li>
        </ul>
        <p className="pt-2"><b>방송 지표 확인</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>시청자 수 (current_viewers) — 90초 heartbeat 기반, 실제 활성 세션</li>
          <li>피크 시청자 (peak_viewers) — 방송 중 최대 동시 접속</li>
          <li>총 뷰 (total_viewers) — 중복 제거된 유니크 시청자</li>
          <li>채팅 수, 주문 수, 후원액 — 참여도 지표</li>
        </ul>
        <p className="pt-2"><b>플래시세일/타임딜 모니터링</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>허위 할인율(원가 부풀리기) 감지 → 상품 비활성화</li>
          <li>재고 0인 상품으로 타임딜 생성 → 시스템이 자동 차단하나 추가 점검</li>
        </ul>
        <Callout type="warn">
          <b>방송 30분 미활동</b> 시 cron 이 자동 종료. 셀러가 재방송 원하면 새 스트림 생성 필요.
        </Callout>
      </>),
    },
    {
      id: 'moderation', title: '콘텐츠 모더레이션', icon: '🛡️',
      content: (<>
        <p><b>리뷰 모더레이션</b>: <code>/admin/review-moderation</code></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>신고된 리뷰 우선 처리 — 혐오/욕설/허위 내용은 <b>숨김</b> 처리</li>
          <li>가짜 리뷰 감지: 동일 IP 다중 작성, 비슷한 문구 반복 → 일괄 숨김</li>
          <li>관리자가 직접 리뷰 생성 가능(테스트용) — 실제 운영에서는 지양</li>
        </ul>
        <p className="pt-2"><b>채팅 모더레이션</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>셀러가 1차 모더레이션 담당 (본인 방송 메시지 삭제 가능)</li>
          <li>관리자는 모든 방송의 채팅에 개입 가능</li>
          <li>반복 위반 유저는 <b>채팅 금지</b> (admin만 설정 가능)</li>
        </ul>
        <p className="pt-2"><b>리플레이(다시보기) 관리</b>: <code>/admin/replay</code></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>종료된 방송은 다시보기로 자동 저장</li>
          <li>문제 있는 방송은 <b>숨김</b> 처리 (삭제 대신 권장)</li>
        </ul>
        <Callout type="danger">
          <b>법적 리스크 콘텐츠</b> (의료기기 허위광고, 청소년 유해물 등) 발견 시 즉시 숨김 + 법무팀 보고.
        </Callout>
      </>),
    },
    {
      id: 'metrics', title: '핵심 지표 모니터링', icon: '📊',
      content: (<>
        <p><b>매출 분석</b>: <code>/admin/revenue</code></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>GMV (총거래액)</b> — 일/주/월 추이 확인, 목표 대비 달성률</li>
          <li><b>카테고리별 매출</b> — 어떤 카테고리가 성장/하락 중인지</li>
          <li><b>TOP 셀러</b> — 상위 10명 매출 집중도 (파레토 원칙 확인)</li>
          <li><b>TOP 상품</b> — 베스트셀러 + 시즌 트렌드</li>
        </ul>
        <p className="pt-2"><b>유저 지표</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>DAU/WAU/MAU</b> — 활성 유저 추이</li>
          <li><b>신규 가입자</b> — 마케팅 채널별 유입 분석</li>
          <li><b>재구매율</b> — 한 번 구매한 유저가 다시 구매하는 비율 (중요!)</li>
          <li><b>이탈률</b> — 30일 무접속 유저 비율</li>
        </ul>
        <p className="pt-2"><b>라이브 지표</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>방송당 평균 시청 시간</b> — 참여도</li>
          <li><b>시청→구매 전환율</b> — 라이브 커머스의 핵심 지표</li>
          <li><b>채팅/시청자 비율</b> — 몰입도</li>
        </ul>
        <p className="pt-2"><b>경보 임계치 (Alert)</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>일 매출 전주 대비 <b>-30% 이상</b> 하락 → 원인 조사 (결제 장애? 인기 셀러 이탈?)</li>
          <li>에러율 <b>1% 초과</b> → Sentry 로그 확인, 긴급 배포 검토</li>
          <li>결제 실패율 <b>5% 초과</b> → Toss 장애 확인, 대체 결제 안내</li>
        </ul>
        <Callout type="info">
          <b>KPI 대시보드</b>는 주간 회의에서 함께 리뷰합니다. 이상치는 즉시 Slack 알림 설정.
        </Callout>
      </>),
    },
    {
      id: 'promo', title: '프로모션/마케팅', icon: '🎯',
      content: (<>
        <p><b>쿠폰 관리</b>: <code>/admin/coupons</code></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>신규 가입 쿠폰 — 자동 발급, 7일 유효</li>
          <li>시즌 쿠폰 — 관리자 수동 생성 (할인율, 최소 주문액, 사용 기간)</li>
          <li>셀러 전용 쿠폰 — 특정 셀러 상품에만 적용 가능</li>
        </ul>
        <p className="pt-2"><b>배너 관리</b>: <code>/admin/banners</code></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>홈 상단 배너 — 최대 5개 슬라이드, 주기적 업데이트</li>
          <li>카테고리별 배너 — 쇼핑 페이지 상단</li>
          <li>클릭률(CTR) 모니터링 — 3% 미만 배너는 교체</li>
        </ul>
        <p className="pt-2"><b>브랜드메시지(알림톡)</b>: <code>/admin/alimtalk</code></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>주문 확인, 배송 시작, 라이브 시작 알림 — 자동 발송</li>
          <li>마케팅 메시지 — 셀러가 크레딧 구매 후 본인 팔로워에게 발송</li>
          <li>요금: 건당 25원 (기본 패키지 100건 2,500원)</li>
        </ul>
        <p className="pt-2"><b>공동구매/타임딜 승인</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>셀러가 자율 생성하나 허위 가격 감지 시 관리자가 중단 가능</li>
          <li>원가 대비 90% 이상 할인 → 자동 플래그 → 관리자 검토 필요</li>
        </ul>
        <Callout type="info">
          신규 프로모션 기획 전에 과거 지표(쿠폰 사용률, 배너 CTR) 확인 → 효과적이지 않은 방식 반복 방지.
        </Callout>
      </>),
    },
    {
      id: 'incident', title: '기술 장애 대응', icon: '🚨',
      content: (<>
        <p className="font-semibold">증상별 1차 점검 체크리스트:</p>
        <div className="space-y-3 pt-2">
          <div>
            <p className="font-semibold text-sm">🔴 유저 대량 로그인 실패</p>
            <ol className="list-decimal pl-5 space-y-0.5 text-xs">
              <li>Cloudflare Dashboard → Workers/Pages → ur-live → Logs</li>
              <li>JWT_SECRET 환경변수 누락 여부 확인 (2026-04-22 사고 선례)</li>
              <li>Kakao 로그인이면 Kakao 콘솔에서 앱 키 유효성 확인</li>
              <li>해결 안되면 이전 배포로 롤백: <code>wrangler pages deployment list</code></li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-sm">🔴 결제 실패 급증</p>
            <ol className="list-decimal pl-5 space-y-0.5 text-xs">
              <li>Toss 페이먼츠 상태 페이지 확인 (<code>status.tosspayments.com</code>)</li>
              <li>Toss SDK 키 만료/변경 여부 (Cloudflare Secret)</li>
              <li>Webhook 수신 여부 확인 — <code>/api/webhooks/toss</code> 로그</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-sm">🔴 라이브 방송 끊김</p>
            <ol className="list-decimal pl-5 space-y-0.5 text-xs">
              <li>Durable Object 상태 확인 — Cloudflare Dashboard</li>
              <li>YouTube API 쿼터 초과 여부 (일일 10,000 units 기본)</li>
              <li>셀러의 RTMP 송출 측 문제면 OBS 재시작 안내</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold text-sm">🟡 특정 기능 에러 (500)</p>
            <ol className="list-decimal pl-5 space-y-0.5 text-xs">
              <li>Sentry 로그에서 에러 스택 확인</li>
              <li>D1 컬럼 누락이면 <code>/api/_internal/repair-schema</code> 호출 (관리자 인증)</li>
              <li>Worker 재배포 — GitHub Actions → main 브랜치 push</li>
            </ol>
          </div>
        </div>
        <Callout type="warn">
          <b>배포 롤백</b>: Cloudflare Dashboard → Pages → Deployments → 이전 버전 "Rollback"
        </Callout>
        <Callout type="danger">
          <b>금지 사항</b>: 운영 중 <code>wrangler deploy</code> 사용 금지 (이 프로젝트는 Pages, Workers 아님). <code>wrangler pages deploy</code> 만 사용.
        </Callout>
      </>),
    },
    {
      id: 'legal', title: '법적 준수 / 보안', icon: '⚖️',
      content: (<>
        <p><b>한국 전자상거래법</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>통신판매업 신고번호 — 셀러 공개 프로필에 표시 의무 (자동 표시됨)</li>
          <li>청약철회 7일 — 환불 가능 기간 법정 준수</li>
          <li>표시·광고 공정화법 — 허위·과장 광고 감지 시 즉시 조치</li>
        </ul>
        <p className="pt-2"><b>개인정보 보호법 (PIPA)</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>셀러 phone/email은 공개 프로필에 노출 금지 (이미 API에서 마스킹됨)</li>
          <li>구매자 닉네임 자동 마스킹 (예: 정종문 → 정*문)</li>
          <li>회원 탈퇴 시 개인정보 30일 내 완전 삭제 (자동 cron)</li>
          <li>주문 관련 데이터는 5년 보관 의무 (법적 요건)</li>
        </ul>
        <p className="pt-2"><b>보안 체크</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>관리자 계정</b>: 2FA 필수 설정 (TOTP), 비밀번호 90일 변경</li>
          <li><b>감사 로그</b>: 모든 관리자 행동 자동 기록, 수정/삭제 불가</li>
          <li><b>세션 타임아웃</b>: 관리자 30분 무활동 시 자동 로그아웃</li>
          <li><b>API 키 rotation</b>: 분기별 JWT_SECRET, DB 크레덴셜 교체</li>
        </ul>
        <Callout type="warn">
          <b>개인정보 유출 의심 시</b>: 즉시 관리자 계정 잠금 → 감사 로그 확인 → 유출 범위 파악 → 72시간 내 KISA 신고 의무.
        </Callout>
      </>),
    },
    {
      id: 'support', title: '고객 문의 응대', icon: '💬',
      content: (<>
        <p><b>문의 유형별 응대 가이드</b>:</p>
        <div className="space-y-3 pt-2">
          <div>
            <p className="font-semibold text-sm">📦 배송 문의</p>
            <ul className="list-disc pl-5 space-y-0.5 text-xs">
              <li>운송장 번호 제공 시 → 택배사 추적 링크 안내</li>
              <li>3일 이상 미출고 → 셀러에게 알림 + 구매자에게 예상일 안내</li>
              <li>분실/파손 → 셀러와 3자 연결, 필요 시 관리자 직권 환불</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-sm">💳 결제/환불 문의</p>
            <ul className="list-disc pl-5 space-y-0.5 text-xs">
              <li>결제는 됐는데 주문 미생성 → <code>/admin/orders</code> 에서 수동 생성</li>
              <li>이중 결제 → Toss 콘솔에서 확인 후 한 건 수동 취소</li>
              <li>7일 초과 환불 요청 → 수동 이체 후 주문 REFUNDED 처리</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-sm">🏪 셀러 문의</p>
            <ul className="list-disc pl-5 space-y-0.5 text-xs">
              <li>가입 승인 지연 → 24h 이내 처리 원칙</li>
              <li>정산 이체 지연 → 은행 이체일 확인, 영업일 5일 초과 시 재전송</li>
              <li>상품 등록 거부 → 거부 사유 명확히 안내 (허위 정보, 카테고리 부적합 등)</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-sm">🔴 이슈 에스컬레이션</p>
            <ul className="list-disc pl-5 space-y-0.5 text-xs">
              <li>법적 문제(사기, 명예훼손) → 법무팀 즉시 전달</li>
              <li>보안 사고(계정 탈취, 개인정보 유출) → CTO + CEO 즉시 보고</li>
              <li>대량 환불 요청(10건↑) → CS 팀장 + 영업팀 협의</li>
            </ul>
          </div>
        </div>
        <Callout type="info">
          응답 목표: 일반 문의 24시간, 결제/배송 4시간, 긴급(분쟁) 1시간 내.
        </Callout>
      </>),
    },
    {
      id: 'deploy', title: '배포 절차', icon: '🚀',
      content: (<>
        <p><b>배포 구조</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Cloudflare Pages</b> 프로젝트 <code>ur-live</code></li>
          <li>커스텀 도메인: <code>live.ur-team.com</code></li>
          <li>자동 배포: feature 브랜치 → main 머지 시 GitHub Actions 가 Pages 에 배포</li>
        </ul>
        <p className="pt-2"><b>배포 명령</b>:</p>
        <CodeBlock>{`# 로컬에서 수동 배포 (비상시에만)
npm run build
npx wrangler@3 pages deploy dist/client --project-name=ur-live

# 환경변수/Secret 변경은 Dashboard 에서
# Cloudflare Dashboard → Pages → ur-live → Settings → Variables`}</CodeBlock>
        <p className="pt-2"><b>배포 전 체크리스트</b>:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li><code>bash scripts/quality-check.sh</code> — 13개 항목 검증</li>
          <li><code>npm test</code> — 999+ 테스트 통과 확인</li>
          <li><code>npx vite build</code> + <code>node scripts/build-worker.js</code> — 빌드 성공</li>
          <li>GitHub Actions 녹색 확인 후 main 머지</li>
        </ol>
        <p className="pt-2"><b>DB 스키마 변경</b>:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>migration 파일 작성 (<code>migrations/0XXX_add_feature.sql</code>)</li>
          <li><code>repair-schema</code> 엔드포인트에 ALTER/CREATE 추가 (임시 조치)</li>
          <li>배포 후 관리자 <Kbd>curl</Kbd> 로 <code>/api/_internal/repair-schema</code> 호출</li>
          <li>정식 migration CI 는 향후 구축 예정 (현재 수동)</li>
        </ul>
        <Callout type="danger">
          <b>절대 금지</b>: main 에 직접 push, pre-commit 훅 <code>--no-verify</code>, 프로덕션 D1 에서 <code>DROP TABLE</code> 수동 실행.
        </Callout>
      </>),
    },
    {
      id: 'faq', title: '자주 묻는 문제 (FAQ)', icon: '❓',
      content: (<>
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-sm">Q. 셀러가 "로그인이 안 돼요" 라고 하면?</p>
            <p className="text-xs pt-1">1) localStorage 초기화 안내 2) 비밀번호 재설정 링크 발송 3) 계정 상태 확인 (status=suspended 여부)</p>
          </div>
          <div>
            <p className="font-semibold text-sm">Q. 주문은 생성됐는데 셀러에게 안 보입니다</p>
            <p className="text-xs pt-1">seller_id 매칭 확인. 관리자가 수동으로 <code>/admin/orders</code> 에서 seller_id 수정 가능.</p>
          </div>
          <div>
            <p className="font-semibold text-sm">Q. 라이브 시청자 수가 부정확합니다</p>
            <p className="text-xs pt-1">current_viewers 는 120초 heartbeat 기반. peak_viewers 는 방송 중 누적 최대값. 둘 다 정확. manual_viewer_count 가 설정돼 있으면 그 값이 우선 표시됨.</p>
          </div>
          <div>
            <p className="font-semibold text-sm">Q. 후원/팁 금액이 맞지 않습니다</p>
            <p className="text-xs pt-1">donations 테이블에서 payment_status='approved' 만 집계. 수수료(15%) 차감 후 셀러에게 정산됨. refunded 상태는 제외.</p>
          </div>
          <div>
            <p className="font-semibold text-sm">Q. 브랜드메시지(알림톡)가 발송 안 됩니다</p>
            <p className="text-xs pt-1">셀러 크레딧 잔액 확인 (<code>seller_credits</code> 테이블). 부족하면 충전 필요. Aligo API 상태도 확인.</p>
          </div>
          <div>
            <p className="font-semibold text-sm">Q. 환불 처리 후 유저가 "안 들어왔다"고 합니다</p>
            <p className="text-xs pt-1">카드 결제는 3~5 영업일 소요 (카드사 영업일 기준). 포인트/적립금은 즉시. Toss 콘솔에서 환불 이력 확인 가능.</p>
          </div>
          <div>
            <p className="font-semibold text-sm">Q. 특정 셀러가 다른 셀러 상품 복사한다고 신고 들어왔어요</p>
            <p className="text-xs pt-1">이미지/설명 유사도 확인 → 원본 셀러에게 증빙 요청 → 허위 판매자 경고 → 반복 시 정지.</p>
          </div>
        </div>
      </>),
    },
    {
      id: 'links', title: '유용한 링크 / 단축키', icon: '🔗',
      content: (<>
        <p className="font-semibold">자주 쓰는 관리자 페이지:</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <a href="/admin" className="p-2 bg-blue-50 hover:bg-blue-100 rounded">📊 대시보드</a>
          <a href="/admin/revenue" className="p-2 bg-blue-50 hover:bg-blue-100 rounded">💵 매출 분석</a>
          <a href="/admin/live-monitor" className="p-2 bg-blue-50 hover:bg-blue-100 rounded">🔴 라이브 모니터</a>
          <a href="/admin/seller-approval" className="p-2 bg-blue-50 hover:bg-blue-100 rounded">✅ 셀러 승인</a>
          <a href="/admin/settlement" className="p-2 bg-blue-50 hover:bg-blue-100 rounded">💰 정산</a>
          <a href="/admin/orders" className="p-2 bg-blue-50 hover:bg-blue-100 rounded">📦 주문 관리</a>
          <a href="/admin/audit-log" className="p-2 bg-blue-50 hover:bg-blue-100 rounded">🛡️ 감사 로그</a>
          <a href="/admin/platform-settings" className="p-2 bg-blue-50 hover:bg-blue-100 rounded">⚙️ 플랫폼 설정</a>
        </div>
        <p className="font-semibold pt-3">외부 서비스:</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>Cloudflare Dashboard — <code>dash.cloudflare.com</code> (Pages / D1 / KV / R2)</li>
          <li>Toss 페이먼츠 — <code>pay.toss.im</code> (결제 내역, 환불, 통계)</li>
          <li>GitHub Actions — 배포 히스토리, 롤백</li>
          <li>Sentry — 런타임 에러 모니터링</li>
          <li>Aligo (알림톡) — <code>smartsms.aligo.in</code></li>
        </ul>
        <p className="font-semibold pt-3">터미널 단축키 (관리자 로컬 환경):</p>
        <CodeBlock>{`# 로컬 개발 서버
npm run dev

# 품질 검증 (커밋 전 필수)
bash scripts/quality-check.sh

# 특정 테스트만
npx vitest run src/tests/unit/multi-platform.routes.test.ts

# D1 콘솔 (Cloudflare)
npx wrangler d1 execute toss-live-commerce-db --command="SELECT COUNT(*) FROM orders"

# KV 확인
npx wrangler kv:key list --namespace-id=<ID>`}</CodeBlock>
        <Callout type="info">
          <b>비상 연락망</b>은 별도 보안 문서 참조. 이 가이드에 개인 연락처 기재 금지.
        </Callout>
      </>),
    },
  ]

  return (
    <AdminLayout title="운영 가이드">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="유어딜 운영 가이드"
          subtitle="서비스 운영·관리자 핸드북 — 일일 업무부터 장애 대응까지"
          icon={<BookOpen className="h-5 w-5" />}
        />

        <Callout type="info">
          이 가이드는 관리자 전용 문서입니다. 최초 로그인한 관리자는 <b>대시보드</b>부터 한 바퀴 훑어보시는 것을 권합니다.
          필요한 섹션만 펼쳐서 참고하세요 — 모두 비동기적으로 숙지하셔도 됩니다.
        </Callout>

        <nav className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">목차</p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm text-gray-700">
            {sections.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="hover:text-blue-600">{s.icon} {s.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-3">
          {sections.map(s => (
            <section key={s.id} id={s.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
              >
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>{s.icon}</span>{s.title}
                </h2>
                {expanded === s.id ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
              {expanded === s.id && (
                <div className="px-5 pb-5 pt-1 border-t border-gray-100 text-sm text-gray-700 space-y-4 leading-relaxed">
                  {s.content}
                </div>
              )}
            </section>
          ))}
        </div>

        <Callout type="info">
          <p className="font-semibold mb-1">이 문서를 업데이트하려면</p>
          <p className="text-xs">파일 위치: <code className="bg-white px-1 rounded">src/pages/admin/AdminOperationsGuidePage.tsx</code></p>
          <p className="text-xs">운영 정책 변경, 새 기능 추가, 장애 복구 사례 등이 생기면 이 가이드도 함께 업데이트해주세요.</p>
        </Callout>
      </div>
    </AdminLayout>
  )
}
