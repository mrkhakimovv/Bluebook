import React, { useState } from 'react';
import { Award, CheckCircle2, XCircle, RotateCcw, LogOut, BookOpen, Calculator } from 'lucide-react';
import { StudentSession, SATQuestion, MODULE_CONFIGS, MODULE_ORDER, ModuleId } from '../types/sat';
import { isAnswerCorrect } from '../data/defaultQuestions';
import { renderSATTextWithMath } from '../utils/mathRenderer';

interface StudentResultViewProps {
  session: StudentSession;
  questions: SATQuestion[];
  onRestartExam: () => void;
  onReturnToExam?: () => void;
  onLogout: () => void;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  session,
  questions,
  onRestartExam,
  onReturnToExam,
  onLogout,
}) => {
  const [selectedModule, setSelectedModule] = useState<ModuleId>('rw_1');
  const { score } = session;

  const moduleQuestions = questions.filter((q) => q.moduleId === selectedModule);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Award className="w-6 h-6 text-[#1b4332]" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Digital SAT Score Report — {session.fullName}
            </h1>
            <p className="text-xs text-slate-500">
              Real-Time Database Verified Result
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onReturnToExam && session.status !== 'completed' && (
            <button
              onClick={onReturnToExam}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Imtihonga qaytish
            </button>
          )}
          <button
            onClick={onRestartExam}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Qayta topshirish</span>
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Chiqish</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Top Score Summary Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Total Score */}
          <div className="lg:col-span-5 bg-[#1b4332] text-white rounded-2xl p-7 flex flex-col justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wider text-emerald-200 font-semibold">
                Total SAT Score
              </p>
              <div className="text-6xl font-bold tracking-tight tabular-nums pt-2">
                {score.total}
              </div>
              <p className="text-xs text-emerald-200 pt-1">
                Scale: 400–1600 · Aniqlik: {score.accuracyPercent}% ({score.rwRaw + score.mathRaw} / {score.totalQuestions} to‘g‘ri)
              </p>
            </div>

            <div className="pt-6 border-t border-white/15 grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-emerald-200 block">Topshirilgan savollar</span>
                <span className="text-lg font-bold tabular-nums">
                  {score.totalAnswered} / {score.totalQuestions}
                </span>
              </div>
              <div>
                <span className="text-emerald-200 block">Holati</span>
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
                    Section 1
                  </span>
                  <BookOpen className="w-4 h-4 text-[#1b4332]" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Reading and Writing
                </h2>
                <div className="text-4xl font-bold text-slate-900 tabular-nums pt-1">
                  {score.rwScaled}
                  <span className="text-sm font-normal text-slate-400"> / 800</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Module 1 To‘g‘ri javoblar:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {score.moduleScores.rw_1.correct} / {score.moduleScores.rw_1.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Module 2 To‘g‘ri javoblar:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {score.moduleScores.rw_2.correct} / {score.moduleScores.rw_2.total}
                  </span>
                </div>
                <div className="flex justify-between pt-1 font-semibold text-slate-900">
                  <span>Jami R&W Raw Score:</span>
                  <span className="tabular-nums">{score.rwRaw} / {score.rwTotal}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Section 2
                  </span>
                  <Calculator className="w-4 h-4 text-[#1b4332]" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Mathematics
                </h2>
                <div className="text-4xl font-bold text-slate-900 tabular-nums pt-1">
                  {score.mathScaled}
                  <span className="text-sm font-normal text-slate-400"> / 800</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Module 1 To‘g‘ri javoblar:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {score.moduleScores.math_1.correct} / {score.moduleScores.math_1.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Module 2 To‘g‘ri javoblar:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {score.moduleScores.math_2.correct} / {score.moduleScores.math_2.total}
                  </span>
                </div>
                <div className="flex justify-between pt-1 font-semibold text-slate-900">
                  <span>Jami Math Raw Score:</span>
                  <span className="tabular-nums">{score.mathRaw} / {score.mathTotal}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Question-by-Question Review */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Savollar Tahlili (Question-by-Question Review)
              </h3>
              <p className="text-xs text-slate-500">
                Har bir modul bo‘yicha belgilangan javoblaringiz va to‘g‘ri yechimlar
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {MODULE_ORDER.map((modId) => (
                <button
                  key={modId}
                  onClick={() => setSelectedModule(modId)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    selectedModule === modId
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
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                        {q.number}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {q.domain || 'SAT Question'} · {q.type === 'spr' ? 'Student-Produced Response' : 'Multiple Choice'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-semibold">
                      {correct ? (
                        <span className="flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>To‘g‘ri ({userAns})</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="w-4 h-4" />
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
                      dangerouslySetInnerHTML={{ __html: q.passage.replace(/\n/g, '<br/>') }}
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
