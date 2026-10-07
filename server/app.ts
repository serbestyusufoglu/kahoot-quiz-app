import express from 'express';
import crypto from 'node:crypto';
import cors from 'cors';
import QRCode from 'qrcode';
import {
  initDatabase,
  verifyAdmin,
  getAllQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  duplicateQuestion,
  getAllQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  duplicateQuiz,
  createGameRecord,
  getGameById,
  getGameByCode,
  getGameStageEnteredAt,
  updateGameState,
  upsertPlayer,
  getPlayerById,
  getPlayersByGame,
  getAnswerForPlayerQuestion,
  recordAnswer,
  getAnswersForQuestion,
  getAllAnswersForGame,
  getDashboardStats,
} from './db';
import type {
  ActiveQuestionPublic,
  GameStateSnapshot,
  OptionColor,
  Question,
  QuestionResultEntry,
} from '../shared/types';

initDatabase();

const JWT_SECRET = process.env.JWT_SECRET || 'kahoot-super-secret-admin-key-2026';

export function signAdminToken(payload: { id: string; username: string }): string {
  const data = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyAdminToken(token?: string | null): { id: string; username: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return { id: parsed.id, username: parsed.username };
  } catch {
    return null;
  }
}

// Optional Socket.IO broadcaster hook (used when running persistent server)
type BroadcasterFn = (gameId: string, eventName?: string) => void;
let broadcaster: BroadcasterFn | null = null;

export function setRealtimeBroadcaster(fn: BroadcasterFn) {
  broadcaster = fn;
}

export function notifyGameStateChanged(gameId: string, eventName?: string) {
  if (broadcaster) {
    broadcaster(gameId, eventName);
  }
}

// In-memory timers (work in persistent server; serverless also uses lazy evaluation below)
const gameTimers = new Map<string, NodeJS.Timeout>();
const autoAdvanceTimers = new Map<string, NodeJS.Timeout>();

export function clearGameTimers(gameId: string) {
  const t = gameTimers.get(gameId);
  if (t) {
    clearTimeout(t);
    gameTimers.delete(gameId);
  }
  const a = autoAdvanceTimers.get(gameId);
  if (a) {
    clearTimeout(a);
    autoAdvanceTimers.delete(gameId);
  }
}

function getOptionTextByColor(q: Question, color: OptionColor): string {
  switch (color) {
    case 'RED':
      return q.redOption;
    case 'BLUE':
      return q.blueOption;
    case 'YELLOW':
      return q.yellowOption;
    case 'GREEN':
      return q.greenOption;
  }
}

/**
 * Evaluates time-based transitions so both persistent servers and serverless functions
 * (like Vercel) transition game states accurately based on server clock.
 */
export function evaluateGameTimers(gameId: string): void {
  const game = getGameById(gameId);
  if (!game) return;

  const now = Date.now();
  const stageEnteredAt = getGameStageEnteredAt(gameId);

  if (game.status === 'STARTING') {
    if (now - stageEnteredAt >= 1800) {
      startQuestionAtIndex(gameId, 0);
    }
    return;
  }

  if (game.status === 'QUESTION' && game.questionEndsAt) {
    if (now >= game.questionEndsAt) {
      endCurrentQuestionAndReveal(gameId);
      return;
    }
  }

  if (game.autoAdvance && game.status === 'ANSWER_REVEAL') {
    if (now - stageEnteredAt >= 4500) {
      showLeaderboardForGame(gameId);
      return;
    }
  }

  if (game.autoAdvance && game.status === 'LEADERBOARD') {
    if (now - stageEnteredAt >= 4500) {
      advanceToNextQuestionOrFinish(gameId);
      return;
    }
  }
}

export function buildGameStateSnapshot(
  gameId: string,
  includeCorrectForActive = false
): GameStateSnapshot | null {
  evaluateGameTimers(gameId);

  const game = getGameById(gameId);
  if (!game) return null;

  const quiz = getQuizById(game.quizId);
  const players = getPlayersByGame(game.id);
  const currentQ =
    quiz && quiz.questions[game.currentQuestionIndex]
      ? quiz.questions[game.currentQuestionIndex]
      : null;

  let answeredCount = 0;
  let questionResults: GameStateSnapshot['questionResults'] = null;

  if (currentQ) {
    const answers = getAnswersForQuestion(game.id, currentQ.id);
    answeredCount = answers.length;

    const answerByPlayer = new Map(answers.map((a) => [a.playerId, a]));
    for (const p of players) {
      const a = answerByPlayer.get(p.id);
      p.lastAnswer = a
        ? {
            questionId: a.questionId,
            selectedColor: a.selectedColor,
            isCorrect: a.isCorrect,
            score: a.score,
            elapsedSeconds: a.elapsedSeconds,
          }
        : null;
    }

    if (
      game.status === 'ANSWER_REVEAL' ||
      game.status === 'LEADERBOARD' ||
      game.status === 'FINISHED' ||
      includeCorrectForActive
    ) {
      const colorCounts: Record<OptionColor, number> = {
        RED: 0,
        BLUE: 0,
        YELLOW: 0,
        GREEN: 0,
      };
      for (const a of answers) {
        colorCounts[a.selectedColor] = (colorCounts[a.selectedColor] || 0) + 1;
      }

      const results: QuestionResultEntry[] = players.map((p) => {
        const a = answerByPlayer.get(p.id);
        return {
          playerId: p.id,
          playerName: p.name,
          selectedColor: a ? a.selectedColor : null,
          isCorrect: a ? a.isCorrect : false,
          score: a ? a.score : 0,
          totalScore: p.totalScore,
          elapsedSeconds: a ? a.elapsedSeconds : null,
          submittedAt: a ? a.submittedAt : null,
        };
      });

      results.sort((x, y) => {
        if (y.score !== x.score) return y.score - x.score;
        if (x.elapsedSeconds !== null && y.elapsedSeconds !== null) {
          return x.elapsedSeconds - y.elapsedSeconds;
        }
        return y.totalScore - x.totalScore;
      });

      questionResults = {
        correctColor: currentQ.correctColor,
        correctOptionText: getOptionTextByColor(currentQ, currentQ.correctColor),
        colorCounts,
        results,
      };
    }
  }

  const revealCorrect =
    includeCorrectForActive ||
    game.status === 'ANSWER_REVEAL' ||
    game.status === 'LEADERBOARD' ||
    game.status === 'FINISHED';

  const currentQuestionPublic: ActiveQuestionPublic | null = currentQ
    ? {
        index: game.currentQuestionIndex,
        total: quiz ? quiz.questions.length : 0,
        id: currentQ.id,
        text: currentQ.text,
        redOption: currentQ.redOption,
        blueOption: currentQ.blueOption,
        yellowOption: currentQ.yellowOption,
        greenOption: currentQ.greenOption,
        duration: currentQ.duration,
        mediaUrl: currentQ.mediaUrl || null,
        ...(revealCorrect ? { correctColor: currentQ.correctColor } : {}),
      }
    : null;

  const leaderboard = [...players].sort((a, b) => b.totalScore - a.totalScore);

  return {
    game,
    serverTime: Date.now(),
    players,
    currentQuestion: currentQuestionPublic,
    answeredCount,
    totalPlayers: players.length,
    questionResults,
    leaderboard,
  };
}

export function scheduleQuestionTimer(gameId: string, durationMs: number) {
  clearGameTimers(gameId);
  const timer = setTimeout(() => {
    endCurrentQuestionAndReveal(gameId);
  }, Math.max(50, durationMs));
  gameTimers.set(gameId, timer);
}

export function startQuestionAtIndex(gameId: string, questionIndex: number) {
  clearGameTimers(gameId);
  const game = getGameById(gameId);
  if (!game) return;
  const quiz = getQuizById(game.quizId);
  if (!quiz || questionIndex >= quiz.questions.length) {
    finishGame(gameId);
    return;
  }

  const question = quiz.questions[questionIndex];
  const now = Date.now();
  const durationMs = question.duration * 1000;
  const endsAt = now + durationMs;

  updateGameState(gameId, {
    status: 'QUESTION',
    previousStatusBeforePause: null,
    currentQuestionIndex: questionIndex,
    questionStartedAt: now,
    questionEndsAt: endsAt,
    remainingMsWhenPaused: null,
  });

  notifyGameStateChanged(gameId, 'question_started');
  scheduleQuestionTimer(gameId, durationMs);
}

export function endCurrentQuestionAndReveal(gameId: string) {
  clearGameTimers(gameId);
  const game = getGameById(gameId);
  if (!game) return;
  if (game.status !== 'QUESTION' && game.status !== 'PAUSED') return;

  updateGameState(gameId, {
    status: 'ANSWER_REVEAL',
    previousStatusBeforePause: null,
    questionEndsAt: Date.now(),
    remainingMsWhenPaused: null,
  });

  notifyGameStateChanged(gameId, 'question_ended');
  notifyGameStateChanged(gameId, 'answer_revealed');
  notifyGameStateChanged(gameId, 'leaderboard_updated');

  const updated = getGameById(gameId);
  if (updated?.autoAdvance) {
    const t = setTimeout(() => {
      const g = getGameById(gameId);
      if (!g || g.status !== 'ANSWER_REVEAL') return;
      showLeaderboardForGame(gameId);
    }, 4500);
    autoAdvanceTimers.set(gameId, t);
  }
}

export function showLeaderboardForGame(gameId: string) {
  clearGameTimers(gameId);
  const game = getGameById(gameId);
  if (!game) return;

  updateGameState(gameId, {
    status: 'LEADERBOARD',
    previousStatusBeforePause: null,
  });

  notifyGameStateChanged(gameId, 'leaderboard_updated');

  const updated = getGameById(gameId);
  if (updated?.autoAdvance) {
    const t = setTimeout(() => {
      const g = getGameById(gameId);
      if (!g || g.status !== 'LEADERBOARD') return;
      advanceToNextQuestionOrFinish(gameId);
    }, 4500);
    autoAdvanceTimers.set(gameId, t);
  }
}

export function advanceToNextQuestionOrFinish(gameId: string) {
  clearGameTimers(gameId);
  const game = getGameById(gameId);
  if (!game) return;
  const quiz = getQuizById(game.quizId);
  if (!quiz) return;

  const nextIdx = game.currentQuestionIndex + 1;
  if (nextIdx >= quiz.questions.length) {
    finishGame(gameId);
  } else {
    startQuestionAtIndex(gameId, nextIdx);
  }
}

export function finishGame(gameId: string) {
  clearGameTimers(gameId);
  updateGameState(gameId, {
    status: 'FINISHED',
    previousStatusBeforePause: null,
    questionEndsAt: null,
    remainingMsWhenPaused: null,
  });
  notifyGameStateChanged(gameId, 'game_finished');
}

// Shared Game Actions (used by both HTTP /api/realtime/* and Socket.IO)
export function handlePlayerJoinAction(payload: {
  gameCode: string;
  name: string;
  playerId?: string;
}) {
  const code = String(payload?.gameCode || '').trim();
  const name = String(payload?.name || '').trim();

  const game = getGameByCode(code);
  if (!game) {
    return { ok: false, error: 'Geçersiz oyun kodu. Lütfen kontrol edin.' };
  }

  const existingPlayer = payload?.playerId ? getPlayerById(payload.playerId) : null;
  if (game.status === 'FINISHED' && (!existingPlayer || existingPlayer.gameId !== game.id)) {
    return { ok: false, error: 'Bu yarışma sona ermiştir.' };
  }

  if (!name && !existingPlayer) {
    return { ok: false, error: 'Lütfen isminizi girin.' };
  }

  const player = upsertPlayer({
    playerId:
      existingPlayer && existingPlayer.gameId === game.id ? existingPlayer.id : undefined,
    gameId: game.id,
    name: name || existingPlayer?.name || 'Oyuncu',
  });

  const quiz = getQuizById(game.quizId);
  const currentQ = quiz?.questions[game.currentQuestionIndex];
  const existingAnswer = currentQ
    ? getAnswerForPlayerQuestion(game.id, player.id, currentQ.id)
    : null;

  notifyGameStateChanged(game.id, 'player_joined');
  const snapshot = buildGameStateSnapshot(game.id, false)!;

  return {
    ok: true,
    player,
    snapshot,
    alreadyAnsweredCurrent: Boolean(existingAnswer),
    currentAnswer: existingAnswer,
  };
}

export function handleStartGameAction(gameCode: string) {
  const game = getGameByCode(gameCode);
  if (!game) return { ok: false, error: 'Oyun bulunamadı.' };

  updateGameState(game.id, {
    status: 'STARTING',
    currentQuestionIndex: 0,
  });
  notifyGameStateChanged(game.id, 'game_started');

  clearGameTimers(game.id);
  const t = setTimeout(() => {
    startQuestionAtIndex(game.id, 0);
  }, 1800);
  gameTimers.set(game.id, t);

  return { ok: true, snapshot: buildGameStateSnapshot(game.id, true) };
}

export function handleSubmitAnswerAction(payload: {
  gameCode: string;
  playerId: string;
  selectedColor: OptionColor;
}) {
  const submittedAt = Date.now(); // STRICT SERVER TIMESTAMP
  const gameBefore = getGameByCode(payload?.gameCode || '');
  if (!gameBefore) {
    return { ok: false, error: 'Oyun bulunamadı.' };
  }
  evaluateGameTimers(gameBefore.id);
  const game = getGameById(gameBefore.id)!;

  if (game.status !== 'QUESTION') {
    return { ok: false, error: 'Şu anda aktif bir soru bulunmuyor veya süre doldu.' };
  }

  const player = getPlayerById(payload?.playerId || '');
  if (!player || player.gameId !== game.id) {
    return { ok: false, error: 'Oyuncu doğrulanamadı.' };
  }

  const quiz = getQuizById(game.quizId);
  const question = quiz?.questions[game.currentQuestionIndex];
  if (!question) {
    return { ok: false, error: 'Aktif soru bulunamadı.' };
  }

  const existing = getAnswerForPlayerQuestion(game.id, player.id, question.id);
  if (existing) {
    return {
      ok: false,
      error: 'Bu soruya zaten cevap verdiniz.',
      answer: existing,
    };
  }

  const validColors: OptionColor[] = ['RED', 'BLUE', 'YELLOW', 'GREEN'];
  if (!validColors.includes(payload.selectedColor)) {
    return { ok: false, error: 'Geçersiz renk seçimi.' };
  }

  const startedAt = game.questionStartedAt || submittedAt;
  const endsAt = game.questionEndsAt || startedAt + question.duration * 1000;
  const totalTimeMs = question.duration * 1000;

  const isLate = submittedAt > endsAt;
  const elapsedMs = Math.max(0, submittedAt - startedAt);
  const elapsedSeconds = Number((elapsedMs / 1000).toFixed(3));
  const remainingTimeMs = isLate ? 0 : Math.max(0, endsAt - submittedAt);

  const isCorrect = !isLate && payload.selectedColor === question.correctColor;

  let score = 0;
  if (isCorrect && remainingTimeMs > 0) {
    if (elapsedMs <= 1000) {
      score = 100;
    } else {
      score = Math.floor(100 * (remainingTimeMs / totalTimeMs));
      score = Math.max(1, Math.min(100, score));
    }
  }

  const savedAnswer = recordAnswer({
    gameId: game.id,
    playerId: player.id,
    questionId: question.id,
    selectedColor: payload.selectedColor,
    submittedAt,
    elapsedSeconds,
    isCorrect,
    score,
  });

  notifyGameStateChanged(game.id, 'answer_submitted');

  const players = getPlayersByGame(game.id);
  const connectedPlayers = players.filter((p) => p.connected);
  const activePoolCount = connectedPlayers.length > 0 ? connectedPlayers.length : players.length;
  const allAnswers = getAnswersForQuestion(game.id, question.id);

  if (activePoolCount > 0 && allAnswers.length >= activePoolCount) {
    endCurrentQuestionAndReveal(game.id);
  }

  return {
    ok: true,
    answer: savedAnswer,
    snapshot: buildGameStateSnapshot(game.id, false),
  };
}

export function handleTogglePauseAction(gameCode: string) {
  const game = getGameByCode(gameCode);
  if (!game) return { ok: false, error: 'Oyun bulunamadı.' };

  if (game.status === 'PAUSED') {
    const prevStatus = game.previousStatusBeforePause || 'QUESTION';
    if (prevStatus === 'QUESTION') {
      const remainingMs = Math.max(1000, game.remainingMsWhenPaused || 5000);
      const now = Date.now();
      const quiz = getQuizById(game.quizId);
      const currentQ = quiz?.questions[game.currentQuestionIndex];
      const totalMs = (currentQ?.duration || 20) * 1000;
      const elapsedAlready = Math.max(0, totalMs - remainingMs);

      updateGameState(game.id, {
        status: 'QUESTION',
        previousStatusBeforePause: null,
        questionStartedAt: now - elapsedAlready,
        questionEndsAt: now + remainingMs,
        remainingMsWhenPaused: null,
      });
      notifyGameStateChanged(game.id, 'game_resumed');
      scheduleQuestionTimer(game.id, remainingMs);
    } else {
      updateGameState(game.id, {
        status: prevStatus,
        previousStatusBeforePause: null,
        remainingMsWhenPaused: null,
      });
      notifyGameStateChanged(game.id, 'game_resumed');
    }
    return {
      ok: true,
      status: prevStatus,
      snapshot: buildGameStateSnapshot(game.id, true),
    };
  } else {
    clearGameTimers(game.id);
    const now = Date.now();
    const remainingMs =
      game.status === 'QUESTION' && game.questionEndsAt
        ? Math.max(500, game.questionEndsAt - now)
        : null;

    updateGameState(game.id, {
      status: 'PAUSED',
      previousStatusBeforePause: game.status,
      remainingMsWhenPaused: remainingMs,
    });
    notifyGameStateChanged(game.id, 'game_paused');
    return {
      ok: true,
      status: 'PAUSED',
      snapshot: buildGameStateSnapshot(game.id, true),
    };
  }
}

// ============================================================================
// EXPRESS APPLICATION
// ============================================================================

export const app = express();

app.use(cors());
app.use(express.json());

function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const admin = verifyAdminToken(token);
  if (!admin) {
    res.status(401).json({ error: 'Yetkisiz erişim. Lütfen yönetici girişi yapın.' });
    return;
  }
  (req as any).admin = admin;
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
    return;
  }
  const admin = verifyAdmin(String(username).trim(), String(password));
  if (!admin) {
    res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
    return;
  }
  const token = signAdminToken({ id: admin.id, username: admin.username });
  res.json({ token, admin });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ admin: (req as any).admin });
});

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  const stats = getDashboardStats();
  const recentQuizzes = getAllQuizzes().slice(0, 6);
  res.json({
    ...stats,
    recentQuizzes,
  });
});

// --- Questions CRUD ---
app.get('/api/admin/questions', requireAdmin, (_req, res) => {
  res.json({ questions: getAllQuestions() });
});

app.post('/api/admin/questions', requireAdmin, (req, res) => {
  const { text, redOption, blueOption, yellowOption, greenOption, correctColor, duration, mediaUrl, category } =
    req.body || {};
  if (!text || !redOption || !blueOption || !yellowOption || !greenOption || !correctColor) {
    res.status(400).json({ error: 'Lütfen soru metnini, 4 seçeneği ve doğru rengi eksiksiz girin.' });
    return;
  }
  const question = createQuestion({
    text,
    redOption,
    blueOption,
    yellowOption,
    greenOption,
    correctColor,
    duration: Number(duration) || 20,
    mediaUrl,
    category,
  });
  res.status(201).json({ question });
});

app.put('/api/admin/questions/:id', requireAdmin, (req, res) => {
  const { text, redOption, blueOption, yellowOption, greenOption, correctColor, duration, mediaUrl, category } =
    req.body || {};
  const updated = updateQuestion(req.params.id, {
    text,
    redOption,
    blueOption,
    yellowOption,
    greenOption,
    correctColor,
    duration: Number(duration) || 20,
    mediaUrl,
    category,
  });
  if (!updated) {
    res.status(404).json({ error: 'Soru bulunamadı.' });
    return;
  }
  res.json({ question: updated });
});

app.delete('/api/admin/questions/:id', requireAdmin, (req, res) => {
  const ok = deleteQuestion(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Soru bulunamadı.' });
    return;
  }
  res.json({ success: true });
});

app.post('/api/admin/questions/:id/duplicate', requireAdmin, (req, res) => {
  const copy = duplicateQuestion(req.params.id);
  if (!copy) {
    res.status(404).json({ error: 'Soru bulunamadı.' });
    return;
  }
  res.status(201).json({ question: copy });
});

// --- Quizzes CRUD ---
app.get('/api/admin/quizzes', requireAdmin, (_req, res) => {
  res.json({ quizzes: getAllQuizzes() });
});

app.get('/api/admin/quizzes/:id', requireAdmin, (req, res) => {
  const quiz = getQuizById(req.params.id);
  if (!quiz) {
    res.status(404).json({ error: 'Quiz bulunamadı.' });
    return;
  }
  res.json({ quiz });
});

app.post('/api/admin/quizzes', requireAdmin, (req, res) => {
  const { title, description, questionIds } = req.body || {};
  if (!title || !Array.isArray(questionIds) || questionIds.length === 0) {
    res.status(400).json({ error: 'Quiz adı ve en az 1 soru seçimi zorunludur.' });
    return;
  }
  const quiz = createQuiz({ title, description, questionIds });
  res.status(201).json({ quiz });
});

app.put('/api/admin/quizzes/:id', requireAdmin, (req, res) => {
  const { title, description, questionIds } = req.body || {};
  if (!title || !Array.isArray(questionIds) || questionIds.length === 0) {
    res.status(400).json({ error: 'Quiz adı ve en az 1 soru seçimi zorunludur.' });
    return;
  }
  const updated = updateQuiz(req.params.id, { title, description, questionIds });
  if (!updated) {
    res.status(404).json({ error: 'Quiz bulunamadı.' });
    return;
  }
  res.json({ quiz: updated });
});

app.delete('/api/admin/quizzes/:id', requireAdmin, (req, res) => {
  const ok = deleteQuiz(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Quiz bulunamadı.' });
    return;
  }
  res.json({ success: true });
});

app.post('/api/admin/quizzes/:id/duplicate', requireAdmin, (req, res) => {
  const copy = duplicateQuiz(req.params.id);
  if (!copy) {
    res.status(404).json({ error: 'Quiz bulunamadı.' });
    return;
  }
  res.status(201).json({ quiz: copy });
});

// --- Games Management ---
app.post('/api/admin/games', requireAdmin, async (req, res) => {
  const { quizId } = req.body || {};
  if (!quizId) {
    res.status(400).json({ error: 'Quiz seçilmelidir.' });
    return;
  }
  const game = createGameRecord(quizId);
  if (!game) {
    res.status(400).json({ error: 'Seçilen quiz bulunamadı veya içinde soru yok.' });
    return;
  }

  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  const joinUrl = `${origin}/join/${game.gameCode}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    width: 360,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  res.status(201).json({
    game,
    joinUrl,
    qrDataUrl,
  });
});

app.get('/api/admin/games/:gameCode', requireAdmin, async (req, res) => {
  const game = getGameByCode(req.params.gameCode);
  if (!game) {
    res.status(404).json({ error: 'Oyun bulunamadı.' });
    return;
  }
  const snapshot = buildGameStateSnapshot(game.id, true);
  const allAnswers = getAllAnswersForGame(game.id);
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  const joinUrl = `${origin}/join/${game.gameCode}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    width: 360,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  res.json({
    snapshot,
    allAnswers,
    joinUrl,
    qrDataUrl,
  });
});

app.get('/api/games/code/:gameCode', async (req, res) => {
  const game = getGameByCode(req.params.gameCode);
  if (!game) {
    res.status(404).json({ error: 'Bu oyun koduna ait aktif bir yarışma bulunamadı.' });
    return;
  }
  const origin =
    (req.query.origin as string) || req.headers.origin || `${req.protocol}://${req.get('host')}`;
  const joinUrl = `${origin}/join/${game.gameCode}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    width: 360,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
  res.json({
    game: {
      id: game.id,
      gameCode: game.gameCode,
      quizTitle: game.quizTitle,
      status: game.status,
      totalQuestions: game.totalQuestions,
    },
    joinUrl,
    qrDataUrl,
  });
});

// ============================================================================
// SERVERLESS-COMPATIBLE REALTIME HTTP ENDPOINTS (/api/realtime/*)
// ============================================================================

app.get('/api/realtime/state/:gameCode', (req, res) => {
  const game = getGameByCode(req.params.gameCode);
  if (!game) {
    res.status(404).json({ ok: false, error: 'Oyun bulunamadı.' });
    return;
  }
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const isAdmin = Boolean(verifyAdminToken(token));

  const snapshot = buildGameStateSnapshot(game.id, isAdmin);
  res.json({ ok: true, snapshot });
});

app.post('/api/realtime/admin-join', requireAdmin, (req, res) => {
  const game = getGameByCode(req.body?.gameCode || '');
  if (!game) {
    res.status(404).json({ ok: false, error: 'Oyun bulunamadı.' });
    return;
  }
  const snapshot = buildGameStateSnapshot(game.id, true);
  res.json({ ok: true, snapshot });
});

app.post('/api/realtime/join', (req, res) => {
  const result = handlePlayerJoinAction(req.body || {});
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

app.post('/api/realtime/start-game', requireAdmin, (req, res) => {
  const result = handleStartGameAction(req.body?.gameCode || '');
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

app.post('/api/realtime/submit-answer', (req, res) => {
  const result = handleSubmitAnswerAction(req.body || {});
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

app.post('/api/realtime/end-question', requireAdmin, (req, res) => {
  const game = getGameByCode(req.body?.gameCode || '');
  if (!game) {
    res.status(404).json({ ok: false, error: 'Oyun bulunamadı.' });
    return;
  }
  endCurrentQuestionAndReveal(game.id);
  res.json({ ok: true, snapshot: buildGameStateSnapshot(game.id, true) });
});

app.post('/api/realtime/show-leaderboard', requireAdmin, (req, res) => {
  const game = getGameByCode(req.body?.gameCode || '');
  if (!game) {
    res.status(404).json({ ok: false, error: 'Oyun bulunamadı.' });
    return;
  }
  showLeaderboardForGame(game.id);
  res.json({ ok: true, snapshot: buildGameStateSnapshot(game.id, true) });
});

app.post('/api/realtime/next-question', requireAdmin, (req, res) => {
  const game = getGameByCode(req.body?.gameCode || '');
  if (!game) {
    res.status(404).json({ ok: false, error: 'Oyun bulunamadı.' });
    return;
  }
  advanceToNextQuestionOrFinish(game.id);
  res.json({ ok: true, snapshot: buildGameStateSnapshot(game.id, true) });
});

app.post('/api/realtime/toggle-pause', requireAdmin, (req, res) => {
  const result = handleTogglePauseAction(req.body?.gameCode || '');
  if (!result.ok) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

app.post('/api/realtime/toggle-auto-advance', requireAdmin, (req, res) => {
  const game = getGameByCode(req.body?.gameCode || '');
  if (!game) {
    res.status(404).json({ ok: false, error: 'Oyun bulunamadı.' });
    return;
  }
  updateGameState(game.id, { autoAdvance: Boolean(req.body?.autoAdvance) });
  notifyGameStateChanged(game.id);
  res.json({ ok: true, snapshot: buildGameStateSnapshot(game.id, true) });
});

app.post('/api/realtime/finish-game', requireAdmin, (req, res) => {
  const game = getGameByCode(req.body?.gameCode || '');
  if (!game) {
    res.status(404).json({ ok: false, error: 'Oyun bulunamadı.' });
    return;
  }
  finishGame(game.id);
  res.json({ ok: true, snapshot: buildGameStateSnapshot(game.id, true) });
});
