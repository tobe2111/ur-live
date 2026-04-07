interface UserInfoProps {
  userName?: string
  profileImage?: string
}

export function UserInfo({ userName = '게스트', profileImage }: UserInfoProps) {
  return (
    <div className="bg-[#0F0F0F] px-5 pt-10 pb-6">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          {profileImage ? (
            <img
              src={profileImage}
              alt={userName}
              className="w-20 h-20 rounded-full object-cover"
              onError={(e) => {
                // 이미지 로드 실패 시 이니셜 아바타로 교체
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.removeAttribute('style')
              }}
            />
          ) : null}
          <div
            className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold"
            style={profileImage ? { display: 'none' } : undefined}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight">
          {userName}님
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          유어딜에 오신 것을 환영합니다 🎉
        </p>
      </div>
    </div>
  )
}
