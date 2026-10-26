import React from 'react';
import { X, MapPin, Bookmark } from 'lucide-react';
import { SATQuestion } from '../types/sat';

interface QuestionNavigatorPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  moduleTitle: string;
  questions: SATQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  flagged: Record<string, boolean>;
  onSelectQuestion: (index: number) => void;
  onGoToReviewPage: () => void;
}

export const QuestionNavigatorPopover: React.FC<QuestionNavigatorPopoverProps> = ({
  isOpen,
  onClose,
  moduleTitle,
  questions,
  currentIndex,
  answers,
  flagged,
  onSelectQuestion,
  onGoToReviewPage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center pb-16 bg-black/10" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-[520px] p-6 relative animate-in fade-in slide-in-from-bottom-2 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <h3 className="font-bold text-base text-gray-900">{moduleTitle} Questions</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Legend Row */}
        <div className="flex items-center justify-center gap-6 py-2.5 border-b border-gray-200 text-xs text-gray-700">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-800" />
            <span>Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 border border-dashed border-gray-400 inline-block" />
            <span>Unanswered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-red-600 fill-red-600" />
            <span>For Review</span>
          </div>
        </div>

        {/* Question Numbers Grid (10 columns matching screenshot) */}
        <div className="grid grid-cols-10 gap-2.5 py-5">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIndex;
            const isAnswered = Boolean(answers[q.id] && answers[q.id].trim() !== '');
            const isFlagged = Boolean(flagged[q.id]);

            return (
              <div key={q.id} className="relative flex flex-col items-center pt-3">
                {isCurrent && (
                  <MapPin className="w-3.5 h-3.5 text-gray-900 absolute top-0" />
                )}
                <button
                  onClick={() => {
                    onSelectQuestion(idx);
                    onClose();
                  }}
                  className={`w-9 h-9 text-xs font-bold flex items-center justify-center relative transition-all ${
                    isAnswered
                      ? 'bg-[#1b4332] text-white border border-[#1b4332]'
                      : 'bg-white text-gray-900 border border-dashed border-gray-400 hover:border-gray-700'
                  } ${
                    isCurrent
                      ? 'ring-2 ring-gray-900 ring-offset-1 rounded-sm'
                      : ''
                  }`}
                >
                  {q.number}
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-xs border border-white" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Go to Review Page Button */}
        <div className="flex justify-center pt-1">
          <button
            onClick={() => {
              onClose();
              onGoToReviewPage();
            }}
            className="px-6 py-2 rounded-full border border-[#1b4332] text-[#1b4332] text-xs font-bold hover:bg-[#1b4332]/5 transition-colors"
          >
            Go to Review Page
          </button>
        </div>

        {/* Bottom Pointer Triangle */}
        <div className="w-4 h-4 bg-white border-r border-b border-gray-200 rotate-45 absolute -bottom-2 left-1/2 -translate-x-1/2" />
      </div>
    </div>
  );
};
