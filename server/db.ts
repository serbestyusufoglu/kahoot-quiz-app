import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AdminUser,
  Answer,
  Game,
  GameStatus,
  OptionColor,
  Player,
  Question,
  Quiz,
} from '../shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH
  ? path.resolve(__dirname, '..', process.env.DB_PATH)
  : path.join(dataDir, 'kahoot.db');

export const db = new DatabaseSync(dbPath);

// Enable WAL and foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function hashPassword(password: string): string {
  const salt = 'kahoot_arena_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      redOption TEXT NOT NULL,
      blueOption TEXT NOT NULL,
      yellowOption TEXT NOT NULL,
      greenOption TEXT NOT NULL,
      correctColor TEXT NOT NULL CHECK (correctColor IN ('RED', 'BLUE', 'YELLOW', 'GREEN')),
      duration INTEGER NOT NULL DEFAULT 20,
      questionType TEXT NOT NULL DEFAULT 'MULTIPLE_CHOICE_4',
      mediaUrl TEXT,
      category TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      quizId TEXT NOT NULL,
      questionId TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (quizId, questionId),
      FOREIGN KEY (quizId) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      gameCode TEXT UNIQUE NOT NULL,
      quizId TEXT NOT NULL,
      status TEXT NOT NULL,
      previousStatusBeforePause TEXT,
      currentQuestionIndex INTEGER NOT NULL DEFAULT 0,
      questionStartedAt INTEGER,
      questionEndsAt INTEGER,
      remainingMsWhenPaused INTEGER,
      autoAdvance INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (quizId) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      gameId TEXT NOT NULL,
      name TEXT NOT NULL,
      totalScore INTEGER NOT NULL DEFAULT 0,
      joinedAt TEXT NOT NULL,
      connected INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      gameId TEXT NOT NULL,
      playerId TEXT NOT NULL,
      questionId TEXT NOT NULL,
      selectedColor TEXT NOT NULL CHECK (selectedColor IN ('RED', 'BLUE', 'YELLOW', 'GREEN')),
      submittedAt INTEGER NOT NULL,
      elapsedSeconds REAL NOT NULL,
      isCorrect INTEGER NOT NULL,
      score INTEGER NOT NULL,
      UNIQUE(gameId, playerId, questionId),
      FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE
    );
  `);

  // Seed default admin if none exists
  const defaultUsername = process.env.DEFAULT_ADMIN_USER || 'admin';
  const defaultPassword = process.env.DEFAULT_ADMIN_PASS || 'admin123';
  const existingAdmin = db
    .prepare('SELECT id FROM admins WHERE username = ?')
    .get(defaultUsername) as { id: string } | undefined;

  if (!existingAdmin) {
    db.prepare(
      'INSERT INTO admins (id, username, passwordHash, createdAt) VALUES (?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      defaultUsername,
      hashPassword(defaultPassword),
      new Date().toISOString()
    );
  }

  // Seed initial sample questions and quizzes if empty
  const questionCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM questions').get() as { cnt: number }
  ).cnt;

  if (questionCount === 0) {
    const now = new Date().toISOString();
    const sampleQuestions: Array<Omit<Question, 'createdAt'>> = [
      {
        id: crypto.randomUUID(),
        text: "Dünya'nın doğal uydusu hangisidir?",
        redOption: 'Mars',
        blueOption: 'Ay',
        yellowOption: 'Venüs',
        greenOption: 'Jüpiter',
        correctColor: 'BLUE',
        duration: 20,
        questionType: 'MULTIPLE_CHOICE_4',
        category: 'Fen Bilimleri',
      },
      {
        id: crypto.randomUUID(),
        text: 'Güneş sisteminin merkezinde hangi gök cismi bulunur?',
        redOption: 'Güneş',
        blueOption: 'Dünya',
        yellowOption: 'Satürn',
        greenOption: 'Ay',
        correctColor: 'RED',
        duration: 20,
        questionType: 'MULTIPLE_CHOICE_4',
        category: 'Fen Bilimleri',
      },
      {
        id: crypto.randomUUID(),
        text: "Dünya'nın kendi ekseni etrafında bir tam dönüşü ne kadar sürer?",
        redOption: '365 gün 6 saat',
        blueOption: '1 ay',
        yellowOption: '24 saat (1 gün)',
        greenOption: '12 saat',
        correctColor: 'YELLOW',
        duration: 15,
        questionType: 'MULTIPLE_CHOICE_4',
        category: 'Fen Bilimleri',
      },
      {
        id: crypto.randomUUID(),
        text: "Türkiye'nin başkenti hangi şehrimizdir?",
        redOption: 'Ankara',
        blueOption: 'İstanbul',
        yellowOption: 'İzmir',
        greenOption: 'Bursa',
        correctColor: 'RED',
        duration: 15,
        questionType: 'MULTIPLE_CHOICE_4',
        category: 'Genel Kültür',
      },
      {
        id: crypto.randomUUID(),
        text: 'Hangi gezegen "Kızıl Gezegen" olarak da bilinir?',
        redOption: 'Merkür',
        blueOption: 'Neptün',
        yellowOption: 'Uranüs',
        greenOption: 'Mars',
        correctColor: 'GREEN',
        duration: 20,
        questionType: 'MULTIPLE_CHOICE_4',
        category: 'Fen Bilimleri',
      },
    ];

    const insertQ = db.prepare(`
      INSERT INTO questions (
        id, text, redOption, blueOption, yellowOption, greenOption,
        correctColor, duration, questionType, mediaUrl, category, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const q of sampleQuestions) {
      insertQ.run(
        q.id,
        q.text,
        q.redOption,
        q.blueOption,
        q.yellowOption,
        q.greenOption,
        q.correctColor,
        q.duration,
        q.questionType || 'MULTIPLE_CHOICE_4',
        q.mediaUrl || null,
        q.category || null,
        now
      );
    }

    const quizId = crypto.randomUUID();
    db.prepare(
      'INSERT INTO quizzes (id, title, description, createdAt) VALUES (?, ?, ?, ?)'
    ).run(
      quizId,
      '5. Sınıf Fen Bilimleri – Dünya ve Evren',
      'Güneş sistemi, Dünya ve Ay ünitesi değerlendirme yarışması',
      now
    );

    const insertQQ = db.prepare(
      'INSERT INTO quiz_questions (quizId, questionId, position) VALUES (?, ?, ?)'
    );
    [sampleQuestions[0], sampleQuestions[1], sampleQuestions[2], sampleQuestions[4]].forEach(
      (q, idx) => {
        insertQQ.run(quizId, q.id, idx);
      }
    );
  }
}

// --- Admin Queries ---
export function verifyAdmin(username: string, password: string): AdminUser | null {
  const row = db
    .prepare('SELECT id, username, passwordHash, createdAt FROM admins WHERE username = ?')
    .get(username) as
    | { id: string; username: string; passwordHash: string; createdAt: string }
    | undefined;
  if (!row) return null;
  if (row.passwordHash !== hashPassword(password)) return null;
  return { id: row.id, username: row.username, createdAt: row.createdAt };
}

// --- Question Queries ---
export function getAllQuestions(): Question[] {
  const rows = db
    .prepare('SELECT * FROM questions ORDER BY datetime(createdAt) DESC, rowid DESC')
    .all() as any[];

  const quizLinks = db
    .prepare(
      `SELECT qq.questionId, qz.id as quizId, qz.title as quizTitle
       FROM quiz_questions qq
       JOIN quizzes qz ON qz.id = qq.quizId`
    )
    .all() as Array<{ questionId: string; quizId: string; quizTitle: string }>;

  const mapByQuestion = new Map<string, Array<{ id: string; title: string }>>();
  for (const link of quizLinks) {
    if (!mapByQuestion.has(link.questionId)) {
      mapByQuestion.set(link.questionId, []);
    }
    mapByQuestion.get(link.questionId)!.push({ id: link.quizId, title: link.quizTitle });
  }

  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    redOption: r.redOption,
    blueOption: r.blueOption,
    yellowOption: r.yellowOption,
    greenOption: r.greenOption,
    correctColor: r.correctColor as OptionColor,
    duration: Number(r.duration),
    questionType: r.questionType || 'MULTIPLE_CHOICE_4',
    mediaUrl: r.mediaUrl || null,
    category: r.category || null,
    createdAt: r.createdAt,
    usedInQuizzes: mapByQuestion.get(r.id) || [],
  }));
}

export function getQuestionById(id: string): Question | null {
  const r = db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as any;
  if (!r) return null;
  return {
    id: r.id,
    text: r.text,
    redOption: r.redOption,
    blueOption: r.blueOption,
    yellowOption: r.yellowOption,
    greenOption: r.greenOption,
    correctColor: r.correctColor as OptionColor,
    duration: Number(r.duration),
    questionType: r.questionType || 'MULTIPLE_CHOICE_4',
    mediaUrl: r.mediaUrl || null,
    category: r.category || null,
    createdAt: r.createdAt,
  };
}

export function createQuestion(input: {
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
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const duration = Math.max(5, Math.min(300, Math.round(Number(input.duration) || 20)));

  db.prepare(
    `INSERT INTO questions (
      id, text, redOption, blueOption, yellowOption, greenOption,
      correctColor, duration, questionType, mediaUrl, category, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MULTIPLE_CHOICE_4', ?, ?, ?)`
  ).run(
    id,
    input.text.trim(),
    input.redOption.trim(),
    input.blueOption.trim(),
    input.yellowOption.trim(),
    input.greenOption.trim(),
    input.correctColor,
    duration,
    input.mediaUrl || null,
    input.category || null,
    createdAt
  );

  return getQuestionById(id)!;
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
  }
): Question | null {
  const existing = getQuestionById(id);
  if (!existing) return null;
  const duration = Math.max(5, Math.min(300, Math.round(Number(input.duration) || 20)));

  db.prepare(
    `UPDATE questions
     SET text = ?, redOption = ?, blueOption = ?, yellowOption = ?, greenOption = ?,
         correctColor = ?, duration = ?, mediaUrl = ?, category = ?
     WHERE id = ?`
  ).run(
    input.text.trim(),
    input.redOption.trim(),
    input.blueOption.trim(),
    input.yellowOption.trim(),
    input.greenOption.trim(),
    input.correctColor,
    duration,
    input.mediaUrl ?? existing.mediaUrl ?? null,
    input.category ?? existing.category ?? null,
    id
  );

  return getQuestionById(id);
}

export function deleteQuestion(id: string): boolean {
  const res = db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  return res.changes > 0;
}

export function duplicateQuestion(id: string): Question | null {
  const existing = getQuestionById(id);
  if (!existing) return null;
  return createQuestion({
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
export function getAllQuizzes(): Quiz[] {
  const quizzes = db
    .prepare('SELECT * FROM quizzes ORDER BY datetime(createdAt) DESC, rowid DESC')
    .all() as any[];

  return quizzes.map((qz) => getQuizById(qz.id)!).filter(Boolean);
}

export function getQuizById(id: string): Quiz | null {
  const qz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id) as any;
  if (!qz) return null;

  const qRows = db
    .prepare(
      `SELECT q.*, qq.position
       FROM quiz_questions qq
       JOIN questions q ON q.id = qq.questionId
       WHERE qq.quizId = ?
       ORDER BY qq.position ASC`
    )
    .all(id) as any[];

  const questions: Question[] = qRows.map((r) => ({
    id: r.id,
    text: r.text,
    redOption: r.redOption,
    blueOption: r.blueOption,
    yellowOption: r.yellowOption,
    greenOption: r.greenOption,
    correctColor: r.correctColor as OptionColor,
    duration: Number(r.duration),
    questionType: r.questionType || 'MULTIPLE_CHOICE_4',
    mediaUrl: r.mediaUrl || null,
    category: r.category || null,
    createdAt: r.createdAt,
  }));

  return {
    id: qz.id,
    title: qz.title,
    description: qz.description || '',
    questions,
    questionIds: questions.map((q) => q.id),
    totalQuestions: questions.length,
    createdAt: qz.createdAt,
  };
}

export function createQuiz(input: {
  title: string;
  description?: string;
  questionIds: string[];
}): Quiz {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare('INSERT INTO quizzes (id, title, description, createdAt) VALUES (?, ?, ?, ?)').run(
    id,
    input.title.trim(),
    (input.description || '').trim(),
    createdAt
  );

  const insertQQ = db.prepare(
    'INSERT OR IGNORE INTO quiz_questions (quizId, questionId, position) VALUES (?, ?, ?)'
  );
  input.questionIds.forEach((qId, idx) => {
    insertQQ.run(id, qId, idx);
  });

  return getQuizById(id)!;
}

export function updateQuiz(
  id: string,
  input: {
    title: string;
    description?: string;
    questionIds: string[];
  }
): Quiz | null {
  const existing = getQuizById(id);
  if (!existing) return null;

  db.prepare('UPDATE quizzes SET title = ?, description = ? WHERE id = ?').run(
    input.title.trim(),
    (input.description ?? existing.description ?? '').trim(),
    id
  );

  db.prepare('DELETE FROM quiz_questions WHERE quizId = ?').run(id);
  const insertQQ = db.prepare(
    'INSERT OR IGNORE INTO quiz_questions (quizId, questionId, position) VALUES (?, ?, ?)'
  );
  input.questionIds.forEach((qId, idx) => {
    insertQQ.run(id, qId, idx);
  });

  return getQuizById(id);
}

export function deleteQuiz(id: string): boolean {
  const res = db.prepare('DELETE FROM quizzes WHERE id = ?').run(id);
  return res.changes > 0;
}

export function duplicateQuiz(id: string): Quiz | null {
  const existing = getQuizById(id);
  if (!existing) return null;
  return createQuiz({
    title: `${existing.title} (Kopya)`,
    description: existing.description,
    questionIds: existing.questionIds,
  });
}

// --- Game, Player, Answer Queries ---
export function generateUniqueGameCode(): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exists = db.prepare('SELECT id FROM games WHERE gameCode = ?').get(code);
    if (!exists) return code;
  }
  return String(Date.now()).slice(-6);
}

export function createGameRecord(quizId: string): Game | null {
  const quiz = getQuizById(quizId);
  if (!quiz || quiz.questions.length === 0) return null;

  const id = crypto.randomUUID();
  const gameCode = generateUniqueGameCode();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO games (
      id, gameCode, quizId, status, previousStatusBeforePause,
      currentQuestionIndex, questionStartedAt, questionEndsAt, remainingMsWhenPaused, autoAdvance, createdAt
    ) VALUES (?, ?, ?, 'LOBBY', NULL, 0, NULL, NULL, NULL, 0, ?)`
  ).run(id, gameCode, quizId, createdAt);

  return getGameById(id);
}

export function getGameById(id: string): Game | null {
  const row = db
    .prepare(
      `SELECT g.*, qz.title as quizTitle
       FROM games g
       JOIN quizzes qz ON qz.id = g.quizId
       WHERE g.id = ?`
    )
    .get(id) as any;
  if (!row) return null;
  const qCount = (
    db
      .prepare('SELECT COUNT(*) as cnt FROM quiz_questions WHERE quizId = ?')
      .get(row.quizId) as { cnt: number }
  ).cnt;

  return {
    id: row.id,
    gameCode: row.gameCode,
    quizId: row.quizId,
    quizTitle: row.quizTitle,
    status: row.status as GameStatus,
    previousStatusBeforePause: (row.previousStatusBeforePause as GameStatus) || null,
    currentQuestionIndex: Number(row.currentQuestionIndex),
    totalQuestions: qCount,
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
  const row = db
    .prepare('SELECT id FROM games WHERE gameCode = ?')
    .get(gameCode.trim()) as { id: string } | undefined;
  if (!row) return null;
  return getGameById(row.id);
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
  const current = getGameById(gameId);
  if (!current) return null;

  const nextStatus = updates.status !== undefined ? updates.status : current.status;
  const nextPrevStatus =
    updates.previousStatusBeforePause !== undefined
      ? updates.previousStatusBeforePause
      : current.previousStatusBeforePause;
  const nextIndex =
    updates.currentQuestionIndex !== undefined
      ? updates.currentQuestionIndex
      : current.currentQuestionIndex;
  const nextStarted =
    updates.questionStartedAt !== undefined
      ? updates.questionStartedAt
      : current.questionStartedAt;
  const nextEnds =
    updates.questionEndsAt !== undefined ? updates.questionEndsAt : current.questionEndsAt;
  const nextRem =
    updates.remainingMsWhenPaused !== undefined
      ? updates.remainingMsWhenPaused
      : current.remainingMsWhenPaused;
  const nextAuto =
    updates.autoAdvance !== undefined ? (updates.autoAdvance ? 1 : 0) : current.autoAdvance ? 1 : 0;

  db.prepare(
    `UPDATE games
     SET status = ?,
         previousStatusBeforePause = ?,
         currentQuestionIndex = ?,
         questionStartedAt = ?,
         questionEndsAt = ?,
         remainingMsWhenPaused = ?,
         autoAdvance = ?
     WHERE id = ?`
  ).run(
    nextStatus,
    nextPrevStatus,
    nextIndex,
    nextStarted,
    nextEnds,
    nextRem,
    nextAuto,
    gameId
  );

  return getGameById(gameId);
}

export function upsertPlayer(params: {
  playerId?: string;
  gameId: string;
  name: string;
}): Player {
  if (params.playerId) {
    const existing = db
      .prepare('SELECT * FROM players WHERE id = ? AND gameId = ?')
      .get(params.playerId, params.gameId) as any;
    if (existing) {
      db.prepare('UPDATE players SET connected = 1, name = ? WHERE id = ?').run(
        params.name.trim() || existing.name,
        existing.id
      );
      return getPlayerById(existing.id)!;
    }
  }

  const id = params.playerId || crypto.randomUUID();
  const joinedAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO players (id, gameId, name, totalScore, joinedAt, connected) VALUES (?, ?, ?, 0, ?, 1)'
  ).run(id, params.gameId, params.name.trim(), joinedAt);

  return getPlayerById(id)!;
}

export function getPlayerById(playerId: string): Player | null {
  const r = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as any;
  if (!r) return null;
  return {
    id: r.id,
    gameId: r.gameId,
    name: r.name,
    totalScore: Number(r.totalScore),
    joinedAt: r.joinedAt,
    connected: Boolean(r.connected),
  };
}

export function setPlayerConnected(playerId: string, connected: boolean): void {
  db.prepare('UPDATE players SET connected = ? WHERE id = ?').run(connected ? 1 : 0, playerId);
}

export function getPlayersByGame(gameId: string): Player[] {
  const rows = db
    .prepare('SELECT * FROM players WHERE gameId = ? ORDER BY totalScore DESC, joinedAt ASC')
    .all(gameId) as any[];
  return rows.map((r) => ({
    id: r.id,
    gameId: r.gameId,
    name: r.name,
    totalScore: Number(r.totalScore),
    joinedAt: r.joinedAt,
    connected: Boolean(r.connected),
  }));
}

export function getAnswerForPlayerQuestion(
  gameId: string,
  playerId: string,
  questionId: string
): Answer | null {
  const r = db
    .prepare('SELECT * FROM answers WHERE gameId = ? AND playerId = ? AND questionId = ?')
    .get(gameId, playerId, questionId) as any;
  if (!r) return null;
  return {
    id: r.id,
    gameId: r.gameId,
    playerId: r.playerId,
    questionId: r.questionId,
    selectedColor: r.selectedColor as OptionColor,
    submittedAt: Number(r.submittedAt),
    elapsedSeconds: Number(r.elapsedSeconds),
    isCorrect: Boolean(r.isCorrect),
    score: Number(r.score),
  };
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
  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO answers (
      id, gameId, playerId, questionId, selectedColor, submittedAt, elapsedSeconds, isCorrect, score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.gameId,
    params.playerId,
    params.questionId,
    params.selectedColor,
    params.submittedAt,
    params.elapsedSeconds,
    params.isCorrect ? 1 : 0,
    params.score
  );

  if (params.score > 0) {
    db.prepare('UPDATE players SET totalScore = totalScore + ? WHERE id = ?').run(
      params.score,
      params.playerId
    );
  }

  return getAnswerForPlayerQuestion(params.gameId, params.playerId, params.questionId)!;
}

export function getAnswersForQuestion(gameId: string, questionId: string): Answer[] {
  const rows = db
    .prepare(
      `SELECT a.*, p.name as playerName
       FROM answers a
       JOIN players p ON p.id = a.playerId
       WHERE a.gameId = ? AND a.questionId = ?
       ORDER BY a.submittedAt ASC`
    )
    .all(gameId, questionId) as any[];

  return rows.map((r) => ({
    id: r.id,
    gameId: r.gameId,
    playerId: r.playerId,
    playerName: r.playerName,
    questionId: r.questionId,
    selectedColor: r.selectedColor as OptionColor,
    submittedAt: Number(r.submittedAt),
    elapsedSeconds: Number(r.elapsedSeconds),
    isCorrect: Boolean(r.isCorrect),
    score: Number(r.score),
  }));
}

export function getAllAnswersForGame(gameId: string): Answer[] {
  const rows = db
    .prepare(
      `SELECT a.*, p.name as playerName
       FROM answers a
       JOIN players p ON p.id = a.playerId
       WHERE a.gameId = ?
       ORDER BY a.submittedAt ASC`
    )
    .all(gameId) as any[];

  return rows.map((r) => ({
    id: r.id,
    gameId: r.gameId,
    playerId: r.playerId,
    playerName: r.playerName,
    questionId: r.questionId,
    selectedColor: r.selectedColor as OptionColor,
    submittedAt: Number(r.submittedAt),
    elapsedSeconds: Number(r.elapsedSeconds),
    isCorrect: Boolean(r.isCorrect),
    score: Number(r.score),
  }));
}

export function getDashboardStats() {
  const totalQuestions = (
    db.prepare('SELECT COUNT(*) as cnt FROM questions').get() as { cnt: number }
  ).cnt;
  const totalQuizzes = (
    db.prepare('SELECT COUNT(*) as cnt FROM quizzes').get() as { cnt: number }
  ).cnt;
  const activeGames = (
    db
      .prepare("SELECT COUNT(*) as cnt FROM games WHERE status != 'FINISHED'")
      .get() as { cnt: number }
  ).cnt;
  const totalPlayers = (
    db.prepare('SELECT COUNT(*) as cnt FROM players').get() as { cnt: number }
  ).cnt;

  const activeGameRow = db
    .prepare(
      "SELECT id FROM games WHERE status != 'FINISHED' ORDER BY datetime(createdAt) DESC LIMIT 1"
    )
    .get() as { id: string } | undefined;

  return {
    totalQuestions,
    totalQuizzes,
    activeGames,
    totalPlayers,
    latestActiveGame: activeGameRow ? getGameById(activeGameRow.id) : null,
  };
}
