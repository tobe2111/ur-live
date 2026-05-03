import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, User, Mail, Phone, Bell, CreditCard,
  MapPin, Globe, HelpCircle, ChevronRight, Edit, X,
  Loader2, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { getUserIdSync, getUserNameSync, getUserEmail } from '@/utils/auth';
import api from '@/lib/api';
import SEO from '@/components/SEO';
import { toast } from '@/hooks/useToast';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import ThemeToggleSection from '@/components/settings/ThemeToggleSection';

// ─── 앱 버전 섹션 ──────────────────────────────────────────────
// 🛡️ 2026-04-30: 버전 표기 정리.
//   이전: VITE_APP_VERSION 에 github.sha (40자) 가 들어와 "e9b6faa081e80024..." 노출
//   수정: 사용자 친화 버전 (package.json) + 짧은 빌드 hash (7자) 분리
const APP_VERSION = '1.0.0' // package.json version 동기 (manual)
const BUILD_HASH = (import.meta.env.VITE_APP_VERSION || '').slice(0, 7)

function AppVersionSection() {
  const { t } = useTranslation();
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchVersion = async () => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      const data = await res.json() as { success?: boolean; version?: string };
      if (data?.version) setServerVersion(String(data.version));
    } catch {}
  };

  useEffect(() => {
    fetchVersion().finally(() => setLoading(false));
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    await fetchVersion();
    setTimeout(() => setChecking(false), 500);
  };

  const handleUpdate = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
    } catch {}
    window.location.reload();
  };

  // localStorage에 저장된 로컬 빌드 버전 (version-check.ts에서 관리)
  const localBuildVersion = (typeof window !== 'undefined' ? localStorage.getItem('ur_build_version') : null);
  const isLatest = !loading && serverVersion && localBuildVersion && serverVersion === localBuildVersion;
  const hasUpdate = !loading && serverVersion && localBuildVersion && serverVersion !== localBuildVersion;

  return (
    <div className="mb-2">
      <p className="text-[12px] font-bold text-white mb-2 px-1">{t('accountSettings.appInfo')}</p>
      <div className="rounded-2xl overflow-hidden bg-white/[0.04]">
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-[13px] text-white/75">{t('accountSettings.currentVersion')}</span>
          <span className="text-[12px] font-medium text-white">v{APP_VERSION}</span>
        </div>
        {BUILD_HASH && (
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-[13px] text-white/75">{t('accountSettings.build')}</span>
            <span className="text-[11px] font-mono text-white/55">{BUILD_HASH}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[13px] text-white/75">{t('accountSettings.checkLatest')}</span>
          {loading ? (
            <span className="flex items-center gap-1.5 text-[12px] text-white/45">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 확인 중
            </span>
          ) : !serverVersion ? (
            <button
              type="button"
              onClick={handleCheck}
              className="flex items-center gap-1 text-[12px] text-white/55 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              다시 시도
            </button>
          ) : isLatest ? (
            <span className="flex items-center gap-1.5 text-[12px] text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> 최신 버전
            </span>
          ) : hasUpdate ? (
            <button
              type="button"
              onClick={handleUpdate}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-pink-500 text-white text-xs font-bold hover:bg-pink-600 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> 업데이트
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheck}
              className="flex items-center gap-1 text-[12px] text-white/55 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              확인
            </button>
          )}
        </div>
      </div>
      {hasUpdate && (
        <p className="mt-2 text-[11px] text-pink-400 px-2 text-center">
          새 버전이 준비되었습니다. 업데이트 버튼을 눌러 적용하세요.
        </p>
      )}
    </div>
  );
}

export default function AccountSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState({ id: '', name: '', email: '', phone: '' });

  const [editModal, setEditModal] = useState(false);
  useEscapeKey(() => setEditModal(false));
  const [editForm, setEditForm] = useState({ name: '', phone: '' });
  const [editLoading, setEditLoading] = useState(false);


  const [notif, setNotif] = useState(() => {
    try {
      const s = localStorage.getItem('notif_settings');
      return s ? JSON.parse(s) : { push: true, email: true };
    } catch { return { push: true, email: true }; }
  });

  useEffect(() => {
    const userId = getUserIdSync();
    if (!userId) { toast.info(t('accountSettings.loginRequired')); navigate('/login'); return; }
    (async () => {
      let phone = '';
      try {
        const res = await api.get('/api/auth/me');
        if (res.data.success && res.data.data) phone = res.data.data.phone || '';
      } catch {}
      setUser({ id: userId, name: getUserNameSync() || t('accountSettings.fallbackName'), email: getUserEmail() || '', phone });
    })();
  }, [navigate]);

  function openEdit() { setEditForm({ name: user.name, phone: user.phone }); setEditModal(true); }

  async function saveProfile() {
    if (!editForm.name.trim()) { toast.error(t('accountSettings.nameRequired')); return; }
    setEditLoading(true);
    try {
      const res = await api.patch('/api/auth/profile', { name: editForm.name.trim(), phone: editForm.phone.trim() });
      if (res.data.success) {
        setUser(u => ({ ...u, name: editForm.name.trim(), phone: editForm.phone.trim() }));
        localStorage.setItem('user_name', editForm.name.trim());
        setEditModal(false);
        toast.success(t('accountSettings.profileUpdated'));
      }
    } catch (e: unknown) {
      const e_ = e as { response?: { data?: { error?: string }; status?: number } }
      toast.error(e_.response?.data?.error || t('accountSettings.updateFailed'));
    } finally { setEditLoading(false); }
  }

  function toggleNotif(key: 'push' | 'email') {
    const next = { ...notif, [key]: !notif[key] };
    setNotif(next);
    localStorage.setItem('notif_settings', JSON.stringify(next));
    const type = key === 'push' ? t('accountSettings.notifPush') : t('accountSettings.notifEmail');
    toast.success(next[key] ? t('accountSettings.notifTurnedOn', { type }) : t('accountSettings.notifTurnedOff', { type }));
  }

  return (
    <div className="min-h-screen bg-[#020202] pb-7">
      <SEO
        title={t('accountSettings.seoTitle')}
        description={t('accountSettings.seoDesc')}
        url="/account/settings"
        noindex
      />
      {/* 🛡️ 2026-04-30 v4 Wallet sticky chrome */}
      <div className="sticky top-0 z-50" style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px) saturate(140%)', WebkitBackdropFilter: 'blur(20px) saturate(140%)', borderBottom: '0.5px solid rgba(84,84,88,0.34)' }}>
        <div className="ur-content-narrow flex items-center px-2 lg:px-8 py-3 gap-1">
          <button type="button" onClick={() => navigate(-1)} aria-label={t('accountSettings.back')} className="rounded-full flex items-center justify-center w-[34px] h-[34px] bg-white/[0.06]">
            <ChevronLeft className="w-4 h-4 text-white" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* v4 Large Title */}
      <div className="ur-content-narrow px-4 lg:px-8 pt-3 pb-1">
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{t('accountSettings.title')}</h1>
      </div>

      <main className="ur-content-narrow px-4 lg:px-8 pt-3">
        {/* 프로필 카드 (v4 그라데이션 톤) */}
        <div className="rounded-2xl p-5 mb-5 relative" style={{ background: 'radial-gradient(ellipse at top, rgba(236,72,153,0.18), transparent 70%), rgba(255,255,255,0.04)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold text-white">{t('accountSettings.myProfile')}</h2>
            <button type="button" onClick={openEdit} aria-label={t('accountSettings.editProfileAria')} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.08] text-[11px] font-semibold text-white/80 hover:bg-white/[0.12] transition-colors">
              <Edit className="w-3 h-3" aria-hidden="true" />수정
            </button>
          </div>
          <div className="space-y-2">
            {[
              { icon: <User className="w-4 h-4 text-pink-400" aria-hidden="true" />, label: t('accountSettings.labelName'), value: user.name },
              { icon: <Mail className="w-4 h-4 text-pink-400" aria-hidden="true" />, label: t('accountSettings.labelEmail'), value: user.email },
              { icon: <Phone className="w-4 h-4 text-pink-400" aria-hidden="true" />, label: t('accountSettings.labelPhone'), value: user.phone || t('accountSettings.phoneNotRegistered') },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 bg-white/[0.04] rounded-xl px-3 py-2.5">
                {icon}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-white/45">{label}</p>
                  <p className="text-[13px] font-medium text-white truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Section title={t('accountSettings.sectionNotification')}>
          <ToggleItem icon={<Bell className="w-4 h-4" aria-hidden="true" />} label={t('accountSettings.togglePush')} value={notif.push} onChange={() => toggleNotif('push')} />
          <ToggleItem icon={<Mail className="w-4 h-4" aria-hidden="true" />} label={t('accountSettings.toggleEmail')} value={notif.email} onChange={() => toggleNotif('email')} />
        </Section>

        <ThemeToggleSection />


        <Section title={t('accountSettings.sectionPaymentShipping')}>
          <Link to="/mypage/addresses" className="flex items-center gap-3 px-3.5 py-3 active:bg-white/[0.06] transition-colors">
            <MapPin className="w-4 h-4 text-white/55" aria-hidden="true" />
            <span className="flex-1 text-[13px] text-white">{t('accountSettings.menu.addresses')}</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
          </Link>
          <Item icon={<CreditCard className="w-4 h-4" aria-hidden="true" />} label={t('accountSettings.paymentMethod')} onClick={() => toast.info(t('accountSettings.preparingFeature'))} badge={t('accountSettings.comingSoonBadge')} />
        </Section>

        <Section title={t('accountSettings.sectionOther')}>
          <div className="flex items-center gap-3 px-3.5 py-3">
            <Globe className="w-4 h-4 text-white/55" aria-hidden="true" />
            <span className="flex-1 text-[13px] text-white">{t('accountSettings.menu.language')}</span>
            <span className="text-[12px] text-white/45">{t('accountSettings.menu.languageValue')}</span>
          </div>
          <Link to="/faq" className="flex items-center gap-3 px-3.5 py-3 active:bg-white/[0.06] transition-colors" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <HelpCircle className="w-4 h-4 text-white/55" aria-hidden="true" />
            <span className="flex-1 text-[13px] text-white">{t('accountSettings.menu.support')}</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
          </Link>
        </Section>

        <Section title={t('accountSettings.sectionPolicies')}>
          <Link to="/privacy" className="flex items-center gap-3 px-3.5 py-3 active:bg-white/[0.06] transition-colors">
            <span className="flex-1 text-[13px] text-white">{t('accountSettings.menu.privacy')}</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
          </Link>
          <Link to="/terms" className="flex items-center gap-3 px-3.5 py-3 active:bg-white/[0.06] transition-colors" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="flex-1 text-[13px] text-white">{t('accountSettings.menu.terms')}</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
          </Link>
          <Link to="/refund" className="flex items-center gap-3 px-3.5 py-3 active:bg-white/[0.06] transition-colors" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="flex-1 text-[13px] text-white">{t('accountSettings.menu.refund')}</span>
            <ChevronRight className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
          </Link>
        </Section>

        <AppVersionSection />

        {/* 🛡️ 2026-05-01: 사용자 신고 — "탈퇴 버튼이 없는데?" — 너무 옅어서 안 보임.
            크기/색 정상화 + Section 스타일로 일관성. */}
        <div className="mt-8 mb-6 px-4">
          <Link
            to="/account/delete-warning"
            className="block w-full py-3 px-4 text-center text-[13px] text-red-400 hover:text-red-500 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-colors"
          >
            {t('accountSettings.deleteAccount')}
          </Link>
        </div>
      </main>

      {/* 프로필 편집 모달 — stays white for readability */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditModal(false)} role="presentation">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('accountSettings.modalEditAria')}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">{t('accountSettings.editProfile')}</h3>
              <button onClick={() => setEditModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="account-name" className="block text-sm font-medium text-gray-700 mb-1.5">{t('accountSettings.editName')} <span className="text-red-500" aria-hidden="true">*</span></label>
                <input
                  id="account-name"
                  required
                  aria-required="true"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder={t('accountSettings.editNamePlaceholder')}
                />
              </div>
              <div>
                <label htmlFor="account-phone" className="block text-sm font-medium text-gray-700 mb-1.5">{t('accountSettings.editPhone')}</label>
                <input
                  id="account-phone"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="010-0000-0000" type="tel"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors">{t('accountSettings.editCancel')}</button>
              <button onClick={saveProfile} disabled={editLoading} className="flex-1 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50">
                {editLoading ? t('accountSettings.saving') : t('accountSettings.save')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[12px] font-bold text-white mb-2 px-1">{title}</p>
      <div className="rounded-2xl overflow-hidden bg-white/[0.04]">{children}</div>
    </div>
  );
}

function Item({ icon, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: string }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-3.5 py-3 active:bg-white/[0.06] transition-colors text-left" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-white/55">{icon}</span>
      <span className="flex-1 text-[13px] text-white">{label}</span>
      {badge && <span className="text-[10px] bg-white/[0.08] text-white/55 px-2 py-0.5 rounded-full">{badge}</span>}
      <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" aria-hidden="true" />
    </button>
  );
}

// 🛡️ 2026-05-02: ThemeSection → @/components/settings/ThemeToggleSection 으로 이전
//   (UserProfilePage 와 공유).

function ToggleItem({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: boolean; onChange: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-3.5 py-3" style={{ borderTop: 'var(--toggle-border, none)' }}>
      <span className="text-white/55">{icon}</span>
      <span className="flex-1 text-[13px] text-white">{label}</span>
      <button
        type="button"
        onClick={onChange}
        aria-label={value ? t('accountSettings.ariaToggleOff', { label }) : t('accountSettings.ariaToggleOn', { label })}
        aria-pressed={value}
        className={`relative w-[44px] h-[24px] rounded-full transition-colors duration-200 shrink-0 ${value ? 'bg-pink-500' : 'bg-white/[0.15]'}`}
      >
        <span className={`absolute top-[2px] left-[2px] w-[20px] h-[20px] bg-white rounded-full shadow-sm transition-transform duration-200 ${value ? 'translate-x-[20px]' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
