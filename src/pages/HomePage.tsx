import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Gamepad2, Sparkles, ArrowRight, QrCode, Users, Trophy } from 'lucide-react';
import { getAdminToken } from '../utils/api.ts';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [quickCode, setQuickCode] = useState('');

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickCode.trim();
    if (cleaned) {
      navigate(`/join/${cleaned}`);
    } else {
      navigate('/join');
    }
  };

  const handleAdminClick = () => {
    if (getAdminToken()) {
      navigate('/admin');
    } else {
      navigate('/admin/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col justify-between relative overflow-hidden">
      {/* Decorative color blobs */}
      <div className="pointer-events-none absolute -top-28 -left-28 w-96 h-96 rounded-full bg-[#E21B3C]/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-28 w-96 h-96 rounded-full bg-[#1368CE]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 w-96 h-96 rounded-full bg-[#26890C]/20 blur-3xl" />

      {/* Header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-1 p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/15">
            <span className="w-3 h-3 rounded-sm bg-[#E21B3C]" />
            <span className="w-3 h-3 rounded-sm bg-[#1368CE]" />
            <span className="w-3 h-3 rounded-sm bg-[#D89E00]" />
            <span className="w-3 h-3 rounded-sm bg-[#26890C]" />
          </div>
          <div>
            <span className="text-2xl font-extrabold tracking-tight text-white">
              Bilgi<span className="text-indigo-400">Arena</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
              Canlı Sınıf Yarışması
            </span>
          </div>
        </div>

        <button
          onClick={handleAdminClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-semibold text-white transition"
        >
          <Shield className="w-4 h-4 text-indigo-400" />
          <span>Yönetici Girişi</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl w-full mx-auto px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Gerçek Zamanlı Çok Oyunculu Quiz Platformu
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Renklerle Yarış, <br />
            <span className="bg-gradient-to-r from-[#ff5e78] via-[#ffd24c] to-[#5ce63c] bg-clip-text text-transparent">
              Hızınla Puan Topla!
            </span>
          </h1>
          <p className="mt-4 text-slate-300 text-base sm:text-lg">
            Akıllı tahta veya projeksiyondaki QR kodu telefonunla okut ya da 6 haneli oyun kodunu girerek anında yarışmaya katıl.
          </p>
        </div>

        {/* Two Main Action Cards: Oyuna Katıl & Yönetici Girişi */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
          {/* Card 1: Oyuna Katıl */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/15 rounded-3xl p-7 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-600/30 mb-5">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-extrabold text-white">Oyuna Katıl</h2>
              <p className="text-slate-400 text-sm mt-1">
                Ekrandaki 6 haneli oyun kodunu girerek telefonundan yarışmaya bağlan.
              </p>

              <form onSubmit={handleQuickJoin} className="mt-6 space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={quickCode}
                  onChange={(e) => setQuickCode(e.target.value.replace(/\s+/g, ''))}
                  placeholder="Oyun Kodu (Örn: 583421)"
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-950/90 border border-slate-700 focus:border-emerald-400 focus:outline-none text-center text-xl font-extrabold tracking-widest text-white placeholder:text-slate-600 placeholder:font-medium placeholder:tracking-normal"
                />
                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-extrabold text-lg shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition active:scale-[0.99]"
                >
                  <span>OYUNA KATIL</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-400" />
                QR Kod ile hızlı giriş
              </span>
              <span>🔴 🔵 🟡 🟢 4 Renk Sistemi</span>
            </div>
          </div>

          {/* Card 2: Yönetici Girişi */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/15 rounded-3xl p-7 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-5">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-extrabold text-white">Yönetici Girişi</h2>
              <p className="text-slate-400 text-sm mt-1">
                Soru havuzu oluşturun, sürükle-bırak ile quiz hazırlayın ve akıllı tahtada canlı yarışma başlatın.
              </p>

              <div className="mt-6 space-y-2.5 text-sm text-slate-300">
                <div className="flex items-center gap-2.5 bg-white/5 px-3.5 py-2.5 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span>Soru Havuzu & Sürükle-Bırak Quiz Yönetimi</span>
                </div>
                <div className="flex items-center gap-2.5 bg-white/5 px-3.5 py-2.5 rounded-xl">
                  <Users className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Otomatik Oyun Kodu & Büyük QR Kod Ekranı</span>
                </div>
                <div className="flex items-center gap-2.5 bg-white/5 px-3.5 py-2.5 rounded-xl">
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Sunucu Tabanlı Adil Süre & Puan Hesaplama</span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleAdminClick}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-lg shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition active:scale-[0.99]"
              >
                <span>YÖNETİCİ PANELİNE GİT</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-slate-500">
        BilgiArena • Gerçek Zamanlı Çok Kullanıcılı Eğitim ve Yarışma Sistemi
      </footer>
    </div>
  );
};
