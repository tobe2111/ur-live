import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { Ticket, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/useToast'

export default function SellerCouponsPage() {
  const { t } = useTranslation()
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', type: 'fixed', value: '', min_order: '', max_discount: '', total_count: '100', expires_at: '' })
  const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })

  const load = () => {
    setLoading(true)
    api.get('/api/seller/analytics/coupons', getAuthHeaders())
      .then(r => { if (r.data.success) setCoupons(r.data.data || []) })
      .catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.code || !form.name || !form.value) { toast.error(t('seller.coupons.fillRequired')); return }
    try {
      await api.post('/api/seller/analytics/coupons', {
        ...form, value: Number(form.value), min_order: Number(form.min_order) || 0,
        max_discount: Number(form.max_discount) || null, total_count: Number(form.total_count),
        expires_at: form.expires_at || null,
      }, getAuthHeaders())
      toast.success(t('seller.coupons.created'))
      setShowForm(false); load()
    } catch { toast.error(t('seller.coupons.createFailed')) }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('seller.coupons.confirmDeactivate'))) return
    try {
      await api.delete(`/api/seller/analytics/coupons/${id}`, getAuthHeaders())
      load()
    } catch {
      toast.error(t('seller.coupons.deleteFailed'))
    }
  }

  return (
    <SellerLayout title={t('seller.coupons.title')}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">{t('seller.coupons.title')}</h1>
          <button onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> {t('seller.coupons.create')}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input placeholder={t('seller.coupons.codePlaceholder')} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              <input placeholder={t('seller.coupons.namePlaceholder')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
                <option value="fixed">{t('seller.coupons.fixedDiscount')}</option>
                <option value="percent">{t('seller.coupons.percentDiscount')}</option>
              </select>
              <input placeholder={form.type === 'fixed' ? t('seller.coupons.discountAmountPlaceholder') : t('seller.coupons.discountRatePlaceholder')} type="number" value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              <input placeholder={t('seller.coupons.minOrderAmount')} type="number" value={form.min_order}
                onChange={e => setForm(f => ({ ...f, min_order: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input placeholder={t('seller.coupons.maxDiscountPlaceholder')} type="number" value={form.max_discount}
                onChange={e => setForm(f => ({ ...f, max_discount: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              <input placeholder={t('seller.coupons.totalCountPlaceholder')} type="number" value={form.total_count}
                onChange={e => setForm(f => ({ ...f, total_count: e.target.value }))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>
            <button onClick={handleCreate} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold">{t('seller.coupons.createBtn')}</button>
          </div>
        )}

        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> : coupons.length === 0 ? (
          <p className="text-center py-12 text-gray-500">{t('seller.coupons.empty')}</p>
        ) : (
          <div className="space-y-3">
            {coupons.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{c.name} <span className="text-xs font-mono text-gray-500">({c.code})</span></p>
                    <p className="text-xs text-gray-500">
                      {c.type === 'percent' ? t('seller.coupons.percentOff', { value: c.value }) : t('seller.coupons.fixedOff', { value: Number(c.value).toLocaleString() })}
                      {c.min_order_amount > 0 && ` · ${t('seller.coupons.minOrder', { amount: Number(c.min_order_amount).toLocaleString() })}`}
                      {` · ${t('seller.coupons.usage', { used: c.used_count, total: c.total_count })}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
