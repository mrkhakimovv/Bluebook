import React from 'react';
import { CheckCircle2, Circle, Flag, ArrowLeft, ChevronRight } from 'lucide-react';
import { SATQuestion } from '../types/sat';

interface CheckYourWorkViewProps {
  moduleTitle: string;
  questions: SATQuestion[];
  answers: Record<string, string>;
  flagged: Record<string, boolean>;
  onSelectQuestion: (index: number) => void;
  onReturnToQuestions: () => void;
  onSubmitModule: () => void;
  isLastModule: boolean;
}

export const CheckYourWorkView: React.FC<CheckYourWorkViewProps> = ({
  questions,
  answers,
  flagged,
  onSelectQuestion,
  onReturnToQuestions,
  onSubmitModule,
  isLastModule,
}) => {
  const totalCount = questions.length;
  const answeredCount = questions.filter(
    (q) => answers[q.id] && answers[q.id].trim() !== ''
  ).length;
  const unansweredCount = totalCount - answeredCount;
  const flaggedCount = questions.filter((q) => flagged[q.id]).length;

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc] overflow-hidden">
      <div className="flex-1 overflow-y-auto touch-scroll-pane">
        <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
          {/* Title */}
          <div className="text-center space-y-1">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 tracking-tight">
              Check Your Work
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Review your answers before submitting. Click any question to return to it.
            </p>
          </div>

          {/* 3 Summary Stat Cards */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5 flex flex-col items-center justify-center shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-[#2563eb] mb-1 sm:mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Answered</span>
              </div>
              <div className="text-xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                {answeredCount}
              </div>
              <div className="text-[11px] sm:text-xs text-gray-500 mt-0.5">of {totalCount}</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5 flex flex-col items-center justify-center shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-gray-600 mb-1 sm:mb-2">
                <Circle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                <span>Unanswered</span>
              </div>
              <div className="text-xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                {unansweredCount}
              </div>
              <div className="text-[11px] sm:text-xs text-gray-500 mt-0.5">questions</div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5 flex flex-col items-center justify-center shadow-xs">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-red-600 mb-1 sm:mb-2">
                <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-red-600 text-red-600" />
                <span>For Review</span>
              </div>
              <div className="text-xl sm:text-3xl font-bold text-gray-900 tabular-nums">
                {flaggedCount}
              </div>
              <div className="text-[11px] sm:text-xs text-gray-500 mt-0.5">flagged</div>
            </div>
          </div>

          {/* Question Overview Grid Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-xs sm:text-sm font-bold text-gray-900">Question Overview</h2>

            <div className="grid grid-cols-7 sm:grid-cols-10 gap-2 sm:gap-3">
              {questions.map((q, idx) => {
                const isAnswered = Boolean(answers[q.id] && answers[q.id].trim() !== '');
                const isFlagged = Boolean(flagged[q.id]);

                return (
                  <button
                    key={q.id}
                    onClick={() => onSelectQuestion(idx)}
                    className={`h-9 sm:h-10 rounded-lg text-xs font-semibold flex items-center justify-center relative transition-all ${
                      isAnswered
                        ? 'bg-[#2563eb] text-white border border-[#2563eb] hover:bg-[#1d4ed8]'
                        : 'bg-white text-gray-800 border border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {q.number}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600 border border-white" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-center gap-5 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-xs bg-[#2563eb] inline-block" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-xs border border-gray-300 bg-white inline-block" />
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-xs border border-gray-300 bg-white relative inline-block">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 absolute -top-0.5 -right-0.5" />
                </span>
                <span>For Review</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={onReturnToQuestions}
          className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-gray-300 text-xs font-semibold text-gray-800 hover:bg-gray-50 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Questions</span>
        </button>

        <div className="text-xs font-medium text-gray-500 tabular-nums hidden sm:block">
          {answeredCount} of {totalCount} answered
        </div>

        <button
          onClick={onSubmitModule}
          className="px-4 sm:px-5 py-2 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
        >
          <span>{isLastModule ? 'Submit Exam & View Score' : 'Submit Module'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
