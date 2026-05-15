/**
 * 🛡️ 2026-05-15 (PRISM 따라잡기): PRISM Live Studio + OBS 송출 가이드.
 *
 * mallpro 의 PRISM 안내 페이지 따라잡기.
 *
 * 내용:
 *   - PRISM 다운로드 + 설치 (Windows/Mac)
 *   - YouTube 채널 연결 (OAuth 1회)
 *   - 다채널 동시 송출 (YouTube + TikTok + Instagram)
 *   - 화질/음질 권장 사양
 *   - 트러블슈팅 (업로드 속도 / CPU / 마이크)
 */

import { useNavigate } from 'react-router-dom'
import { Download, Radio, Wifi, Cpu, Mic, AlertCircle, ChevronRight, ExternalLink, CheckCircle2 } from 'lucide-react'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'

export default function SellerStreamingGuidePage() {
  const navigate = useNavigate()

  return (
    <SellerLayout title="송출 가이드">
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="라이브 송출 가이드"
          subtitle="PRISM Live Studio / OBS 셀러 송출 안내 + 다채널 동시 송출"
          icon={<Radio className="h-5 w-5" />}
        />

        {/* 빠른 시작 카드 */}
        <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl p-5 text-white">
          <p className="text-xs font-bold opacity-80 mb-2">⚡ 30초 요약</p>
          <ol className="text-sm space-y-1.5 list-decimal pl-5">
            <li>PRISM 다운로드 (무료, 네이버)</li>
            <li>YouTube 계정 1회 연결</li>
            <li>해상도 1080p / 비트레이트 6000 kbps</li>
            <li>"라이브 시작" 버튼 → 우리 사이트에 자동 노출</li>
          </ol>
        </div>

        {/* 1. 도구 선택 */}
        <section className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Download className="w-5 h-5 text-pink-500" /> 1. 송출 도구 선택
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-pink-50 border-2 border-pink-300 rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm font-bold text-pink-700">PRISM Live Studio</p>
                <span className="text-[9px] bg-pink-500 text-white px-1.5 py-0.5 rounded-full font-bold">추천</span>
              </div>
              <p className="text-[11px] text-gray-600 mb-3">네이버 제작, 무료, 한국어, 카카오 통합, 다채널 동시 송출 기본</p>
              <a
                href="https://prismlive.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-bold"
              >
                <Download className="w-3 h-3" /> 다운로드 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-gray-900 mb-2">OBS Studio</p>
              <p className="text-[11px] text-gray-600 mb-3">오픈소스, 영문, 무료, 모든 플랫폼 호환, 커스터마이징 강함</p>
              <a
                href="https://obsproject.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold"
              >
                <Download className="w-3 h-3" /> 다운로드 <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
          <p className="text-[10px] text-gray-400">
            PRISM 은 OBS 기반 (실제 OBS Studio fork) — 화질/안정성은 동일. PRISM 이 UI 가 한국어 + 카카오/네이버 연동 추가.
          </p>
        </section>

        {/* 2. YouTube 연결 */}
        <section className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Radio className="w-5 h-5 text-pink-500" /> 2. YouTube 채널 연결
          </h2>
          <ol className="text-sm text-gray-700 space-y-2 list-decimal pl-5">
            <li>본 사이트에서 <button onClick={() => navigate('/seller/live-broadcast')} className="text-pink-600 underline font-bold">셀러 라이브 방송</button> 페이지 진입</li>
            <li>"YouTube 연결" 버튼 → OAuth 동의 화면 (1회만)</li>
            <li>본 사이트가 자동으로 라이브 스트림 생성 + RTMP URL/Key 발급</li>
            <li>PRISM/OBS 에 RTMP 정보 입력 → 송출 시작</li>
          </ol>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            💡 YouTube 채널이 없으면 <a href="https://www.youtube.com/account_advanced" target="_blank" rel="noopener" className="underline font-bold">YouTube 채널 생성</a> 먼저.
            <br />브랜드 채널 (개인 채널 X) 권장 — 가게 이름으로 정식 채널 만드세요.
          </div>
        </section>

        {/* 3. 권장 송출 설정 */}
        <section className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-pink-500" /> 3. 권장 송출 설정
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 font-bold text-gray-700">설정</th>
                  <th className="text-left p-2 font-bold text-pink-700">단일 채널 (추천)</th>
                  <th className="text-left p-2 font-bold text-gray-600">다채널 (3개)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="p-2 text-gray-600">해상도</td><td className="p-2 font-mono">1080p</td><td className="p-2 font-mono">720p × 3</td></tr>
                <tr><td className="p-2 text-gray-600">프레임</td><td className="p-2 font-mono">60 fps</td><td className="p-2 font-mono">30 fps</td></tr>
                <tr><td className="p-2 text-gray-600">비트레이트</td><td className="p-2 font-mono">6000 kbps</td><td className="p-2 font-mono">2500 × 3 = 7500 kbps</td></tr>
                <tr><td className="p-2 text-gray-600">오디오</td><td className="p-2 font-mono">AAC 192 kbps</td><td className="p-2 font-mono">AAC 128 kbps</td></tr>
                <tr><td className="p-2 text-gray-600">필요 업로드</td><td className="p-2 font-mono">~10 Mbps</td><td className="p-2 font-mono">~15 Mbps</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. 최소 환경 */}
        <section className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-pink-500" /> 4. 최소 환경 체크
          </h2>
          <div className="space-y-2">
            {[
              { icon: Wifi, label: '인터넷 업로드 속도', value: '5 Mbps+ (단일) / 15 Mbps+ (다채널)', test: 'speedtest.net 에서 확인' },
              { icon: Cpu, label: 'PC RAM', value: '8 GB+', test: '5년 미만 데스크탑/노트북 OK' },
              { icon: Mic, label: '외장 마이크', value: 'USB 콘덴서 5-10만원', test: '내장 마이크 X — 시청자 이탈 1순위 원인' },
            ].map((row, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <row.icon className="w-4 h-4 text-pink-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900">{row.label}: <span className="text-pink-600">{row.value}</span></p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{row.test}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. 다채널 송출 (PRISM 전용) */}
        <section className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-pink-500" /> 5. 다채널 동시 송출 (PRISM 전용)
          </h2>
          <p className="text-sm text-gray-700">YouTube + TikTok + Instagram 한 번에 송출. PRISM 우측 상단 "+" 버튼.</p>
          <ol className="text-xs text-gray-600 space-y-1 list-decimal pl-5">
            <li>PRISM 좌측 메뉴 → "다채널 설정"</li>
            <li>YouTube 추가 (본 사이트에서 자동 RTMP URL/Key 가져오기) ← 메인</li>
            <li>TikTok 추가 (TikTok Live Studio 계정 연결)</li>
            <li>Instagram 추가 (Meta 계정 연결)</li>
            <li>각 채널 비트레이트 자동 분배됨</li>
            <li>송출 시작 → 본 사이트 + 본인 TikTok/IG 동시 라이브</li>
          </ol>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="text-[11px] text-amber-800">
              <p className="font-bold mb-0.5">다채널 송출 후 미니샵 설정 필수:</p>
              <p>본 사이트는 YouTube 만 임베드. TikTok/Instagram 라이브는 <button onClick={() => navigate('/seller/mini-shop')} className="underline font-bold">미니샵 설정</button>에서 라이브 URL 입력 → 셀러 페이지에 "여기서도 라이브 중" 배지 표시.</p>
            </div>
          </div>
        </section>

        {/* 6. 트러블슈팅 */}
        <section className="bg-white rounded-2xl p-5 border border-gray-200 space-y-3">
          <h2 className="text-base font-bold text-gray-900">🔧 자주 묻는 문제</h2>
          <div className="space-y-2">
            {[
              { q: '화면이 끊겨요', a: '업로드 속도 부족. 단일 채널 + 비트레이트 4000 kbps 로 낮춰보세요.' },
              { q: '소리가 안 들려요', a: 'PRISM 오디오 입력 장치 = 외장 마이크 선택. 내장 마이크 비활성.' },
              { q: 'CPU 100% 사용 중', a: 'PRISM 인코더 = NVENC (NVIDIA) 또는 Quick Sync (Intel) — H264 소프트웨어 → 하드웨어 인코딩.' },
              { q: '시청자 영상이 깜빡임', a: '인터넷 패킷 손실. 유선 LAN 연결 권장 (Wi-Fi 5GHz 차선).' },
              { q: 'YouTube "스트림 키 오류"', a: '본 사이트에서 라이브 다시 생성 → 새 RTMP Key 발급 → PRISM 에 재입력.' },
            ].map((faq, i) => (
              <details key={i} className="bg-gray-50 rounded-lg p-3 group">
                <summary className="text-sm font-bold text-gray-900 cursor-pointer flex items-center justify-between">
                  <span>Q. {faq.q}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                </summary>
                <p className="text-xs text-gray-600 mt-2 pl-3 border-l-2 border-pink-300">A. {faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/seller/live-broadcast')}
            className="py-3.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-sm font-bold"
          >
            라이브 방송 시작 →
          </button>
          <button
            onClick={() => navigate('/seller/mini-shop')}
            className="py-3.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-bold"
          >
            미니샵 설정 →
          </button>
        </div>
      </div>
    </SellerLayout>
  )
}
