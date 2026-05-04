import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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

function formatTimeLeft(expiresAt: string, t: (key: string, opts?: any) => string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return t('myGroupBuys.ended');
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return t('myGroupBuys.daysHoursLeft', { days, hours });
  if (hours > 0) return t('myGroupBuys.hoursMinutesLeft', { hours, minutes });
  return t('myGroupBuys.minutesLeft', { minutes });
}

export default function MyGroupBuysPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('ongoing');
  const [groups, setGroups] = useState<ReferralGroup[]>([]);
  const [products, setProducts] = useState<Record<number, ProductInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userType = localStorage.getItem('user_type');
    const userId = localStorage.getItem('user_id');
    if (userType !== 'user' || !userId) {
      toast.info(t('myGroupBuys.loginRequired'));
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
        toast.error(t('myGroupBuys.loadError'));
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
    <div className="min-h-dvh bg-white dark:bg-[#0A0A0A]">
      <SEO
        title={t('myGroupBuys.title')}
        description={t('myGroupBuys.seoDesc')}
        url="/my-group-buys"
      />
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#0A0A0A] border-b border-gray-200 dark:border-[#2A2A2A]">
        <div className="ur-content-narrow flex items-center justify-between h-14 px-4 lg:px-8">
          <button onClick={() => navigate(-1)} className="flex items-center text-gray-700 dark:text-gray-200 hover:text-gray-900">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">{t('myGroupBuys.title')}</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] sticky top-14 z-30">
        {([
          { key: 'ongoing' as TabKey, label: t('myGroupBuys.tabOngoing') },
          { key: 'done' as TabKey, label: t('myGroupBuys.tabDone') },
        ]).map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900'
                : 'text-gray-500 dark:text-gray-400 border-b-2 border-transparent'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <main className="ur-content-narrow px-4 lg:px-8 py-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 dark:border-[#3A3A3A] border-t-gray-900 rounded-full animate-spin" />
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
                    className="w-full text-left bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-3">
                      {/* 썸네일 */}
                      <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden shrink-0 flex items-center justify-center">
                        {img ? (
                          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <ShoppingBag className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {product?.name || `상품 #${g.product_id}`}
                          </h3>
                          <StatusBadge status={g.status} />
                        </div>

                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            g.is_creator ? 'bg-pink-50 text-pink-600' : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300'
                          }`}>
                            {g.is_creator ? t('myGroupBuys.iStarted') : t('myGroupBuys.creatorGroup', { name: g.creator_name })}
                          </span>
                        </div>

                        {/* 진행 바 */}
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full bg-pink-500 transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {g.current_count}/{g.target_count}명
                            </span>
                            <span className="font-semibold text-pink-600">
                              {g.discount_percent}% 할인
                            </span>
                          </div>
                          {g.status === 'open' && (
                            <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                              <Clock className="w-3.5 h-3.5" />
                              {formatTimeLeft(g.expires_at, t)}
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
  const { t } = useTranslation();
  if (status === 'open') {
    return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-900 text-white">{t('myGroupBuys.statusOngoing')}</span>;
  }
  if (status === 'achieved') {
    return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t('myGroupBuys.statusAchieved')}</span>;
  }
  if (status === 'cancelled') {
    return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#1A1A1A] text-gray-400 dark:text-gray-500">{t('myGroupBuys.statusCanceled')}</span>;
  }
  return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#1A1A1A] text-gray-400 dark:text-gray-500">{t('myGroupBuys.statusExpired')}</span>;
}

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#1A1A1A] flex items-center justify-center mb-4">
        <Gift className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{t('myGroupBuys.emptyTitle')}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">{t('myGroupBuys.emptyHint')}</p>
      <button
        onClick={onBrowse}
        className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
      >
        {t('myGroupBuys.browseProducts', { defaultValue: '상품 둘러보기' })}
      </button>
    </div>
  );
}
