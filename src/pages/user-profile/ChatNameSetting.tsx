/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 채팅 이름 마스킹 토글.
 */
import { useState } from 'react'

export default function ChatNameSetting() {
  const [masked, setMasked] = useState(() => localStorage.getItem('chat_name_mask') !== 'off')
  const userName = localStorage.getItem('user_name') || '사용자'

  const preview = masked
    ? (userName.length <= 1 ? userName + '*'
      : userName.length === 2 ? userName[0] + '*'
      : userName.length === 3 ? userName[0] + '*' + userName[2]
      : userName[0] + '*'.repeat(userName.length - 2) + userName[userName.length - 1])
    : userName

  const toggle = () => {
    const next = !masked
    setMasked(next)
    localStorage.setItem('chat_name_mask', next ? 'on' : 'off')
  }

  return (
    <div className="ur-content-medium px-5 lg:px-8 py-1.5">
      <div className="bg-[#121212] rounded-2xl px-5 py-4 border border-[#2A2A2A]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">채팅 이름 표시</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              라이브 채팅에서 내 이름: <span className="text-pink-400 font-medium">{preview}</span>
            </p>
          </div>
          <button
            onClick={toggle}
            className={`relative w-11 h-6 rounded-full transition-colors ${masked ? 'bg-pink-500' : 'bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${masked ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-2">
          {masked ? '이름이 마스킹됩니다 (개인정보 보호)' : '원본 이름이 그대로 표시됩니다'}
        </p>
      </div>
    </div>
  )
}
