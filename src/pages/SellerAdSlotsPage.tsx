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

function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return '대기 중';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '마감';
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

function SlotCard({ slot, onBid }: { slot: AdSlot; onBid: (slot: AdSlot) => void }) {
  const wonByMe = slot.my_bid?.status === 'won';
  const bidding = slot.my_bid?.status === 'active';
  const isLeading = bidding && slot.my_bid?.bid_amount === slot.top_bid;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold text-gray-900">{slot.display_name}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{slot.description}</p>
        </div>
        {wonByMe && (
          <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-semibold">
            <Trophy className="w-3 h-3" />낙찰
          </span>
        )}
        {isLeading && !wonByMe && (
          <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold">
            <TrendingUp className="w-3 h-3" />선두
          </span>
        )}
        {bidding && !isLeading && (
          <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
            <Gavel className="w-3 h-3" />입찰 중
          </span>
        )}
      </div>

      <div className="px-4 py-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-gray-400">기본가</p>
          <p className="text-[12px] font-semibold text-gray-900">{slot.base_price.toLocaleString('ko-KR')}원</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">현재 최고</p>
          <p className="text-[12px] font-semibold text-gray-900">
            {slot.top_bid ? slot.top_bid.toLocaleString('ko-KR') + '원' : '없음'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">입찰 수</p>
          <p className="text-[12px] font-semibold text-gray-900">{slot.bid_count}건</p>
        </div>
      </div>

      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeLeft(slot.expires_at)}</span>
        </div>
        {wonByMe ? (
          <span className="text-[11px] text-yellow-600 font-medium">노출 중 — {timeLeft(slot.my_bid?.end_period ?? null)}</span>
        ) : (
          <button
            type="button"
            onClick={() => onBid(slot)}
            disabled={slot.is_expired}
            className="px-3 py-1.5 rounded-xl bg-pink-500 text-white text-[12px] font-semibold disabled:opacity-40 hover:bg-pink-600 transition-colors"
          >
            {slot.is_expired ? '마감' : bidding ? '입찰가 변경' : '입찰하기'}
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
            내 입찰가: {slot.my_bid.bid_amount.toLocaleString('ko-KR')}원
            {wonByMe && ' · 낙찰 완료'}
            {isLeading && ' · 현재 선두'}
            {bidding && !isLeading && ' · 경쟁 중 (입찰가 올리기 권장)'}
          </div>
        </div>
      )}
    </div>
  );
}

function BidModal({
  slot,
  onClose,
  onSuccess,
}: {
  slot: AdSlot;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(String(slot.min_bid));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const bid = Number(amount.replace(/,/g, ''));
    if (!Number.isFinite(bid) || bid < slot.min_bid) {
      setError(`최소 입찰가는 ${slot.min_bid.toLocaleString('ko-KR')}원입니다.`);
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
        setError(data.error ?? '입찰에 실패했습니다.');
        if (data.min_bid) setAmount(String(data.min_bid));
      } else {
        onSuccess();
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl w-full max-w-[430px] p-6 pb-8">
        <h3 className="text-[15px] font-bold text-gray-900 mb-1">{slot.display_name} 입찰</h3>
        <p className="text-[12px] text-gray-500 mb-4">{slot.description}</p>

        <div className="grid grid-cols-2 gap-3 mb-4 text-center">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-500">기본 시작가</p>
            <p className="text-[13px] font-bold text-gray-900">{slot.base_price.toLocaleString('ko-KR')}원</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] text-gray-500">최소 입찰가</p>
            <p className="text-[13px] font-bold text-pink-600">{slot.min_bid.toLocaleString('ko-KR')}원</p>
          </div>
        </div>

        <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">입찰가 (원)</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          min={slot.min_bid}
          step={1000}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400"
          placeholder={`최소 ${slot.min_bid.toLocaleString('ko-KR')}원`}
        />
        {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}

        <div className="flex items-start gap-2 mt-3 p-3 bg-blue-50 rounded-xl">
          <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-blue-700">
            매일 18시에 최고 입찰자가 낙찰됩니다. 낙찰 시 dashboard 알림으로 결제 안내를 받게 됩니다.
            낙찰 전까지는 무료로 입찰 변경 가능합니다.
          </p>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-pink-500 text-white text-[13px] font-semibold disabled:opacity-50 hover:bg-pink-600 transition-colors"
          >
            {loading ? '처리 중...' : '입찰하기'}
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

  const handleBidSuccess = () => {
    setSelectedSlot(null);
    reload();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title="광고 슬롯 입찰 - 유어딜 셀러" description="광고 슬롯 입찰로 메인·라이브 화면 상단 노출 우선권을 확보하세요." url="/seller/ad-slots" />

      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <ChevronLeft className="w-4 h-4 text-gray-700" />
        </button>
        <h1 className="text-[15px] font-bold text-gray-900">광고 슬롯 입찰</h1>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5">
        {/* 안내 */}
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100 rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Gavel className="w-4 h-4 text-pink-600" />
            <p className="text-[13px] font-bold text-gray-900">광고 슬롯이란?</p>
          </div>
          <ul className="space-y-1">
            {[
              '메인 홈·라이브·카테고리 상단에 24시간 우선 노출',
              '매일 18시 최고 입찰자 자동 낙찰',
              '낙찰 전까지 입찰가 변경 가능 (수수료 없음)',
              '낙찰 후 dashboard 알림으로 결제 진행',
            ].map(t => (
              <li key={t} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                <span className="mt-0.5 text-pink-500">•</span>
                {t}
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
          <div className="text-center py-16 text-gray-400 text-[13px]">슬롯 정보를 불러올 수 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {slots.map(slot => (
              <SlotCard key={slot.slot_id} slot={slot} onBid={setSelectedSlot} />
            ))}
          </div>
        )}
      </div>

      {selectedSlot && (
        <BidModal
          slot={selectedSlot}
          onClose={() => setSelectedSlot(null)}
          onSuccess={handleBidSuccess}
        />
      )}
    </div>
  );
}
