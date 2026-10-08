export type OptionColor = 'RED' | 'BLUE' | 'YELLOW' | 'GREEN';

export type QuestionType = 'MULTIPLE_CHOICE_4' | 'TRUE_FALSE' | 'OPEN_ENDED' | 'IMAGE' | 'VIDEO' | 'AUDIO';

export type GameStatus =
  | 'LOBBY'
  | 'STARTING'
  | 'QUESTION'
  | 'ANSWER_REVEAL'
  | 'LEADERBOARD'
  | 'PAUSED'
  | 'FINISHED';

export interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface Question {
  id: string;
  ownerId?: string;
  text: string;
  redOption: string;
  blueOption: string;
  yellowOption: string;
  greenOption: string;
  correctColor: OptionColor;
  duration: number; // in seconds
  questionType?: QuestionType;
  mediaUrl?: string | null;
  category?: string | null;
  createdAt: string;
  usedInQuizzes?: { id: string; title: string }[];
}

export interface Quiz {
  id: string;
  ownerId?: string;
  title: string;
  description?: string;
  questions: Question[];
  questionIds: string[];
  totalQuestions: number;
  createdAt: string;
}

export interface Player {
  id: string;
  gameId: string;
  name: string;
  totalScore: number;
  joinedAt: string;
  connected: boolean;
  lastAnswer?: {
    questionId: string;
    selectedColor: OptionColor;
    isCorrect: boolean;
    score: number;
    elapsedSeconds: number;
  } | null;
}

export interface Answer {
  id: string;
  gameId: string;
  playerId: string;
  playerName?: string;
  questionId: string;
  selectedColor: OptionColor;
  submittedAt: number; // epoch ms (server timestamp)
  elapsedSeconds: number; // e.g. 4.215
  isCorrect: boolean;
  score: number;
}

export interface Game {
  id: string;
  ownerId?: string;
  gameCode: string;
  quizId: string;
  quizTitle: string;
  status: GameStatus;
  previousStatusBeforePause?: GameStatus | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  questionStartedAt: number | null; // epoch ms
  questionEndsAt: number | null; // epoch ms
  remainingMsWhenPaused: number | null;
  autoAdvance: boolean;
  createdAt: string;
}

export interface ActiveQuestionPublic {
  index: number;
  total: number;
  id: string;
  text: string;
  redOption: string;
  blueOption: string;
  yellowOption: string;
  greenOption: string;
  duration: number;
  mediaUrl?: string | null;
  correctColor?: OptionColor; // Only populated in ANSWER_REVEAL / FINISHED or for Admin
}

export interface QuestionResultEntry {
  playerId: string;
  playerName: string;
  selectedColor: OptionColor | null;
  isCorrect: boolean;
  score: number;
  totalScore: number;
  elapsedSeconds: number | null;
  submittedAt: number | null;
}

export interface GameStateSnapshot {
  game: Game;
  serverTime: number;
  players: Player[];
  currentQuestion: ActiveQuestionPublic | null;
  answeredCount: number;
  totalPlayers: number;
  questionResults?: {
    correctColor: OptionColor;
    correctOptionText: string;
    colorCounts: Record<OptionColor, number>;
    results: QuestionResultEntry[];
  } | null;
  leaderboard: Player[];
}

export const COLOR_META: Record<
  OptionColor,
  {
    key: OptionColor;
    label: string;
    shapeName: string;
    emoji: string;
    bgClass: string;
    hoverClass: string;
    borderClass: string;
    badgeClass: string;
    hex: string;
  }
> = {
  RED: {
    key: 'RED',
    label: 'Kırmızı',
    shapeName: 'Daire',
    emoji: '●',
    bgClass: 'bg-[#E21B3C]',
    hoverClass: 'hover:bg-[#C81533]',
    borderClass: 'border-[#ff4d6a]',
    badgeClass: 'bg-rose-50 text-[#E21B3C] border-rose-200',
    hex: '#E21B3C',
  },
  BLUE: {
    key: 'BLUE',
    label: 'Mavi',
    shapeName: 'Üçgen',
    emoji: '▲',
    bgClass: 'bg-[#1368CE]',
    hoverClass: 'hover:bg-[#0F56AC]',
    borderClass: 'border-[#4592f5]',
    badgeClass: 'bg-sky-50 text-[#1368CE] border-sky-200',
    hex: '#1368CE',
  },
  YELLOW: {
    key: 'YELLOW',
    label: 'Sarı',
    shapeName: 'Altıgen',
    emoji: '⬢',
    bgClass: 'bg-[#D89E00]',
    hoverClass: 'hover:bg-[#B88600]',
    borderClass: 'border-[#ffc125]',
    badgeClass: 'bg-amber-50 text-[#B88600] border-amber-200',
    hex: '#D89E00',
  },
  GREEN: {
    key: 'GREEN',
    label: 'Yeşil',
    shapeName: 'Kare',
    emoji: '■',
    bgClass: 'bg-[#26890C]',
    hoverClass: 'hover:bg-[#1E6E09]',
    borderClass: 'border-[#46b828]',
    badgeClass: 'bg-emerald-50 text-[#26890C] border-emerald-200',
    hex: '#26890C',
  },
};
