interface ProfileHeaderProps {
  seller: {
    name: string
    business_name?: string
    email?: string
    bio?: string
    profile_image?: string
  }
}

export function ProfileHeader({ seller }: ProfileHeaderProps) {
  const displayName = seller.business_name || seller.name
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <div className="text-center space-y-4">
      {/* Profile Image */}
      <div className="flex justify-center">
        {seller.profile_image ? (
          <img
            src={seller.profile_image}
            alt={displayName}
            className="w-20 h-20 rounded-full object-cover ring-2 ring-gray-100 shadow-sm"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-sm">
            {initials}
          </div>
        )}
      </div>

      {/* Name */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
        {seller.business_name && seller.name !== seller.business_name && (
          <p className="text-sm text-gray-500 mt-0.5">@{seller.name}</p>
        )}
      </div>

      {/* Bio */}
      {seller.bio && (
        <p className="text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">
          {seller.bio}
        </p>
      )}
    </div>
  )
}
