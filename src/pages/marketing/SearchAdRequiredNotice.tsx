import { CARD_CLS } from './dashboard-tabs'

/**
 * 🔌 2026-07-28 검색광고 미연결 안내 (대표 지시 — "첫 광고주가 와도 키워드 화면이 비어 있다").
 *
 * 배경: 연관키워드·기회 발굴·목표순위 예상입찰가는 전부 네이버 **검색광고 API**(RelKwdStat/Estimate)
 *   에서 온다. 자격증명은 [광고주 개별 연결 → 플랫폼 전역 폴백] 순으로 풀리는데(resolveSearchAdCreds),
 *   둘 다 없으면 그간 화면이 이렇게 응답했다:
 *     · 연관키워드 → 작은 회색 문구 "…검색광고 키 설정 후 표시됩니다" (누가 뭘 해야 하는지 없음)
 *     · 기회 발굴  → 빨간 에러 + **재시도 버튼**(눌러도 영원히 같은 에러 — 광고주가 계속 누르게 됨)
 *   둘 다 광고주 입장에선 "고장난 화면"으로 읽힌다. 실제로는 **본인 계정을 연결하면 바로 켜지는** 상태다.
 *
 * 그래서 이 컴포넌트는 같은 상황을 **행동 가능한 안내**로 통일한다 — 무엇이 왜 비었고, 어디서, 무엇을
 * 입력하면 켜지는지. 재시도 대신 연결 화면으로 보낸다.
 *
 * ⚠️ 읽기 전용 기능임을 명시한다 — 광고주가 "키를 주면 내 광고비가 조작되나?"를 가장 먼저 걱정하므로.
 */
export default function SearchAdRequiredNotice({ feature, onGo }: { feature: string; onGo?: (anchor: string) => void }) {
  const go = () => {
    if (onGo) { onGo('sec-searchad'); return }
    // 대시보드 밖에서 쓰일 때의 폴백 — 탭 전환은 URL 이 SSOT.
    window.location.href = '/ads/dashboard?tab=performance#sec-searchad'
  }

  return (
    <div className={`mt-3 ${CARD_CLS} border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20`}>
      <div className="text-[13.5px] font-bold text-gray-900 dark:text-white">
        {feature}는 검색광고 계정을 연결하면 켜집니다
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-600 dark:text-gray-300">
        이 데이터는 네이버 <b className="text-gray-800 dark:text-gray-100">검색광고 API</b> 에서 가져옵니다.
        광고 성과 탭에서 <b className="text-gray-800 dark:text-gray-100">고객 ID · 액세스 라이선스 · 비밀키</b> 세 값을 넣으면
        바로 사용할 수 있습니다.
      </p>
      <p className="mt-1 text-[11.5px] text-gray-500 dark:text-gray-400">
        읽기 전용으로만 사용합니다 — 연결한다고 입찰가나 광고비가 바뀌지 않습니다.
        키는 <span className="text-gray-600 dark:text-gray-300">네이버 검색광고 → 도구 → API 사용관리</span> 에서 발급합니다.
      </p>
      <button
        onClick={go}
        className="mt-3 rounded-lg bg-gray-900 dark:bg-white px-4 py-2 text-[12.5px] font-bold text-white dark:text-[#11141C]"
      >
        검색광고 계정 연결하기
      </button>
    </div>
  )
}
