import { useNavigate } from "react-router-dom"
import {
  MapPin,
  ShoppingBag,
  FileText,
  Shield,
  Truck,
  Settings,
  ChevronRight,
  Ticket,
  Heart,
} from "lucide-react"

const menuItems = [
  {
    icon: ShoppingBag,
    title: "주문 내역",
    subtitle: "구매한 상품을 확인하세요",
    path: "/my-orders",
  },
  {
    icon: Ticket,
    title: "내 식사권",
    subtitle: "공동구매 바우처를 확인하세요",
    path: "/my-vouchers",
    accent: true,
  },
  {
    icon: Heart,
    title: "위시리스트",
    subtitle: "찜한 상품 목록",
    path: "/wishlist",
  },
  {
    icon: MapPin,
    title: "배송지 관리",
    subtitle: "배송 주소를 관리하세요",
    path: "/mypage/addresses",
  },
  {
    icon: Settings,
    title: "계정 설정",
    subtitle: "프로필 및 계정 관리",
    path: "/account/settings",
  },
  {
    icon: FileText,
    title: "이용약관",
    subtitle: "",
    path: "/terms-of-service",
  },
  {
    icon: Shield,
    title: "개인정보처리방침",
    subtitle: "",
    path: "/privacy-policy",
  },
  {
    icon: Truck,
    title: "배송 및 환불 정책",
    subtitle: "",
    path: "/refund-policy",
  },
]

export function MenuList() {
  const navigate = useNavigate()

  return (
    <div className="bg-[#020202]">
      <div className="px-5">
        {menuItems.map((item, index) => (
          <button
            key={item.title}
            onClick={() => navigate(item.path)}
            className={`flex w-full items-center gap-4 py-4 text-left transition-colors active:bg-secondary ${
              index !== menuItems.length - 1
                ? "border-b border-[#1A1A1A]"
                : ""
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <item.icon className="h-[18px] w-[18px] text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                {item.title}
              </p>
              {item.subtitle && (
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {item.subtitle}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
          </button>
        ))}
      </div>
    </div>
  )
}
