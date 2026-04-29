import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, Clock, ShoppingBag, Gift } from 'lucide-react';
import api from '@/lib/api';
import SEO from '@/components/SEO';
import { toast } from '@/hooks/useToast';

interface Tier { count: number; discount: number }
interface ReferralGroup {
  id: number | string;
  invite_code: string;
  product_id: number;
  creator_user_id: number | string;
  creator_name: string;
  current_count: number;
  target_count: number;
  discount_percent: number;
  tiers?: Tier[];
  unlocked_tier?: Tier | null;
  expires_at: string;
  status: 'open' | 'achieved' | 'expired' | 'cancelled';
  is_creator: boolean;
}

interface ProductInfo {
  id: number;
  name: string;
  image_url?: string;
  thumbnail_url?: string;
}

type TabKey = 'ongoing' | 'done';

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '종료됨';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}일 ${hours}시간 남음`;
  if (hours > 0) return `${hours}시간 ${minutes}분 남음`;
  return `${minutes}분 남음`;
}

export default function MyGroupBuysPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('ongoing');
  const [groups, setGroups] = useState<ReferralGroup[]>([]);
  const [products, setProducts] = useState<Record<number, ProductInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userType = localStorage.getItem('user_type');
    const userId = localStorage.getItem('user_id');
    if (userType !== 'user' || !userId) {
      toast.info('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    (async () => {
      try {
        const res = await api.get('/api/referral/my');
        if (res.data?.success) {
          const list: ReferralGroup[] = res.data.data || [];
          setGroups(list);
          // 상품 정보 병렬 조회 (중복 제거)
          const uniqueIds = Array.from(new Set(list.map(g => g.product_id).filter(Boolean)));
          const results = await Promise.all(
            uniqueIds.map(async (pid) => {
              try {
                const p = await api.get(`/api/group-buy/products/${pid}`);
                if (p.data?.success) return [pid, p.data.data as ProductInfo] as const;
              } catch {}
              return null;
            })
          );
          const map: Record<number, ProductInfo> = {};
          results.forEach(r => { if (r) map[r[0]] = r[1]; });
          setProducts(map);
        }
      } catch {
        toast.error('공동구매 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const filtered = useMemo(() => {
    if (tab === 'ongoing') return groups.filter(g => g.status === 'open');
    return groups.filter(g => g.status === 'achieved' || g.status === 'expired' || g.status === 'cancelled');
  }, [groups, tab]);

  return (
    <div className="min-h-dvh bg-white">
      <SEO
        title="내 공동구매"
        description="참여 중인 공동구매 현황을 확인하세요."
        url="/my-group-buys"
      />
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-4">
          <button onClick={() => navigate(-1)} className="flex items-center text-gray-700 hover:text-gray-900">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">내 공동구매</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 bg-white sticky top-14 z-30">
        {([
          { key: 'ongoing', label: '진행 중' },
          { key: 'done', label: '완료' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-500 border-b-2 border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="px-4 py-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onBrowse={() => navigate('/browse')} />
        ) : (
          <ul className="space-y-3">
            {filtered.map(g => {
              const product = products[g.product_id];
              const img = product?.image_url || product?.thumbnail_url;
              const progressPct = Math.min(100, Math.round((g.current_count / Math.max(1, g.target_count)) * 100));
              return (
                <li key={g.id}>
                  <button
                    onClick={() => navigate(`/referral/${g.invite_code}`)}
                    className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {/* 썸네일 */}
                      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {img ? (
                          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <ShoppingBag className="w-6 h-6 text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {product?.name || `상품 #${g.product_id}`}
                          </h3>
                          <StatusBadge status={g.status} />
                        </div>

                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            g.is_creator ? 'bg-pink-50 text-pink-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {g.is_creator ? '내가 시작' : `${g.creator_name}님의 공구`}
                          </span>
                        </div>

                        {/* 진행 바 */}
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-pink-500 transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3 text-gray-600">
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {g.current_count}/{g.target_count}명
                            </span>
                            <span className="font-semibold text-pink-600">
                              {g.discount_percent}% 할인
                            </span>
                          </div>
                          {g.status === 'open' && (
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTimeLeft(g.expires_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: ReferralGroup['status'] }) {
  if (status === 'open') {
    return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-900 text-white">진행중</span>;
  }
  if (status === 'achieved') {
    return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">달성</span>;
  }
  if (status === 'cancelled') {
    return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">취소</span>;
  }
  return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">만료</span>;
}

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Gift className="w-8 h-8 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1">참여 중인 공동구매가 없습니다</p>
      <p className="text-xs text-gray-500 mb-6">친구와 함께 할인받아 보세요</p>
      <button
        onClick={onBrowse}
        className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
      >
        상품 둘러보기
      </button>
    </div>
  );
}
