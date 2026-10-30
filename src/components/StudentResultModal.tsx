import React, { useState, useMemo } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  RotateCcw,
  LogOut,
  BookOpen,
  Calculator,
  BarChart3,
} from 'lucide-react';
import {
  StudentSession,
  SATQuestion,
  MODULE_CONFIGS,
  MODULE_ORDER,
  ModuleId,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
  RW_DOMAINS,
  MATH_DOMAINS,
} from '../types/sat';
import {
  scoreSession,
  computeStage1Routing,
  getModuleQuestionsForSession,
} from '../lib/scoring/rasch';
import { isAnswerCorrect } from '../data/defaultQuestions';
import { renderSATTextWithMath } from '../utils/mathRenderer';

interface StudentResultViewProps {
  session: StudentSession;
  questions: SATQuestion[];
  scoringConfig?: ScoringConfig;
  onRestartExam: () => void;
  onReturnToExam?: () => void;
  onReturnToDashboard?: () => void;
  onLogout: () => void;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  session,
  questions,
  scoringConfig = DEFAULT_SCORING_CONFIG,
  onRestartExam,
  onReturnToExam,
  onReturnToDashboard,
  onLogout,
}) => {
  const activeModules = MODULE_ORDER.filter((m) =>
    questions.some((q) => q.moduleId === m)
  );
  const [selectedModule, setSelectedModule] = useState<ModuleId>(
    activeModules[0] || 'rw_1'
  );

  // Use saved session.result if available; otherwise compute on-the-fly for legacy sessions (without mutating Firestore)
  const raschResult = useMemo(() => {
    if (session.result && session.result.rw && session.result.math) {
      return session.result;
    }
    return scoreSession(session, questions, scoringConfig);
  }, [session, questions, scoringConfig]);

  const effectiveRouting = useMemo(
    () => ({
      rw:
        session.routing?.rw ||
        computeStage1Routing('rw', questions, session.answers, scoringConfig).variant,
      math:
        session.routing?.math ||
        computeStage1Routing('math', questions, session.answers, scoringConfig).variant,
    }),
    [session.routing, session.answers, questions, scoringConfig]
  );

  const stageCounts = useMemo(() => {
    const countStage = (modId: ModuleId) => {
      const qs = getModuleQuestionsForSession(
        questions,
        modId,
        effectiveRouting
      ).filter((q) => q.scored !== false);
      const corr = qs.filter((q) =>
        isAnswerCorrect(q, session.answers[q.id] || '')
      ).length;
      return { correct: corr, total: qs.length };
    };
    return {
      rw_1: countStage('rw_1'),
      rw_2: countStage('rw_2'),
      math_1: countStage('math_1'),
      math_2: countStage('math_2'),
    };
  }, [questions, effectiveRouting, session.answers]);

  const effectiveModule = activeModules.includes(selectedModule)
    ? selectedModule
    : activeModules[0] || 'rw_1';

  const moduleQuestions = useMemo(
    () => getModuleQuestionsForSession(questions, effectiveModule, effectiveRouting),
    [questions, effectiveModule, effectiveRouting]
  );

  const totalRawScored = raschResult.rw.rawScored + raschResult.math.rawScored;
  const totalNScored = raschResult.rw.nScored + raschResult.math.nScored;
  const accuracyPct =
    totalNScored > 0 ? Math.round((totalRawScored / totalNScored) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <Award className="w-6 h-6 text-[#2563eb] shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900">
                Digital SAT Natijalari — {session.fullName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                Taxminiy ball
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ushbu natija o‘quv va tayyorgarlik maqsadidagi taxminiy ball hisoblanadi (rasmiy College Board SAT balli emas).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {onReturnToDashboard && (
            <button
              onClick={onReturnToDashboard}
              className="px-3.5 sm:px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Dashboardga qaytish
            </button>
          )}
          {onReturnToExam && session.status !== 'completed' && (
            <button
              onClick={onReturnToExam}
              className="px-3.5 sm:px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Imtihonga qaytish
            </button>
          )}
          <button
            onClick={onRestartExam}
            className="px-3.5 sm:px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Qayta topshirish</span>
          </button>
          <button
            onClick={onLogout}
            className="px-3.5 sm:px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Chiqish</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">
        {/* Top Score Summary Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* Total Score */}
          <div className="lg:col-span-5 bg-[#2563eb] text-white rounded-2xl p-5 sm:p-7 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wider text-blue-100 font-semibold">
                  Jami SAT Natijasi (Taxminiy ball)
                </p>
                <span className="px-2 py-0.5 rounded bg-white/15 text-[11px] font-semibold text-blue-50 shrink-0">
                  400–1600 shkala
                </span>
              </div>
              <div className="text-5xl sm:text-6xl font-bold tracking-tight tabular-nums pt-2">
                {raschResult.total}
              </div>
              <p className="text-xs text-blue-100 pt-1">
                Hisoblanadigan savollar aniqligi: {accuracyPct}% ({totalRawScored} / {totalNScored} to‘g‘ri)
              </p>
            </div>

            <div className="pt-6 border-t border-white/15 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-blue-100 block">Topshirilgan savollar</span>
                <span className="text-lg font-bold tabular-nums">
                  {session.score.totalAnswered} / {session.score.totalQuestions}
                </span>
              </div>
              <div>
                <span className="text-blue-100 block">Imtihon holati</span>
                <span className="text-lg font-bold">
                  {session.status === 'completed' ? 'Yakunlangan' : 'Jarayonda'}
                </span>
              </div>
            </div>
          </div>

          {/* Section Breakdown */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    1-bo‘lim · Taxminiy ball
                  </span>
                  <BookOpen className="w-4 h-4 text-[#2563eb]" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Reading and Writing
                </h2>
                <div className="text-4xl font-bold text-slate-900 tabular-nums pt-1">
                  {raschResult.rw.score}
                  <span className="text-sm font-normal text-slate-400"> / 800</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>1-modul to‘g‘ri javoblar:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {stageCounts.rw_1.correct} / {stageCounts.rw_1.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>2-modul to‘g‘ri javoblar:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {stageCounts.rw_2.correct} / {stageCounts.rw_2.total}
                  </span>
                </div>
                <div className="flex justify-between pt-1 font-semibold text-slate-900">
                  <span>Jami hisoblangan to‘g‘ri javoblar:</span>
                  <span className="tabular-nums">
                    {raschResult.rw.rawScored} / {raschResult.rw.nScored}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    2-bo‘lim · Taxminiy ball
                  </span>
                  <Calculator className="w-4 h-4 text-[#2563eb]" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Mathematics
                </h2>
                <div className="text-4xl font-bold text-slate-900 tabular-nums pt-1">
                  {raschResult.math.score}
                  <span className="text-sm font-normal text-slate-400"> / 800</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>1-modul to‘g‘ri javoblar:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {stageCounts.math_1.correct} / {stageCounts.math_1.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>2-modul to‘g‘ri javoblar:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {stageCounts.math_2.correct} / {stageCounts.math_2.total}
                  </span>
                </div>
                <div className="flex justify-between pt-1 font-semibold text-slate-900">
                  <span>Jami hisoblangan to‘g‘ri javoblar:</span>
                  <span className="tabular-nums">
                    {raschResult.math.rawScored} / {raschResult.math.nScored}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Domain Breakdown Table (Scored Questions Only) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4">
            <BarChart3 className="w-5 h-5 text-[#2563eb]" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Yo‘nalishlar (Domain) bo‘yicha natijalar
              </h3>
              <p className="text-xs text-slate-500">
                Faqat ballga kiruvchi (hisoblanadigan) savollar bo‘yicha to‘g‘ri javoblar ko‘rsatkichi
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* R&W Domains */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Reading & Writing yo‘nalishlari
              </h4>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3.5">Domain</th>
                      <th className="py-2.5 px-3.5 text-right">To‘g‘ri / Jami</th>
                      <th className="py-2.5 px-3.5 text-right">Ko‘rsatkich (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {RW_DOMAINS.map((domain) => {
                      const stat = raschResult.rw.domains[domain] || {
                        correct: 0,
                        total: 0,
                      };
                      const pct =
                        stat.total > 0
                          ? Math.round((stat.correct / stat.total) * 100)
                          : 0;
                      return (
                        <tr key={domain} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3.5 font-medium text-slate-800">
                            {domain}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-700">
                            {stat.correct} / {stat.total}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold text-[#2563eb]">
                            {stat.total > 0 ? `${pct}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Math Domains */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mathematics yo‘nalishlari
              </h4>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3.5">Domain</th>
                      <th className="py-2.5 px-3.5 text-right">To‘g‘ri / Jami</th>
                      <th className="py-2.5 px-3.5 text-right">Ko‘rsatkich (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MATH_DOMAINS.map((domain) => {
                      const stat = raschResult.math.domains[domain] || {
                        correct: 0,
                        total: 0,
                      };
                      const pct =
                        stat.total > 0
                          ? Math.round((stat.correct / stat.total) * 100)
                          : 0;
                      return (
                        <tr key={domain} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3.5 font-medium text-slate-800">
                            {domain}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-700">
                            {stat.correct} / {stat.total}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold text-[#2563eb]">
                            {stat.total > 0 ? `${pct}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Question-by-Question Review */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-5 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Savollar Tahlili (Question-by-Question Review)
              </h3>
              <p className="text-xs text-slate-500">
                Har bir modul bo‘yicha belgilangan javoblaringiz va to‘g‘ri yechimlar
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
              {(activeModules.length > 0 ? activeModules : MODULE_ORDER).map((modId) => (
                <button
                  key={modId}
                  onClick={() => setSelectedModule(modId)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    effectiveModule === modId
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {MODULE_CONFIGS[modId].shortTitle}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {moduleQuestions.map((q) => {
              const userAns = session.answers[q.id] || '';
              const correct = isAnswerCorrect(q, userAns);
              return (
                <div
                  key={q.id}
                  className="border border-slate-200 rounded-xl p-4 space-y-2.5 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {q.number}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {q.domain || 'SAT savoli'} ·{' '}
                        {q.type === 'spr' ? 'Yozma javob (SPR)' : 'Variantli savol'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-semibold">
                      {correct ? (
                        <span className="flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>To‘g‘ri ({userAns})</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="w-4 h-4 shrink-0" />
                          <span>
                            Sizning javobingiz: {userAns || 'Belgilanmagan'} · To‘g‘ri javob: {q.correctAnswer}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {q.passage && (
                    <div
                      className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg font-serif leading-relaxed"
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
                    <p
                      className="text-xs text-slate-600 pt-1 border-t border-slate-100 sat-serif"
                      dangerouslySetInnerHTML={{
                        __html: `<strong class="font-sans text-slate-800">Izoh:</strong> ${renderSATTextWithMath(
                          q.explanation
                        )}`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};
