import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Highlighter,
  Calculator,
  BookOpen,
  MoreVertical,
  Bookmark,
  Maximize2,
  Minimize2,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  LogOut,
  X,
  StickyNote,
  Underline,
  Clock,
  Coffee,
  ArrowRight,
} from 'lucide-react';
import {
  StudentSession,
  SATQuestion,
  MODULE_CONFIGS,
  MODULE_ORDER,
  ModuleId,
  HighlightAnnotation,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
} from '../types/sat';
import {
  getModuleQuestionsForSession,
  computeStage1Routing,
} from '../lib/scoring/rasch';
import { isAnswerCorrect } from '../data/defaultQuestions';
import { ReferenceModal } from './ReferenceModal';
import { DesmosModal } from './DesmosModal';
import { QuestionNavigatorPopover } from './QuestionNavigatorPopover';
import { CheckYourWorkView } from './CheckYourWorkView';
import { renderSATTextWithMath } from '../utils/mathRenderer';

interface BluebookExamViewProps {
  session: StudentSession;
  questions: SATQuestion[];
  scoringConfig?: ScoringConfig;
  onSyncSession: (updates: Partial<StudentSession>) => void;
  onExitExam: () => void;
}

export const BluebookExamView: React.FC<BluebookExamViewProps> = ({
  session,
  questions,
  scoringConfig = DEFAULT_SCORING_CONFIG,
  onSyncSession,
  onExitExam,
}) => {
  const [showFullscreenBanner, setShowFullscreenBanner] = useState(true);
  const [showDirections, setShowDirections] = useState(false);
  const [hideTimer, setHideTimer] = useState(false);
  const [highlighterMode, setHighlighterMode] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [eliminatorMode, setEliminatorMode] = useState(true);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [leftPanePercent, setLeftPanePercent] = useState(50);
  const [isLeftExpanded, setIsLeftExpanded] = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Text selection popover state for Highlights & Notes
  const [selectionPopup, setSelectionPopup] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [activeNoteQuestionId, setActiveNoteQuestionId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const activeModuleOrder = MODULE_ORDER.filter((m) =>
    questions.some((q) => q.moduleId === m)
  );
  const effectiveModuleOrder =
    activeModuleOrder.length > 0 ? activeModuleOrder : MODULE_ORDER;

  const currentModuleId = effectiveModuleOrder.includes(session.currentModule)
    ? session.currentModule
    : effectiveModuleOrder[0];
  const moduleConfig = MODULE_CONFIGS[currentModuleId];
  const isMathSection = moduleConfig.sectionNumber === 2;

  // Compute effective routing if student is already in Module 2
  const effectiveRouting = useMemo(() => {
    const r = { ...(session.routing || {}) };
    if (!r.rw && (currentModuleId === 'rw_2' || session.completedModules.includes('rw_1'))) {
      r.rw = computeStage1Routing(
        'rw',
        questions,
        session.answers,
        scoringConfig
      ).variant;
    }
    if (!r.math && (currentModuleId === 'math_2' || session.completedModules.includes('math_1'))) {
      r.math = computeStage1Routing(
        'math',
        questions,
        session.answers,
        scoringConfig
      ).variant;
    }
    return r;
  }, [
    session.routing,
    session.answers,
    session.completedModules,
    currentModuleId,
    questions,
    scoringConfig,
  ]);

  const moduleQuestions = useMemo(
    () => getModuleQuestionsForSession(questions, currentModuleId, effectiveRouting),
    [questions, currentModuleId, effectiveRouting]
  );

  const safeIndex = Math.min(
    Math.max(0, session.currentQuestionIndex),
    Math.max(0, moduleQuestions.length - 1)
  );
  const currentQuestion = moduleQuestions[safeIndex];

  // Local timer state synced periodically with session
  const [secondsLeft, setSecondsLeft] = useState<number>(
    session.moduleTimeRemaining?.[currentModuleId] ?? moduleConfig.durationSeconds
  );
  const secondsRef = useRef(secondsLeft);
  secondsRef.current = secondsLeft;

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  const scoringConfigRef = useRef(scoringConfig);
  scoringConfigRef.current = scoringConfig;

  const onSyncSessionRef = useRef(onSyncSession);
  onSyncSessionRef.current = onSyncSession;

  useEffect(() => {
    setSecondsLeft(
      sessionRef.current.moduleTimeRemaining?.[currentModuleId] ??
        moduleConfig.durationSeconds
    );
  }, [currentModuleId, moduleConfig.durationSeconds]);

  const handleAdvanceModule = () => {
    const latestSession = sessionRef.current;
    const latestQuestions = questionsRef.current;
    const latestConfig = scoringConfigRef.current;

    const currentOrderIdx = effectiveModuleOrder.indexOf(currentModuleId);
    const completed = Array.from(
      new Set([...latestSession.completedModules, currentModuleId])
    );

    // Stage 1 -> Stage 2 adaptive routing (computed & saved ONCE when Module 1 finishes)
    const nextRouting = { ...(latestSession.routing || {}) };
    const nextRoutingTheta = { ...(latestSession.routingTheta || {}) };

    if (currentModuleId === 'rw_1' && !nextRouting.rw) {
      const rwStage1 = computeStage1Routing(
        'rw',
        latestQuestions,
        latestSession.answers,
        latestConfig
      );
      nextRouting.rw = rwStage1.variant;
      nextRoutingTheta.rw = Number(rwStage1.theta.toFixed(4));
    }

    if (currentModuleId === 'math_1' && !nextRouting.math) {
      const mathStage1 = computeStage1Routing(
        'math',
        latestQuestions,
        latestSession.answers,
        latestConfig
      );
      nextRouting.math = mathStage1.variant;
      nextRoutingTheta.math = Number(mathStage1.theta.toFixed(4));
    }

    if (
      currentOrderIdx >= 0 &&
      currentOrderIdx < effectiveModuleOrder.length - 1
    ) {
      const nextMod: ModuleId = effectiveModuleOrder[currentOrderIdx + 1];
      // Show 10-minute optional break when transitioning from Section 1 (rw_*) to Section 2 (math_*)
      if (currentModuleId.startsWith('rw_') && nextMod.startsWith('math_')) {
        onSyncSessionRef.current({
          status: 'break',
          currentModule: nextMod,
          currentQuestionIndex: 0,
          viewMode: 'question',
          completedModules: completed,
          routing: nextRouting,
          routingTheta: nextRoutingTheta,
          moduleTimeRemaining: {
            ...latestSession.moduleTimeRemaining,
            [currentModuleId]: secondsRef.current,
          },
        });
        return;
      }

      onSyncSessionRef.current({
        currentModule: nextMod,
        currentQuestionIndex: 0,
        viewMode: 'question',
        completedModules: completed,
        routing: nextRouting,
        routingTheta: nextRoutingTheta,
        moduleTimeRemaining: {
          ...latestSession.moduleTimeRemaining,
          [currentModuleId]: secondsRef.current,
        },
      });
    } else {
      // Completed all active modules!
      onSyncSessionRef.current({
        status: 'completed',
        completedModules: completed,
        routing: nextRouting,
        routingTheta: nextRoutingTheta,
        moduleTimeRemaining: {
          ...latestSession.moduleTimeRemaining,
          [currentModuleId]: secondsRef.current,
        },
      });
    }
  };

  const handleAdvanceModuleRef = useRef(handleAdvanceModule);
  handleAdvanceModuleRef.current = handleAdvanceModule;

  useEffect(() => {
    if (session.status !== 'in_progress') return;
    const interval = setInterval(() => {
      const currentVal = secondsRef.current;
      if (currentVal <= 1) {
        clearInterval(interval);
        setSecondsLeft(0);
        handleAdvanceModuleRef.current();
        return;
      }
      const nextVal = currentVal - 1;
      secondsRef.current = nextVal;
      setSecondsLeft(nextVal);
      if (nextVal % 10 === 0) {
        onSyncSessionRef.current({
          moduleTimeRemaining: {
            ...sessionRef.current.moduleTimeRemaining,
            [currentModuleId]: nextVal,
          },
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentModuleId, session.status]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleSelectOption = (optionId: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQuestion) return;
    const eliminatedForQ = session.eliminated[currentQuestion.id] || [];
    if (eliminatedForQ.includes(optionId)) return; // Don't select crossed-out option unless restored

    const currentAns = session.answers[currentQuestion.id];
    const nextAnswers = {
      ...session.answers,
      [currentQuestion.id]: currentAns === optionId ? '' : optionId,
    };
    onSyncSession({
      answers: nextAnswers,
      moduleTimeRemaining: {
        ...session.moduleTimeRemaining,
        [currentModuleId]: secondsRef.current,
      },
    });
  };

  const handleSprChange = (rawVal: string) => {
    if (!currentQuestion) return;
    // Enforce SAT Student-Produced Response rules: max 5 chars for positive, 6 for negative, only digits, ., /, -
    const filtered = rawVal.replace(/[^0-9.\-/]/g, '');
    const maxLen = filtered.startsWith('-') ? 6 : 5;
    const truncated = filtered.slice(0, maxLen);

    onSyncSession({
      answers: {
        ...session.answers,
        [currentQuestion.id]: truncated,
      },
      moduleTimeRemaining: {
        ...session.moduleTimeRemaining,
        [currentModuleId]: secondsRef.current,
      },
    });
  };

  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    const nextFlagged = {
      ...session.flagged,
      [currentQuestion.id]: !session.flagged[currentQuestion.id],
    };
    onSyncSession({ flagged: nextFlagged });
  };

  const handleToggleEliminate = (optionId: string) => {
    if (!currentQuestion) return;
    const currentList = session.eliminated[currentQuestion.id] || [];
    const exists = currentList.includes(optionId);
    const nextList = exists
      ? currentList.filter((id) => id !== optionId)
      : [...currentList, optionId];

    const nextAnswers = { ...session.answers };
    if (!exists && nextAnswers[currentQuestion.id] === optionId) {
      delete nextAnswers[currentQuestion.id];
    }

    onSyncSession({
      eliminated: {
        ...session.eliminated,
        [currentQuestion.id]: nextList,
      },
      answers: nextAnswers,
    });
  };

  const handleGoToQuestion = (idx: number) => {
    onSyncSession({
      currentQuestionIndex: idx,
      viewMode: 'question',
      moduleTimeRemaining: {
        ...session.moduleTimeRemaining,
        [currentModuleId]: secondsRef.current,
      },
    });
  };

  const handleNext = () => {
    if (safeIndex < moduleQuestions.length - 1) {
      handleGoToQuestion(safeIndex + 1);
    } else {
      onSyncSession({
        viewMode: 'review',
        moduleTimeRemaining: {
          ...session.moduleTimeRemaining,
          [currentModuleId]: secondsRef.current,
        },
      });
    }
  };

  const handleBack = () => {
    if (safeIndex > 0) {
      handleGoToQuestion(safeIndex - 1);
    }
  };

  // Handle text selection for Highlights & Notes
  const handleTextMouseUp = () => {
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : '';
    if (selectedText && selectedText.length >= 2 && selectedText.length <= 350) {
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPopup({
        text: selectedText,
        x: Math.max(120, Math.min(window.innerWidth - 160, rect.left + rect.width / 2)),
        y: Math.max(80, rect.bottom + 10),
      });
    } else {
      setSelectionPopup(null);
    }
  };

  const applyHighlight = (color: 'yellow' | 'blue' | 'pink' | 'underline', openNote?: boolean) => {
    if (!selectionPopup || !currentQuestion) return;
    const newHighlight: HighlightAnnotation = {
      id: `hl_${Date.now()}`,
      questionId: currentQuestion.id,
      text: selectionPopup.text,
      color,
      createdAt: new Date().toISOString(),
    };
    const nextHighlights = [...(session.highlights || []), newHighlight];
    onSyncSession({ highlights: nextHighlights });
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
    if (openNote) {
      setActiveNoteQuestionId(currentQuestion.id);
    }
  };

  const removeHighlight = (hlId: string) => {
    const nextHighlights = (session.highlights || []).filter((h) => h.id !== hlId);
    onSyncSession({ highlights: nextHighlights });
  };

  // Render text with applied highlights and KaTeX math
  const renderHighlightedHtml = (rawHtml: string, isPureMathOption = false) => {
    let output = renderSATTextWithMath(rawHtml, isPureMathOption).replace(/\n/g, '<br/>');
    const qHighlights = (session.highlights || []).filter(
      (h) => currentQuestion && h.questionId === currentQuestion.id
    );
    for (const hl of qHighlights) {
      const escaped = hl.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const bgClass =
        hl.color === 'yellow'
          ? 'background-color: #fef08a; padding: 1px 0;'
          : hl.color === 'blue'
          ? 'background-color: #bfdbfe; padding: 1px 0;'
          : hl.color === 'pink'
          ? 'background-color: #fbcfe8; padding: 1px 0;'
          : 'text-decoration: underline; text-decoration-thickness: 2px;';
      try {
        const regex = new RegExp(`(${escaped})`, 'i');
        output = output.replace(
          regex,
          `<mark style="${bgClass}" title="Highlighted">$1</mark>`
        );
      } catch {
        // Ignore regex edge cases
      }
    }
    return output;
  };

  const triggerFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
    setShowFullscreenBanner(false);
  };

  // Break View between Section 1 and Section 2
  if (session.status === 'break') {
    return (
      <div className="min-h-screen bg-[#111827] text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#1e293b] border border-slate-700 rounded-2xl p-8 text-center space-y-6">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <Coffee className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Section 1 Completed</h1>
            <p className="text-sm text-slate-300">
              Siz Reading and Writing bo‘limining ikkala modulini yakunladingiz. Endi Section 2: Math bo‘limiga o‘tishingiz mumkin.
            </p>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-4 text-xs text-slate-300 space-y-1">
            <div>O‘quvchi: <strong>{session.fullName}</strong></div>
            <div>Keyingi bosqich: <strong>Section 2, Module 1: Math (22 savol, 35 daqiqa)</strong></div>
          </div>
          <button
            onClick={() =>
              onSyncSession({
                status: 'in_progress',
                currentModule: 'math_1',
                currentQuestionIndex: 0,
                viewMode: 'question',
              })
            }
            className="w-full py-3 px-6 rounded-full bg-[#1b4332] hover:bg-[#245942] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>Start Section 2: Math</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const hasSplitPassage = Boolean(currentQuestion?.passage);

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col bg-white select-text"
      style={{ zoom: `${zoomPercent}%` }}
      onMouseMove={(e) => {
        if (!isDraggingSplit) return;
        const pct = (e.clientX / window.innerWidth) * 100;
        setLeftPanePercent(Math.min(72, Math.max(28, pct)));
      }}
      onMouseUp={() => setIsDraggingSplit(false)}
    >
      {/* 1. Optional Top Blue Fullscreen Banner */}
      {showFullscreenBanner && (
        <div className="bg-[#2563eb] text-white text-xs py-1.5 px-4 flex items-center justify-center gap-3 shrink-0">
          <button onClick={triggerFullscreen} className="flex items-center gap-1.5 hover:underline">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 bg-white/20 rounded text-[11px] font-mono">F11</kbd>
            <span>for fullscreen — all buttons will be visible</span>
          </button>
          <button
            onClick={() => setShowFullscreenBanner(false)}
            className="text-white/80 hover:text-white ml-1"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. Bluebook Exam Header Bar (#e2e8e0) */}
      <header className="bg-[#e2e8e0] border-b border-dashed border-gray-400 px-5 py-2 flex items-center justify-between shrink-0 relative">
        {/* Left: Section & Module Title + Directions */}
        <div className="flex flex-col items-start min-w-[240px]">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-gray-900 tracking-tight">
              {moduleConfig.title}
            </h1>
          </div>
          <button
            onClick={() => setShowDirections(!showDirections)}
            className="flex items-center gap-1 text-xs font-medium text-gray-800 hover:text-black mt-0.5 cursor-pointer"
          >
            <span>Directions</span>
            {showDirections ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Center: Countdown Timer + Hide Button */}
        <div className="flex flex-col items-center justify-center">
          {!hideTimer ? (
            <>
              <div
                className={`text-xl font-bold tabular-nums tracking-tight leading-none ${
                  secondsLeft < 300 ? 'text-red-600' : 'text-gray-900'
                }`}
              >
                {formatTimer(secondsLeft)}
              </div>
              <button
                onClick={() => setHideTimer(true)}
                className="mt-1 px-3 py-0.5 rounded-full border border-gray-500 text-[11px] font-medium text-gray-800 hover:bg-black/5 transition-colors cursor-pointer"
              >
                Hide
              </button>
            </>
          ) : (
            <button
              onClick={() => setHideTimer(false)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-500 text-xs font-medium text-gray-800 hover:bg-black/5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Show Timer</span>
            </button>
          )}
        </div>

        {/* Right: Tool Icons (Highlights & Notes, Calculator, Reference, More) */}
        <div className="flex items-center gap-2 min-w-[240px] justify-end">
          <button
            onClick={() => setHighlighterMode(!highlighterMode)}
            className={`flex flex-col items-center justify-center px-3 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
              highlighterMode
                ? 'bg-[#cfd8cc] border border-gray-500 text-gray-900'
                : 'text-gray-800 hover:bg-black/5'
            }`}
          >
            <Highlighter className="w-4 h-4 mb-0.5" />
            <span>Highlights & Notes</span>
          </button>

          {isMathSection && (
            <>
              <button
                onClick={() => setShowCalculator(!showCalculator)}
                className={`flex flex-col items-center justify-center px-3 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  showCalculator
                    ? 'bg-[#cfd8cc] border border-gray-500 text-gray-900'
                    : 'text-gray-800 hover:bg-black/5'
                }`}
              >
                <Calculator className="w-4 h-4 mb-0.5" />
                <span>Calculator</span>
              </button>

              <button
                onClick={() => setShowReference(!showReference)}
                className={`flex flex-col items-center justify-center px-3 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  showReference
                    ? 'bg-[#cfd8cc] border border-gray-500 text-gray-900'
                    : 'text-gray-800 hover:bg-black/5'
                }`}
              >
                <BookOpen className="w-4 h-4 mb-0.5" />
                <span>Reference</span>
              </button>
            </>
          )}

          {/* More Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`flex flex-col items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                showMoreMenu
                  ? 'bg-[#cfd8cc] border border-[#1e3a5f] text-gray-900'
                  : 'text-gray-800 hover:bg-black/5'
              }`}
            >
              <MoreVertical className="w-4 h-4 mb-0.5" />
              <span>More</span>
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 text-xs text-gray-800">
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowHelpModal(true);
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-100 flex items-center gap-2.5"
                >
                  <HelpCircle className="w-4 h-4 text-gray-600" />
                  <span>Help</span>
                </button>
                <button
                  onClick={() => setZoomPercent((z) => Math.min(130, z + 10))}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-100 flex items-center gap-2.5"
                >
                  <ZoomIn className="w-4 h-4 text-gray-600" />
                  <span>Zoom In ({zoomPercent}%)</span>
                </button>
                <button
                  onClick={() => setZoomPercent((z) => Math.max(80, z - 10))}
                  className="w-full px-4 py-2.5 text-left hover:bg-gray-100 flex items-center gap-2.5"
                >
                  <ZoomOut className="w-4 h-4 text-gray-600" />
                  <span>Zoom Out ({zoomPercent}%)</span>
                </button>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    onExitExam();
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-red-50 text-red-600 font-medium flex items-center gap-2.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Exit Test</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Directions Dropdown Popover */}
        {showDirections && (
          <div className="absolute left-5 top-16 z-40 bg-white rounded-xl shadow-2xl border border-gray-300 max-w-xl p-5 space-y-3 text-xs text-gray-800 leading-relaxed">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <span className="font-bold text-sm text-gray-900">Directions</span>
              <button
                onClick={() => setShowDirections(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p>{moduleConfig.directions}</p>
          </div>
        )}
      </header>

      {/* 3. Main Body: Either Check Your Work View or Active Question View */}
      {session.viewMode === 'review' ? (
        <CheckYourWorkView
          moduleTitle={moduleConfig.title}
          questions={moduleQuestions}
          answers={session.answers}
          flagged={session.flagged}
          onSelectQuestion={(idx) => handleGoToQuestion(idx)}
          onReturnToQuestions={() => handleGoToQuestion(safeIndex)}
          onSubmitModule={handleAdvanceModule}
          isLastModule={
            currentModuleId ===
            effectiveModuleOrder[effectiveModuleOrder.length - 1]
          }
        />
      ) : currentQuestion ? (
        <main
          className="flex-1 flex overflow-hidden relative bg-white"
          onMouseUp={handleTextMouseUp}
        >
          {/* Floating Selection Highlighter Toolbar */}
          {selectionPopup && (
            <div
              style={{
                left: `${selectionPopup.x}px`,
                top: `${selectionPopup.y}px`,
                transform: 'translateX(-50%)',
              }}
              className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 px-3 py-2 flex items-center gap-2.5 animate-in fade-in zoom-in-95 duration-100"
              onMouseUp={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => applyHighlight('yellow')}
                className="w-6 h-6 rounded-full bg-[#facc15] border border-amber-400 hover:scale-110 transition-transform"
                title="Highlight Yellow"
              />
              <button
                onClick={() => applyHighlight('blue')}
                className="w-6 h-6 rounded-full bg-[#7dd3fc] border border-sky-400 hover:scale-110 transition-transform"
                title="Highlight Blue"
              />
              <button
                onClick={() => applyHighlight('pink')}
                className="w-6 h-6 rounded-full bg-[#f9a8d4] border border-pink-400 hover:scale-110 transition-transform"
                title="Highlight Pink"
              />
              <div className="h-4 w-[1px] bg-gray-200" />
              <button
                onClick={() => applyHighlight('underline')}
                className="p-1 rounded hover:bg-gray-100 text-gray-800"
                title="Underline"
              >
                <Underline className="w-4 h-4" />
              </button>
              <button
                onClick={() => applyHighlight('yellow', true)}
                className="p-1 rounded hover:bg-gray-100 text-gray-800"
                title="Add Note"
              >
                <StickyNote className="w-4 h-4" />
              </button>
            </div>
          )}

          {hasSplitPassage ? (
            /* SPLIT VIEW (Reading & Writing or Math with Passage) */
            <>
              {/* Left Passage Pane */}
              <div
                style={{ width: isLeftExpanded ? '70%' : `${leftPanePercent}%` }}
                className="h-full overflow-y-auto px-8 py-6 relative"
              >
                <button
                  onClick={() => setIsLeftExpanded(!isLeftExpanded)}
                  className="absolute top-3 right-4 p-1.5 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                  title="Expand/Restore passage pane"
                >
                  {isLeftExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>

                <div
                  className="font-serif text-[17px] leading-[1.75] text-gray-900 max-w-2xl pt-2"
                  dangerouslySetInnerHTML={{
                    __html: renderHighlightedHtml(currentQuestion.passage || ''),
                  }}
                />

                {/* Active Highlights List for quick removal */}
                {(session.highlights || []).filter((h) => h.questionId === currentQuestion.id)
                  .length > 0 && (
                  <div className="mt-8 pt-4 border-t border-gray-100 space-y-1.5">
                    <span className="text-[11px] font-medium text-gray-400">
                      Applied Highlights (click × to remove):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(session.highlights || [])
                        .filter((h) => h.questionId === currentQuestion.id)
                        .map((h) => (
                          <span
                            key={h.id}
                            className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                          >
                            <span className="truncate max-w-[140px]">"{h.text}"</span>
                            <button
                              onClick={() => removeHighlight(h.id)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Center Resizable Divider */}
              <div
                onMouseDown={() => setIsDraggingSplit(true)}
                className="w-[3px] bg-gray-300 hover:bg-gray-400 relative cursor-col-resize flex items-center justify-center shrink-0 select-none"
              >
                <div className="w-4 h-10 rounded-full bg-[#1f2937] text-white flex items-center justify-center text-[9px] font-mono shadow-md">
                  &lt;&gt;
                </div>
              </div>

              {/* Right Question & Options Pane */}
              <div className="flex-1 h-full overflow-y-auto px-8 py-6">
                {renderQuestionRightContent()}
              </div>
            </>
          ) : (
            /* SINGLE CENTERED COLUMN (Math) */
            <div className="flex-1 h-full overflow-y-auto px-6 py-5">
              <div className="max-w-[780px] mx-auto w-full">
                {renderQuestionRightContent()}
              </div>
            </div>
          )}
        </main>
      ) : null}

      {/* 4. Bluebook Exam Footer Bar (#e2e8e0) */}
      {session.viewMode !== 'review' && (
        <footer className="bg-[#e2e8e0] border-t border-dashed border-gray-400 px-6 py-2.5 flex items-center justify-between shrink-0">
          {/* Left: Student Full Name */}
          <div className="text-sm font-bold text-gray-900 min-w-[160px] truncate">
            {session.fullName}
          </div>

          {/* Center: Question X of Y ^ Popover Trigger */}
          <button
            onClick={() => setShowNavigator(!showNavigator)}
            className="px-4 py-2 rounded-lg bg-[#111827] hover:bg-[#1f2937] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <span>
              Question {safeIndex + 1} of {moduleQuestions.length}
            </span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Right: Back & Next Dark Green Pill Buttons */}
          <div className="flex items-center justify-end gap-2.5 min-w-[160px]">
            {safeIndex > 0 && (
              <button
                onClick={handleBack}
                className="px-5 py-2 rounded-full bg-[#1b4332] hover:bg-[#143325] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-full bg-[#1b4332] hover:bg-[#143325] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </footer>
      )}

      {/* Question Navigator Popover */}
      <QuestionNavigatorPopover
        isOpen={showNavigator}
        onClose={() => setShowNavigator(false)}
        moduleTitle={moduleConfig.title}
        questions={moduleQuestions}
        currentIndex={safeIndex}
        answers={session.answers}
        flagged={session.flagged}
        onSelectQuestion={(idx) => handleGoToQuestion(idx)}
        onGoToReviewPage={() => onSyncSession({ viewMode: 'review' })}
      />

      {/* Reference Sheet Modal */}
      <ReferenceModal isOpen={showReference} onClose={() => setShowReference(false)} />

      {/* Desmos Graphing Calculator Modal */}
      <DesmosModal isOpen={showCalculator} onClose={() => setShowCalculator(false)} />

      {/* Sticky Note Modal */}
      {activeNoteQuestionId && (
        <div className="fixed bottom-20 right-8 z-50 w-80 bg-amber-50 border border-amber-300 rounded-xl shadow-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" />
              <span>Question {safeIndex + 1} Note</span>
            </span>
            <button
              onClick={() => setActiveNoteQuestionId(null)}
              className="text-amber-700 hover:text-amber-950"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            rows={4}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Write your scratch notes for this question..."
            className="w-full bg-white/80 rounded-lg border border-amber-200 p-2 text-xs text-gray-900 focus:outline-none"
          />
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="text-base font-bold text-gray-900">Bluebook SAT Help & Shortcuts</h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-gray-700 leading-relaxed">
              <p>
                <strong>Mark for Review:</strong> Savolni keyinroq qaytib ko‘rib chiqish uchun bayroqcha bilan belgilang.
              </p>
              <p>
                <strong>Option Eliminator (ABC):</strong> O‘ng burchakdagi ABC tugmasi yordamida noto‘g‘ri deb hisoblagan variantlar ustidan chizib tashlang.
              </p>
              <p>
                <strong>Highlights & Notes:</strong> Matndan istalgan qismni sichqoncha bilan belgilab, sariq, ko‘k yoki pushti rangga bo‘yang.
              </p>
              <p>
                <strong>Real-Time Auto-Save:</strong> Belgilangan barcha javoblar darhol ma’lumotlar bazasiga saqlanadi.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderQuestionRightContent() {
    if (!currentQuestion) return null;
    const isFlagged = Boolean(session.flagged[currentQuestion.id]);
    const currentAnswer = session.answers[currentQuestion.id] || '';
    const eliminatedList = session.eliminated[currentQuestion.id] || [];

    return (
      <div className="space-y-5">
        {/* Question Header Bar (#f0f0f0 with dashed bottom border) */}
        <div className="bg-[#f0f0f0] border-b-2 border-dashed border-gray-400 px-3.5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-md bg-[#111111] text-white text-xs font-bold flex items-center justify-center">
              {currentQuestion.number}
            </span>
            <button
              onClick={handleToggleFlag}
              className="flex items-center gap-1.5 text-xs text-gray-800 hover:text-black cursor-pointer"
            >
              <Bookmark
                className={`w-4 h-4 ${
                  isFlagged ? 'text-red-600 fill-red-600' : 'text-gray-700'
                }`}
              />
              <span className={isFlagged ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}>
                Mark for Review
              </span>
            </button>
          </div>

          {currentQuestion.type === 'mcq' && (
            <button
              onClick={() => setEliminatorMode(!eliminatorMode)}
              className={`px-2.5 py-1 rounded-md border text-xs font-bold tracking-tight transition-colors cursor-pointer ${
                eliminatorMode
                  ? 'bg-[#1b4332] text-white border-[#1b4332]'
                  : 'bg-white text-gray-900 border-gray-500 hover:bg-gray-100'
              }`}
              title="Toggle Option Eliminator"
            >
              <span className="line-through decoration-2">ABC</span>
            </button>
          )}
        </div>

        {/* Question Body Container */}
        <div className="pl-3 pr-1 space-y-5">
          {currentQuestion.mathEquation && currentQuestion.mathEquation.length > 0 && (
            <div className="py-2 text-center text-[17px] text-[#111111] space-y-2.5">
              {currentQuestion.mathEquation.map((eq, i) => (
                <div
                  key={i}
                  dangerouslySetInnerHTML={{
                    __html: renderSATTextWithMath(eq, true),
                  }}
                />
              ))}
            </div>
          )}

          {/* Question Prompt in authentic SAT Serif + KaTeX */}
          <div
            className="sat-serif text-[16.5px] leading-[1.7] text-[#111111]"
            dangerouslySetInnerHTML={{
              __html: renderHighlightedHtml(currentQuestion.prompt),
            }}
          />

          {/* Answer Area: MCQ vs Student-Produced Response */}
          {currentQuestion.type === 'mcq' && currentQuestion.options ? (
            <div className="space-y-3 pt-1">
              {currentQuestion.options.map((opt) => {
                const isSelected = currentAnswer === opt.id;
                const isEliminated = eliminatedList.includes(opt.id);

                return (
                  <div key={opt.id} className="flex items-center gap-3">
                    <button
                      onClick={() => handleSelectOption(opt.id)}
                      className={`flex-1 text-left rounded-lg px-4 py-3 flex items-center gap-3.5 relative transition-all cursor-pointer ${
                        isSelected
                          ? 'border-2 border-[#1b4332] bg-emerald-50/25 shadow-xs'
                          : 'border border-gray-500 hover:border-gray-800 bg-white'
                      }`}
                    >
                      {isEliminated && (
                        <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-gray-800 z-10 pointer-events-none" />
                      )}

                      <span
                        className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition-colors font-sans ${
                          isEliminated
                            ? 'border border-gray-300 text-gray-400'
                            : isSelected
                            ? 'bg-[#1b4332] text-white border border-[#1b4332]'
                            : 'border border-gray-700 text-gray-900'
                        }`}
                      >
                        {opt.id}
                      </span>

                      <span
                        className={`sat-serif text-[16px] leading-snug ${
                          isEliminated ? 'text-gray-400' : 'text-[#111111]'
                        }`}
                        dangerouslySetInnerHTML={{
                          __html: renderHighlightedHtml(opt.text, isMathSection),
                        }}
                      />
                    </button>

                    {eliminatorMode && (
                      <button
                        onClick={() => handleToggleEliminate(opt.id)}
                        className="w-7 h-7 rounded-full border border-gray-500 flex items-center justify-center text-[11px] font-bold text-gray-700 hover:bg-gray-100 relative shrink-0 cursor-pointer"
                        title={isEliminated ? 'Restore option' : `Cross out option ${opt.id}`}
                      >
                        {isEliminated ? (
                          <span className="text-[10px] font-sans underline">Undo</span>
                        ) : (
                          <>
                            <span>{opt.id}</span>
                            <span className="absolute left-[-3px] right-[-3px] top-1/2 h-[1.5px] bg-gray-800" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Student-Produced Response */
            <div className="space-y-5 pt-2">
              <div className="bg-[#f3f4f6] border border-gray-200 rounded-xl p-5 space-y-1.5 text-gray-800">
                <h4 className="text-xs font-bold text-gray-900 font-sans">
                  Student-produced response
                </h4>
                <p className="text-xs leading-relaxed text-gray-700 font-sans">
                  Enter your answer in the box. You can enter up to 5 characters for a positive answer and 6 characters (including the negative sign) for a negative answer. Answers can be integers, decimals, or fractions.
                </p>
              </div>

              <div className="space-y-2 font-sans">
                <label className="block text-xs font-bold text-gray-900">
                  Your answer
                </label>
                <input
                  type="text"
                  value={currentAnswer}
                  onChange={(e) => handleSprChange(e.target.value)}
                  placeholder="Type your answer"
                  className="w-48 px-4 py-3 rounded-xl border border-gray-400 focus:border-[#1b4332] focus:ring-2 focus:ring-[#1b4332]/15 focus:outline-none text-sm font-mono text-gray-900"
                />
                <p className="text-[11px] text-gray-500">
                  Examples: 5, -3, 0.75, 3/4, 1.5
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
};
