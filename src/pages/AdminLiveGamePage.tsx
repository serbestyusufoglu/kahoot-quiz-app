import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  Play,
  Pause,
  SkipForward,
  Square,
  Trophy,
  Users,
  Clock,
  Volume2,
  VolumeX,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
import { apiFetch, getAdminToken, getSocket } from '../utils/api.ts';
import { useServerTimer } from '../utils/useServerTimer.ts';
import { soundManager } from '../utils/sound.ts';
import {
  COLOR_META,
  type Answer,
  type GameStateSnapshot,
  type OptionColor,
} from '../../shared/types.ts';

export const AdminLiveGamePage: React.FC = () => {
  const { gameCode } = useParams<{ gameCode: string }>();
  const navigate = useNavigate();

  const [snapshot, setSnapshot] = useState<GameStateSnapshot | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [allAnswers, setAllAnswers] = useState<Answer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundManager.enabled);
  const prevStatusRef = useRef<string | null>(null);
  const prevQuestionIdxRef = useRef<number>(-1);

  const remainingSeconds = useServerTimer({
    status: snapshot?.game.status,
    questionEndsAt: snapshot?.game.questionEndsAt,
    remainingMsWhenPaused: snapshot?.game.remainingMsWhenPaused,
    serverTime: snapshot?.serverTime,
    playTickSound: true,
  });

  const applySnapshotWithSound = (nextSnap: GameStateSnapshot) => {
    const prevStatus = prevStatusRef.current;
    const prevQIdx = prevQuestionIdxRef.current;
    const nextStatus = nextSnap.game.status;
    const nextQIdx = nextSnap.game.currentQuestionIndex;

    if (
      nextStatus === 'QUESTION' &&
      (prevStatus !== 'QUESTION' || prevQIdx !== nextQIdx)
    ) {
      soundManager.playQuestionStart();
    } else if (nextStatus === 'ANSWER_REVEAL' && prevStatus === 'QUESTION') {
      soundManager.playTimeUp();
    } else if (nextStatus === 'FINISHED' && prevStatus !== 'FINISHED') {
      soundManager.playWinner();
      if (gameCode) {
        apiFetch(`/api/admin/games/${gameCode}`)
          .then((r) => {
            if (r.allAnswers) setAllAnswers(r.allAnswers);
          })
          .catch(() => {});
      }
    }

    prevStatusRef.current = nextStatus;
    prevQuestionIdxRef.current = nextQIdx;
    setSnapshot(nextSnap);
  };

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      navigate('/admin/login');
      return;
    }
    if (!gameCode) return;

    const fullJoinUrl = `${window.location.origin}/join/${gameCode}`;
    setJoinUrl(fullJoinUrl);
    QRCode.toDataURL(fullJoinUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => {});

    apiFetch(`/api/admin/games/${gameCode}`)
      .then((res) => {
        if (res.snapshot) applySnapshotWithSound(res.snapshot);
        if (res.allAnswers) setAllAnswers(res.allAnswers);
      })
      .catch((err) => setError(err.message));

    const pollInterval = setInterval(() => {
      apiFetch<{ ok: boolean; snapshot: GameStateSnapshot }>(
        `/api/realtime/state/${gameCode}`
      )
        .then((res) => {
          if (res.ok && res.snapshot) {
            applySnapshotWithSound(res.snapshot);
          }
        })
        .catch(() => {});
    }, 800);

    const socket = getSocket();
    const joinAdminRoom = () => {
      socket.emit(
        'admin_join_game',
        { gameCode, token },
        (res: { ok: boolean; snapshot?: GameStateSnapshot }) => {
          if (res?.ok && res.snapshot) {
            applySnapshotWithSound(res.snapshot);
          }
        }
      );
    };
    joinAdminRoom();
    socket.on('connect', joinAdminRoom);

    const handleSync = (nextSnap: GameStateSnapshot) => {
      if (nextSnap.game.gameCode === gameCode) {
        applySnapshotWithSound(nextSnap);
      }
    };
    socket.on('game_state_sync', handleSync);

    return () => {
      clearInterval(pollInterval);
      socket.off('connect', joinAdminRoom);
      socket.off('game_state_sync', handleSync);
    };
  }, [gameCode, navigate]);

  const emitAdminAction = async (
    event: string,
    extraPayload: Record<string, any> = {}
  ) => {
    if (!gameCode) return;
    setError(null);

    const endpointMap: Record<string, string> = {
      admin_start_game: '/api/realtime/start-game',
      admin_end_question: '/api/realtime/end-question',
      admin_show_leaderboard: '/api/realtime/show-leaderboard',
      admin_next_question: '/api/realtime/next-question',
      admin_toggle_pause: '/api/realtime/toggle-pause',
      admin_toggle_auto_advance: '/api/realtime/toggle-auto-advance',
      admin_finish_game: '/api/realtime/finish-game',
    };

    const endpoint = endpointMap[event];
    if (!endpoint) return;

    try {
      const res = await apiFetch<{ ok: boolean; snapshot?: GameStateSnapshot; error?: string }>(
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify({ gameCode, ...extraPayload }),
        }
      );
      if (res.snapshot) {
        applySnapshotWithSound(res.snapshot);
      }
    } catch (err: any) {
      setError(err.message || 'İşlem gerçekleştirilemedi.');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSound = () => {
    const next = soundManager.toggle();
    setSoundEnabled(next);
  };

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-slate-600 font-semibold">Canlı yarışma ekranı yükleniyor...</div>
          {error && <div className="text-rose-600 text-sm">{error}</div>}
        </div>
      </div>
    );
  }

  const { game, players, currentQuestion, answeredCount, totalPlayers, questionResults, leaderboard } =
    snapshot;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* TOP ADMIN LIVE CONTROL PANEL (#0f172a Dark Contrast Bar with Bright Emerald Buttons) */}
      <header className="bg-[#0f172a] text-white border-b border-slate-800 px-4 sm:px-6 py-3.5 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white transition"
              title="Yönetici Paneline Dön"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
                  KOD: {game.gameCode}
                </span>
                <span className="text-sm font-extrabold text-white truncate max-w-xs sm:max-w-md">
                  {game.quizTitle}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-300 mt-1">
                <span className="font-bold text-[#0ea5e9]">
                  {game.status === 'LOBBY'
                    ? `Toplam ${game.totalQuestions} Soru`
                    : `${game.currentQuestionIndex + 1}. SORU / ${game.totalQuestions}`}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>Oyuncular: </span>
                  <strong className="text-white">{totalPlayers}</strong>
                </span>
                {(game.status === 'QUESTION' ||
                  game.status === 'PAUSED' ||
                  game.status === 'ANSWER_REVEAL') && (
                  <>
                    <span>•</span>
                    <span>
                      Cevaplayan:{' '}
                      <strong className="text-[#10b981]">
                        {answeredCount} / {totalPlayers}
                      </strong>
                    </span>
                  </>
                )}
                {(game.status === 'QUESTION' || game.status === 'PAUSED') && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#0ea5e9]" />
                      <span>Süre: </span>
                      <strong className="text-white">{remainingSeconds} saniye</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleSound}
              title={soundEnabled ? 'Sesleri Kapat' : 'Sesleri Aç'}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition ${
                soundEnabled
                  ? 'bg-[#0ea5e9]/20 border-[#0ea5e9]/50 text-[#0ea5e9]'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() =>
                emitAdminAction('admin_toggle_auto_advance', {
                  autoAdvance: !game.autoAdvance,
                })
              }
              className={`px-3 py-2 rounded-2xl border text-xs font-bold transition ${
                game.autoAdvance
                  ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981]'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              Otomatik Geçiş: {game.autoAdvance ? 'Açık' : 'Kapalı'}
            </button>

            {game.status === 'LOBBY' && (
              <button
                onClick={() => emitAdminAction('admin_start_game')}
                className="px-5 py-2.5 rounded-2xl bg-[#10b981] hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>BAŞLAT</span>
              </button>
            )}

            {(game.status === 'QUESTION' || game.status === 'PAUSED') && (
              <>
                <button
                  onClick={() => emitAdminAction('admin_end_question')}
                  className="px-3.5 py-2 rounded-2xl bg-[#0ea5e9] hover:bg-sky-400 text-white font-extrabold text-xs flex items-center gap-1.5 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SORUYU BİTİR</span>
                </button>

                <button
                  onClick={() => emitAdminAction('admin_toggle_pause')}
                  className={`px-3.5 py-2 rounded-2xl font-extrabold text-xs flex items-center gap-1.5 transition ${
                    game.status === 'PAUSED'
                      ? 'bg-[#10b981] hover:bg-emerald-400 text-slate-950'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {game.status === 'PAUSED' ? (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>OYUNU DEVAM ETTİR</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>OYUNU DURAKLAT</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => emitAdminAction('admin_next_question')}
                  className="px-3.5 py-2 rounded-2xl bg-[#10b981] hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>SONRAKİ SORU</span>
                </button>
              </>
            )}

            {game.status === 'ANSWER_REVEAL' && (
              <>
                <button
                  onClick={() => emitAdminAction('admin_show_leaderboard')}
                  className="px-4 py-2.5 rounded-2xl bg-[#0ea5e9] hover:bg-sky-400 text-white font-extrabold text-xs flex items-center gap-1.5 transition"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>CANLI SKOR TABLOSU</span>
                </button>
                <button
                  onClick={() => emitAdminAction('admin_next_question')}
                  className="px-4 py-2.5 rounded-2xl bg-[#10b981] hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>
                    {game.currentQuestionIndex + 1 >= game.totalQuestions
                      ? 'SONUÇ EKRANINA GEÇ'
                      : 'SONRAKİ SORU'}
                  </span>
                </button>
              </>
            )}

            {game.status === 'LEADERBOARD' && (
              <button
                onClick={() => emitAdminAction('admin_next_question')}
                className="px-5 py-2.5 rounded-2xl bg-[#10b981] hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition"
              >
                <SkipForward className="w-4 h-4" />
                <span>
                  {game.currentQuestionIndex + 1 >= game.totalQuestions
                    ? 'SONUÇLARI GÖSTER'
                    : 'SONRAKİ SORU'}
                </span>
              </button>
            )}

            {game.status !== 'FINISHED' && (
              <button
                onClick={() => emitAdminAction('admin_finish_game')}
                className="px-3.5 py-2 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>OYUNU BİTİR</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8 flex flex-col justify-center">
        {/* STATE 1: LOBBY (Dark Contrast QR Card #0f172a + Clean Light Players Card) */}
        {game.status === 'LOBBY' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 bg-[#0f172a] text-white border border-slate-800 rounded-2xl p-8 text-center shadow-xl flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 text-xs font-extrabold uppercase tracking-wider mb-4">
                <Sparkles className="w-4 h-4" />
                OYUNA KATIL
              </div>

              <div className="p-4 bg-white rounded-2xl shadow-lg mb-4">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Oyun Kodu ${game.gameCode} QR`}
                    className="w-60 h-60 sm:w-64 sm:h-64 object-contain"
                  />
                ) : (
                  <div className="w-60 h-60 flex items-center justify-center text-slate-900 font-bold">
                    QR Hazırlanıyor...
                  </div>
                )}
              </div>

              <p className="text-xs font-semibold text-[#0ea5e9] mb-4">
                Oyuncular bu QR kodu okutarak katılabilir.
              </p>

              <div className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 mb-4">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Oyun Kodu:
                </div>
                <div className="text-5xl sm:text-6xl font-black tracking-widest text-[#10b981] font-mono mt-1">
                  {game.gameCode}
                </div>
              </div>

              <p className="text-sm text-slate-300 mb-5">
                Telefonundan QR kodu okut veya oyun adresine git:
                <span className="block font-mono text-[#0ea5e9] font-bold mt-1 break-all">
                  {joinUrl}
                </span>
              </p>

              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 py-2.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center justify-center gap-2 transition"
                >
                  {copied ? <Check className="w-4 h-4 text-[#10b981]" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Bağlantı Kopyalandı!' : 'Katılım Linkini Kopyala'}</span>
                </button>
                <a
                  href={`/join/${game.gameCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-4 rounded-2xl bg-[#0ea5e9] hover:bg-sky-400 text-xs font-extrabold text-white flex items-center gap-1.5 transition"
                >
                  <span>Oyuncu Ekranı Aç</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-8 min-h-[480px] flex flex-col justify-between shadow-lg shadow-slate-200/50">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center">
                      <Users className="w-6 h-6 text-[#0ea5e9]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-extrabold text-slate-900">
                        OYUNCULAR ({players.length})
                      </h2>
                      <p className="text-xs text-slate-500">
                        Katılan oyuncular gerçek zamanlı olarak aşağıda listelenir.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => emitAdminAction('admin_start_game')}
                    className="px-6 py-3.5 rounded-2xl bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>OYUNU BAŞLAT</span>
                  </button>
                </div>

                {players.length === 0 ? (
                  <div className="py-24 text-center space-y-3">
                    <div className="inline-flex p-4 rounded-full bg-slate-100 text-slate-400 animate-pulse">
                      <Users className="w-8 h-8" />
                    </div>
                    <div className="text-lg font-bold text-slate-700">
                      Oyuncuların katılması bekleniyor...
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Telefonunuzdan QR kodu okutarak veya{' '}
                      <span className="text-[#0ea5e9] font-mono font-bold">{joinUrl}</span> adresine giderek
                      hemen katılabilirsiniz.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[340px] overflow-y-auto pr-1">
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 shadow-sm animate-float"
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            p.connected ? 'bg-[#10b981]' : 'bg-amber-400'
                          }`}
                        />
                        <span className="font-extrabold text-slate-900 text-sm truncate">
                          {p.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Quiz: {game.quizTitle}</span>
                <span>Toplam {game.totalQuestions} Soru</span>
              </div>
            </div>
          </div>
        )}

        {/* STATE 2: STARTING */}
        {game.status === 'STARTING' && (
          <div className="bg-[#0f172a] text-white rounded-2xl p-16 text-center shadow-xl space-y-6">
            <div className="inline-flex px-5 py-2 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] text-sm font-extrabold uppercase tracking-widest">
              Hazır Olun!
            </div>
            <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tight animate-bounce">
              Yarışma Başlıyor...
            </h1>
            <p className="text-lg text-slate-300">
              Telefon ekranlarınıza bakın! İlk soru birazdan ekranda olacak.
            </p>
          </div>
        )}

        {/* STATE 3 & 4: QUESTION & PAUSED */}
        {(game.status === 'QUESTION' || game.status === 'PAUSED') && currentQuestion && (
          <div className="space-y-6 relative">
            {game.status === 'PAUSED' && (
              <div className="inset-0 z-20 bg-[#0f172a] text-white rounded-2xl border-2 border-[#0ea5e9] p-10 text-center flex flex-col items-center justify-center space-y-4 shadow-2xl">
                <Pause className="w-16 h-16 text-[#0ea5e9] animate-pulse" />
                <h2 className="text-4xl sm:text-5xl font-black text-white tracking-wider">
                  OYUN DURAKLATILDI
                </h2>
                <p className="text-slate-300 text-base">
                  Yönetici oyunu devam ettirdiğinde kaldığı süreden ({remainingSeconds} sn) devam edecektir.
                </p>
                <button
                  onClick={() => emitAdminAction('admin_toggle_pause')}
                  className="mt-2 px-6 py-3 rounded-2xl bg-[#10b981] hover:bg-emerald-400 text-slate-950 font-extrabold text-base flex items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>OYUNU DEVAM ETTİR</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-2 flex justify-center">
                <div
                  className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full border-8 flex flex-col items-center justify-center shadow-lg transition-colors ${
                    remainingSeconds <= 5
                      ? 'bg-rose-50 border-rose-500 text-rose-600 animate-pulse'
                      : 'bg-white border-[#10b981] text-slate-900'
                  }`}
                >
                  <span className="text-4xl sm:text-5xl font-black font-mono leading-none">
                    {remainingSeconds}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">
                    saniye
                  </span>
                </div>
              </div>

              {/* Important Question Panel in Dark Anthracite (#0f172a) */}
              <div className="lg:col-span-8 bg-[#0f172a] text-white border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
                <div className="inline-block px-4 py-1 rounded-full bg-[#10b981]/20 text-[#10b981] text-xs font-extrabold uppercase tracking-widest mb-3">
                  SORU {currentQuestion.index + 1} / {currentQuestion.total}
                </div>
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white leading-snug">
                  "{currentQuestion.text}"
                </h1>
              </div>

              <div className="lg:col-span-2 flex justify-center">
                <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 text-center w-full shadow-sm">
                  <div className="text-3xl sm:text-4xl font-black text-[#10b981]">
                    {answeredCount} <span className="text-lg text-slate-400">/ {totalPlayers}</span>
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                    Cevaplayan
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Colored Answer Cards with rounded-2xl */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {(
                [
                  { color: 'RED' as OptionColor, text: currentQuestion.redOption },
                  { color: 'BLUE' as OptionColor, text: currentQuestion.blueOption },
                  { color: 'YELLOW' as OptionColor, text: currentQuestion.yellowOption },
                  { color: 'GREEN' as OptionColor, text: currentQuestion.greenOption },
                ] as const
              ).map((opt) => {
                const m = COLOR_META[opt.color];
                return (
                  <div
                    key={opt.color}
                    className={`${m.bgClass} border-4 ${m.borderClass} rounded-2xl p-7 sm:p-9 shadow-lg flex items-center gap-5 transition transform hover:scale-[1.01]`}
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black/25 flex items-center justify-center text-3xl sm:text-4xl shrink-0">
                      {m.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-white/85">
                        {m.label}
                      </div>
                      <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white break-words mt-0.5">
                        {opt.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STATE 5: ANSWER_REVEAL */}
        {game.status === 'ANSWER_REVEAL' && currentQuestion && questionResults && (
          <div className="space-y-8">
            <div className="bg-[#0f172a] text-white border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
              <div className="text-xs font-extrabold uppercase tracking-widest text-[#10b981] mb-2">
                DOĞRU CEVAP
              </div>
              <div className="text-lg text-slate-300 mb-4 font-semibold">
                "{currentQuestion.text}"
              </div>

              {(() => {
                const winMeta = COLOR_META[questionResults.correctColor];
                return (
                  <div
                    className={`inline-flex items-center gap-4 px-8 py-5 rounded-2xl ${winMeta.bgClass} border-4 ${winMeta.borderClass} shadow-xl`}
                  >
                    <span className="text-4xl">{winMeta.emoji}</span>
                    <div className="text-left">
                      <div className="text-xs font-extrabold uppercase tracking-widest text-white/85">
                        {winMeta.label.toUpperCase()}
                      </div>
                      <div className="text-2xl sm:text-4xl font-black text-white">
                        {questionResults.correctOptionText}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                <h3 className="text-base font-extrabold text-slate-900">Cevap Dağılımı</h3>
                {(['RED', 'BLUE', 'YELLOW', 'GREEN'] as OptionColor[]).map((col) => {
                  const m = COLOR_META[col];
                  const count = questionResults.colorCounts[col] || 0;
                  const isCorrect = questionResults.correctColor === col;
                  const optText =
                    col === 'RED'
                      ? currentQuestion.redOption
                      : col === 'BLUE'
                      ? currentQuestion.blueOption
                      : col === 'YELLOW'
                      ? currentQuestion.yellowOption
                      : currentQuestion.greenOption;

                  return (
                    <div
                      key={col}
                      className={`p-4 rounded-2xl border flex items-center justify-between ${
                        isCorrect
                          ? `${m.bgClass} border-slate-900 text-white shadow-md`
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl">{m.emoji}</span>
                        <div className="truncate">
                          <span className="font-extrabold">{m.label}: </span>
                          <span>{optText}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isCorrect && <CheckCircle2 className="w-5 h-5 text-white" />}
                        <span
                          className={`px-3 py-1 rounded-xl font-extrabold text-sm ${
                            isCorrect ? 'bg-black/25 text-white' : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {count} Oyuncu
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-extrabold text-slate-900">SORU SONUÇLARI</h3>
                    <span className="text-xs text-slate-500">
                      Sunucu cevap zamanına göre sıralı
                    </span>
                  </div>

                  {questionResults.results.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm">
                      Bu soruya cevap veren oyuncu olmadı.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {questionResults.results.map((r) => {
                        const colMeta = r.selectedColor ? COLOR_META[r.selectedColor] : null;
                        return (
                          <div
                            key={r.playerId}
                            className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">
                                {colMeta ? colMeta.emoji : '⚪'}
                              </span>
                              <div>
                                <div className="font-extrabold text-slate-900 text-base">
                                  {r.playerName}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {r.elapsedSeconds !== null
                                    ? `Cevap zamanı: ${r.elapsedSeconds.toFixed(3)} saniye`
                                    : 'Cevap vermedi'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span
                                className={`px-3.5 py-1.5 rounded-xl font-black text-base ${
                                  r.score > 0
                                    ? 'bg-emerald-50 text-[#10b981] border border-emerald-200'
                                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                                }`}
                              >
                                +{r.score}
                              </span>
                              <span className="text-xs text-slate-500 w-24 text-right">
                                Toplam: <strong className="text-slate-900">{r.totalScore}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    onClick={() => emitAdminAction('admin_show_leaderboard')}
                    className="px-5 py-2.5 rounded-2xl bg-[#0ea5e9] hover:bg-sky-600 text-white font-extrabold text-xs flex items-center gap-2 transition"
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>CANLI SKOR TABLOSU</span>
                  </button>
                  <button
                    onClick={() => emitAdminAction('admin_next_question')}
                    className="px-5 py-2.5 rounded-2xl bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-2 transition"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>SONRAKİ SORU</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STATE 6: LEADERBOARD */}
        {game.status === 'LEADERBOARD' && (
          <div className="max-w-3xl w-full mx-auto bg-[#0f172a] text-white border border-slate-800 rounded-2xl p-8 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-[#10b981]" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    CANLI SKOR TABLOSU
                  </h2>
                  <p className="text-xs text-slate-400">
                    {game.currentQuestionIndex + 1}. soru sonunda toplam puan durumu
                  </p>
                </div>
              </div>

              <button
                onClick={() => emitAdminAction('admin_next_question')}
                className="px-5 py-3 rounded-2xl bg-[#10b981] hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition"
              >
                <span>
                  {game.currentQuestionIndex + 1 >= game.totalQuestions
                    ? 'FİNAL SONUÇLARI'
                    : 'SONRAKİ SORU'}
                </span>
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {leaderboard.map((p, idx) => (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                    idx === 0
                      ? 'bg-[#10b981]/20 border-[#10b981] scale-[1.01]'
                      : idx === 1
                      ? 'bg-[#0ea5e9]/15 border-[#0ea5e9]/50'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-9 h-9 rounded-xl bg-black/30 font-black text-base flex items-center justify-center text-[#10b981]">
                      {idx + 1}.
                    </span>
                    <span className="text-lg sm:text-xl font-extrabold text-white">
                      {p.name}
                    </span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-[#10b981] font-mono">
                    {p.totalScore} <span className="text-xs font-sans text-slate-400">puan</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATE 7: FINISHED */}
        {game.status === 'FINISHED' && (
          <div className="space-y-8">
            <div className="bg-[#0f172a] text-white border border-slate-800 rounded-2xl p-8 sm:p-10 text-center shadow-xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] text-xs font-extrabold uppercase tracking-widest mb-4">
                <Trophy className="w-4 h-4" />
                YARIŞMA TAMAMLANDI
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white mb-8">
                🏆 YARIŞMA SONUÇLARI
              </h1>

              {leaderboard[0] && (
                <div className="max-w-lg mx-auto mb-8 p-6 rounded-2xl bg-gradient-to-br from-[#10b981]/25 to-[#0ea5e9]/20 border-2 border-[#10b981] shadow-xl animate-float">
                  <div className="text-4xl mb-2">👑 🥇</div>
                  <div className="text-xs font-extrabold uppercase tracking-widest text-[#10b981]">
                    YARIŞMA BİRİNCİSİ
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-white mt-1">
                    1. {leaderboard[0].name}
                  </div>
                  <div className="text-2xl font-extrabold text-[#10b981] mt-1">
                    {leaderboard[0].totalScore} puan
                  </div>
                </div>
              )}

              <div className="max-w-2xl mx-auto space-y-3 text-left">
                {leaderboard.map((p, idx) => {
                  const medal =
                    idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                  return (
                    <div
                      key={p.id}
                      className={`p-4 rounded-2xl border flex items-center justify-between ${
                        idx === 0
                          ? 'bg-[#10b981]/20 border-[#10b981]/60'
                          : idx === 1
                          ? 'bg-[#0ea5e9]/15 border-[#0ea5e9]/40'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 text-lg font-extrabold text-white">
                        <span className="w-8 text-center">{medal}</span>
                        <span>
                          {idx + 1}. {p.name}
                        </span>
                      </div>
                      <div className="text-lg font-black text-[#10b981]">
                        {p.totalScore} puan
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-center gap-4">
                <Link
                  to="/admin"
                  className="px-6 py-3 rounded-2xl bg-[#10b981] hover:bg-emerald-400 text-slate-950 font-extrabold text-sm transition"
                >
                  Yönetici Paneline Dön
                </Link>
              </div>
            </div>

            {allAnswers.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-extrabold text-slate-900 mb-1">
                  Detaylı Sunucu Cevap Zamanları (Timestamp Kayıtları)
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Aynı anda gönderilen cevaplar milisaniye hassasiyetinde sunucu alış zamanına göre sıralanmıştır.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase bg-slate-50">
                        <th className="py-2.5 px-3">Oyuncu</th>
                        <th className="py-2.5 px-3">Seçilen Renk</th>
                        <th className="py-2.5 px-3">Cevap Zamanı</th>
                        <th className="py-2.5 px-3">Durum</th>
                        <th className="py-2.5 px-3 text-right">Kazanılan Puan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allAnswers.map((a) => {
                        const m = COLOR_META[a.selectedColor];
                        return (
                          <tr key={a.id}>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {a.playerName || a.playerId}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {m.emoji} {m.label}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-[#0ea5e9]">
                              {a.elapsedSeconds.toFixed(3)} saniye
                            </td>
                            <td className="py-2.5 px-3">
                              {a.isCorrect ? (
                                <span className="text-[#10b981] font-bold">Doğru</span>
                              ) : (
                                <span className="text-rose-600 font-bold">Yanlış</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                              +{a.score}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
