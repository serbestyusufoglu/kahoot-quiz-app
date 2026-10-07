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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between relative overflow-hidden">
      {/* Subtle Eco Ambient Accents */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#10b981]/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/4 -right-32 w-96 h-96 rounded-full bg-[#0ea5e9]/10 blur-3xl" />

      {/* Header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-1 p-2 bg-white rounded-2xl shadow-sm border border-slate-200">
            <span className="w-3 h-3 rounded-sm bg-[#E21B3C]" />
            <span className="w-3 h-3 rounded-sm bg-[#1368CE]" />
            <span className="w-3 h-3 rounded-sm bg-[#D89E00]" />
            <span className="w-3 h-3 rounded-sm bg-[#26890C]" />
          </div>
          <div>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              Bilgi<span className="text-[#10b981]">Arena</span>
            </span>
            <span className="hidden sm:inline-block ml-2.5 text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#10b981] border border-emerald-200 font-semibold">
              Canlı Sınıf Yarışması
            </span>
          </div>
        </div>

        <button
          onClick={handleAdminClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 shadow-sm text-sm font-bold text-slate-800 transition"
        >
          <Shield className="w-4 h-4 text-[#0ea5e9]" />
          <span>Yönetici Girişi</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl w-full mx-auto px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-[#0ea5e9] text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Gerçek Zamanlı Çok Oyunculu Quiz Platformu
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Renklerle Yarış, <br />
            <span className="bg-gradient-to-r from-[#10b981] to-[#0ea5e9] bg-clip-text text-transparent">
              Hızınla Puan Topla!
            </span>
          </h1>
          <p className="mt-4 text-slate-600 text-base sm:text-lg">
            Akıllı tahta veya projeksiyondaki QR kodu telefonunla okut ya da 6 haneli oyun kodunu girerek anında yarışmaya katıl.
          </p>
        </div>

        {/* Two Main Action Cards: Light Minimalist Card + Dark Contrast Admin Panel Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
          {/* Card 1: Oyuna Katıl (Clean White Minimalist Card) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-7 shadow-lg shadow-slate-200/50 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#10b981] flex items-center justify-center shadow-md shadow-emerald-500/25 mb-5">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">Oyuna Katıl</h2>
              <p className="text-slate-500 text-sm mt-1">
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
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:bg-white focus:outline-none text-center text-xl font-extrabold tracking-widest text-slate-900 placeholder:text-slate-400 placeholder:font-medium placeholder:tracking-normal transition"
                />
                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold text-lg shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 transition active:scale-[0.99]"
                >
                  <span>OYUNA KATIL</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-[#10b981]" />
                QR Kod ile hızlı giriş
              </span>
              <span>🔴 🔵 🟡 🟢 4 Renk Sistemi</span>
            </div>
          </div>

          {/* Card 2: Yönetici Girişi (Dark Anthracite #0f172a Contrast Panel with Bright Emerald Button) */}
          <div className="bg-[#0f172a] text-white border border-slate-800 rounded-2xl p-7 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#0ea5e9] flex items-center justify-center shadow-md shadow-sky-500/25 mb-5">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-extrabold text-white">Yönetici Girişi</h2>
              <p className="text-slate-300 text-sm mt-1">
                Soru havuzu oluşturun, sürükle-bırak ile quiz hazırlayın ve akıllı tahtada canlı yarışma başlatın.
              </p>

              <div className="mt-6 space-y-2.5 text-sm text-slate-200">
                <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-3.5 py-2.5 rounded-2xl">
                  <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                  <span>Soru Havuzu & Sürükle-Bırak Quiz Yönetimi</span>
                </div>
                <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-3.5 py-2.5 rounded-2xl">
                  <Users className="w-4 h-4 text-[#0ea5e9] shrink-0" />
                  <span>Otomatik Oyun Kodu & Büyük QR Kod Ekranı</span>
                </div>
                <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-3.5 py-2.5 rounded-2xl">
                  <Trophy className="w-4 h-4 text-[#10b981] shrink-0" />
                  <span>Sunucu Tabanlı Adil Süre & Puan Hesaplama</span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleAdminClick}
                className="w-full py-4 rounded-2xl bg-[#10b981] hover:bg-emerald-400 text-slate-950 font-extrabold text-lg shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition active:scale-[0.99]"
              >
                <span>YÖNETİCİ PANELİNE GİT</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-slate-500 font-medium">
        BilgiArena • Gerçek Zamanlı Çok Kullanıcılı Eğitim ve Yarışma Sistemi
      </footer>
    </div>
  );
};
