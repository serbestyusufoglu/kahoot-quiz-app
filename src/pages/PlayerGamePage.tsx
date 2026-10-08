import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, Pause, Wifi, Sparkles } from 'lucide-react';
import { apiFetch, getSocket } from '../utils/api.ts';
import { useServerTimer } from '../utils/useServerTimer.ts';
import { soundManager } from '../utils/sound.ts';
import {
  COLOR_META,
  type GameStateSnapshot,
  type OptionColor,
  type Player,
} from '../../shared/types.ts';
import { ShapeIcon } from '../components/ShapeIcon.tsx';

export const PlayerGamePage: React.FC = () => {
  const { gameCode: routeCode } = useParams<{ gameCode?: string }>();
  const [searchParams] = useSearchParams();
  const sessionKeySuffix = searchParams.get('p') || 'default';

  const [gameCodeInput, setGameCodeInput] = useState(routeCode || '');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [joinedPlayer, setJoinedPlayer] = useState<Player | null>(null);
  const [snapshot, setSnapshot] = useState<GameStateSnapshot | null>(null);

  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answeredQuestionId, setAnsweredQuestionId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<OptionColor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const prevStatusRef = useRef<string | null>(null);

  const storageKey = (code: string) => `kahoot_player_${code}_${sessionKeySuffix}`;

  const remainingSeconds = useServerTimer({
    status: snapshot?.game.status,
    questionEndsAt: snapshot?.game.questionEndsAt,
    remainingMsWhenPaused: snapshot?.game.remainingMsWhenPaused,
    serverTime: snapshot?.serverTime,
    playTickSound: false,
  });

  useEffect(() => {
    if (routeCode) {
      setGameCodeInput(routeCode);
    }
  }, [routeCode]);

  const applyPlayerSnapshot = (nextSnap: GameStateSnapshot, currentPlayerId?: string) => {
    const pid = currentPlayerId || joinedPlayer?.id;
    if (nextSnap.currentQuestion) {
      setAnsweredQuestionId((prevId) => {
        if (prevId && prevId !== nextSnap.currentQuestion?.id) {
          setSelectedColor(null);
          return null;
        }
        return prevId;
      });
    }

    if (
      pid &&
      nextSnap.game.status === 'ANSWER_REVEAL' &&
      prevStatusRef.current !== 'ANSWER_REVEAL' &&
      nextSnap.questionResults
    ) {
      const myRes = nextSnap.questionResults.results.find((r) => r.playerId === pid);
      if (myRes?.isCorrect) {
        soundManager.playCorrect();
      } else {
        soundManager.playWrong();
      }
    }

    prevStatusRef.current = nextSnap.game.status;
    setSnapshot(nextSnap);

    if (pid) {
      const updatedMe = nextSnap.players.find((p) => p.id === pid);
      if (updatedMe) {
        setJoinedPlayer(updatedMe);
      }
    }
  };

  useEffect(() => {
    const code = (routeCode || gameCodeInput).trim();
    if (!code) return;

    const raw = localStorage.getItem(storageKey(code));
    if (!raw) return;

    try {
      const saved = JSON.parse(raw) as { playerId: string; name: string; gameCode: string };
      if (saved.playerId && saved.name) {
        setPlayerNameInput(saved.name);
        connectPlayerToGame(code, saved.name, saved.playerId);
      }
    } catch {
      // ignore
    }
  }, [routeCode]);

  useEffect(() => {
    if (!joinedPlayer || !snapshot) return;
    const code = snapshot.game.gameCode;

    const pollInterval = setInterval(() => {
      apiFetch<{ ok: boolean; snapshot: GameStateSnapshot }>(
        `/api/realtime/state/${code}`
      )
        .then((res) => {
          if (res.ok && res.snapshot) {
            applyPlayerSnapshot(res.snapshot, joinedPlayer.id);
          }
        })
        .catch(() => {});
    }, 800);

    const socket = getSocket();
    const handleSync = (nextSnap: GameStateSnapshot) => {
      if (nextSnap.game.gameCode === code) {
        applyPlayerSnapshot(nextSnap, joinedPlayer.id);
      }
    };

    socket.on('game_state_sync', handleSync);
    return () => {
      clearInterval(pollInterval);
      socket.off('game_state_sync', handleSync);
    };
  }, [joinedPlayer?.id, snapshot?.game.gameCode]);

  const connectPlayerToGame = async (
    code: string,
    name: string,
    existingPlayerId?: string
  ) => {
    setJoining(true);
    setError(null);

    try {
      const res = await apiFetch<{
        ok: boolean;
        error?: string;
        player: Player;
        snapshot: GameStateSnapshot;
        alreadyAnsweredCurrent?: boolean;
        currentAnswer?: { questionId: string; selectedColor: OptionColor };
      }>('/api/realtime/join', {
        method: 'POST',
        body: JSON.stringify({
          gameCode: code.trim(),
          name: name.trim(),
          playerId: existingPlayerId,
        }),
      });

      localStorage.setItem(
        storageKey(code.trim()),
        JSON.stringify({
          playerId: res.player.id,
          name: res.player.name,
          gameCode: code.trim(),
        })
      );

      setJoinedPlayer(res.player);
      applyPlayerSnapshot(res.snapshot, res.player.id);

      if (res.alreadyAnsweredCurrent && res.currentAnswer) {
        setAnsweredQuestionId(res.currentAnswer.questionId);
        setSelectedColor(res.currentAnswer.selectedColor);
      }

      getSocket().emit('join_game', {
        gameCode: code.trim(),
        name: res.player.name,
        playerId: res.player.id,
      });
    } catch (err: any) {
      setError(err.message || 'Oyuna katılınamadı.');
    } finally {
      setJoining(false);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = gameCodeInput.trim();
    const cleanedName = playerNameInput.trim();
    if (!cleanedCode) {
      setError('Lütfen 6 haneli oyun kodunu girin.');
      return;
    }
    if (!cleanedName) {
      setError('Lütfen yarışmada görünecek isminizi girin.');
      return;
    }

    let existingId: string | undefined;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(cleanedCode)) || 'null');
      if (saved && saved.playerId && saved.name === cleanedName) {
        existingId = saved.playerId;
      }
    } catch {}

    connectPlayerToGame(cleanedCode, cleanedName, existingId);
  };

  const handleSelectColor = async (color: OptionColor) => {
    if (!snapshot || !joinedPlayer || !snapshot.currentQuestion) return;
    if (snapshot.game.status !== 'QUESTION') return;
    if (answeredQuestionId === snapshot.currentQuestion.id || submitting) return;

    setSubmitting(true);
    setSelectedColor(color);
    setAnsweredQuestionId(snapshot.currentQuestion.id);

    try {
      const res = await apiFetch<{
        ok: boolean;
        error?: string;
        snapshot?: GameStateSnapshot;
      }>('/api/realtime/submit-answer', {
        method: 'POST',
        body: JSON.stringify({
          gameCode: snapshot.game.gameCode,
          playerId: joinedPlayer.id,
          selectedColor: color,
        }),
      });
      if (res.snapshot) {
        applyPlayerSnapshot(res.snapshot, joinedPlayer.id);
      }
    } catch (err: any) {
      if (!String(err.message).includes('zaten')) {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!joinedPlayer || !snapshot) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-5 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#10b981]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#0ea5e9]/10 blur-3xl" />

        <div className="relative z-10 w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/60">
          <div className="flex justify-center mb-4">
            <div className="grid grid-cols-2 gap-1 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#E21B3C]" />
              <span className="w-3.5 h-3.5 rounded-sm bg-[#1368CE]" />
              <span className="w-3.5 h-3.5 rounded-sm bg-[#D89E00]" />
              <span className="w-3.5 h-3.5 rounded-sm bg-[#26890C]" />
            </div>
          </div>

          <h1 className="text-2xl font-black text-center text-slate-900">Oyuna Katıl</h1>
          <p className="text-xs text-center text-slate-500 mt-1 mb-6 font-medium">
            Oyun kodunu ve ismini girerek yarışmaya bağlan
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                Oyun Kodu:
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={gameCodeInput}
                onChange={(e) => setGameCodeInput(e.target.value.replace(/\s+/g, ''))}
                placeholder="583421"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:bg-white focus:outline-none text-center text-2xl font-black tracking-widest text-slate-900 font-mono transition"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                İsim:
              </label>
              <input
                type="text"
                required
                maxLength={24}
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value)}
                placeholder="Adınız..."
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:bg-white focus:outline-none text-center text-lg font-extrabold text-slate-900 transition"
              />
            </div>

            <button
              type="submit"
              disabled={joining}
              className="w-full py-4 rounded-2xl bg-[#10b981] hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-lg shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition"
            >
              {joining ? 'KATILINIYOR...' : 'OYUNA KATIL'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { game, currentQuestion, questionResults, leaderboard } = snapshot;
  const myPlayer = snapshot.players.find((p) => p.id === joinedPlayer.id) || joinedPlayer;
  const myRank = leaderboard.findIndex((p) => p.id === joinedPlayer.id) + 1;
  const hasAnsweredCurrent =
    Boolean(currentQuestion && answeredQuestionId === currentQuestion.id) ||
    Boolean(currentQuestion && myPlayer.lastAnswer?.questionId === currentQuestion.id);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between select-none">
      {/* Dark Contrast Header (#0f172a) */}
      <header className="bg-[#0f172a] text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Wifi className="w-4 h-4 text-[#10b981] shrink-0" />
          <span className="font-extrabold text-sm text-white truncate">{myPlayer.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 font-semibold">Kod: {game.gameCode}</span>
          <div className="px-3 py-1 rounded-full bg-[#10b981] text-slate-950 font-black text-xs">
            {myPlayer.totalScore} Puan
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 max-w-lg w-full mx-auto">
        {(game.status === 'LOBBY' || game.status === 'STARTING') && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-5">
            <div className="w-20 h-20 rounded-2xl bg-emerald-50 border-2 border-[#10b981] flex items-center justify-center animate-bounce">
              <Sparkles className="w-10 h-10 text-[#10b981]" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-widest text-[#10b981]">
                Hoş Geldin, {myPlayer.name}!
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                {game.status === 'STARTING'
                  ? 'Yarışma Başlıyor!'
                  : 'Yarışmanın başlaması bekleniyor...'}
              </h2>
              <p className="text-sm text-slate-500">
                Gözün büyük ekranda olsun! Soru başladığında 4 renk butonu burada açılacak.
              </p>
            </div>
          </div>
        )}

        {game.status === 'PAUSED' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <div className="w-full bg-[#0f172a] text-white rounded-2xl p-8 space-y-4 shadow-xl">
              <div className="w-20 h-20 rounded-full bg-[#0ea5e9]/20 border-2 border-[#0ea5e9] flex items-center justify-center mx-auto">
                <Pause className="w-10 h-10 text-[#0ea5e9] animate-pulse" />
              </div>
              <h2 className="text-3xl font-black text-white tracking-wide">
                OYUN DURAKLATILDI
              </h2>
              <p className="text-sm text-slate-300">
                Yönetici yarışmayı devam ettirdiğinde ekranınız otomatik olarak güncellenecektir.
              </p>
            </div>
          </div>
        )}

        {game.status === 'QUESTION' && currentQuestion && (
          <div className="flex-1 flex flex-col justify-between gap-4">
            {/* Dark Contrast Question Banner (#0f172a) */}
            <div className="bg-[#0f172a] text-white rounded-2xl p-4 text-center shrink-0 shadow-md">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-[#0ea5e9] mb-1.5">
                <span>SORU {currentQuestion.index + 1}</span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-sm ${
                    remainingSeconds <= 5
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-[#10b981] text-slate-950 font-black'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {remainingSeconds} sn
                </span>
              </div>
              <p className="text-base sm:text-lg font-extrabold text-white leading-snug">
                "{currentQuestion.text}"
              </p>
            </div>

            {hasAnsweredCurrent ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center bg-white border border-slate-200 rounded-2xl p-8 space-y-4 shadow-sm">
                {(() => {
                  const chosen =
                    selectedColor || myPlayer.lastAnswer?.selectedColor || 'BLUE';
                  const m = COLOR_META[chosen];
                  return (
                    <div
                      className={`w-24 h-24 rounded-2xl ${m.bgClass} border-4 ${m.borderClass} flex items-center justify-center shadow-xl text-white`}
                    >
                      <ShapeIcon color={chosen} className="w-12 h-12 drop-shadow" />
                    </div>
                  );
                })()}
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                  Cevabınız alındı.
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Süre bitene veya diğer oyuncular cevaplayana kadar bekleyin...
                </p>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-2 gap-3.5 min-h-[340px]">
                {(['RED', 'BLUE', 'YELLOW', 'GREEN'] as OptionColor[]).map((col) => {
                  const m = COLOR_META[col];
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => handleSelectColor(col)}
                      aria-label={m.shapeName}
                      className={`${m.bgClass} ${m.hoverClass} active:scale-95 border-4 ${m.borderClass} rounded-2xl flex items-center justify-center p-6 shadow-lg transition text-white`}
                    >
                      <ShapeIcon
                        color={col}
                        className="w-20 h-20 sm:w-24 sm:h-24 text-white drop-shadow-md"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(game.status === 'ANSWER_REVEAL' || game.status === 'LEADERBOARD') && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-6">
            {(() => {
              const myResult = questionResults?.results.find(
                (r) => r.playerId === joinedPlayer.id
              );
              const isCorrect = Boolean(myResult?.isCorrect);
              const earned = myResult?.score || 0;
              const correctCol = questionResults?.correctColor;
              const correctMeta = correctCol ? COLOR_META[correctCol] : null;

              return (
                <div className="w-full bg-white border border-slate-200 rounded-2xl p-7 shadow-lg space-y-5">
                  <div className="flex justify-center">
                    {isCorrect ? (
                      <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-[#10b981] flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12 text-[#10b981]" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-rose-50 border-2 border-rose-400 flex items-center justify-center">
                        <XCircle className="w-12 h-12 text-rose-500" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h2
                      className={`text-3xl font-black ${
                        isCorrect ? 'text-[#10b981]' : 'text-rose-500'
                      }`}
                    >
                      {isCorrect ? 'DOĞRU CEVAP!' : 'YANLIŞ / SÜRE DOLDU'}
                    </h2>
                    <div className="mt-2 inline-block px-5 py-2 rounded-2xl bg-[#0f172a] font-black text-2xl text-[#10b981]">
                      +{earned} Puan
                    </div>
                  </div>

                  {correctCol && correctMeta && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-center gap-2">
                      <span>Doğru Cevap:</span>
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-lg ${correctMeta.bgClass} text-white`}
                      >
                        <ShapeIcon color={correctCol} className="w-3.5 h-3.5" />
                      </span>
                      <strong className="text-slate-900">
                        {questionResults?.correctOptionText}
                      </strong>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] uppercase text-slate-500 font-bold">
                        Toplam Puanın
                      </div>
                      <div className="text-2xl font-black text-[#10b981] mt-0.5">
                        {myPlayer.totalScore}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] uppercase text-slate-500 font-bold">
                        Sıralaman
                      </div>
                      <div className="text-2xl font-black text-[#0ea5e9] mt-0.5">
                        {myRank > 0 ? `${myRank}. / ${leaderboard.length}` : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {game.status === 'FINISHED' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <div className="w-full bg-[#0f172a] text-white border border-slate-800 rounded-2xl p-8 shadow-xl space-y-5">
              <div className="text-5xl">
                {myRank === 1 ? '👑 🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🏁'}
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-widest text-[#10b981]">
                  YARIŞMA TAMAMLANDI
                </div>
                <h2 className="text-3xl font-black text-white mt-1">{myPlayer.name}</h2>
              </div>

              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="text-xs text-slate-400 uppercase font-bold">Final Sıralaman</div>
                <div className="text-4xl font-black text-[#0ea5e9]">
                  {myRank}. Sıra
                </div>
                <div className="text-xl font-extrabold text-[#10b981]">
                  Toplam {myPlayer.totalScore} Puan
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
