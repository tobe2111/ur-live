/**
 * 🗺️ 지도 마커 할인 강조 임계값 (2026-09-09 — 대표 확정 "안 D4로 하자" 의 조정 손잡이).
 *
 * ## 왜 조정할 수 있어야 하나
 * 안 D4 는 "할인이 큰 곳만 다른 무게로 띄운다" 인데, **얼마부터 큰가는 라인업이 정한다.**
 * 2026-09-09 실측에서는 활성 50건이 전부 할인 중이고 30%+ 가 9건이라 30 이 맞았다.
 * 라인업이 바뀌어 30%+ 가 절반이 되면 그 강조는 다시 배경음이 된다 — 그때 여기서 올린다.
 *
 * 값은 `platform_settings.map_highlight_discount_pct` 에 저장되고 공개
 * `GET /api/consumer-settings` 가 읽는다. 비워 두면 코드 기본값(30)을 쓴다.
 */
import { MAP_HIGHLIGHT_DISCOUNT_PCT } from '@/shared/map-marker'

const KEY = 'map_highlight_discount_pct'

export default function MapMarkerSection({
  settings,
  setSettings,
}: {
  settings: Record<string, string>
  setSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>
}) {
  const raw = settings[KEY] ?? ''
  const n = Number(raw)
  const bad = raw !== '' && !(Number.isFinite(n) && n >= 1 && n <= 99)
  const effective = raw === '' || bad ? MAP_HIGHLIGHT_DISCOUNT_PCT : Math.round(n)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">지도 마커 — 할인 강조 기준</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          이 % 이상인 딜만 지도에서 <span className="font-semibold text-gray-600">검은 알약 + 노란 퍼센트</span>로
          띄웁니다. 나머지는 가격만. 저장 후 최대 10분 뒤 반영(엣지 캐시).
        </p>
      </div>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number" min={1} max={99} inputMode="numeric"
            value={raw}
            onChange={(e) => setSettings(prev => ({ ...prev, [KEY]: e.target.value }))}
            placeholder={String(MAP_HIGHLIGHT_DISCOUNT_PCT)}
            className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
          />
          <span className="text-sm text-gray-500">% 이상</span>
          <span className="text-xs text-gray-400">
            지금 적용 중: <b className="text-gray-700">{effective}%</b>
            {raw === '' && ' (비워 두면 기본값)'}
          </span>
        </div>
        {bad && (
          <p className="mt-2 text-xs text-red-600">
            1~99 사이로 넣어 주세요 — 범위 밖은 저장돼도 무시되고 기본값 {MAP_HIGHLIGHT_DISCOUNT_PCT}% 가 쓰입니다.
          </p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          너무 낮추면 지도의 절반이 검게 변해 강조가 의미를 잃습니다. 화면에 두세 개만 뜨는 값이 좋습니다.
        </p>
      </div>
    </div>
  )
}
