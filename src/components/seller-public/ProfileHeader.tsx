interface ProfileHeaderProps {
  seller: {
    name: string
    email?: string
    bio?: string
  }
}

export function ProfileHeader({ seller }: ProfileHeaderProps) {
  return (
    <div className="text-center space-y-3">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        {seller.name}
      </h1>
      {seller.bio && (
        <p className="text-sm text-gray-600 leading-relaxed tracking-wide px-4">
          {seller.bio}
        </p>
      )}
    </div>
  )
}
