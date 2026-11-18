/** 🧬 주입 — 이미지 건강 모니터 (2026-11-18) · 가드: src/tests/unit/image-health-monitor-2026-11-18.test.ts */
const T = 'src/tests/unit/image-health-monitor-2026-11-18.test.ts'
const F = 'src/worker/cron/image-health-monitor.ts'
export default [
  { name: 'imghealth: 못 닿음을 다시 깨짐으로 센다', file: F,
    find: "      if (s === 'unreachable') { unreachable++; return }\n", replace: "      if (s === 'unreachable') { unreachable++; broken++ }\n", test: T,
    why: '해외를 막는 원본 사진 때문에 매일 깨짐 100% 거짓 경보가 난다.' },
  { name: 'imghealth: 브라우저 전용 호스트를 표본에 넣는다', file: F,
    find: '    if (host && isRawOnlyImageHost(host)) { skipped++; continue }\n', replace: '', test: T,
    why: '서버가 판정할 수 없는 사진으로 표본이 차서 한 회가 수 분 걸린다.' },
]
