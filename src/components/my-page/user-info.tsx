interface UserInfoProps {
  userName?: string
}

export function UserInfo({ userName = '게스트' }: UserInfoProps) {
  return (
    <div className="bg-background px-5 pt-10 pb-6">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          {userName}님
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          리스터코퍼레이션에 오신 것을 환영합니다
        </p>
      </div>
    </div>
  )
}
