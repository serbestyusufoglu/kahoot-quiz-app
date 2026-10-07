import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Trophy, Clock, Pause, Wifi, Sparkles } from 'lucide-react';
import { getSocket } from '../utils/api.ts';
import { useServerTimer } from '../utils/useServerTimer.ts';
import { soundManager } from '../utils/sound.ts';
import {
  COLOR_META,
  type GameStateSnapshot,
  type OptionColor,
  type Player,
} from '../../shared/types.ts';

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

  // Track current question answer submission on phone
  const [answeredQuestionId, setAnsweredQuestionId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<OptionColor | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const storageKey = (code: string) => `kahoot_player_${code}_${sessionKeySuffix}`;

  const remainingSeconds = useServerTimer({
    status: snapshot?.game.status,
    questionEndsAt: snapshot?.game.questionEndsAt,
    remainingMsWhenPaused: snapshot?.game.remainingMsWhenPaused,
    serverTime: snapshot?.serverTime,
    playTickSound: false,
  });

  // Update gameCodeInput if routeCode changes
  useEffect(() => {
    if (routeCode) {
      setGameCodeInput(routeCode);
    }
  }, [routeCode]);

  // Attempt automatic reconnection if player session exists for routeCode
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
      // ignore invalid storage
    }
  }, [routeCode]);

  // Listen to real-time socket events once joined
  useEffect(() => {
    const socket = getSocket();

    const handleSync = (nextSnap: GameStateSnapshot) => {
      setSnapshot((prev) => {
        if (
          joinedPlayer &&
          nextSnap.game.gameCode !==
            (prev?.game.gameCode || gameCodeInput.trim())
        ) {
          return prev;
        }
        return nextSnap;
      });

      if (joinedPlayer) {
        const updatedMe = nextSnap.players.find((p) => p.id === joinedPlayer.id);
        if (updatedMe) {
          setJoinedPlayer(updatedMe);
        }
      }
    };

    const handleQuestionStarted = (nextSnap: GameStateSnapshot) => {
      handleSync(nextSnap);
      if (nextSnap.currentQuestion) {
        // Reset selection if it's a new question
        setAnsweredQuestionId((prevId) => {
          if (prevId !== nextSnap.currentQuestion?.id) {
            setSelectedColor(null);
            return null;
          }
          return prevId;
        });
      }
    };

    const handleAnswerRevealed = (nextSnap: GameStateSnapshot) => {
      handleSync(nextSnap);
      if (joinedPlayer && nextSnap.questionResults) {
        const myRes = nextSnap.questionResults.results.find(
          (r) => r.playerId === joinedPlayer.id
        );
        if (myRes?.isCorrect) {
          soundManager.playCorrect();
        } else {
          soundManager.playWrong();
        }
      }
    };

    const handleReconnect = () => {
      if (joinedPlayer && snapshot) {
        connectPlayerToGame(snapshot.game.gameCode, joinedPlayer.name, joinedPlayer.id);
      }
    };

    socket.on('game_state_sync', handleSync);
    socket.on('question_started', handleQuestionStarted);
    socket.on('answer_revealed', handleAnswerRevealed);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('game_state_sync', handleSync);
      socket.off('question_started', handleQuestionStarted);
      socket.off('answer_revealed', handleAnswerRevealed);
      socket.off('connect', handleReconnect);
    };
  }, [joinedPlayer, snapshot, gameCodeInput]);

  const connectPlayerToGame = (code: string, name: string, existingPlayerId?: string) => {
    setJoining(true);
    setError(null);

    const socket = getSocket();
    socket.emit(
      'join_game',
      {
        gameCode: code.trim(),
        name: name.trim(),
        playerId: existingPlayerId,
      },
      (res: {
        ok: boolean;
        error?: string;
        player?: Player;
        snapshot?: GameStateSnapshot;
        alreadyAnsweredCurrent?: boolean;
        currentAnswer?: { questionId: string; selectedColor: OptionColor };
      }) => {
        setJoining(false);
        if (!res.ok || !res.player || !res.snapshot) {
          setError(res.error || 'Oyuna katılınamadı.');
          return;
        }

        localStorage.setItem(
          storageKey(code.trim()),
          JSON.stringify({
            playerId: res.player.id,
            name: res.player.name,
            gameCode: code.trim(),
          })
        );

        setJoinedPlayer(res.player);
        setSnapshot(res.snapshot);

        if (res.alreadyAnsweredCurrent && res.currentAnswer) {
          setAnsweredQuestionId(res.currentAnswer.questionId);
          setSelectedColor(res.currentAnswer.selectedColor);
        }
      }
    );
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

    // Check if there is a saved playerId for this code + name
    let existingId: string | undefined;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(cleanedCode)) || 'null');
      if (saved && saved.playerId && saved.name === cleanedName) {
        existingId = saved.playerId;
      }
    } catch {}

    connectPlayerToGame(cleanedCode, cleanedName, existingId);
  };

  const handleSelectColor = (color: OptionColor) => {
    if (!snapshot || !joinedPlayer || !snapshot.currentQuestion) return;
    if (snapshot.game.status !== 'QUESTION') return;
    if (answeredQuestionId === snapshot.currentQuestion.id || submitting) return;

    setSubmitting(true);
    setSelectedColor(color);
    setAnsweredQuestionId(snapshot.currentQuestion.id);

    getSocket().emit(
      'submit_answer',
      {
        gameCode: snapshot.game.gameCode,
        playerId: joinedPlayer.id,
        selectedColor: color,
      },
      (res: { ok: boolean; error?: string }) => {
        setSubmitting(false);
        if (!res.ok && res.error && !res.error.includes('zaten')) {
          setError(res.error);
        }
      }
    );
  };

  // =========================================================================
  // VIEW 1: NOT JOINED YET -> "Oyuna Katıl" Form (Section 8)
  // =========================================================================
  if (!joinedPlayer || !snapshot) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col justify-center items-center p-5">
        <div className="w-full max-w-sm bg-slate-900/95 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex justify-center mb-4">
            <div className="grid grid-cols-2 gap-1 p-2.5 bg-white/10 rounded-2xl border border-white/15">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#E21B3C]" />
              <span className="w-3.5 h-3.5 rounded-sm bg-[#1368CE]" />
              <span className="w-3.5 h-3.5 rounded-sm bg-[#D89E00]" />
              <span className="w-3.5 h-3.5 rounded-sm bg-[#26890C]" />
            </div>
          </div>

          <h1 className="text-2xl font-black text-center text-white">Oyuna Katıl</h1>
          <p className="text-xs text-center text-slate-400 mt-1 mb-6">
            Oyun kodunu ve ismini girerek yarışmaya bağlan
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-1.5">
                Oyun Kodu:
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={gameCodeInput}
                onChange={(e) => setGameCodeInput(e.target.value.replace(/\s+/g, ''))}
                placeholder="583421"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-slate-700 focus:border-emerald-400 focus:outline-none text-center text-2xl font-black tracking-widest text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-1.5">
                İsim:
              </label>
              <input
                type="text"
                required
                maxLength={24}
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value)}
                placeholder="Adınız..."
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-slate-700 focus:border-emerald-400 focus:outline-none text-center text-lg font-extrabold text-white"
              />
            </div>

            <button
              type="submit"
              disabled={joining}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-50 text-white font-black text-lg shadow-xl shadow-emerald-600/30 active:scale-[0.98] transition"
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

  // =========================================================================
  // VIEW 2: CONNECTED PLAYER PHONE INTERFACE (Distraction-free Mobile UI)
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between select-none">
      {/* Compact Top Status Bar (Player Name & Total Score) */}
      <header className="bg-slate-900 border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-extrabold text-sm text-white truncate">{myPlayer.name}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">Kod: {game.gameCode}</span>
          <div className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-xs">
            {myPlayer.totalScore} Puan
          </div>
        </div>
      </header>

      {/* Main Dynamic Game Body */}
      <main className="flex-1 flex flex-col p-4 max-w-lg w-full mx-auto">
        {/* ----------------------------------------------------------------- */}
        {/* STATE: LOBBY & STARTING                                           */}
        {/* ----------------------------------------------------------------- */}
        {(game.status === 'LOBBY' || game.status === 'STARTING') && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-5">
            <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 border-2 border-indigo-400/40 flex items-center justify-center animate-bounce">
              <Sparkles className="w-10 h-10 text-indigo-300" />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-extrabold uppercase tracking-widest text-emerald-400">
                Hoş Geldin, {myPlayer.name}!
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {game.status === 'STARTING'
                  ? 'Yarışma Başlıyor!'
                  : 'Yarışmanın başlaması bekleniyor...'}
              </h2>
              <p className="text-sm text-slate-400">
                Gözün büyük ekranda olsun! Soru başladığında 4 renk butonu burada açılacak.
              </p>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* STATE: PAUSED (Section 19)                                        */}
        {/* ----------------------------------------------------------------- */}
        {game.status === 'PAUSED' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center">
              <Pause className="w-10 h-10 text-amber-400 animate-pulse" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-wide">
              OYUN DURAKLATILDI
            </h2>
            <p className="text-sm text-slate-400">
              Yönetici yarışmayı devam ettirdiğinde ekranınız otomatik olarak güncellenecektir.
            </p>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* STATE: QUESTION (Section 10 - 4 Huge Mobile Color Buttons)        */}
        {/* ----------------------------------------------------------------- */}
        {game.status === 'QUESTION' && currentQuestion && (
          <div className="flex-1 flex flex-col justify-between gap-4">
            {/* Simple Question Header on Phone */}
            <div className="bg-slate-900 border border-white/15 rounded-2xl p-4 text-center shrink-0">
              <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-indigo-300 mb-1.5">
                <span>SORU {currentQuestion.index + 1}</span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-sm ${
                    remainingSeconds <= 5
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-white/10 text-white'
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

            {/* If player already answered -> Lock & Show "Cevabınız alındı." */}
            {hasAnsweredCurrent ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center bg-slate-900/90 border border-white/15 rounded-3xl p-8 space-y-4">
                {(() => {
                  const chosen =
                    selectedColor || myPlayer.lastAnswer?.selectedColor || 'BLUE';
                  const m = COLOR_META[chosen];
                  return (
                    <div
                      className={`w-24 h-24 rounded-3xl ${m.bgClass} border-4 ${m.borderClass} flex items-center justify-center text-5xl shadow-2xl`}
                    >
                      {m.emoji}
                    </div>
                  );
                })()}
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Cevabınız alındı.
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Süre bitene veya diğer oyuncular cevaplayana kadar bekleyin...
                </p>
              </div>
            ) : (
              /* 4 Large Color Touch Buttons */
              <div className="flex-1 grid grid-cols-2 gap-3.5 min-h-[340px]">
                {(['RED', 'BLUE', 'YELLOW', 'GREEN'] as OptionColor[]).map((col) => {
                  const m = COLOR_META[col];
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => handleSelectColor(col)}
                      className={`${m.bgClass} ${m.hoverClass} active:scale-95 border-4 ${m.borderClass} rounded-3xl flex flex-col items-center justify-center p-4 shadow-2xl transition`}
                    >
                      <span className="text-5xl sm:text-6xl mb-3 drop-shadow">{m.emoji}</span>
                      <span className="text-xl sm:text-2xl font-black tracking-wider text-white uppercase">
                        {m.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* STATE: ANSWER_REVEAL & LEADERBOARD (Section 15 & 16)              */}
        {/* ----------------------------------------------------------------- */}
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
                <div className="w-full bg-slate-900 border border-white/15 rounded-3xl p-7 shadow-2xl space-y-5">
                  <div className="flex justify-center">
                    {isCorrect ? (
                      <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center">
                        <XCircle className="w-12 h-12 text-rose-400" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h2
                      className={`text-3xl font-black ${
                        isCorrect ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isCorrect ? 'DOĞRU CEVAP!' : 'YANLIŞ / SÜRE DOLDU'}
                    </h2>
                    <div className="mt-2 inline-block px-5 py-2 rounded-2xl bg-white/10 font-black text-2xl text-white">
                      +{earned} Puan
                    </div>
                  </div>

                  {correctMeta && (
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 text-xs text-slate-300">
                      Doğru Cevap:{' '}
                      <strong className="text-white">
                        {correctMeta.emoji} {correctMeta.label.toUpperCase()} (
                        {questionResults?.correctOptionText})
                      </strong>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/10">
                      <div className="text-[11px] uppercase text-slate-400 font-bold">
                        Toplam Puanın
                      </div>
                      <div className="text-2xl font-black text-amber-300 mt-0.5">
                        {myPlayer.totalScore}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/10">
                      <div className="text-[11px] uppercase text-slate-400 font-bold">
                        Sıralaman
                      </div>
                      <div className="text-2xl font-black text-indigo-300 mt-0.5">
                        {myRank > 0 ? `${myRank}. / ${leaderboard.length}` : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* STATE: FINISHED (Section 17)                                      */}
        {/* ----------------------------------------------------------------- */}
        {game.status === 'FINISHED' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <div className="w-full bg-slate-900 border border-white/15 rounded-3xl p-8 shadow-2xl space-y-5">
              <div className="text-5xl">
                {myRank === 1 ? '👑 🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🏁'}
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-widest text-amber-300">
                  YARIŞMA TAMAMLANDI
                </div>
                <h2 className="text-3xl font-black text-white mt-1">{myPlayer.name}</h2>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-white/10 space-y-2">
                <div className="text-xs text-slate-400 uppercase font-bold">Final Sıralaman</div>
                <div className="text-4xl font-black text-indigo-300">
                  {myRank}. Sıra
                </div>
                <div className="text-xl font-extrabold text-amber-300">
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
