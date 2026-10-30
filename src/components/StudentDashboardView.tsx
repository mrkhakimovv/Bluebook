import React, { useState, useMemo } from 'react';
import {
  Home,
  BookOpen,
  FileText,
  AlertCircle,
  BarChart2,
  Calculator,
  Calendar,
  BookMarked,
  Sigma,
  Gift,
  Ticket,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  ClipboardList,
  Play,
  RotateCcw,
  LogOut,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Award,
  Clock,
  Sparkles,
  Copy,
  Check,
  Menu,
  X,
} from 'lucide-react';
import {
  StudentSession,
  SATQuestion,
  MODULE_CONFIGS,
  MODULE_ORDER,
  ScoringConfig,
} from '../types/sat';
import { isAnswerCorrect } from '../data/defaultQuestions';
import { scoreSession, getModuleQuestionsForSession, computeStage1Routing } from '../lib/scoring/rasch';
import { renderSATTextWithMath } from '../utils/mathRenderer';
import { loadPlatformContent } from '../data/platformContent';

interface StudentDashboardViewProps {
  session: StudentSession;
  allSessions: StudentSession[];
  questions: SATQuestion[];
  scoringConfig: ScoringConfig;
  onStartExam: () => void;
  onViewResults: () => void;
  onRestartExam: () => Promise<void>;
  onLogout: () => void;
}

type DashboardTab =
  | 'home'
  | 'question_bank'
  | 'practice_tests'
  | 'error_notebook'
  | 'my_metrics'
  | 'calculate_score'
  | 'study_plan'
  | 'vocabulary'
  | 'formula_sheet'
  | 'referrals'
  | 'promocode';

export const StudentDashboardView: React.FC<StudentDashboardViewProps> = ({
  session,
  allSessions,
  questions,
  scoringConfig,
  onStartExam,
  onViewResults,
  onRestartExam,
  onLogout,
}) => {
  const [platformContent] = useState(() => loadPlatformContent());
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [selectedExamDate, setSelectedExamDate] = useState<string | null>(null);
  const [studyPlanTasks, setStudyPlanTasks] = useState<
    { id: string; title: string; duration: string; completed: boolean }[]
  >(() =>
    loadPlatformContent().studyPlanTemplates.map((tpl) => ({
      id: tpl.id,
      title: tpl.title,
      duration: tpl.duration,
      completed: tpl.moduleId ? session.completedModules?.includes(tpl.moduleId) || false : false,
    }))
  );
  const [qBankFilter, setQBankFilter] = useState<'all' | 'rw' | 'math'>('all');
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [calcRwRaw, setCalcRwRaw] = useState<number>(38);
  const [calcMathRaw, setCalcMathRaw] = useState<number>(34);
  const [copiedRef, setCopiedRef] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoStatus, setPromoStatus] = useState<string | null>(null);

  // Compute student statistics from session
  const stats = useMemo(() => {
    const rwStage1 = computeStage1Routing('rw', questions, session.answers || {}, scoringConfig);
    const mathStage1 = computeStage1Routing('math', questions, session.answers || {}, scoringConfig);
    const routing = {
      rw: session.routing?.rw || rwStage1.variant,
      math: session.routing?.math || mathStage1.variant,
    };

    const sessionQuestions: SATQuestion[] = [];
    for (const modId of MODULE_ORDER) {
      sessionQuestions.push(...getModuleQuestionsForSession(questions, modId, routing));
    }

    let answeredCount = 0;
    let correctCount = 0;
    const wrongQuestions: { question: SATQuestion; studentAnswer: string }[] = [];

    for (const q of sessionQuestions) {
      const rawAns = session.answers?.[q.id];
      if (rawAns !== undefined && String(rawAns).trim() !== '') {
        answeredCount += 1;
        if (isAnswerCorrect(q, rawAns)) {
          correctCount += 1;
        } else {
          wrongQuestions.push({ question: q, studentAnswer: rawAns });
        }
      }
    }

    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    const totalPoints = correctCount * 175;

    // Calculate total study time spent from moduleTimeRemaining
    const totalDefaultSeconds =
      MODULE_CONFIGS.rw_1.durationSeconds +
      MODULE_CONFIGS.rw_2.durationSeconds +
      MODULE_CONFIGS.math_1.durationSeconds +
      MODULE_CONFIGS.math_2.durationSeconds;

    const currentRemainingSeconds =
      (session.moduleTimeRemaining?.rw_1 ?? MODULE_CONFIGS.rw_1.durationSeconds) +
      (session.moduleTimeRemaining?.rw_2 ?? MODULE_CONFIGS.rw_2.durationSeconds) +
      (session.moduleTimeRemaining?.math_1 ?? MODULE_CONFIGS.math_1.durationSeconds) +
      (session.moduleTimeRemaining?.math_2 ?? MODULE_CONFIGS.math_2.durationSeconds);

    const spentSeconds = Math.max(0, totalDefaultSeconds - currentRemainingSeconds);
    const totalMinutes = Math.max(answeredCount > 0 ? 1 : 0, Math.round(spentSeconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    const raschResult = session.result || scoreSession(session, questions, scoringConfig);

    return {
      answeredCount,
      correctCount,
      accuracy,
      totalPoints,
      streak: answeredCount > 0 ? 1 : 1,
      studyTimeFormatted: `${hours}h ${mins}m`,
      wrongQuestions,
      raschResult,
    };
  }, [session, questions, scoringConfig]);

  // Weekly activity bars (Sat -> Fri)
  const weeklyBars = useMemo(() => {
    const days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const updatedDate = new Date(session.updatedAt || Date.now());
    const jsDay = updatedDate.getDay(); // 0=Sun..6=Sat
    const mapDayToIdx: Record<number, number> = {
      6: 0, // Sat
      0: 1, // Sun
      1: 2, // Mon
      2: 3, // Tue
      3: 4, // Wed
      4: 5, // Thu
      5: 6, // Fri
    };
    const activeIdx = mapDayToIdx[jsDay] ?? 5;
    return days.map((day, idx) => ({
      day,
      count: idx === activeIdx ? Math.max(stats.answeredCount, 4) : 0,
      isActive: idx === activeIdx,
    }));
  }, [session.updatedAt, stats.answeredCount]);

  // Leaderboard entries combining real sessions and benchmark students
  const leaderboard = useMemo(() => {
    const entries: {
      id: string;
      name: string;
      points: number;
      initial: string;
      color: string;
      isCurrentUser?: boolean;
    }[] = [
      {
        id: 'bench_1',
        name: 'Nasrin Hridy',
        points: leaderboardPeriod === 'weekly' ? 12070 : 28450,
        initial: 'N',
        color: 'bg-[#ea580c]',
      },
      {
        id: 'bench_2',
        name: 'Aman Begdullaev',
        points: leaderboardPeriod === 'weekly' ? 10870 : 24120,
        initial: 'A',
        color: 'bg-[#d97706]',
      },
      {
        id: 'bench_3',
        name: 'Ibrohimjon Anvarjonov',
        points: leaderboardPeriod === 'weekly' ? 4420 : 11900,
        initial: 'I',
        color: 'bg-[#2563eb]',
      },
    ];

    const colors = ['bg-[#2563eb]', 'bg-[#059669]', 'bg-[#7c3aed]', 'bg-[#db2777]'];
    allSessions.forEach((s, i) => {
      const answered = Object.keys(s.answers || {}).length;
      const pts = Math.max(
        s.score?.rwRaw || 0,
        answered
      ) * 175 + (s.status === 'completed' ? s.score?.total || 0 : 0);

      const existingIdx = entries.findIndex(
        (e) => e.name.toLowerCase() === s.fullName.toLowerCase()
      );
      const entry = {
        id: s.id,
        name: s.fullName,
        points: pts,
        initial: (s.fullName.trim()[0] || 'S').toUpperCase(),
        color: colors[i % colors.length],
        isCurrentUser: s.id === session.id,
      };
      if (existingIdx >= 0) {
        if (pts > entries[existingIdx].points) {
          entries[existingIdx] = entry;
        }
      } else {
        entries.push(entry);
      }
    });

    return entries.sort((a, b) => b.points - a.points);
  }, [allSessions, session.id, leaderboardPeriod]);

  const topThree = leaderboard.slice(0, 3);

  const countdownDays = useMemo(() => {
    if (!selectedExamDate) return null;
    const target = new Date(selectedExamDate).getTime();
    const now = Date.now();
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [selectedExamDate]);

  const handleBuildDefaultPlan = () => {
    setStudyPlanTasks(
      platformContent.studyPlanTemplates.map((tpl) => ({
        id: tpl.id,
        title: tpl.title,
        duration: tpl.duration,
        completed: tpl.moduleId
          ? session.completedModules?.includes(tpl.moduleId) || false
          : false,
      }))
    );
  };

  const handleTogglePlanTask = (taskId: string) => {
    setStudyPlanTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleLaunchExam = () => {
    const orientationApi = (window.screen as Screen & {
      orientation?: { lock?: (type: string) => Promise<void> };
    })?.orientation;
    orientationApi?.lock?.('landscape')?.catch(() => {});
    onStartExam();
  };

  const userInitial = (session.fullName.trim()[0] || 'S').toUpperCase();

  const navSelect = (tab: DashboardTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col md:flex-row p-2 sm:p-4 gap-4 sm:gap-6">
      {/* Mobile Header Bar */}
      <div className="flex md:hidden items-center justify-between px-3 py-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-base font-extrabold tracking-tight text-slate-900">
            Bluebook
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-[#2563eb] text-white rounded">
            SAT
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLaunchExam}
            className="px-3 py-1.5 rounded-lg bg-[#2563eb] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Practice Test</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Left Sidebar (Matches Uploaded Reference Layout on White Theme) */}
      <aside
        className={`${
          mobileMenuOpen ? 'fixed inset-4 z-50 flex' : 'hidden md:flex'
        } ${
          sidebarCollapsed ? 'md:w-20' : 'md:w-64'
        } shrink-0 bg-white border border-slate-200 rounded-2xl shadow-xs flex-col justify-between p-3.5 transition-all`}
      >
        <div className="space-y-5 overflow-y-auto pr-0.5">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-2 pt-1">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-extrabold tracking-tight text-slate-900">
                  Bluebook
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-slate-900 text-white rounded">
                  SAT
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (mobileMenuOpen) {
                  setMobileMenuOpen(false);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              title={sidebarCollapsed ? 'Yon panelni ochish' : 'Yon panelni yig‘ish'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Home Button */}
          <div>
            <button
              type="button"
              onClick={() => navSelect('home')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Home className="w-4 h-4 text-[#2563eb] shrink-0" />
              {!sidebarCollapsed && <span>Home</span>}
            </button>
          </div>

          {/* Practice Section */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 text-[11px] font-semibold text-slate-400">
                Practice
              </div>
            )}
            <button
              type="button"
              onClick={() => navSelect('question_bank')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'question_bank'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Question Bank</span>}
            </button>

            <button
              type="button"
              onClick={() => navSelect('practice_tests')}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'practice_tests'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <FileText className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>Practice Tests</span>}
              </span>
              {!sidebarCollapsed && (
                <span className="w-2 h-2 rounded-full bg-[#2563eb]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => navSelect('error_notebook')}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'error_notebook'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>Error Notebook</span>}
              </span>
              {!sidebarCollapsed && stats.wrongQuestions.length > 0 && (
                <span className="text-[11px] font-bold text-red-600">
                  {stats.wrongQuestions.length}
                </span>
              )}
            </button>
          </div>

          {/* Progress Section */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 text-[11px] font-semibold text-slate-400">
                Progress
              </div>
            )}
            <button
              type="button"
              onClick={() => navSelect('my_metrics')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'my_metrics'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>My Metrics</span>}
            </button>

            <button
              type="button"
              onClick={() => navSelect('calculate_score')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'calculate_score'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Calculate Score</span>}
            </button>
          </div>

          {/* Preparation Section */}
          <div className="space-y-1">
            {!sidebarCollapsed && (
              <div className="px-3 text-[11px] font-semibold text-slate-400">
                Preparation
              </div>
            )}
            <button
              type="button"
              onClick={() => navSelect('study_plan')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'study_plan'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>AI Study Plan</span>}
            </button>

            <button
              type="button"
              onClick={() => navSelect('vocabulary')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'vocabulary'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <BookMarked className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Vocabulary</span>}
            </button>

            <button
              type="button"
              onClick={() => navSelect('formula_sheet')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'formula_sheet'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Sigma className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Formula Sheet</span>}
            </button>
          </div>
        </div>

        {/* Bottom Links & Student Profile Card */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => navSelect('referrals')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'referrals'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Gift className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Referrals</span>}
            </button>

            <button
              type="button"
              onClick={() => navSelect('promocode')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'promocode'
                  ? 'bg-slate-100 text-slate-900 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Ticket className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Promocode</span>}
            </button>
          </div>

          {/* Student Profile Pill at Bottom */}
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#ea580c] text-white font-bold text-xs flex items-center justify-center shrink-0">
                {userInitial}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {session.fullName}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {session.email || 'Pro plan'}
                  </div>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={onLogout}
                title="Akkauntdan chiqish"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area on Clean White Background */}
      <main className="flex-1 min-w-0 bg-white px-2 sm:px-6 py-2 sm:py-4 space-y-6 overflow-y-auto">
        {activeTab === 'home' && (
          <>
            {/* Top Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Dashboard
              </h1>
              <div className="flex items-center gap-2.5">
                {session.status === 'completed' && (
                  <button
                    type="button"
                    onClick={onViewResults}
                    className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-[#2563eb]" />
                    <span>Natijani ko‘rish ({stats.raschResult.total})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLaunchExam}
                  className="px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {session.status === 'completed'
                      ? 'Testni Ko‘rish / Qayta Topshirish'
                      : stats.answeredCount > 0
                      ? 'Practice Testni Davom Ettirish'
                      : 'Practice Testni Boshlash'}
                  </span>
                </button>
              </div>
            </div>

            {/* 5-Column Top KPI Strip with Vertical Dividers (Exact match to screenshot) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-6 py-4 px-2 border-b border-slate-100 lg:divide-x lg:divide-slate-200">
              <div className="px-4 first:pl-0 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Accuracy</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {stats.accuracy}%
                </div>
                <div className="text-xs text-slate-400">
                  {stats.correctCount} correct
                </div>
              </div>

              <div className="px-4 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Total points</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {stats.totalPoints}
                </div>
                <div className="text-xs text-slate-400">Lifetime points</div>
              </div>

              <div className="px-4 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Streak</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {stats.streak}
                </div>
                <div className="text-xs text-slate-400">Start your streak</div>
              </div>

              <div className="px-4 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Study Time</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {stats.studyTimeFormatted}
                </div>
                <div className="text-xs text-slate-400">Total time spent</div>
              </div>

              <div className="px-4 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Total Attempts</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {stats.answeredCount}
                </div>
                <div className="text-xs text-slate-400">All questions tried</div>
              </div>
            </div>

            {/* Middle 3-Card Row: Weekly Activity | Exam Countdown | Today's plan */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Card 1: Weekly Activity */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between min-h-[230px]">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Weekly Activity</h2>
                  <span className="text-xs font-semibold text-slate-600">
                    {stats.answeredCount} questions
                  </span>
                </div>

                {/* Bar Chart with Dashed Grid Lines */}
                <div className="relative pt-8 pb-2 flex-1 flex flex-col justify-end">
                  <div className="absolute inset-x-0 top-8 bottom-8 flex flex-col justify-between pointer-events-none">
                    <div className="border-b border-dashed border-slate-200 w-full" />
                    <div className="border-b border-dashed border-slate-200 w-full" />
                    <div className="border-b border-dashed border-slate-200 w-full" />
                    <div className="border-b border-slate-200 w-full" />
                  </div>

                  <div className="relative z-10 grid grid-cols-7 gap-2 items-end h-28 pt-4">
                    {weeklyBars.map((bar) => (
                      <div
                        key={bar.day}
                        className="flex flex-col items-center justify-end h-full gap-2"
                      >
                        <div className="w-full flex items-end justify-center h-20">
                          {bar.isActive ? (
                            <div
                              className="w-7 sm:w-8 rounded-md bg-[#2563eb] transition-all"
                              style={{
                                height: `${Math.min(
                                  100,
                                  Math.max(45, bar.count * 8)
                                )}%`,
                              }}
                              title={`${bar.count} questions`}
                            />
                          ) : (
                            <div className="w-6 sm:w-7 h-2 rounded-full bg-slate-200" />
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-slate-500">
                          {bar.day}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 2: Exam Countdown */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between min-h-[230px]">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <h2 className="text-base font-bold text-slate-900">Exam Countdown</h2>
                  </div>

                  {selectedExamDate ? (
                    <div className="py-1">
                      <div className="text-2xl font-extrabold text-[#2563eb] tabular-nums">
                        {countdownDays} days left
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Target Official SAT Date:{' '}
                        <span className="font-semibold text-slate-800">
                          {
                            platformContent.examDates.find(
                              (d) => d.iso === selectedExamDate
                            )?.label
                          }
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-slate-700 pt-1">
                      Select your SAT date to start the countdown
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-4">
                  {platformContent.examDates.map((d) => {
                    const isSelected = selectedExamDate === d.iso;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          setSelectedExamDate(isSelected ? null : d.iso)
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#2563eb] text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 3: Today's plan */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between min-h-[230px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <h2 className="text-base font-bold text-slate-900">Today's plan</h2>
                  </div>
                  {studyPlanTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => navSelect('study_plan')}
                      className="text-xs font-semibold text-[#2563eb] hover:underline cursor-pointer"
                    >
                      View all
                    </button>
                  )}
                </div>

                {studyPlanTasks.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-1.5 py-6">
                    <p className="text-xs font-medium text-slate-500">
                      No study plan yet
                    </p>
                    <button
                      type="button"
                      onClick={handleBuildDefaultPlan}
                      className="text-xs font-bold text-[#2563eb] hover:underline cursor-pointer"
                    >
                      Build a study plan
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 pt-3">
                    {studyPlanTasks.slice(0, 3).map((task) => (
                      <label
                        key={task.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => handleTogglePlanTask(task.id)}
                            className="rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
                          />
                          <span
                            className={`truncate font-medium ${
                              task.completed
                                ? 'line-through text-slate-400'
                                : 'text-slate-800'
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                          {task.duration}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Leaderboard Section (Exact Podium Match on White Background) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-slate-900">Leaderboard</h2>
                  <button
                    type="button"
                    onClick={() => setShowAllLeaderboard(!showAllLeaderboard)}
                    className="text-xs font-semibold text-[#2563eb] hover:underline cursor-pointer"
                  >
                    {showAllLeaderboard ? 'Hide list' : 'View all'}
                  </button>
                </div>

                <div className="inline-flex items-center p-1 bg-slate-100 rounded-full">
                  <button
                    type="button"
                    onClick={() => setLeaderboardPeriod('weekly')}
                    className={`px-3.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                      leaderboardPeriod === 'weekly'
                        ? 'bg-[#2563eb] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardPeriod('monthly')}
                    className={`px-3.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                      leaderboardPeriod === 'monthly'
                        ? 'bg-[#2563eb] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              {/* 3-Place Podium */}
              <div className="max-w-2xl mx-auto pt-4 grid grid-cols-3 gap-3 sm:gap-6 items-end">
                {/* 2nd Place (Left) */}
                {topThree[1] && (
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${topThree[1].color} text-white font-bold text-lg sm:text-xl flex items-center justify-center border-2 border-slate-200 shadow-sm mb-2`}
                    >
                      {topThree[1].initial}
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1">
                      {topThree[1].name}
                    </div>
                    <div className="text-[11px] text-slate-500 mb-3 tabular-nums">
                      {topThree[1].points.toLocaleString('ru-RU')} points
                    </div>
                    <div className="w-full h-20 sm:h-24 rounded-t-xl bg-gradient-to-b from-slate-200 to-slate-300 flex items-center justify-center">
                      <span className="text-lg sm:text-xl font-extrabold text-slate-700">
                        2nd
                      </span>
                    </div>
                  </div>
                )}

                {/* 1st Place (Center - Tallest) */}
                {topThree[0] && (
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${topThree[0].color} text-white font-bold text-xl sm:text-2xl flex items-center justify-center border-2 border-amber-400 shadow-sm mb-2`}
                    >
                      {topThree[0].initial}
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-1">
                      {topThree[0].name}
                    </div>
                    <div className="text-[11px] text-slate-500 mb-3 tabular-nums">
                      {topThree[0].points.toLocaleString('ru-RU')} points
                    </div>
                    <div className="w-full h-28 sm:h-36 rounded-t-xl bg-gradient-to-b from-amber-300 to-amber-500 flex items-center justify-center shadow-xs">
                      <span className="text-xl sm:text-2xl font-extrabold text-amber-950">
                        1st
                      </span>
                    </div>
                  </div>
                )}

                {/* 3rd Place (Right) */}
                {topThree[2] && (
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full ${topThree[2].color} text-white font-bold text-lg sm:text-xl flex items-center justify-center border-2 border-slate-200 shadow-sm mb-2`}
                    >
                      {topThree[2].initial}
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1">
                      {topThree[2].name}
                    </div>
                    <div className="text-[11px] text-slate-500 mb-3 tabular-nums">
                      {topThree[2].points.toLocaleString('ru-RU')} points
                    </div>
                    <div className="w-full h-14 sm:h-16 rounded-t-xl bg-gradient-to-b from-amber-700/80 to-amber-900 flex items-center justify-center">
                      <span className="text-base sm:text-lg font-extrabold text-amber-100">
                        3rd
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Full Leaderboard Table when 'View all' is clicked */}
              {showAllLeaderboard && (
                <div className="pt-4 border-t border-slate-200 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaderboard.map((item, index) => (
                        <tr
                          key={item.id}
                          className={
                            item.isCurrentUser ? 'bg-blue-50/60 font-bold' : ''
                          }
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {index + 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full ${item.color} text-white text-[11px] font-bold flex items-center justify-center`}
                            >
                              {item.initial}
                            </span>
                            <span>{item.name}</span>
                            {item.isCurrentUser && (
                              <span className="text-[10px] font-bold text-[#2563eb]">
                                (You)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                            {item.points.toLocaleString('ru-RU')} pts
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB: PRACTICE TESTS */}
        {activeTab === 'practice_tests' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Practice Tests
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Official Bluebook-style adaptive full-length Digital SAT practice exams.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#2563eb]">
                    Full-Length Adaptive Test
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Bluebook Digital SAT Practice Test #1
                  </h2>
                  <p className="text-xs text-slate-600 max-w-2xl">
                    Section 1: Reading & Writing (Module 1 & Adaptive Module 2 — 64 daqiqa, 54 savol) · Section 2: Math (Module 1 & Adaptive Module 2 — 70 daqiqa, 44 savol).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Status:{' '}
                    <strong className="text-slate-900">
                      {session.status === 'completed'
                        ? 'Yakunlangan'
                        : stats.answeredCount > 0
                        ? `Jarayonda (${MODULE_CONFIGS[session.currentModule]?.shortTitle})`
                        : 'Boshlanmagan'}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <div className="text-[11px] text-slate-500">Belgilangan savollar</div>
                  <div className="text-base font-bold text-slate-900 tabular-nums">
                    {stats.answeredCount} / {session.score.totalQuestions}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Reading & Writing</div>
                  <div className="text-base font-bold text-slate-900 tabular-nums">
                    {session.status === 'completed' ? stats.raschResult.rw.score : '200–800'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Mathematics</div>
                  <div className="text-base font-bold text-slate-900 tabular-nums">
                    {session.status === 'completed' ? stats.raschResult.math.score : '200–800'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Total Score</div>
                  <div className="text-base font-bold text-[#2563eb] tabular-nums">
                    {session.status === 'completed' ? stats.raschResult.total : '400–1600'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {session.status !== 'completed' ? (
                  <button
                    type="button"
                    onClick={handleLaunchExam}
                    className="px-5 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {stats.answeredCount > 0
                        ? 'Imtihonni Davom Ettirish'
                        : 'Imtihonni Boshlash'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onViewResults}
                    className="px-5 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    <span>Batafsil Natijani Ko‘rish</span>
                  </button>
                )}

                {(stats.answeredCount > 0 || session.status === 'completed') && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onRestartExam();
                      handleLaunchExam();
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Yangidan Boshlash</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: QUESTION BANK */}
        {activeTab === 'question_bank' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Question Bank ({questions.length})
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Practice individual Reading & Writing and Mathematics questions from the database.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setQBankFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    qBankFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  All ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setQBankFilter('rw')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    qBankFilter === 'rw'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Reading & Writing
                </button>
                <button
                  type="button"
                  onClick={() => setQBankFilter('math')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    qBankFilter === 'math'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Math
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {questions
                .filter((q) =>
                  qBankFilter === 'all'
                    ? true
                    : qBankFilter === 'rw'
                    ? q.moduleId.startsWith('rw_')
                    : q.moduleId.startsWith('math_')
                )
                .slice(0, 25)
                .map((q) => {
                  const revealed = !!revealedAnswers[q.id];
                  return (
                    <div
                      key={q.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800">
                            #{q.number}
                          </span>
                          <span>·</span>
                          <span className="font-mono text-[#2563eb]">ID: {q.id}</span>
                          <span>·</span>
                          <span>{MODULE_CONFIGS[q.moduleId]?.shortTitle}</span>
                          {q.domain && (
                            <>
                              <span>·</span>
                              <span>{q.domain}</span>
                            </>
                          )}
                        </div>
                        <span className="uppercase font-bold text-[11px] text-slate-500">
                          {q.difficulty || 'medium'}
                        </span>
                      </div>

                      {q.passage && (
                        <div
                          className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl leading-relaxed sat-serif"
                          dangerouslySetInnerHTML={{
                            __html: renderSATTextWithMath(q.passage),
                          }}
                        />
                      )}

                      <div
                        className="text-sm font-medium text-slate-900 sat-serif"
                        dangerouslySetInnerHTML={{
                          __html: renderSATTextWithMath(q.prompt),
                        }}
                      />

                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt) => (
                            <div
                              key={opt.id}
                              className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                                revealed && opt.id === q.correctAnswer
                                  ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-semibold'
                                  : 'border-slate-200 text-slate-700'
                              }`}
                            >
                              <span className="font-bold">{opt.id}.</span>
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: renderSATTextWithMath(opt.text),
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedAnswers((prev) => ({
                              ...prev,
                              [q.id]: !prev[q.id],
                            }))
                          }
                          className="text-xs font-bold text-[#2563eb] hover:underline cursor-pointer"
                        >
                          {revealed ? 'Javobni yashirish' : 'To‘g‘ri javobni ko‘rish'}
                        </button>
                        {revealed && (
                          <span className="text-xs font-bold text-emerald-700">
                            To‘g‘ri javob: {q.correctAnswer}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB: ERROR NOTEBOOK */}
        {activeTab === 'error_notebook' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Error Notebook ({stats.wrongQuestions.length})
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Questions you answered incorrectly during your practice sessions.
              </p>
            </div>

            {stats.wrongQuestions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900">
                  Xatolar daftarchasi bo‘sh!
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Hozircha xato belgilangan savollar yo‘q. Practice Test ishlaganingizda xato qilingan savollar shu yerda avtomatik tahlil bilan saqlanadi.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.wrongQuestions.map(({ question: q, studentAnswer }) => (
                  <div
                    key={q.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {MODULE_CONFIGS[q.moduleId]?.shortTitle} · Savol #{q.number} (ID:{' '}
                        {q.id})
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-red-600 font-bold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Sizning javobingiz:{' '}
                          {studentAnswer}
                        </span>
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> To‘g‘ri javob:{' '}
                          {q.correctAnswer}
                        </span>
                      </div>
                    </div>

                    {q.passage && (
                      <div
                        className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl sat-serif"
                        dangerouslySetInnerHTML={{
                          __html: renderSATTextWithMath(q.passage),
                        }}
                      />
                    )}

                    <div
                      className="text-sm font-medium text-slate-900 sat-serif"
                      dangerouslySetInnerHTML={{
                        __html: renderSATTextWithMath(q.prompt),
                      }}
                    />

                    {q.explanation && (
                      <div className="text-xs text-slate-600 bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                        <strong className="text-slate-900">Izoh: </strong>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: renderSATTextWithMath(q.explanation),
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: MY METRICS */}
        {activeTab === 'my_metrics' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Metrics</h1>
              <p className="text-xs text-slate-500 mt-1">
                Detailed Rasch IRT performance breakdown across Reading & Writing and Mathematics domains.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
                <span className="text-xs text-slate-500 font-medium">
                  Estimated Total Score
                </span>
                <div className="text-3xl font-extrabold text-[#2563eb] tabular-nums">
                  {stats.raschResult.total}
                </div>
                <span className="text-[11px] text-slate-400">Scale: 400–1600</span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
                <span className="text-xs text-slate-500 font-medium">
                  Reading & Writing
                </span>
                <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {stats.raschResult.rw.score}
                </div>
                <span className="text-[11px] text-slate-400">
                  Raw: {stats.raschResult.rw.rawScored}/{stats.raschResult.rw.nScored} · θ ={' '}
                  {stats.raschResult.rw.theta.toFixed(2)}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
                <span className="text-xs text-slate-500 font-medium">Mathematics</span>
                <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {stats.raschResult.math.score}
                </div>
                <span className="text-[11px] text-slate-400">
                  Raw: {stats.raschResult.math.rawScored}/{stats.raschResult.math.nScored} · θ ={' '}
                  {stats.raschResult.math.theta.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">
                  Reading & Writing Domains
                </h2>
                <div className="space-y-3">
                  {Object.entries(stats.raschResult.rw.domains).map(([dom, dStat]) => {
                    const pct =
                      dStat.total > 0
                        ? Math.round((dStat.correct / dStat.total) * 100)
                        : 0;
                    return (
                      <div key={dom} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700">{dom}</span>
                          <span className="font-mono text-slate-600">
                            {dStat.correct}/{dStat.total} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#2563eb] rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">Mathematics Domains</h2>
                <div className="space-y-3">
                  {Object.entries(stats.raschResult.math.domains).map(([dom, dStat]) => {
                    const pct =
                      dStat.total > 0
                        ? Math.round((dStat.correct / dStat.total) * 100)
                        : 0;
                    return (
                      <div key={dom} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700">{dom}</span>
                          <span className="font-mono text-slate-600">
                            {dStat.correct}/{dStat.total} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#2563eb] rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: CALCULATE SCORE */}
        {activeTab === 'calculate_score' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Calculate Score
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Interactive Digital SAT Score Calculator (200–800 per section, 400–1600 total).
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-800">
                    <span>Reading & Writing Correct Answers (out of 54)</span>
                    <span className="text-[#2563eb] font-mono">{calcRwRaw} / 54</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={54}
                    value={calcRwRaw}
                    onChange={(e) => setCalcRwRaw(Number(e.target.value))}
                    className="w-full accent-[#2563eb] cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-800">
                    <span>Mathematics Correct Answers (out of 44)</span>
                    <span className="text-[#2563eb] font-mono">{calcMathRaw} / 44</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={44}
                    value={calcMathRaw}
                    onChange={(e) => setCalcMathRaw(Number(e.target.value))}
                    className="w-full accent-[#2563eb] cursor-pointer"
                  />
                </div>
              </div>

              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Estimated Scaled Score
                </div>
                {(() => {
                  const rwScaled =
                    Math.round((200 + (calcRwRaw / 54) * 600) / 10) * 10;
                  const mathScaled =
                    Math.round((200 + (calcMathRaw / 44) * 600) / 10) * 10;
                  return (
                    <>
                      <div className="text-5xl font-extrabold text-[#2563eb] tabular-nums">
                        {rwScaled + mathScaled}
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                        <div>
                          <div className="text-slate-500">Reading & Writing</div>
                          <div className="text-lg font-bold text-slate-900 tabular-nums">
                            {rwScaled}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Mathematics</div>
                          <div className="text-lg font-bold text-slate-900 tabular-nums">
                            {mathScaled}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB: AI STUDY PLAN */}
        {activeTab === 'study_plan' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Study Plan
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Structured daily preparation roadmap for your Digital SAT target score.
                </p>
              </div>
              {studyPlanTasks.length === 0 && (
                <button
                  type="button"
                  onClick={handleBuildDefaultPlan}
                  className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Build Study Plan</span>
                </button>
              )}
            </div>

            {studyPlanTasks.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                <Calendar className="w-8 h-8 text-[#2563eb] mx-auto" />
                <div className="text-sm font-bold text-slate-900">
                  No study plan generated yet
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click the button below to generate a personalized Digital SAT practice schedule covering Reading & Writing and Math modules.
                </p>
                <button
                  type="button"
                  onClick={handleBuildDefaultPlan}
                  className="px-5 py-2.5 rounded-xl bg-[#2563eb] text-white text-xs font-bold cursor-pointer"
                >
                  Build a study plan
                </button>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                {studyPlanTasks.map((task) => (
                  <label
                    key={task.id}
                    className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleTogglePlanTask(task.id)}
                        className="w-4 h-4 rounded border-slate-300 text-[#2563eb]"
                      />
                      <span
                        className={`text-sm font-medium ${
                          task.completed
                            ? 'line-through text-slate-400'
                            : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {task.duration}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: VOCABULARY */}
        {activeTab === 'vocabulary' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                High-Frequency SAT Vocabulary
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Essential Craft & Structure words In Context tested on the Digital SAT.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {platformContent.vocabulary.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2"
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-base font-bold text-slate-900">{item.word}</h3>
                    <span className="text-xs italic text-[#2563eb]">{item.part}</span>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">{item.definition}</p>
                  <p className="text-xs text-slate-500 italic">“{item.example}”</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: FORMULA SHEET */}
        {activeTab === 'formula_sheet' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Official SAT Math Formula Sheet
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Reference formulas provided during Section 2: Mathematics.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {platformContent.formulaGroups.map((grp, idx) => (
                <div
                  key={grp.id}
                  className={`bg-white border border-slate-200 rounded-2xl p-5 space-y-2 ${
                    idx === platformContent.formulaGroups.length - 1 &&
                    platformContent.formulaGroups.length % 2 === 1
                      ? 'md:col-span-2'
                      : ''
                  }`}
                >
                  <h3 className="text-sm font-bold text-slate-900">{grp.title}</h3>
                  <ul className="text-xs text-slate-700 space-y-1.5 font-mono">
                    {grp.formulas.map((f, fIdx) => (
                      <li key={fIdx}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: REFERRALS */}
        {activeTab === 'referrals' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Referrals</h1>
              <p className="text-xs text-slate-500 mt-1">
                Invite friends preparing for the Digital SAT and compete on the leaderboard.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl space-y-4">
              <div className="text-xs font-semibold text-slate-700">
                Your Personal Invite Code
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`SAT-${session.id.slice(-6).toUpperCase()}`}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `SAT-${session.id.slice(-6).toUpperCase()}`
                    );
                    setCopiedRef(true);
                    setTimeout(() => setCopiedRef(false), 2000);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedRef ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: PROMOCODE */}
        {activeTab === 'promocode' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Promocode</h1>
              <p className="text-xs text-slate-500 mt-1">
                Activate a promo code for Pro practice features.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!promoInput.trim()) return;
                setPromoStatus(
                  `Promokod "${promoInput.trim().toUpperCase()}" muvaffaqiyatli faollashtirildi (Pro plan)!`
                );
                setPromoInput('');
              }}
              className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl space-y-4"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="Enter promocode (e.g. BLUEBOOK2026)"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:border-[#2563eb] focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-bold cursor-pointer"
                >
                  Apply
                </button>
              </div>
              {promoStatus && (
                <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{promoStatus}</span>
                </div>
              )}
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
