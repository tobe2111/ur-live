/**
 * 셀러 광고 슬롯 입찰 페이지 (2026-05-05)
 *
 * 5개 슬롯 (메인 hero, 카테고리 상위 1, 라이브 추천 1/2/3) 에
 * 입찰하여 24시간 노출 우선권을 획득합니다.
 *
 * 경매 방식:
 *   - 매일 18시 현재 최고 입찰자 낙찰 (낙찰 후 24시간 노출)
 *   - 최소 입찰가 = 기본가 또는 현재 최고가 + 1,000원
 *   - 낙찰 후 결제 (dashboard 알림으로 안내)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Gavel, Clock, TrendingUp, Trophy, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SEO from '@/components/SEO';

interface AdSlot {
  slot_id: string;
  display_name: string;
  description: string;
  base_price: number;
  current_seller_id: number | null;
  current_bid: number | null;
  expires_at: string | null;
  is_active: number;
  current_winner_name: string | null;
  top_bid: number | null;
  bid_count: number;
  min_bid: number;
  is_expired: boolean;
  my_bid: {
    slot_id: string;
    bid_amount: number;
    status: string;
    payment_status: string;
    start_period: string | null;
    end_period: string | null; // eslint-disable-line @typescript-eslint/no-unused-vars
  } | null;
}

interface SlotLabels {
  waiting: string;
  closed: string;
  won: string;
  leading: string;
  bidding: string;
  basePrice: string;
  currentTop: string;
  bidCount: string;
  bidUnit: string;
  noBid: string;
  priceUnit: string;
  exposing: string;
  myBid: string;
  wonSuffix: string;
  leadingSuffix: string;
  competingSuffix: string;
  changeBid: string;
  placeBid: string;
}

interface BidModalLabels {
  basePriceLabel: string;
  minBidLabel: string;
  bidAmountLabel: string;
  auctionNotice: string;
  cancelBtn: string;
  submitBtn: string;
  submitting: string;
  priceUnit: string;
  minBidError: (amount: string) => string;
  networkError: string;
  bidFailed: string;
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('seller_token') || localStorage.getItem('access_token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function useAdSlots() {
  const [slots, setSlots] = useState<AdSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/seller/ad-slots', {
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json() as { slots: AdSlot[] };
        setSlots(data.slots ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { slots, loading, reload: load };
}

function timeLeft(expiresAt: string | null, labels: { waiting: string; closed: string }): string {
  if (!expiresAt) return labels.waiting;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return labels.closed;
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function SlotCard({ slot, labels, onBid }: { slot: AdSlot; labels: SlotLabels; onBid: (slot: AdSlot) => void }) {
  const wonByMe = slot.my_bid?.status === 'won';
  const bidding = slot.my_bid?.status === 'active';
  const isLeading = bidding && slot.my_bid?.bid_amount === slot.top_bid;
  const tlabels = { waiting: labels.waiting, closed: labels.closed };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold text-gray-900">{slot.display_name}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{slot.description}</p>
        </div>
        {wonByMe && (
          <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-semibold">
            <Trophy className="w-3 h-3" />{labels.won}
          </span>
        )}
        {isLeading && !wonByMe && (
          <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">
            <TrendingUp className="w-3 h-3" />{labels.leading}
          </span>
        )}
        {bidding && !isLeading && (
          <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
            <Gavel className="w-3 h-3" />{labels.bidding}
          </span>
        )}
      </div>

      <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-gray-400">{labels.basePrice}</p>
          <p className="text-[12px] font-semibold text-gray-900">{slot.base_price.toLocaleString('ko-KR')}{labels.priceUnit}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">{labels.currentTop}</p>
          <p className="text-[12px] font-semibold text-gray-900">
            {slot.top_bid ? slot.top_bid.toLocaleString('ko-KR') + labels.priceUnit : labels.noBid}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">{labels.bidCount}</p>
          <p className="text-[12px] font-semibold text-gray-900">{slot.bid_count}{labels.bidUnit}</p>
        </div>
      </div>

      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeLeft(slot.expires_at, tlabels)}</span>
        </div>
        {wonByMe ? (
          <span className="text-[11px] text-yellow-600 font-medium">{labels.exposing} — {timeLeft(slot.my_bid?.end_period ?? null, tlabels)}</span>
        ) : (
          <button
            type="button"
            onClick={() => onBid(slot)}
            disabled={slot.is_expired}
            className="px-3 py-1.5 rounded-xl bg-pink-500 text-white text-[12px] font-semibold disabled:opacity-40 hover:bg-pink-600 transition-colors"
          >
            {slot.is_expired ? labels.closed : bidding ? labels.changeBid : labels.placeBid}
          </button>
        )}
      </div>

      {slot.my_bid && (
        <div className="px-4 pb-3">
          <div className={`rounded-xl px-3 py-2 text-[11px] ${
            wonByMe ? 'bg-yellow-50 text-yellow-700' :
            isLeading ? 'bg-green-50 text-green-700' :
            'bg-gray-50 text-gray-600'
          }`}>
            {labels.myBid}: {slot.my_bid.bid_amount.toLocaleString('ko-KR')}{labels.priceUnit}
            {wonByMe && ' · ' + labels.wonSuffix}
            {isLeading && ' · ' + labels.leadingSuffix}
            {bidding && !isLeading && ' · ' + labels.competingSuffix}
          </div>
        </div>
      )}
    </div>
  );
}

function BidModal({
  slot,
  labels,
  onClose,
  onSuccess,
}: {
  slot: AdSlot;
  labels: BidModalLabels;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(String(slot.min_bid));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const bid = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(bid) || bid < slot.min_bid) {
      setError(labels.minBidError(slot.min_bid.toLocaleString('ko-KR')));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/seller/ad-slots/${slot.slot_id}/bid`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_amount: bid }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; min_bid?: number };
      if (!res.ok) {
        setError(data.error ?? labels.bidFailed);
        if (data.min_bid) setAmount(String(data.min_bid));
      } else {
        onSuccess();
      }
    } catch {
      setError(labels.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl w-full max-w-[430px] p-6 pb-8">
        <h3 className="text-[15px] font-bold text-gray-900 mb-1">{slot.display_name}</h3>
        <p className="text-[12px] text-gray-500 mb-4">{slot.description}</p>

        <div className="grid grid-cols-2 gap-3 mb-4 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-500">{labels.basePriceLabel}</p>
            <p className="text-[13px] font-bold text-gray-900">{slot.base_price.toLocaleString('ko-KR')}{labels.priceUnit}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-500">{labels.minBidLabel}</p>
            <p className="text-[13px] font-bold text-pink-600">{slot.min_bid.toLocaleString('ko-KR')}{labels.priceUnit}</p>
          </div>
        </div>

        <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">{labels.bidAmountLabel}</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          min={slot.min_bid}
          step={1000}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400"
          placeholder={`${labels.minBidLabel} ${slot.min_bid.toLocaleString('ko-KR')}${labels.priceUnit}`}
        />
        {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}

        <div className="flex items-start gap-2 mt-3 p-3 bg-blue-50 rounded-xl">
          <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-blue-700">
            {labels.auctionNotice}
          </p>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-700"
          >
            {labels.cancelBtn}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-pink-500 text-white text-[13px] font-semibold disabled:opacity-50 hover:bg-pink-600 transition-colors"
          >
            {loading ? labels.submitting : labels.submitBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SellerAdSlotsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slots, loading, reload } = useAdSlots();
  const [selectedSlot, setSelectedSlot] = useState<AdSlot | null>(null);

  const slotLabels: SlotLabels = {
    waiting: t('seller.adSlots.waiting', { defaultValue: '대기 중' }),
    closed: t('seller.adSlots.closed', { defaultValue: '마감' }),
    won: t('seller.adSlots.won', { defaultValue: '낙찰' }),
    leading: t('seller.adSlots.leading', { defaultValue: '선두' }),
    bidding: t('seller.adSlots.bidding', { defaultValue: '입찰 중' }),
    basePrice: t('seller.adSlots.basePrice', { defaultValue: '기본가' }),
    currentTop: t('seller.adSlots.currentTop', { defaultValue: '현재 최고' }),
    bidCount: t('seller.adSlots.bidCount', { defaultValue: '입찰 수' }),
    bidUnit: t('seller.adSlots.bidUnit', { defaultValue: '건' }),
    noBid: t('seller.adSlots.noBid', { defaultValue: '없음' }),
    priceUnit: t('seller.adSlots.priceUnit', { defaultValue: '원' }),
    exposing: t('seller.adSlots.exposing', { defaultValue: '노출 중' }),
    myBid: t('seller.adSlots.myBid', { defaultValue: '내 입찰가' }),
    wonSuffix: t('seller.adSlots.wonSuffix', { defaultValue: '낙찰 완료' }),
    leadingSuffix: t('seller.adSlots.leadingSuffix', { defaultValue: '현재 선두' }),
    competingSuffix: t('seller.adSlots.competingSuffix', { defaultValue: '경쟁 중 (입찰가 올리기 권장)' }),
    changeBid: t('seller.adSlots.bidModal.changeBid', { defaultValue: '입찰가 변경' }),
    placeBid: t('seller.adSlots.bidModal.placeBid', { defaultValue: '입찰하기' }),
  };

  const bidModalLabels: BidModalLabels = {
    basePriceLabel: t('seller.adSlots.bidModal.basePriceLabel', { defaultValue: '기본 시작가' }),
    minBidLabel: t('seller.adSlots.bidModal.minBidLabel', { defaultValue: '최소 입찰가' }),
    bidAmountLabel: t('seller.adSlots.bidModal.bidAmountLabel', { defaultValue: '입찰가 (원)' }),
    auctionNotice: t('seller.adSlots.bidModal.auctionNotice', { defaultValue: '매일 18시에 최고 입찰자가 낙찰됩니다. 낙찰 시 dashboard 알림으로 결제 안내를 받게 됩니다. 낙찰 전까지는 무료로 입찰 변경 가능합니다.' }),
    cancelBtn: t('seller.adSlots.bidModal.cancelBtn', { defaultValue: '취소' }),
    submitBtn: t('seller.adSlots.bidModal.submitBtn', { defaultValue: '입찰하기' }),
    submitting: t('seller.adSlots.bidModal.submitting', { defaultValue: '처리 중...' }),
    priceUnit: t('seller.adSlots.priceUnit', { defaultValue: '원' }),
    minBidError: (amount) => t('seller.adSlots.bidModal.minBidError', { defaultValue: `최소 입찰가는 {{amount}}원입니다.`, amount }),
    networkError: t('seller.adSlots.bidModal.networkError', { defaultValue: '네트워크 오류가 발생했습니다.' }),
    bidFailed: t('seller.adSlots.bidModal.bidFailed', { defaultValue: '입찰에 실패했습니다.' }),
  };

  const handleBidSuccess = () => {
    setSelectedSlot(null);
    reload();
  };

  const bullets = [
    t('seller.adSlots.bullet1', { defaultValue: '메인 홈·라이브·카테고리 상단에 24시간 우선 노출' }),
    t('seller.adSlots.bullet2', { defaultValue: '매일 18시 최고 입찰자 자동 낙찰' }),
    t('seller.adSlots.bullet3', { defaultValue: '낙찰 전까지 입찰가 변경 가능 (수수료 없음)' }),
    t('seller.adSlots.bullet4', { defaultValue: '낙찰 후 dashboard 알림으로 결제 진행' }),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title={t('seller.adSlots.headerTitle', { defaultValue: '광고 슬롯 입찰' }) + ' - 유어딜 셀러'} description="광고 슬롯 입찰로 메인·라이브 화면 상단 노출 우선권을 확보하세요." url="/seller/ad-slots" />

      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <ChevronLeft className="w-4 h-4 text-gray-700" />
        </button>
        <h1 className="text-[15px] font-bold text-gray-900">{t('seller.adSlots.headerTitle', { defaultValue: '광고 슬롯 입찰' })}</h1>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5">
        {/* 안내 */}
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100 rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Gavel className="w-4 h-4 text-pink-600" />
            <p className="text-[13px] font-bold text-gray-900">{t('seller.adSlots.whatIsAdSlot', { defaultValue: '광고 슬롯이란?' })}</p>
          </div>
          <ul className="space-y-1">
            {bullets.map(bullet => (
              <li key={bullet} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                <span className="mt-0.5 text-pink-500">•</span>
                {bullet}
              </li>
            ))}
          </ul>
        </div>

        {/* 슬롯 목록 */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-white rounded-2xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-[13px]">{t('seller.adSlots.noSlots', { defaultValue: '슬롯 정보를 불러올 수 없습니다.' })}</div>
        ) : (
          <div className="space-y-3">
            {slots.map(slot => (
              <SlotCard key={slot.slot_id} slot={slot} labels={slotLabels} onBid={setSelectedSlot} />
            ))}
          </div>
        )}
      </div>

      {selectedSlot && (
        <BidModal
          slot={selectedSlot}
          labels={bidModalLabels}
          onClose={() => setSelectedSlot(null)}
          onSuccess={handleBidSuccess}
        />
      )}
    </div>
  );
}
