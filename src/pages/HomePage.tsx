import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Gamepad2, Sparkles, ArrowRight, QrCode } from 'lucide-react';
import { getAdminToken } from '../utils/api.ts';
import { ShapeIcon } from '../components/ShapeIcon.tsx';

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

      {/* Header with Top Admin Panel Link */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-1 p-2 bg-white rounded-2xl shadow-sm border border-slate-200">
            <span className="w-3 h-3 rounded-full bg-[#E21B3C]" />
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
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#0f172a] hover:bg-slate-800 text-white shadow-md text-sm font-bold transition"
        >
          <Shield className="w-4 h-4 text-[#10b981]" />
          <span>Yönetici Paneli</span>
        </button>
      </header>

      {/* Main Content: Centered Single "Oyuna Katıl" Card */}
      <main className="relative z-10 max-w-4xl w-full mx-auto px-6 py-8 flex-1 flex flex-col items-center justify-center">
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-[#0ea5e9] text-xs font-bold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            Gerçek Zamanlı Çok Oyunculu Quiz Platformu
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Simgelerle Yarış, <br />
            <span className="bg-gradient-to-r from-[#10b981] to-[#0ea5e9] bg-clip-text text-transparent">
              Hızınla Puan Topla!
            </span>
          </h1>
          <p className="mt-3 text-slate-600 text-sm sm:text-base">
            Akıllı tahtadaki 6 haneli oyun kodunu gir veya QR kodu okutarak yarışmaya hemen katıl.
          </p>
        </div>

        {/* Centered Single Card: Oyuna Katıl */}
        <div className="w-full max-w-md mx-auto bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xl shadow-slate-200/60">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#10b981] flex items-center justify-center shadow-lg shadow-emerald-500/25 mb-4">
              <Gamepad2 className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Oyuna Katıl</h2>
            <p className="text-slate-500 text-sm mt-1">
              6 haneli oyun kodunu girerek telefonundan yarışmaya bağlan.
            </p>
          </div>

          <form onSubmit={handleQuickJoin} className="mt-6 space-y-3.5">
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value.replace(/\s+/g, ''))}
              placeholder="Oyun Kodu (Örn: 583421)"
              className="w-full px-4 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:bg-white focus:outline-none text-center text-2xl font-extrabold tracking-widest text-slate-900 placeholder:text-slate-400 placeholder:font-medium placeholder:text-base placeholder:tracking-normal transition"
            />
            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold text-lg shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition active:scale-[0.99]"
            >
              <span>OYUNA KATIL</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-[#10b981]" />
              QR Kod ile hızlı giriş
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-[#E21B3C] text-white flex items-center justify-center">
                <ShapeIcon color="RED" className="w-3 h-3" />
              </span>
              <span className="w-5 h-5 rounded-md bg-[#1368CE] text-white flex items-center justify-center">
                <ShapeIcon color="BLUE" className="w-3 h-3" />
              </span>
              <span className="w-5 h-5 rounded-md bg-[#D89E00] text-white flex items-center justify-center">
                <ShapeIcon color="YELLOW" className="w-3 h-3" />
              </span>
              <span className="w-5 h-5 rounded-md bg-[#26890C] text-white flex items-center justify-center">
                <ShapeIcon color="GREEN" className="w-3 h-3" />
              </span>
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
