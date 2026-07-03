/**
 * 🌐 2026-07-02 (대표 요청): 유어딜 플랫폼 모델 문서를 어드민에서 열람.
 *   repo 의 SSOT 문서(docs/design/*.md)를 `?raw` 로 import → **빌드마다 자동 동기화**
 *   (문서를 고쳐 배포하면 이 페이지도 자동 최신 — 별도 DB/복붙 없음).
 */
import { useState } from 'react'
// ⚠️ 이 두 import 는 repo 의 실제 SSOT 문서를 그대로 가져온다(빌드 시 인라인). 문서 수정 → 배포 → 자동 반영.
import platformMd from '../../../docs/design/urdeal-platform-model.md?raw'
import linkshopMd from '../../../docs/design/linkshop-role-model.md?raw'
import MarkdownView from '@/components/MarkdownView'
import { FileText } from 'lucide-react'

const DOCS = [
  { key: 'platform', label: '플랫폼 모델 (전체)', src: platformMd },
  { key: 'linkshop', label: '링크샵 역할 모델', src: linkshopMd },
] as const

export default function AdminPlatformModelPage() {
  const [tab, setTab] = useState<(typeof DOCS)[number]['key']>('platform')
  const active = DOCS.find(d => d.key === tab) ?? DOCS[0]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-5 h-5 text-gray-400" />
        <h1 className="text-xl font-extrabold text-gray-900">유어딜 플랫폼 모델</h1>
      </div>
      <p className="text-[13px] text-gray-500 mb-4">
        서비스 구조·행위자·경제·성장 루프의 단일 진실원천(SSOT). 코드(<code className="px-1 rounded bg-gray-100 text-[0.85em]">docs/design/*.md</code>)와
        연동돼 배포 시 자동 최신화됩니다. 수치는 모두 어드민에서 조정 가능한 기본값입니다.
      </p>

      <div className="flex gap-1.5 mb-4 border-b border-gray-200">
        {DOCS.map(d => (
          <button
            key={d.key}
            onClick={() => setTab(d.key)}
            className={`px-3.5 py-2 text-[13px] font-bold -mb-px border-b-2 transition-colors ${
              tab === d.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <MarkdownView source={active.src} />
      </div>
    </div>
  )
}
