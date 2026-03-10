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
  return (
    <div className="text-center space-y-4">
      {/* Profile Image */}
      {seller.profile_image && (
        <div className="flex justify-center">
          <img 
            src={seller.profile_image} 
            alt={seller.name}
            className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
          />
        </div>
      )}
      
      {/* Name and Business */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {seller.business_name || seller.name}
        </h1>
        {seller.business_name && (
          <p className="text-sm text-gray-500 mt-1">{seller.name}</p>
        )}
      </div>
      
      {/* Bio */}
      {seller.bio && (
        <p className="text-sm text-gray-600 leading-relaxed tracking-wide px-4">
          {seller.bio}
        </p>
      )}
    </div>
  )
}
