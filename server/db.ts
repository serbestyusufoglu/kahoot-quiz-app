import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
  AdminUser,
  Answer,
  Game,
  GameStatus,
  OptionColor,
  Player,
  Question,
  Quiz,
} from '../shared/types.js';

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);

function getStoreFilePath(): string {
  if (isVercel) {
    return path.join(os.tmpdir(), 'kahoot-arena-db.json');
  }
  try {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, 'kahoot-arena-db.json');
  } catch {
    return path.join(os.tmpdir(), 'kahoot-arena-db.json');
  }
}

const STORE_FILE = getStoreFilePath();
const DEFAULT_ADMIN_ID = 'admin-1';

interface DatabaseSchema {
  admins: Array<{
    id: string;
    username: string;
    passwordHash: string;
    createdAt: string;
  }>;
  questions: Question[];
  quizzes: Array<{
    id: string;
    ownerId?: string;
    title: string;
    description: string;
    questionIds: string[];
    createdAt: string;
  }>;
  games: Array<{
    id: string;
    ownerId?: string;
    gameCode: string;
    quizId: string;
    status: GameStatus;
    previousStatusBeforePause: GameStatus | null;
    currentQuestionIndex: number;
    questionStartedAt: number | null;
    questionEndsAt: number | null;
    remainingMsWhenPaused: number | null;
    autoAdvance: boolean;
    stageEnteredAt?: number | null;
    createdAt: string;
  }>;
  players: Player[];
  answers: Answer[];
}

let memoryStore: DatabaseSchema | null = null;

export function hashPassword(password: string): string {
  const salt = 'kahoot_arena_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function createInitialSeedData(): DatabaseSchema {
  const now = new Date().toISOString();
  const defaultUsername = process.env.DEFAULT_ADMIN_USER || 'admin';
  const defaultPassword = process.env.DEFAULT_ADMIN_PASS || 'admin123';

  const sampleQuestions: Question[] = [
    {
      id: 'q-1',
      ownerId: DEFAULT_ADMIN_ID,
      text: "Dünya'nın doğal uydusu hangisidir?",
      redOption: 'Mars',
      blueOption: 'Ay',
      yellowOption: 'Venüs',
      greenOption: 'Jüpiter',
      correctColor: 'BLUE',
      duration: 20,
      questionType: 'MULTIPLE_CHOICE_4',
      category: 'Fen Bilimleri',
      createdAt: now,
    },
    {
      id: 'q-2',
      ownerId: DEFAULT_ADMIN_ID,
      text: 'Güneş sisteminin merkezinde hangi gök cismi bulunur?',
      redOption: 'Güneş',
      blueOption: 'Dünya',
      yellowOption: 'Satürn',
      greenOption: 'Ay',
      correctColor: 'RED',
      duration: 20,
      questionType: 'MULTIPLE_CHOICE_4',
      category: 'Fen Bilimleri',
      createdAt: now,
    },
    {
      id: 'q-3',
      ownerId: DEFAULT_ADMIN_ID,
      text: "Dünya'nın kendi ekseni etrafında bir tam dönüşü ne kadar sürer?",
      redOption: '365 gün 6 saat',
      blueOption: '1 ay',
      yellowOption: '24 saat (1 gün)',
      greenOption: '12 saat',
      correctColor: 'YELLOW',
      duration: 15,
      questionType: 'MULTIPLE_CHOICE_4',
      category: 'Fen Bilimleri',
      createdAt: now,
    },
    {
      id: 'q-4',
      ownerId: DEFAULT_ADMIN_ID,
      text: "Türkiye'nin başkenti hangi şehrimizdir?",
      redOption: 'Ankara',
      blueOption: 'İstanbul',
      yellowOption: 'İzmir',
      greenOption: 'Bursa',
      correctColor: 'RED',
      duration: 15,
      questionType: 'MULTIPLE_CHOICE_4',
      category: 'Genel Kültür',
      createdAt: now,
    },
    {
      id: 'q-5',
      ownerId: DEFAULT_ADMIN_ID,
      text: 'Hangi gezegen "Kızıl Gezegen" olarak da bilinir?',
      redOption: 'Merkür',
      blueOption: 'Neptün',
      yellowOption: 'Uranüs',
      greenOption: 'Mars',
      correctColor: 'GREEN',
      duration: 20,
      questionType: 'MULTIPLE_CHOICE_4',
      category: 'Fen Bilimleri',
      createdAt: now,
    },
  ];

  return {
    admins: [
      {
        id: DEFAULT_ADMIN_ID,
        username: defaultUsername,
        passwordHash: hashPassword(defaultPassword),
        createdAt: now,
      },
    ],
    questions: sampleQuestions,
    quizzes: [
      {
        id: 'quiz-1',
        ownerId: DEFAULT_ADMIN_ID,
        title: '5. Sınıf Fen Bilimleri – Dünya ve Evren',
        description: 'Güneş sistemi, Dünya ve Ay ünitesi değerlendirme yarışması',
        questionIds: ['q-1', 'q-2', 'q-3', 'q-5'],
        createdAt: now,
      },
      {
        id: 'quiz-2',
        ownerId: DEFAULT_ADMIN_ID,
        title: 'Genel Kültür & Coğrafya Hızlı Yarışma',
        description: 'Sınıf içi genel kültür yarışması',
        questionIds: ['q-4', 'q-1', 'q-2'],
        createdAt: now,
      },
    ],
    games: [],
    players: [],
    answers: [],
  };
}

function readStore(): DatabaseSchema {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (parsed && Array.isArray(parsed.admins) && Array.isArray(parsed.questions)) {
        memoryStore = parsed;
        return parsed;
      }
    }
  } catch {
    // fallback to memoryStore or seed
  }

  if (!memoryStore) {
    memoryStore = createInitialSeedData();
    writeStore(memoryStore);
  }
  return memoryStore;
}

function writeStore(data: DatabaseSchema): void {
  memoryStore = data;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // ignore write error on restricted environments
  }
}

export function initDatabase(): void {
  readStore();
}

function matchesOwner(itemOwnerId: string | undefined, targetOwnerId?: string): boolean {
  if (!targetOwnerId) return true;
  const resolvedOwner = itemOwnerId || DEFAULT_ADMIN_ID;
  return resolvedOwner === targetOwnerId;
}

// --- Admin Queries ---
export function verifyAdmin(username: string, password: string): AdminUser | null {
  const store = readStore();
  const defaultUsername = process.env.DEFAULT_ADMIN_USER || 'admin';
  const defaultPassword = process.env.DEFAULT_ADMIN_PASS || 'admin123';

  const row = store.admins.find(
    (a) => a.username.toLowerCase() === username.trim().toLowerCase()
  );

  if (row && row.passwordHash === hashPassword(password)) {
    return { id: row.id, username: row.username, createdAt: row.createdAt };
  }

  if (
    username.trim().toLowerCase() === defaultUsername.toLowerCase() &&
    password === defaultPassword
  ) {
    return {
      id: DEFAULT_ADMIN_ID,
      username: defaultUsername,
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

export function registerAdmin(
  username: string,
  password: string
): { admin?: AdminUser; error?: string } {
  const store = readStore();
  const cleanUser = username.trim();

  if (cleanUser.length < 3) {
    return { error: 'Kullanıcı adı en az 3 karakter olmalıdır.' };
  }
  if (password.length < 4) {
    return { error: 'Şifre en az 4 karakter olmalıdır.' };
  }

  const defaultUsername = process.env.DEFAULT_ADMIN_USER || 'admin';
  const exists =
    cleanUser.toLowerCase() === defaultUsername.toLowerCase() ||
    store.admins.some((a) => a.username.toLowerCase() === cleanUser.toLowerCase());

  if (exists) {
    return { error: 'Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir ad seçin.' };
  }

  const id = `admin-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  store.admins.push({
    id,
    username: cleanUser,
    passwordHash: hashPassword(password),
    createdAt,
  });

  writeStore(store);
  return {
    admin: {
      id,
      username: cleanUser,
      createdAt,
    },
  };
}

// --- Question Queries ---
export function getAllQuestions(ownerId?: string): Question[] {
  const store = readStore();
  return [...store.questions]
    .filter((q) => matchesOwner(q.ownerId, ownerId))
    .reverse()
    .map((q) => {
      const usedInQuizzes = store.quizzes
        .filter((qz) => matchesOwner(qz.ownerId, ownerId) && qz.questionIds.includes(q.id))
        .map((qz) => ({ id: qz.id, title: qz.title }));
      return {
        ...q,
        ownerId: q.ownerId || DEFAULT_ADMIN_ID,
        usedInQuizzes,
      };
    });
}

export function getQuestionById(id: string): Question | null {
  const store = readStore();
  const q = store.questions.find((item) => item.id === id);
  return q ? { ...q, ownerId: q.ownerId || DEFAULT_ADMIN_ID } : null;
}

export function createQuestion(input: {
  ownerId?: string;
  text: string;
  redOption: string;
  blueOption: string;
  yellowOption: string;
  greenOption: string;
  correctColor: OptionColor;
  duration: number;
  mediaUrl?: string | null;
  category?: string | null;
}): Question {
  const store = readStore();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const duration = Math.max(5, Math.min(300, Math.round(Number(input.duration) || 20)));

  const newQ: Question = {
    id,
    ownerId: input.ownerId || DEFAULT_ADMIN_ID,
    text: input.text.trim(),
    redOption: input.redOption.trim(),
    blueOption: input.blueOption.trim(),
    yellowOption: input.yellowOption.trim(),
    greenOption: input.greenOption.trim(),
    correctColor: input.correctColor,
    duration,
    questionType: 'MULTIPLE_CHOICE_4',
    mediaUrl: input.mediaUrl || null,
    category: input.category || null,
    createdAt,
  };

  store.questions.push(newQ);
  writeStore(store);
  return newQ;
}

export function updateQuestion(
  id: string,
  input: {
    text: string;
    redOption: string;
    blueOption: string;
    yellowOption: string;
    greenOption: string;
    correctColor: OptionColor;
    duration: number;
    mediaUrl?: string | null;
    category?: string | null;
  },
  ownerId?: string
): Question | null {
  const store = readStore();
  const idx = store.questions.findIndex(
    (q) => q.id === id && matchesOwner(q.ownerId, ownerId)
  );
  if (idx === -1) return null;

  const existing = store.questions[idx];
  const duration = Math.max(5, Math.min(300, Math.round(Number(input.duration) || 20)));

  const updated: Question = {
    ...existing,
    text: input.text.trim(),
    redOption: input.redOption.trim(),
    blueOption: input.blueOption.trim(),
    yellowOption: input.yellowOption.trim(),
    greenOption: input.greenOption.trim(),
    correctColor: input.correctColor,
    duration,
    mediaUrl: input.mediaUrl ?? existing.mediaUrl ?? null,
    category: input.category ?? existing.category ?? null,
  };

  store.questions[idx] = updated;
  writeStore(store);
  return updated;
}

export function deleteQuestion(id: string, ownerId?: string): boolean {
  const store = readStore();
  const before = store.questions.length;
  store.questions = store.questions.filter(
    (q) => !(q.id === id && matchesOwner(q.ownerId, ownerId))
  );
  if (store.questions.length === before) return false;

  for (const qz of store.quizzes) {
    if (matchesOwner(qz.ownerId, ownerId)) {
      qz.questionIds = qz.questionIds.filter((qId) => qId !== id);
    }
  }
  writeStore(store);
  return true;
}

export function duplicateQuestion(id: string, ownerId?: string): Question | null {
  const existing = getQuestionById(id);
  if (!existing || !matchesOwner(existing.ownerId, ownerId)) return null;
  return createQuestion({
    ownerId: ownerId || existing.ownerId || DEFAULT_ADMIN_ID,
    text: `${existing.text} (Kopya)`,
    redOption: existing.redOption,
    blueOption: existing.blueOption,
    yellowOption: existing.yellowOption,
    greenOption: existing.greenOption,
    correctColor: existing.correctColor,
    duration: existing.duration,
    mediaUrl: existing.mediaUrl,
    category: existing.category,
  });
}

// --- Quiz Queries ---
export function getQuizById(id: string, ownerId?: string): Quiz | null {
  const store = readStore();
  const qz = store.quizzes.find(
    (item) => item.id === id && matchesOwner(item.ownerId, ownerId)
  );
  if (!qz) return null;

  const qMap = new Map(store.questions.map((q) => [q.id, q]));
  const questions: Question[] = qz.questionIds
    .map((qId) => qMap.get(qId))
    .filter((q): q is Question => Boolean(q));

  return {
    id: qz.id,
    ownerId: qz.ownerId || DEFAULT_ADMIN_ID,
    title: qz.title,
    description: qz.description || '',
    questions,
    questionIds: questions.map((q) => q.id),
    totalQuestions: questions.length,
    createdAt: qz.createdAt,
  };
}

export function getAllQuizzes(ownerId?: string): Quiz[] {
  const store = readStore();
  return [...store.quizzes]
    .filter((qz) => matchesOwner(qz.ownerId, ownerId))
    .reverse()
    .map((qz) => getQuizById(qz.id))
    .filter((qz): qz is Quiz => Boolean(qz));
}

export function createQuiz(input: {
  ownerId?: string;
  title: string;
  description?: string;
  questionIds: string[];
}): Quiz {
  const store = readStore();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  store.quizzes.push({
    id,
    ownerId: input.ownerId || DEFAULT_ADMIN_ID,
    title: input.title.trim(),
    description: (input.description || '').trim(),
    questionIds: [...input.questionIds],
    createdAt,
  });

  writeStore(store);
  return getQuizById(id)!;
}

export function updateQuiz(
  id: string,
  input: {
    title: string;
    description?: string;
    questionIds: string[];
  },
  ownerId?: string
): Quiz | null {
  const store = readStore();
  const idx = store.quizzes.findIndex(
    (qz) => qz.id === id && matchesOwner(qz.ownerId, ownerId)
  );
  if (idx === -1) return null;

  store.quizzes[idx] = {
    ...store.quizzes[idx],
    title: input.title.trim(),
    description: (input.description ?? store.quizzes[idx].description ?? '').trim(),
    questionIds: [...input.questionIds],
  };

  writeStore(store);
  return getQuizById(id);
}

export function deleteQuiz(id: string, ownerId?: string): boolean {
  const store = readStore();
  const before = store.quizzes.length;
  store.quizzes = store.quizzes.filter(
    (qz) => !(qz.id === id && matchesOwner(qz.ownerId, ownerId))
  );
  if (store.quizzes.length === before) return false;
  writeStore(store);
  return true;
}

export function duplicateQuiz(id: string, ownerId?: string): Quiz | null {
  const existing = getQuizById(id, ownerId);
  if (!existing) return null;
  return createQuiz({
    ownerId: ownerId || existing.ownerId || DEFAULT_ADMIN_ID,
    title: `${existing.title} (Kopya)`,
    description: existing.description,
    questionIds: existing.questionIds,
  });
}

// --- Game, Player, Answer Queries ---
export function generateUniqueGameCode(): string {
  const store = readStore();
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exists = store.games.some((g) => g.gameCode === code);
    if (!exists) return code;
  }
  return String(Date.now()).slice(-6);
}

export function createGameRecord(quizId: string, ownerId?: string): Game | null {
  const quiz = getQuizById(quizId, ownerId);
  if (!quiz || quiz.questions.length === 0) return null;

  const store = readStore();
  const id = crypto.randomUUID();
  const gameCode = generateUniqueGameCode();
  const createdAt = new Date().toISOString();

  store.games.push({
    id,
    ownerId: ownerId || quiz.ownerId || DEFAULT_ADMIN_ID,
    gameCode,
    quizId,
    status: 'LOBBY',
    previousStatusBeforePause: null,
    currentQuestionIndex: 0,
    questionStartedAt: null,
    questionEndsAt: null,
    remainingMsWhenPaused: null,
    autoAdvance: false,
    stageEnteredAt: Date.now(),
    createdAt,
  });

  writeStore(store);
  return getGameById(id);
}

export function getGameById(id: string): Game | null {
  const store = readStore();
  const row = store.games.find((g) => g.id === id);
  if (!row) return null;
  const quiz = getQuizById(row.quizId);

  return {
    id: row.id,
    ownerId: row.ownerId || DEFAULT_ADMIN_ID,
    gameCode: row.gameCode,
    quizId: row.quizId,
    quizTitle: quiz?.title || 'Quiz',
    status: row.status,
    previousStatusBeforePause: row.previousStatusBeforePause || null,
    currentQuestionIndex: Number(row.currentQuestionIndex),
    totalQuestions: quiz?.questions.length || 0,
    questionStartedAt: row.questionStartedAt ? Number(row.questionStartedAt) : null,
    questionEndsAt: row.questionEndsAt ? Number(row.questionEndsAt) : null,
    remainingMsWhenPaused:
      row.remainingMsWhenPaused !== null && row.remainingMsWhenPaused !== undefined
        ? Number(row.remainingMsWhenPaused)
        : null,
    autoAdvance: Boolean(row.autoAdvance),
    createdAt: row.createdAt,
  };
}

export function getGameByCode(gameCode: string): Game | null {
  const store = readStore();
  const cleaned = String(gameCode || '').trim();
  const row = store.games.find((g) => g.gameCode === cleaned);
  if (!row) return null;
  return getGameById(row.id);
}

export function getGameStageEnteredAt(gameId: string): number {
  const store = readStore();
  const row = store.games.find((g) => g.id === gameId);
  return row?.stageEnteredAt || Date.now();
}

export function updateGameState(
  gameId: string,
  updates: Partial<{
    status: GameStatus;
    previousStatusBeforePause: GameStatus | null;
    currentQuestionIndex: number;
    questionStartedAt: number | null;
    questionEndsAt: number | null;
    remainingMsWhenPaused: number | null;
    autoAdvance: boolean;
  }>
): Game | null {
  const store = readStore();
  const idx = store.games.findIndex((g) => g.id === gameId);
  if (idx === -1) return null;

  const current = store.games[idx];
  const statusChanged = updates.status !== undefined && updates.status !== current.status;

  store.games[idx] = {
    ...current,
    status: updates.status !== undefined ? updates.status : current.status,
    previousStatusBeforePause:
      updates.previousStatusBeforePause !== undefined
        ? updates.previousStatusBeforePause
        : current.previousStatusBeforePause,
    currentQuestionIndex:
      updates.currentQuestionIndex !== undefined
        ? updates.currentQuestionIndex
        : current.currentQuestionIndex,
    questionStartedAt:
      updates.questionStartedAt !== undefined
        ? updates.questionStartedAt
        : current.questionStartedAt,
    questionEndsAt:
      updates.questionEndsAt !== undefined ? updates.questionEndsAt : current.questionEndsAt,
    remainingMsWhenPaused:
      updates.remainingMsWhenPaused !== undefined
        ? updates.remainingMsWhenPaused
        : current.remainingMsWhenPaused,
    autoAdvance:
      updates.autoAdvance !== undefined ? Boolean(updates.autoAdvance) : current.autoAdvance,
    stageEnteredAt: statusChanged ? Date.now() : current.stageEnteredAt || Date.now(),
  };

  writeStore(store);
  return getGameById(gameId);
}

export function upsertPlayer(params: {
  playerId?: string;
  gameId: string;
  name: string;
}): Player {
  const store = readStore();
  if (params.playerId) {
    const existingIdx = store.players.findIndex(
      (p) => p.id === params.playerId && p.gameId === params.gameId
    );
    if (existingIdx !== -1) {
      store.players[existingIdx].connected = true;
      if (params.name.trim()) {
        store.players[existingIdx].name = params.name.trim();
      }
      writeStore(store);
      return { ...store.players[existingIdx] };
    }
  }

  const id = params.playerId || crypto.randomUUID();
  const joinedAt = new Date().toISOString();
  const newPlayer: Player = {
    id,
    gameId: params.gameId,
    name: params.name.trim() || 'Oyuncu',
    totalScore: 0,
    joinedAt,
    connected: true,
  };

  store.players.push(newPlayer);
  writeStore(store);
  return { ...newPlayer };
}

export function getPlayerById(playerId: string): Player | null {
  const store = readStore();
  const p = store.players.find((item) => item.id === playerId);
  return p ? { ...p } : null;
}

export function setPlayerConnected(playerId: string, connected: boolean): void {
  const store = readStore();
  const p = store.players.find((item) => item.id === playerId);
  if (p) {
    p.connected = connected;
    writeStore(store);
  }
}

export function getPlayersByGame(gameId: string): Player[] {
  const store = readStore();
  return store.players
    .filter((p) => p.gameId === gameId)
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.joinedAt.localeCompare(b.joinedAt);
    })
    .map((p) => ({ ...p }));
}

export function getAnswerForPlayerQuestion(
  gameId: string,
  playerId: string,
  questionId: string
): Answer | null {
  const store = readStore();
  const a = store.answers.find(
    (item) =>
      item.gameId === gameId && item.playerId === playerId && item.questionId === questionId
  );
  return a ? { ...a } : null;
}

export function recordAnswer(params: {
  gameId: string;
  playerId: string;
  questionId: string;
  selectedColor: OptionColor;
  submittedAt: number;
  elapsedSeconds: number;
  isCorrect: boolean;
  score: number;
}): Answer {
  const existing = getAnswerForPlayerQuestion(params.gameId, params.playerId, params.questionId);
  if (existing) return existing;

  const store = readStore();
  const id = crypto.randomUUID();
  const newAnswer: Answer = {
    id,
    gameId: params.gameId,
    playerId: params.playerId,
    questionId: params.questionId,
    selectedColor: params.selectedColor,
    submittedAt: params.submittedAt,
    elapsedSeconds: params.elapsedSeconds,
    isCorrect: params.isCorrect,
    score: params.score,
  };

  store.answers.push(newAnswer);

  if (params.score > 0) {
    const p = store.players.find((item) => item.id === params.playerId);
    if (p) {
      p.totalScore += params.score;
    }
  }

  writeStore(store);
  return newAnswer;
}

export function getAnswersForQuestion(gameId: string, questionId: string): Answer[] {
  const store = readStore();
  const playerMap = new Map(store.players.map((p) => [p.id, p.name]));

  return store.answers
    .filter((a) => a.gameId === gameId && a.questionId === questionId)
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .map((a) => ({
      ...a,
      playerName: playerMap.get(a.playerId) || 'Oyuncu',
    }));
}

export function getAllAnswersForGame(gameId: string): Answer[] {
  const store = readStore();
  const playerMap = new Map(store.players.map((p) => [p.id, p.name]));

  return store.answers
    .filter((a) => a.gameId === gameId)
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .map((a) => ({
      ...a,
      playerName: playerMap.get(a.playerId) || 'Oyuncu',
    }));
}

export function getDashboardStats(ownerId?: string) {
  const store = readStore();
  const userQuestions = store.questions.filter((q) => matchesOwner(q.ownerId, ownerId));
  const userQuizzes = store.quizzes.filter((qz) => matchesOwner(qz.ownerId, ownerId));
  const userGames = store.games.filter((g) => matchesOwner(g.ownerId, ownerId));
  const userGameIds = new Set(userGames.map((g) => g.id));
  const activeGamesList = userGames.filter((g) => g.status !== 'FINISHED');
  const latestActive =
    activeGamesList.length > 0
      ? getGameById(activeGamesList[activeGamesList.length - 1].id)
      : null;

  const userPlayers = store.players.filter((p) => userGameIds.has(p.gameId));

  return {
    totalQuestions: userQuestions.length,
    totalQuizzes: userQuizzes.length,
    activeGames: activeGamesList.length,
    totalPlayers: userPlayers.length,
    latestActiveGame: latestActive,
  };
}
