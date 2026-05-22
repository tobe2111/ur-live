import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Users, Clock, ShoppingBag, Gift, Ticket, Store } from 'lucide-react';
import api from '@/lib/api';
import SEO from '@/components/SEO';
import { toast } from '@/hooks/useToast';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

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

interface VoucherEntry {
  id: number;
  code: string;
  product_id: number;
  status: 'unused' | 'used' | 'expired' | 'refunded';
  used_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  product_name?: string;
  restaurant_name?: string;
  product_image?: string;
}

interface CommunityGroupBuy {
  id: number;
  invite_code?: string;
  creator_user_id: string | number;
  creator_name: string;
  restaurant_name: string;
  proposed_price: number;
  deposit_per_person: number;
  target_count: number;
  current_count: number;
  status: 'proposed' | 'negotiating' | 'confirmed' | 'achieved' | 'failed' | 'refunded';
  confirmed_price?: number;
  confirmed_discount_percent?: number;
  expires_at?: string;
  created_at: string;
  my_status?: string;
}

interface ProductInfo {
  id: number;
  name: string;
  image_url?: string;
  thumbnail_url?: string;
}

type Source = 'referral' | 'voucher' | 'community';
type TabKey = 'all' | Source;

interface UnifiedItem {
  source: Source;
  key: string;
  // generic display
  title: string;
  image?: string;
  status: string;
  isActive: boolean; // ongoing
  isAchieved: boolean;
  isExpiredOrRefunded: boolean;
  // optional progress
  current?: number;
  target?: number;
  expires_at?: string;
  // CTA
  onClick: () => void;
  ctaLabel?: string;
  // raw for badges
  raw: ReferralGroup | VoucherEntry | CommunityGroupBuy;
  // extra label (e.g. "내가 만든 그룹")
  subBadge?: string;
  subBadgeAccent?: 'pink' | 'gray';
  discountText?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────

export default function MyGroupBuysPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('all');

  const [referralGroups, setReferralGroups] = useState<ReferralGroup[]>([]);
  const [vouchers, setVouchers] = useState<VoucherEntry[]>([]);
  const [community, setCommunity] = useState<CommunityGroupBuy[]>([]);
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
      // 3 endpoints in parallel — each with its own try/catch so one failure doesn't blank the page
      const [refRes, vouRes, comRes] = await Promise.allSettled([
        api.get('/api/referral/my'),
        api.get('/api/group-buy/my'),
        api.get('/api/community-group-buy/my'),
      ]);

      let refList: ReferralGroup[] = [];
      let vouList: VoucherEntry[] = [];
      let comList: CommunityGroupBuy[] = [];

      if (refRes.status === 'fulfilled' && refRes.value.data?.success) {
        refList = refRes.value.data.data || [];
      }
      if (vouRes.status === 'fulfilled' && vouRes.value.data?.success) {
        vouList = vouRes.value.data.data || [];
      }
      if (comRes.status === 'fulfilled' && comRes.value.data?.success) {
        const d = comRes.value.data.data || {};
        const created = (d.created || []) as CommunityGroupBuy[];
        const joined = (d.joined || []) as CommunityGroupBuy[];
        comList = [...created, ...joined];
      }

      setReferralGroups(refList);
      setVouchers(vouList);
      setCommunity(comList);

      // Hydrate product info for referral entries (vouchers already include product fields)
      const productIds = Array.from(new Set(refList.map(g => g.product_id).filter(Boolean)));
      if (productIds.length > 0) {
        const results = await Promise.all(
          productIds.map(async (pid) => {
            try {
              const p = await api.get(`/api/group-buy/products/${pid}`);
              if (p.data?.success) return [pid, p.data.data as ProductInfo] as const;
            } catch { /* ignore */ }
            return null;
          })
        );
        const map: Record<number, ProductInfo> = {};
        results.forEach(r => { if (r) map[r[0]] = r[1]; });
        setProducts(map);
      }

      setLoading(false);
    })();
  }, [navigate, t]);

  // Build unified item list
  const unified = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];

    // Referral groups
    for (const g of referralGroups) {
      const product = products[g.product_id];
      const img = product?.image_url || product?.thumbnail_url;
      items.push({
        source: 'referral',
        key: `referral-${g.id}`,
        title: product?.name || `상품 #${g.product_id}`,
        image: img,
        status: g.status,
        isActive: g.status === 'open',
        isAchieved: g.status === 'achieved',
        isExpiredOrRefunded: g.status === 'expired' || g.status === 'cancelled',
        current: g.current_count,
        target: g.target_count,
        expires_at: g.expires_at,
        onClick: () => navigate(`/referral/${g.invite_code}`),
        raw: g,
        subBadge: g.is_creator ? t('myGroupBuys.iStarted') : t('myGroupBuys.creatorGroup', { name: g.creator_name }),
        subBadgeAccent: g.is_creator ? 'pink' : 'gray',
        discountText: g.discount_percent ? `${g.discount_percent}% 할인` : undefined,
        ctaLabel: g.status === 'achieved'
          ? t('myGroupBuys.useCta', { defaultValue: '사용하기' })
          : undefined,
      });
    }

    // Vouchers (seller group-buys I bought)
    for (const v of vouchers) {
      const isUnused = v.status === 'unused';
      const isUsed = v.status === 'used';
      const isExpired = v.status === 'expired';
      const isRefunded = v.status === 'refunded';
      items.push({
        source: 'voucher',
        key: `voucher-${v.id}`,
        title: v.product_name || v.restaurant_name || `바우처 ${v.code}`,
        image: v.product_image,
        status: v.status,
        isActive: isUnused,
        isAchieved: isUsed,
        isExpiredOrRefunded: isExpired || isRefunded,
        expires_at: v.expires_at || undefined,
        onClick: () => navigate(`/vouchers/${v.code}`),
        raw: v,
        ctaLabel: isUnused
          ? t('myGroupBuys.useCta', { defaultValue: '사용하기' })
          : undefined,
      });
    }

    // Community group-buys
    for (const c of community) {
      const isActive = c.status === 'proposed' || c.status === 'negotiating';
      const isAchieved = c.status === 'confirmed' || c.status === 'achieved';
      const isExpired = c.status === 'failed' || c.status === 'refunded';
      const codeOrId = c.invite_code || c.id;
      items.push({
        source: 'community',
        key: `community-${c.id}`,
        title: c.restaurant_name,
        status: c.status,
        isActive,
        isAchieved,
        isExpiredOrRefunded: isExpired,
        current: c.current_count,
        target: c.target_count,
        expires_at: c.expires_at,
        onClick: () => navigate(`/community-group-buy/${codeOrId}`),
        raw: c,
        discountText: c.confirmed_discount_percent
          ? `${c.confirmed_discount_percent}% 확정`
          : undefined,
      });
    }

    // Sort: active first, then most recent
    items.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const aTime = (a.raw as any).created_at || (a.raw as any).expires_at || '';
      const bTime = (b.raw as any).created_at || (b.raw as any).expires_at || '';
      return String(bTime).localeCompare(String(aTime));
    });

    return items;
  }, [referralGroups, vouchers, community, products, t, navigate]);

  const filtered = useMemo(() => {
    if (tab === 'all') return unified;
    return unified.filter(i => i.source === tab);
  }, [unified, tab]);

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all', label: t('myGroupBuys.tabAll', { defaultValue: '전체' }), count: unified.length },
    { key: 'voucher', label: t('myGroupBuys.tabVoucher', { defaultValue: '식사권' }), count: vouchers.length },
    { key: 'community', label: t('myGroupBuys.tabCommunity', { defaultValue: '공구 제안' }), count: community.length },
    { key: 'referral', label: t('myGroupBuys.tabReferral', { defaultValue: '친구초대' }), count: referralGroups.length },
  ];

  return (
    <div className="min-h-dvh bg-white dark:bg-[#0A0A0A]">
      <SEO
        title={t('myGroupBuys.title')}
        description={t('myGroupBuys.seoDesc')}
        url="/my-group-buys"
      />
      {/* 헤더 */}
      <header className="sticky top-0 md:top-14 z-40 bg-white dark:bg-[#0A0A0A] border-b border-gray-200 dark:border-[#2A2A2A]">
        <div className="ur-content-narrow flex items-center justify-between h-14 px-4 lg:px-8">
          <button onClick={() => navigate(-1)} aria-label="뒤로 가기" className="flex items-center text-gray-700 dark:text-gray-200 hover:text-gray-900">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">{t('myGroupBuys.title')}</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] sticky top-14 z-30 overflow-x-auto">
        {tabs.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`flex-1 min-w-[80px] py-3 text-sm font-medium transition-colors whitespace-nowrap ${
              tab === item.key
                ? 'text-gray-900 dark:text-white border-b-2 border-gray-900'
                : 'text-gray-500 dark:text-gray-400 border-b-2 border-transparent'
            }`}
          >
            {item.label}
            {typeof item.count === 'number' && item.count > 0 && (
              <span className="ml-1 text-xs text-gray-400">({item.count})</span>
            )}
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
            {filtered.map(item => (
              <li key={item.key}>
                <UnifiedCard item={item} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────

function UnifiedCard({ item }: { item: UnifiedItem }) {
  const { t } = useTranslation();
  const progressPct = item.target && item.target > 0
    ? Math.min(100, Math.round(((item.current || 0) / item.target) * 100))
    : 0;

  return (
    <button
      onClick={item.onClick}
      className="w-full text-left bg-white dark:bg-[#0A0A0A] rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-4 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3">
        {/* 썸네일 */}
        <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-[#1A1A1A] overflow-hidden shrink-0 flex items-center justify-center">
          {item.image ? (
            <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <SourceIcon source={item.source} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {item.title}
            </h3>
            <UnifiedStatusBadge item={item} />
          </div>

          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <SourceBadge source={item.source} />
            {item.subBadge && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                item.subBadgeAccent === 'pink'
                  ? 'bg-pink-50 text-pink-600'
                  : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-300'
              }`}>
                {item.subBadge}
              </span>
            )}
          </div>

          {/* 진행 바 (active + has target) */}
          {item.isActive && item.target && item.target > 0 && (
            <div className="h-1.5 w-full bg-gray-100 dark:bg-[#1A1A1A] rounded-full overflow-hidden mb-2">
              <div className="h-full bg-pink-500 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
              {item.target && item.target > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {item.current || 0}/{item.target}명
                </span>
              )}
              {item.discountText && (
                <span className="font-semibold text-pink-600">{item.discountText}</span>
              )}
            </div>
            {item.isActive && item.expires_at && (
              <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                {formatTimeLeft(item.expires_at, t)}
              </span>
            )}
            {item.isExpiredOrRefunded && (
              <span className="text-gray-400 dark:text-gray-500">
                {item.source === 'voucher' && (item.raw as VoucherEntry).status === 'refunded'
                  ? t('myGroupBuys.refunded', { defaultValue: '환불 처리됨' })
                  : t('myGroupBuys.refundInProgress', { defaultValue: '환불 진행중' })}
              </span>
            )}
          </div>

          {/* CTA for achieved */}
          {item.ctaLabel && (
            <div className="mt-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-900 text-white text-xs font-semibold">
                {item.ctaLabel}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function SourceIcon({ source }: { source: Source }) {
  if (source === 'voucher') return <Ticket className="w-6 h-6 text-gray-400 dark:text-gray-500" />;
  if (source === 'community') return <Store className="w-6 h-6 text-gray-400 dark:text-gray-500" />;
  return <ShoppingBag className="w-6 h-6 text-gray-400 dark:text-gray-500" />;
}

function SourceBadge({ source }: { source: Source }) {
  const { t } = useTranslation();
  const map: Record<Source, { label: string; cls: string }> = {
    voucher: {
      label: t('myGroupBuys.tabVoucher', { defaultValue: '식사권' }),
      cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    },
    community: {
      label: t('myGroupBuys.tabCommunity', { defaultValue: '공구 제안' }),
      cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    },
    referral: {
      label: t('myGroupBuys.tabReferral', { defaultValue: '친구초대' }),
      cls: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
    },
  };
  const info = map[source];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

function UnifiedStatusBadge({ item }: { item: UnifiedItem }) {
  const { t } = useTranslation();
  if (item.isActive) {
    return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-900 text-white">{t('myGroupBuys.statusOngoing')}</span>;
  }
  if (item.isAchieved) {
    return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{t('myGroupBuys.statusAchieved')}</span>;
  }
  // expired/refunded/cancelled
  if (item.source === 'voucher' && (item.raw as VoucherEntry).status === 'refunded') {
    return <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#1A1A1A] text-gray-500 dark:text-gray-400">{t('myGroupBuys.statusRefunded', { defaultValue: '환불' })}</span>;
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
