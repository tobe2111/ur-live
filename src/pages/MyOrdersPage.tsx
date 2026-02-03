import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function MyOrdersPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            홈으로 돌아가기
          </Link>
        </Button>
        <div className="rounded-lg border bg-card p-8 text-center">
          <h1 className="mb-4 text-3xl font-bold">내 주문</h1>
          <p className="mb-6 text-muted-foreground">
            주문 내역 페이지가 곧 shadcn/ui로 구현됩니다
          </p>
          <Button asChild>
            <Link to="/">홈으로</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
