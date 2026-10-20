/** 📈 SVG 차트 (2026-10-11) — 가드: src/tests/unit/svg-charts-2026-10-11.test.ts */
const TEST = 'src/tests/unit/svg-charts-2026-10-11.test.ts'
export default [
  {
    name: '[SVG차트] 셀러 차트가 다시 recharts 를 불러온다',
    file: 'src/components/charts/SellerAnalyticsChart.tsx',
    find: "import { SvgLineChart } from './svg-charts'\n",
    replace: "import { SvgLineChart } from './svg-charts'\nimport { LineChart } from 'recharts'\nvoid LineChart\n",
    test: TEST,
    why: 'charts 청크 388 KB 가 조용히 돌아온다.',
  },
  {
    name: '[SVG차트] 값이 전부 0 이면 눈금이 0 하나뿐이다',
    file: 'src/components/charts/svg-charts.tsx',
    find: '  const m = max > 0 ? max : 1\n',
    replace: '  const m = max\n',
    test: TEST,
    why: '0 으로 나눠 막대·선이 NaN 위치에 그려진다.',
  },
]
