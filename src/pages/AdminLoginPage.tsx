import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, User, ArrowLeft, AlertCircle, UserPlus, LogIn, Sparkles } from 'lucide-react';
import { apiFetch, setAdminSession } from '../utils/api.ts';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (targetMode: 'login' | 'register') => {
    setMode(targetMode);
    setError(null);
    if (targetMode === 'register') {
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } else {
      setUsername('admin');
      setPassword('admin123');
    }
  };

  const fillDemoCredentials = () => {
    setMode('login');
    setError(null);
    setUsername('admin');
    setPassword('admin123');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (username.trim().length < 3) {
        setError('Kullanıcı adı en az 3 karakter olmalıdır.');
        return;
      }
      if (password.length < 4) {
        setError('Şifre en az 4 karakter olmalıdır.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Girdiğiniz şifreler birbiriyle eşleşmiyor.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = mode === 'register' ? '/api/admin/register' : '/api/admin/login';
      const res = await apiFetch<{ token: string; admin: { id: string; username: string } }>(
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify({ username: username.trim(), password }),
        }
      );
      setAdminSession(res.token, res.admin.username);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || (mode === 'register' ? 'Kayıt yapılamadı.' : 'Giriş yapılamadı.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#10b981]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#0ea5e9]/10 blur-3xl" />

      <div className="relative z-10 max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-xl shadow-slate-200/60">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 mb-5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Ana Sayfaya Dön
        </Link>

        {/* Top Mode Tabs: Giriş Yap / Kayıt Ol */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-2xl mb-6 border border-slate-200/80">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold transition ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn className="w-4 h-4 text-[#10b981]" />
            <span>Giriş Yap</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-extrabold transition ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-4 h-4 text-[#0ea5e9]" />
            <span>Kayıt Ol</span>
          </button>
        </div>

        <div className="flex items-center gap-3.5 mb-6">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md ${
              mode === 'register'
                ? 'bg-[#0ea5e9] shadow-sky-500/25'
                : 'bg-[#10b981] shadow-emerald-500/25'
            }`}
          >
            {mode === 'register' ? (
              <UserPlus className="w-6 h-6 text-white" />
            ) : (
              <Shield className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">
              {mode === 'register' ? 'Yeni Yönetici Kaydı' : 'Yönetici Girişi'}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {mode === 'register'
                ? 'Kendinize özel soru havuzu ve yarışma paneli oluşturun'
                : 'Soru havuzu ve canlı yarışma yönetim paneli'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:bg-white focus:outline-none text-slate-900 text-sm font-medium transition"
                placeholder={mode === 'register' ? 'Örn: ogretmen_ahmet' : 'admin'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Şifre
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:bg-white focus:outline-none text-slate-900 text-sm font-medium transition"
                placeholder="••••••••"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Şifre Tekrar
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#0ea5e9] focus:bg-white focus:outline-none text-slate-900 text-sm font-medium transition"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 rounded-2xl disabled:opacity-50 text-white font-extrabold text-sm shadow-md transition ${
              mode === 'register'
                ? 'bg-[#0ea5e9] hover:bg-sky-600 shadow-sky-500/25'
                : 'bg-[#10b981] hover:bg-emerald-600 shadow-emerald-500/25'
            }`}
          >
            {loading
              ? mode === 'register'
                ? 'Hesap Oluşturuluyor...'
                : 'Giriş Yapılıyor...'
              : mode === 'register'
              ? 'KAYIT OL VE PANELİ AÇ'
              : 'GİRİŞ YAP'}
          </button>
        </form>

        {/* Bottom Demo Credentials Card (#0f172a Dark Contrast) */}
        <div className="mt-6 p-4 rounded-2xl bg-[#0f172a] text-slate-200 text-xs space-y-2.5 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#10b981]" />
              Demo Sürüm Giriş Bilgileri
            </span>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="px-2.5 py-1 rounded-lg bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] font-bold transition"
            >
              Demo Bilgilerini Doldur
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
            <div className="bg-white/5 px-3 py-2 rounded-xl">
              <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                Demo Kullanıcı Adı
              </span>
              <code className="text-[#10b981] font-mono font-bold text-sm">admin</code>
            </div>
            <div className="bg-white/5 px-3 py-2 rounded-xl">
              <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                Demo Şifre
              </span>
              <code className="text-[#10b981] font-mono font-bold text-sm">admin123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
