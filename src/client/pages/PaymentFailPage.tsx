// Payment Fail Page
import { useSearchParams, Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export function PaymentFailPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const message = searchParams.get('message');
  const orderId = searchParams.get('orderId');

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center" data-testid="payment-fail">
      <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">결제 실패</h1>
      {message && <p className="text-gray-600 mb-1">{message}</p>}
      {code && <p className="text-sm text-gray-400 mb-2">오류 코드: {code}</p>}
      {orderId && <p className="text-sm text-gray-400 mb-6">주문번호: {orderId}</p>}
      <div className="flex gap-3 justify-center">
        <Link to="/cart" className="btn-secondary">장바구니로 돌아가기</Link>
        <Link to="/checkout" className="btn-primary">다시 결제하기</Link>
      </div>
    </div>
  );
}
