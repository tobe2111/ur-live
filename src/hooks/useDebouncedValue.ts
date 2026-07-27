import { useEffect, useState } from 'react'

/**
 * 🔎 입력값 디바운스 — 검색창처럼 타이핑마다 서버 조회가 나가는 것을 막는다.
 *
 *   배경(2026-07-27 대표 "인플루언서 검색도 되게 해줘" / "페이지 렉이 많이 걸려"):
 *   어드민 목록 검색이 매 keystroke 마다 목록+총건수 쿼리를 던지고 있었다. 특히 **한글은 IME 조합 중에도
 *   값이 바뀌어**("ㄱ→가→강→강ㄴ→강남") 한 단어 입력에 5~6번 요청이 나가고, 늦게 도착한 옛 응답이
 *   최신 결과를 덮어써(race) "검색해도 안 나온다"로 보인다. 데이터가 많을수록 심해진다.
 *
 *   value 를 delay(ms) 동안 안 바뀔 때만 반영 → 요청 1회 + 순서 뒤집힘 없음.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), Math.max(0, delay))
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
