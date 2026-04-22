import { useNavigate } from 'react-router-dom'
import { MapPin, Settings, LogOut, ChevronRight } from 'lucide-react'

interface ProfileTabProps {
  userName: string
  userEmail?: string | null
  userProfileImage?: string | null
  onLogout: () => void
}

const ProfileMenuItem = ({ 
  icon: Icon, 
  label, 
  onClick 
}: { 
  icon: any
  label: string
  onClick: () => void
}) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-[#f5f5f7] transition-colors"
  >
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-[#6e6e73]" />
      <span className="text-[15px] font-medium text-[#1d1d1f]">
        {label}
      </span>
    </div>
    <ChevronRight className="h-5 w-5 text-[#6e6e73]" />
  </button>
)

export function ProfileTab({ userName, userEmail, userProfileImage, onLogout }: ProfileTabProps) {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-4 mb-6">
          {/* 🛡️ 2026-04-22: ui-avatars.com (외부 서비스) → 내부 SVG. GDPR/privacy + 외부 의존성 제거 */}
          {userProfileImage ? (
            <img
              src={userProfileImage}
              alt={userName}
              className="w-20 h-20 rounded-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const fallback = target.nextElementSibling as HTMLElement | null
                if (fallback) fallback.style.display = 'flex'
              }}
            />
          ) : null}
          <div
            className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold"
            style={{ display: userProfileImage ? 'none' : 'flex' }}
            aria-label={userName}
          >
            {(userName || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-[21px] font-semibold text-[#1d1d1f] mb-1">
              {userName}
            </h2>
            {userEmail && (
              <p className="text-[15px] text-[#6e6e73]">
                {userEmail}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <ProfileMenuItem
            icon={MapPin}
            label="배송지 관리"
            onClick={() => navigate('/mypage/addresses')}
          />
          <ProfileMenuItem
            icon={Settings}
            label="설정"
            onClick={() => navigate('/account/settings')}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 p-4 hover:bg-[#f5f5f7] transition-colors text-[#ff3b30]"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[15px] font-medium">
            로그아웃
          </span>
        </button>
      </div>

      {/* App Info */}
      <div className="text-center pt-4">
        <p className="text-[13px] text-[#8e8e93]">
          리스터코퍼레이션 커머스 v2.1.0
        </p>
        <p className="text-[13px] text-[#8e8e93] mt-1">
          © 2026 Your Live Commerce
        </p>
      </div>
    </div>
  )
}
