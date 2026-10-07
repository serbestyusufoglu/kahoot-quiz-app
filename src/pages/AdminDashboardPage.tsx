import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  HelpCircle,
  ListChecks,
  Plus,
  Play,
  Edit3,
  Trash2,
  Copy,
  LogOut,
  Users,
  Gamepad2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  apiFetch,
  clearAdminSession,
  getAdminToken,
  getAdminUsername,
} from '../utils/api.ts';
import {
  COLOR_META,
  type Game,
  type OptionColor,
  type Question,
  type Quiz,
} from '../../shared/types.ts';

type AdminTab = 'dashboard' | 'questions' | 'quizzes';

const PRESET_DURATIONS = [10, 15, 20, 30, 45, 60];

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<{
    totalQuestions: number;
    totalQuizzes: number;
    activeGames: number;
    totalPlayers: number;
    latestActiveGame: Game | null;
  }>({
    totalQuestions: 0,
    totalQuizzes: 0,
    activeGames: 0,
    totalPlayers: 0,
    latestActiveGame: null,
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  // Question Modal State
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [qText, setQText] = useState('');
  const [qRed, setQRed] = useState('');
  const [qBlue, setQBlue] = useState('');
  const [qYellow, setQYellow] = useState('');
  const [qGreen, setQGreen] = useState('');
  const [qCorrectColor, setQCorrectColor] = useState<OptionColor>('RED');
  const [qDuration, setQDuration] = useState<number>(20);
  const [qCustomDuration, setQCustomDuration] = useState<string>('');
  const [qSaving, setQSaving] = useState(false);

  // Quiz Modal State
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [quizSaving, setQuizSaving] = useState(false);

  const loadAllData = async () => {
    if (!getAdminToken()) {
      navigate('/admin/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dashRes, qRes, qzRes] = await Promise.all([
        apiFetch('/api/admin/dashboard'),
        apiFetch<{ questions: Question[] }>('/api/admin/questions'),
        apiFetch<{ quizzes: Quiz[] }>('/api/admin/quizzes'),
      ]);
      setStats({
        totalQuestions: dashRes.totalQuestions,
        totalQuizzes: dashRes.totalQuizzes,
        activeGames: dashRes.activeGames,
        totalPlayers: dashRes.totalPlayers,
        latestActiveGame: dashRes.latestActiveGame,
      });
      setQuestions(qRes.questions);
      setQuizzes(qzRes.quizzes);
    } catch (err: any) {
      if (String(err.message).includes('Yetkisiz')) {
        clearAdminSession();
        navigate('/admin/login');
        return;
      }
      setError(err.message || 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleLogout = () => {
    clearAdminSession();
    navigate('/');
  };

  const openCreateQuestionModal = () => {
    setEditingQuestion(null);
    setQText('');
    setQRed('');
    setQBlue('');
    setQYellow('');
    setQGreen('');
    setQCorrectColor('RED');
    setQDuration(20);
    setQCustomDuration('');
    setQuestionModalOpen(true);
  };

  const openEditQuestionModal = (q: Question) => {
    setEditingQuestion(q);
    setQText(q.text);
    setQRed(q.redOption);
    setQBlue(q.blueOption);
    setQYellow(q.yellowOption);
    setQGreen(q.greenOption);
    setQCorrectColor(q.correctColor);
    setQDuration(q.duration);
    setQCustomDuration(PRESET_DURATIONS.includes(q.duration) ? '' : String(q.duration));
    setQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setQSaving(true);
    setError(null);
    const finalDuration = qCustomDuration.trim()
      ? Math.max(5, Math.min(300, Number(qCustomDuration)))
      : qDuration;

    try {
      if (editingQuestion) {
        await apiFetch(`/api/admin/questions/${editingQuestion.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            text: qText,
            redOption: qRed,
            blueOption: qBlue,
            yellowOption: qYellow,
            greenOption: qGreen,
            correctColor: qCorrectColor,
            duration: finalDuration,
          }),
        });
      } else {
        await apiFetch('/api/admin/questions', {
          method: 'POST',
          body: JSON.stringify({
            text: qText,
            redOption: qRed,
            blueOption: qBlue,
            yellowOption: qYellow,
            greenOption: qGreen,
            correctColor: qCorrectColor,
            duration: finalDuration,
          }),
        });
      }
      setQuestionModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setQSaving(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await apiFetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
      await loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDuplicateQuestion = async (id: string) => {
    try {
      await apiFetch(`/api/admin/questions/${id}/duplicate`, { method: 'POST' });
      await loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openCreateQuizModal = () => {
    setEditingQuiz(null);
    setQuizTitle('');
    setQuizDescription('');
    setSelectedQuestionIds(questions.slice(0, 3).map((q) => q.id));
    setQuizModalOpen(true);
  };

  const openEditQuizModal = (qz: Quiz) => {
    setEditingQuiz(qz);
    setQuizTitle(qz.title);
    setQuizDescription(qz.description || '');
    setSelectedQuestionIds([...qz.questionIds]);
    setQuizModalOpen(true);
  };

  const toggleQuestionInQuiz = (qId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const moveQuestionInQuiz = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedQuestionIds.length) return;
    const next = [...selectedQuestionIds];
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    setSelectedQuestionIds(next);
  };

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const next = [...selectedQuestionIds];
    const [draggedItem] = next.splice(draggedIdx, 1);
    next.splice(idx, 0, draggedItem);
    setSelectedQuestionIds(next);
    setDraggedIdx(idx);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedQuestionIds.length === 0) {
      setError('Lütfen quize en az 1 soru ekleyin.');
      return;
    }
    setQuizSaving(true);
    setError(null);
    try {
      if (editingQuiz) {
        await apiFetch(`/api/admin/quizzes/${editingQuiz.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: quizTitle,
            description: quizDescription,
            questionIds: selectedQuestionIds,
          }),
        });
      } else {
        await apiFetch('/api/admin/quizzes', {
          method: 'POST',
          body: JSON.stringify({
            title: quizTitle,
            description: quizDescription,
            questionIds: selectedQuestionIds,
          }),
        });
      }
      setQuizModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setQuizSaving(false);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    try {
      await apiFetch(`/api/admin/quizzes/${id}`, { method: 'DELETE' });
      await loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDuplicateQuiz = async (id: string) => {
    try {
      await apiFetch(`/api/admin/quizzes/${id}/duplicate`, { method: 'POST' });
      await loadAllData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStartGame = async (quizId: string) => {
    setError(null);
    try {
      const res = await apiFetch<{ game: Game }>('/api/admin/games', {
        method: 'POST',
        body: JSON.stringify({ quizId }),
      });
      navigate(`/admin/game/${res.game.gameCode}`);
    } catch (err: any) {
      setError(err.message || 'Oyun başlatılamadı.');
    }
  };

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Dark Contrast Sidebar (#0f172a) with Bright Emerald Active State */}
      <aside className="w-full md:w-64 bg-[#0f172a] text-white flex flex-col justify-between shrink-0 shadow-xl">
        <div>
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="grid grid-cols-2 gap-0.5 p-1.5 bg-white/10 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#E21B3C]" />
                <span className="w-2.5 h-2.5 rounded-xs bg-[#1368CE]" />
                <span className="w-2.5 h-2.5 rounded-xs bg-[#D89E00]" />
                <span className="w-2.5 h-2.5 rounded-xs bg-[#26890C]" />
              </div>
              <div>
                <span className="text-lg font-extrabold tracking-tight text-white">
                  Bilgi<span className="text-[#10b981]">Arena</span>
                </span>
                <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  Yönetici Paneli
                </span>
              </div>
            </Link>
          </div>

          <nav className="p-3 flex md:flex-col gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-[#10b981] text-slate-950 shadow-lg shadow-emerald-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Genel Bakış</span>
            </button>

            <button
              onClick={() => setActiveTab('questions')}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition whitespace-nowrap ${
                activeTab === 'questions'
                  ? 'bg-[#10b981] text-slate-950 shadow-lg shadow-emerald-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4" />
                <span>Soru Havuzu</span>
              </span>
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'questions' ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-300'
                }`}
              >
                {questions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('quizzes')}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition whitespace-nowrap ${
                activeTab === 'quizzes'
                  ? 'bg-[#10b981] text-slate-950 shadow-lg shadow-emerald-500/25'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="flex items-center gap-3">
                <ListChecks className="w-4 h-4" />
                <span>Quiz Yönetimi</span>
              </span>
              <span
                className={`ml-2 text-xs px-2 py-0.5 rounded-full font-extrabold ${
                  activeTab === 'quizzes' ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-300'
                }`}
              >
                {quizzes.length}
              </span>
            </button>
          </nav>
        </div>

        <div className="hidden md:flex p-4 border-t border-white/10 items-center justify-between">
          <div className="text-xs">
            <span className="text-slate-400 block">Aktif Yönetici</span>
            <span className="font-bold text-white">{getAdminUsername() || 'admin'}</span>
          </div>
          <button
            onClick={handleLogout}
            title="Çıkış Yap"
            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content (Soft White / Light Gray Theme) */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Special Status Card: Active Game Banner (#0f172a Dark Contrast + Bright Emerald Button) */}
        {stats.latestActiveGame && (
          <div className="mb-6 p-5 rounded-2xl bg-[#0f172a] text-white border border-slate-800 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="w-3 h-3 rounded-full bg-[#10b981] animate-ping" />
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#10b981]">
                  Aktif Yarışma Devam Ediyor ({stats.latestActiveGame.status})
                </div>
                <div className="text-base font-extrabold text-white mt-0.5">
                  {stats.latestActiveGame.quizTitle} — Oyun Kodu:{' '}
                  <span className="font-mono text-[#0ea5e9]">
                    {stats.latestActiveGame.gameCode}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate(`/admin/game/${stats.latestActiveGame!.gameCode}`)}
              className="px-4 py-2.5 rounded-2xl bg-[#10b981] hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 transition shrink-0 shadow-md shadow-emerald-500/20"
            >
              <span>CANLI EKRANA GİT</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                  Yönetici Kontrol Paneli
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Soru havuzunu yönetin, quiz oluşturun ve tek tıkla sınıf yarışmasını başlatın.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={openCreateQuestionModal}
                  className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 shadow-sm text-sm font-bold text-slate-800 flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4 text-[#0ea5e9]" />
                  <span>Yeni Soru</span>
                </button>
                <button
                  onClick={openCreateQuizModal}
                  className="px-4 py-2.5 rounded-2xl bg-[#10b981] hover:bg-emerald-600 text-sm font-extrabold text-white flex items-center gap-2 shadow-md shadow-emerald-500/25 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>YENİ QUIZ OLUŞTUR</span>
                </button>
              </div>
            </div>

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                  <span>Toplam Soru</span>
                  <HelpCircle className="w-4 h-4 text-[#10b981]" />
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-2">
                  {stats.totalQuestions}
                </div>
                <button
                  onClick={() => setActiveTab('questions')}
                  className="text-xs text-[#10b981] hover:text-emerald-700 font-bold mt-2 inline-block"
                >
                  Soru Havuzunu Gör →
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                  <span>Toplam Quiz</span>
                  <ListChecks className="w-4 h-4 text-[#0ea5e9]" />
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-2">
                  {stats.totalQuizzes}
                </div>
                <button
                  onClick={() => setActiveTab('quizzes')}
                  className="text-xs text-[#0ea5e9] hover:text-sky-700 font-bold mt-2 inline-block"
                >
                  Quizleri Yönet →
                </button>
              </div>

              <div className="bg-[#0f172a] text-white border border-slate-800 rounded-2xl p-5 shadow-md">
                <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase">
                  <span>Aktif Oyun</span>
                  <Gamepad2 className="w-4 h-4 text-[#10b981]" />
                </div>
                <div className="text-3xl font-extrabold text-white mt-2">
                  {stats.activeGames}
                </div>
                <span className="text-xs text-[#10b981] font-semibold mt-2 block">
                  Canlı oturum sayısı
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
                  <span>Toplam Oyuncu</span>
                  <Users className="w-4 h-4 text-[#0ea5e9]" />
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-2">
                  {stats.totalPlayers}
                </div>
                <span className="text-xs text-slate-400 mt-2 block">
                  Katılan tüm öğrenciler
                </span>
              </div>
            </div>

            {/* Recent Quizzes Section */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Son Oluşturulan Quizler</h2>
                  <p className="text-xs text-slate-500">
                    Bir quiz seçip "OYUNU BAŞLAT" butonuna basarak QR kodlu lobi ekranını açabilirsiniz.
                  </p>
                </div>
                <button
                  onClick={openCreateQuizModal}
                  className="px-4 py-2 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-[#0ea5e9] text-xs font-extrabold transition"
                >
                  + YENİ QUIZ OLUŞTUR
                </button>
              </div>

              {quizzes.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Henüz hiç quiz oluşturulmadı. İlk quizinizi oluşturarak başlayın!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quizzes.map((qz) => (
                    <div
                      key={qz.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between hover:border-[#10b981] hover:bg-white hover:shadow-md transition"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 text-[#0ea5e9] border border-sky-200">
                            {qz.totalQuestions} Soru
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {new Date(qz.createdAt).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 line-clamp-2">
                          {qz.title}
                        </h3>
                        {qz.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {qz.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-200/80 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleStartGame(qz.id)}
                          className="flex-1 py-2.5 px-3 rounded-2xl bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20 transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>OYUNU BAŞLAT</span>
                        </button>
                        <button
                          onClick={() => openEditQuizModal(qz)}
                          title="Düzenle"
                          className="p-2.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDuplicateQuiz(qz.id)}
                          title="Kopyala"
                          className="p-2.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SORU HAVUZU */}
        {activeTab === 'questions' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">Soru Havuzu</h1>
                <p className="text-sm text-slate-500">
                  4 renkli seçenek yapısına sahip sorular oluşturun, düzenleyin veya kopyalayın.
                </p>
              </div>
              <button
                onClick={openCreateQuestionModal}
                className="px-5 py-3 rounded-2xl bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold text-sm flex items-center gap-2 shadow-md shadow-emerald-500/25 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Soru</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
                      <th className="py-4 px-5">Soru</th>
                      <th className="py-4 px-4">Doğru Cevap</th>
                      <th className="py-4 px-4">Süre</th>
                      <th className="py-4 px-4">Quiz</th>
                      <th className="py-4 px-5 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {questions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400">
                          Soru havuzunda henüz soru bulunmuyor.
                        </td>
                      </tr>
                    ) : (
                      questions.map((q) => {
                        const meta = COLOR_META[q.correctColor];
                        const correctText =
                          q.correctColor === 'RED'
                            ? q.redOption
                            : q.correctColor === 'BLUE'
                            ? q.blueOption
                            : q.correctColor === 'YELLOW'
                            ? q.yellowOption
                            : q.greenOption;

                        return (
                          <tr key={q.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-4 px-5 max-w-md">
                              <div className="font-bold text-slate-900">{q.text}</div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2 text-xs text-slate-600 font-medium">
                                <span className="truncate">🔴 {q.redOption}</span>
                                <span className="truncate">🔵 {q.blueOption}</span>
                                <span className="truncate">🟡 {q.yellowOption}</span>
                                <span className="truncate">🟢 {q.greenOption}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${meta.badgeClass}`}
                              >
                                <span>{meta.emoji}</span>
                                <span>{meta.label}:</span>
                                <span className="font-extrabold">{correctText}</span>
                              </span>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
                                <Clock className="w-3.5 h-3.5 text-[#0ea5e9]" />
                                {q.duration} sn
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              {q.usedInQuizzes && q.usedInQuizzes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {q.usedInQuizzes.map((qz) => (
                                    <span
                                      key={qz.id}
                                      className="text-[11px] px-2.5 py-0.5 rounded-lg bg-sky-50 text-[#0ea5e9] border border-sky-200 font-semibold truncate max-w-[160px]"
                                    >
                                      {qz.title}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-4 px-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => openEditQuestionModal(q)}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1 transition"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Düzenle</span>
                                </button>
                                <button
                                  onClick={() => handleDuplicateQuestion(q.id)}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1 transition"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Kopyala</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-600 flex items-center gap-1 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Sil</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: QUIZ YÖNETİMİ */}
        {activeTab === 'quizzes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900">Quiz Yönetimi</h1>
                <p className="text-sm text-slate-500">
                  Soru havuzundan quizler oluşturun, soruların sırasını sürükle-bırak ile değiştirin ve oyunu başlatın.
                </p>
              </div>
              <button
                onClick={openCreateQuizModal}
                className="px-5 py-3 rounded-2xl bg-[#10b981] hover:bg-emerald-600 text-white font-extrabold text-sm flex items-center gap-2 shadow-md shadow-emerald-500/25 transition"
              >
                <Plus className="w-4 h-4" />
                <span>YENİ QUIZ OLUŞTUR</span>
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
                      <th className="py-4 px-5">Quiz Adı</th>
                      <th className="py-4 px-4">Soru Sayısı</th>
                      <th className="py-4 px-4">Oluşturulma Tarihi</th>
                      <th className="py-4 px-5 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {quizzes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400">
                          Henüz quiz oluşturulmadı.
                        </td>
                      </tr>
                    ) : (
                      quizzes.map((qz) => (
                        <tr key={qz.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-4 px-5">
                            <div className="font-extrabold text-slate-900 text-base">{qz.title}</div>
                            {qz.description && (
                              <div className="text-xs text-slate-500 mt-0.5">{qz.description}</div>
                            )}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-[#0ea5e9] border border-sky-200">
                              {qz.totalQuestions} Soru
                            </span>
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                            {new Date(qz.createdAt).toLocaleString('tr-TR')}
                          </td>
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleStartGame(qz.id)}
                                className="px-3.5 py-2 rounded-2xl bg-[#10b981] hover:bg-emerald-600 text-xs font-extrabold text-white flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 transition"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>OYUNU BAŞLAT</span>
                              </button>
                              <button
                                onClick={() => openEditQuizModal(qz)}
                                className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1 transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Düzenle</span>
                              </button>
                              <button
                                onClick={() => handleDuplicateQuiz(qz.id)}
                                className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1 transition"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Kopyala</span>
                              </button>
                              <button
                                onClick={() => handleDeleteQuiz(qz.id)}
                                className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-bold text-rose-600 flex items-center gap-1 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Sil</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: YENİ SORU / SORU DÜZENLE */}
      {questionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {editingQuestion ? 'Soruyu Düzenle' : 'Yeni Soru Oluştur'}
                </h2>
                <p className="text-xs text-slate-500">
                  4 renk seçeneğini, doğru cevabı ve soru süresini belirleyin.
                </p>
              </div>
              <button
                onClick={() => setQuestionModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Soru Metni
                </label>
                <textarea
                  rows={2}
                  required
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="Örn: Dünya'nın doğal uydusu hangisidir?"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:bg-white focus:outline-none text-slate-900 text-base font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200">
                  <label className="flex items-center justify-between text-xs font-extrabold text-[#E21B3C] mb-1.5">
                    <span>🔴 Cevap A — Renk: Kırmızı</span>
                    {qCorrectColor === 'RED' && (
                      <span className="px-2 py-0.5 rounded bg-[#E21B3C] text-white text-[10px]">
                        DOĞRU CEVAP
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={qRed}
                    onChange={(e) => setQRed(e.target.value)}
                    placeholder="Kırmızı seçenek metni..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-rose-200 focus:border-[#E21B3C] focus:outline-none text-slate-900 text-sm"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200">
                  <label className="flex items-center justify-between text-xs font-extrabold text-[#1368CE] mb-1.5">
                    <span>🔵 Cevap B — Renk: Mavi</span>
                    {qCorrectColor === 'BLUE' && (
                      <span className="px-2 py-0.5 rounded bg-[#1368CE] text-white text-[10px]">
                        DOĞRU CEVAP
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={qBlue}
                    onChange={(e) => setQBlue(e.target.value)}
                    placeholder="Mavi seçenek metni..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-sky-200 focus:border-[#1368CE] focus:outline-none text-slate-900 text-sm"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <label className="flex items-center justify-between text-xs font-extrabold text-[#B88600] mb-1.5">
                    <span>🟡 Cevap C — Renk: Sarı</span>
                    {qCorrectColor === 'YELLOW' && (
                      <span className="px-2 py-0.5 rounded bg-[#D89E00] text-white text-[10px]">
                        DOĞRU CEVAP
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={qYellow}
                    onChange={(e) => setQYellow(e.target.value)}
                    placeholder="Sarı seçenek metni..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-amber-200 focus:border-[#D89E00] focus:outline-none text-slate-900 text-sm"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <label className="flex items-center justify-between text-xs font-extrabold text-[#26890C] mb-1.5">
                    <span>🟢 Cevap D — Renk: Yeşil</span>
                    {qCorrectColor === 'GREEN' && (
                      <span className="px-2 py-0.5 rounded bg-[#26890C] text-white text-[10px]">
                        DOĞRU CEVAP
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={qGreen}
                    onChange={(e) => setQGreen(e.target.value)}
                    placeholder="Yeşil seçenek metni..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-emerald-200 focus:border-[#26890C] focus:outline-none text-slate-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Doğru Cevap Rengi
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['RED', 'BLUE', 'YELLOW', 'GREEN'] as OptionColor[]).map((col) => {
                    const m = COLOR_META[col];
                    const selected = qCorrectColor === col;
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setQCorrectColor(col)}
                        className={`py-3 px-3 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 border-2 transition ${
                          selected
                            ? `${m.bgClass} border-slate-900 text-white shadow-md scale-[1.02]`
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span>{m.emoji}</span>
                        <span>{m.label}</span>
                        {selected && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Soru Süresi (Saniye)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_DURATIONS.map((sec) => {
                    const isSelected = !qCustomDuration && qDuration === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setQDuration(sec);
                          setQCustomDuration('');
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                          isSelected
                            ? 'bg-[#0ea5e9] border-[#0ea5e9] text-white shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {sec} sn
                      </button>
                    );
                  })}
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={qCustomDuration}
                    onChange={(e) => setQCustomDuration(e.target.value)}
                    placeholder="Özel süre (sn)"
                    className="w-36 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#0ea5e9] focus:bg-white focus:outline-none text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuestionModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={qSaving}
                  className="px-6 py-2.5 rounded-2xl bg-[#10b981] hover:bg-emerald-600 disabled:opacity-50 text-sm font-extrabold text-white shadow-md shadow-emerald-500/25"
                >
                  {qSaving ? 'Kaydediliyor...' : editingQuestion ? 'Değişiklikleri Kaydet' : 'Soruyu Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: QUIZ OLUŞTUR / DÜZENLE */}
      {quizModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl my-8 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between mb-5 shrink-0">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  {editingQuiz ? 'Quizi Düzenle' : 'Yeni Quiz Oluştur'}
                </h2>
                <p className="text-xs text-slate-500">
                  Soru havuzundan soruları seçin ve sürükle-bırak yöntemiyle soru sırasını belirleyin.
                </p>
              </div>
              <button
                onClick={() => setQuizModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuiz} className="flex-1 overflow-y-auto space-y-5 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Quiz Adı
                  </label>
                  <input
                    type="text"
                    required
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    placeholder="Örn: 5. Sınıf Fen Bilimleri – Dünya ve Evren"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:bg-white focus:outline-none text-slate-900 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Açıklama (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    value={quizDescription}
                    onChange={(e) => setQuizDescription(e.target.value)}
                    placeholder="Sınıf veya ünite notu..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-[#10b981] focus:bg-white focus:outline-none text-slate-900 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col max-h-80">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Soru Havuzu ({questions.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setQuizModalOpen(false);
                        openCreateQuestionModal();
                      }}
                      className="text-xs text-[#10b981] hover:text-emerald-700 font-extrabold"
                    >
                      + Havuza Yeni Soru Ekle
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {questions.map((q) => {
                      const isChecked = selectedQuestionIds.includes(q.id);
                      const m = COLOR_META[q.correctColor];
                      return (
                        <div
                          key={q.id}
                          onClick={() => toggleQuestionInQuiz(q.id)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-start justify-between gap-2 ${
                            isChecked
                              ? 'bg-emerald-50 border-[#10b981] text-slate-900'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="font-bold line-clamp-2">{q.text}</div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                              <span>
                                {m.emoji} {m.label}
                              </span>
                              <span>•</span>
                              <span>{q.duration} sn</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-1 accent-[#10b981]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col max-h-80">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0ea5e9]">
                      Seçilen Sorular & Sıralama ({selectedQuestionIds.length})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Sürükle-bırak ile sıralayın
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {selectedQuestionIds.length === 0 ? (
                      <div className="h-40 flex items-center justify-center text-xs text-slate-400 text-center">
                        Soldaki soru havuzundan soru seçin.
                      </div>
                    ) : (
                      selectedQuestionIds.map((qId, idx) => {
                        const q = questionMap.get(qId);
                        if (!q) return null;
                        return (
                          <div
                            key={q.id}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragEnd={handleDragEnd}
                            className={`p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 text-xs cursor-grab active:cursor-grabbing ${
                              draggedIdx === idx ? 'opacity-50 border-[#0ea5e9]' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="w-6 h-6 rounded-lg bg-sky-50 text-[#0ea5e9] font-extrabold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-semibold text-slate-900 truncate">{q.text}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveQuestionInQuiz(idx, -1)}
                                disabled={idx === 0}
                                className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                                title="Yukarı Taşı"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestionInQuiz(idx, 1)}
                                disabled={idx === selectedQuestionIds.length - 1}
                                className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                                title="Aşağı Taşı"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleQuestionInQuiz(q.id)}
                                className="p-1 rounded hover:bg-rose-50 text-rose-500"
                                title="Çıkar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuizModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={quizSaving}
                  className="px-6 py-2.5 rounded-2xl bg-[#10b981] hover:bg-emerald-600 disabled:opacity-50 text-sm font-extrabold text-white shadow-md shadow-emerald-500/25"
                >
                  {quizSaving ? 'Kaydediliyor...' : editingQuiz ? 'Quizi Güncelle' : 'Quizi Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
