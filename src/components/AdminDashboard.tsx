import React, { useState, useMemo, useEffect } from 'react';
import {
  Home,
  Search,
  Trash2,
  RotateCcw,
  Eye,
  Download,
  LogOut,
  Plus,
  Edit3,
  CheckCircle2,
  XCircle,
  X,
  Save,
  Upload,
  AlertTriangle,
  BookOpen,
  Calculator,
  Sliders,
  RefreshCw,
  FileJson,
  ArrowUpDown,
  FileText,
  AlertCircle,
  BarChart2,
  Calendar,
  BookMarked,
  Sigma,
  Gift,
  Ticket,
  PanelLeftClose,
  PanelLeftOpen,
  CalendarDays,
  ClipboardList,
  Menu,
  UserPlus,
  Clock,
} from 'lucide-react';
import {
  StudentSession,
  SATQuestion,
  MODULE_CONFIGS,
  MODULE_ORDER,
  ModuleId,
  QuestionType,
  QuestionDifficulty,
  QuestionVariant,
  ScoringConfig,
  domainsForModule,
} from '../types/sat';
import { isAnswerCorrect } from '../data/defaultQuestions';
import {
  itemDifficulty,
  scoreSession,
  computeStage1Routing,
  getModuleQuestionsForSession,
  getStage2RoutingWarnings,
} from '../lib/scoring/rasch';
import { CalibratedItemParamInput } from '../firebase';
import { renderSATTextWithMath } from '../utils/mathRenderer';
import {
  normalizeQuestionInput,
  validateQuestionInput,
  parseQuestionImport,
  QuestionImportResult,
  ImportPlacementTarget,
  getSessionVariantQuestions,
  formatModuleVariantLabel,
} from '../utils/questionValidation';
import {
  loadPlatformContent,
  savePlatformContent,
  PlatformContentConfig,
} from '../data/platformContent';

type AdminSidebarTab =
  | 'home'
  | 'questions'
  | 'results'
  | 'error_notebook'
  | 'my_metrics'
  | 'scoring'
  | 'study_plan'
  | 'vocabulary'
  | 'formula_sheet'
  | 'referrals'
  | 'promocode';

interface AdminDashboardProps {
  adminName: string;
  sessions: StudentSession[];
  questions: SATQuestion[];
  scoringConfig: ScoringConfig;
  onDeleteSession: (id: string) => Promise<void>;
  onResetSession: (id: string) => Promise<void>;
  onCreateStudentAccount?: (
    fullName: string,
    email: string,
    password: string
  ) => Promise<{ ok: boolean; message?: string }>;
  onUpdateQuestion: (q: SATQuestion) => Promise<void>;
  onAddQuestion: (q: Omit<SATQuestion, 'id' | 'number'>) => Promise<void>;
  onDeleteQuestion: (id: string) => Promise<void>;
  onImportQuestions: (
    items: Omit<SATQuestion, 'id' | 'number'>[],
    mode: 'replace_all' | 'append'
  ) => Promise<void>;
  onRedistributeSectionQuestions?: (section: 'rw' | 'math') => Promise<void>;
  onSaveScoringConfig: (
    cfg: Omit<ScoringConfig, 'version' | 'updatedAt'>
  ) => Promise<void>;
  onRecalculateAllSessions: () => Promise<{ updatedCount: number }>;
  onImportItemParams: (
    items: CalibratedItemParamInput[]
  ) => Promise<{ updatedCount: number; skippedIds: string[] }>;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminName,
  sessions,
  questions,
  scoringConfig,
  onDeleteSession,
  onResetSession,
  onCreateStudentAccount,
  onUpdateQuestion,
  onAddQuestion,
  onDeleteQuestion,
  onImportQuestions,
  onRedistributeSectionQuestions,
  onSaveScoringConfig,
  onRecalculateAllSessions,
  onImportItemParams,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<AdminSidebarTab>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [showAllLeaderboard, setShowAllLeaderboard] = useState(false);
  const [selectedExamDate, setSelectedExamDate] = useState<string | null>(null);

  // Shared Platform Content (Exam Dates, Study Plan, Vocabulary, Formulas, Promocodes)
  const [platformContent, setPlatformContent] = useState<PlatformContentConfig>(() =>
    loadPlatformContent()
  );
  const updatePlatformContent = (next: PlatformContentConfig) => {
    setPlatformContent(next);
    savePlatformContent(next);
  };

  // Inline Admin Content Creation States
  const [newExamLabel, setNewExamLabel] = useState('');
  const [newExamIso, setNewExamIso] = useState('');
  const [isAddingExamDate, setIsAddingExamDate] = useState(false);

  const [newPlanTitle, setNewPlanTitle] = useState('');
  const [newPlanDuration, setNewPlanDuration] = useState('32 min');
  const [newPlanModule, setNewPlanModule] = useState<ModuleId | ''>('rw_1');
  const [isAddingPlanTask, setIsAddingPlanTask] = useState(false);

  const [newVocabWord, setNewVocabWord] = useState('');
  const [newVocabPart, setNewVocabPart] = useState('adjective');
  const [newVocabDef, setNewVocabDef] = useState('');
  const [newVocabEx, setNewVocabEx] = useState('');

  const [newFormulaGroupTitle, setNewFormulaGroupTitle] = useState('');
  const [newFormulaGroupLines, setNewFormulaGroupLines] = useState('');

  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoPlan, setNewPromoPlan] = useState('Pro plan');
  const [newPromoBonus, setNewPromoBonus] = useState(500);

  // Admin Create Student Account Modal/Form state
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentPassword, setNewStudentPassword] = useState('');
  const [newStudentFeedback, setNewStudentFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [inspectedSessionId, setInspectedSessionId] = useState<string | null>(null);
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<ModuleId>('rw_1');
  const [selectedVariantFilter, setSelectedVariantFilter] = useState<
    'all' | 'easy' | 'hard' | 'common'
  >('all');
  const [hasManuallySelectedSection, setHasManuallySelectedSection] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SATQuestion | null>(null);
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);

  // Two-step delete confirmation state (no window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form validation & saving state
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);

  // New Question Form State
  const [newQModule, setNewQModule] = useState<ModuleId>('rw_1');
  const [newQVariant, setNewQVariant] = useState<QuestionVariant | ''>('');
  const [newQScored, setNewQScored] = useState<boolean>(true);
  const [newQType, setNewQType] = useState<QuestionType>('mcq');
  const [newQDomain, setNewQDomain] = useState<string>(domainsForModule('rw_1')[0]);
  const [newQSkill, setNewQSkill] = useState('');
  const [newQDifficulty, setNewQDifficulty] = useState<QuestionDifficulty | ''>('medium');
  const [newQPassage, setNewQPassage] = useState('');
  const [newQPrompt, setNewQPrompt] = useState('');
  const [newQOptA, setNewQOptA] = useState('');
  const [newQOptB, setNewQOptB] = useState('');
  const [newQOptC, setNewQOptC] = useState('');
  const [newQOptD, setNewQOptD] = useState('');
  const [newQCorrect, setNewQCorrect] = useState('A');
  const [newQExplanation, setNewQExplanation] = useState('');

  // JSON Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importPlacement, setImportPlacement] = useState<ImportPlacementTarget>('auto');
  const [importMode, setImportMode] = useState<'replace_all' | 'append'>('replace_all');
  const [importCheckResult, setImportCheckResult] = useState<QuestionImportResult | null>(null);
  const [importActionError, setImportActionError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isRedistributing, setIsRedistributing] = useState(false);

  // Scoring Tab State
  const [cfgArw, setCfgArw] = useState<number>(scoringConfig.A_rw);
  const [cfgBrw, setCfgBrw] = useState<number>(scoringConfig.B_rw);
  const [cfgAmath, setCfgAmath] = useState<number>(scoringConfig.A_math);
  const [cfgBmath, setCfgBmath] = useState<number>(scoringConfig.B_math);
  const [cfgCutRw, setCfgCutRw] = useState<number>(scoringConfig.cutRW);
  const [cfgCutMath, setCfgCutMath] = useState<number>(scoringConfig.cutMath);
  const [cfgExtremeAdjust, setCfgExtremeAdjust] = useState<number>(
    scoringConfig.extremeAdjust
  );
  const [cfgProvEasy, setCfgProvEasy] = useState<number>(scoringConfig.provisionalB.easy);
  const [cfgProvMedium, setCfgProvMedium] = useState<number>(
    scoringConfig.provisionalB.medium
  );
  const [cfgProvHard, setCfgProvHard] = useState<number>(scoringConfig.provisionalB.hard);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Item Parameters Table & Import State
  const [itemTableModuleFilter, setItemTableModuleFilter] = useState<'all' | ModuleId>('all');
  const [itemTableSortBy, setItemTableSortBy] = useState<
    'number' | 'b' | 'infit' | 'outfit' | 'n'
  >('number');
  const [itemTableSortDir, setItemTableSortDir] = useState<'asc' | 'desc'>('asc');
  const [isItemParamModalOpen, setIsItemParamModalOpen] = useState(false);
  const [itemParamJsonText, setItemParamJsonText] = useState('');
  const [isImportingItemParams, setIsImportingItemParams] = useState(false);
  const [itemParamFeedback, setItemParamFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setCfgArw(scoringConfig.A_rw);
    setCfgBrw(scoringConfig.B_rw);
    setCfgAmath(scoringConfig.A_math);
    setCfgBmath(scoringConfig.B_math);
    setCfgCutRw(scoringConfig.cutRW);
    setCfgCutMath(scoringConfig.cutMath);
    setCfgExtremeAdjust(scoringConfig.extremeAdjust);
    setCfgProvEasy(scoringConfig.provisionalB.easy);
    setCfgProvMedium(scoringConfig.provisionalB.medium);
    setCfgProvHard(scoringConfig.provisionalB.hard);
  }, [scoringConfig]);

  const selectedSection: 'rw' | 'math' = selectedModuleFilter.startsWith('rw_')
    ? 'rw'
    : 'math';
  const selectedSubModuleNumber: 1 | 2 = selectedModuleFilter.endsWith('_2') ? 2 : 1;

  const rw1Count = useMemo(
    () => questions.filter((q) => q.moduleId === 'rw_1').length,
    [questions]
  );
  const rw2Count = useMemo(
    () => questions.filter((q) => q.moduleId === 'rw_2').length,
    [questions]
  );
  const math1Count = useMemo(
    () => questions.filter((q) => q.moduleId === 'math_1').length,
    [questions]
  );
  const math2Count = useMemo(
    () => questions.filter((q) => q.moduleId === 'math_2').length,
    [questions]
  );
  const rwTotalCount = rw1Count + rw2Count;
  const mathTotalCount = math1Count + math2Count;

  // Per-(module, variant) statistics for counters
  const moduleGroupStats = useMemo(() => {
    const computeStat = (list: SATQuestion[], maxTotal: number, maxScored: number) => {
      const total = list.length;
      const pretest = list.filter((q) => q.scored === false).length;
      const scored = total - pretest;
      const isExact = total === maxTotal && scored === maxScored && pretest === 2;
      const isError = total > maxTotal || pretest > 2;
      return { total, scored, pretest, maxTotal, maxScored, isExact, isError };
    };

    const rw1 = computeStat(
      questions.filter((q) => q.moduleId === 'rw_1'),
      27,
      25
    );
    const rw2Easy = computeStat(
      questions.filter((q) => q.moduleId === 'rw_2' && q.variant === 'easy'),
      27,
      25
    );
    const rw2Hard = computeStat(
      questions.filter((q) => q.moduleId === 'rw_2' && q.variant === 'hard'),
      27,
      25
    );
    const rw2Common = computeStat(
      questions.filter((q) => q.moduleId === 'rw_2' && !q.variant),
      27,
      25
    );

    const math1 = computeStat(
      questions.filter((q) => q.moduleId === 'math_1'),
      22,
      20
    );
    const math2Easy = computeStat(
      questions.filter((q) => q.moduleId === 'math_2' && q.variant === 'easy'),
      22,
      20
    );
    const math2Hard = computeStat(
      questions.filter((q) => q.moduleId === 'math_2' && q.variant === 'hard'),
      22,
      20
    );
    const math2Common = computeStat(
      questions.filter((q) => q.moduleId === 'math_2' && !q.variant),
      22,
      20
    );

    return {
      rw_1: rw1,
      rw_2_easy: rw2Easy,
      rw_2_hard: rw2Hard,
      rw_2_common: rw2Common,
      math_1: math1,
      math_2_easy: math2Easy,
      math_2_hard: math2Hard,
      math_2_common: math2Common,
    };
  }, [questions]);

  const stage2Warnings = useMemo(() => getStage2RoutingWarnings(questions), [questions]);

  useEffect(() => {
    if (!hasManuallySelectedSection) {
      if (
        rwTotalCount === 0 &&
        mathTotalCount > 0 &&
        selectedModuleFilter.startsWith('rw_')
      ) {
        setSelectedModuleFilter(math1Count > 0 ? 'math_1' : 'math_2');
      } else if (
        mathTotalCount === 0 &&
        rwTotalCount > 0 &&
        selectedModuleFilter.startsWith('math_')
      ) {
        setSelectedModuleFilter(rw1Count > 0 ? 'rw_1' : 'rw_2');
      }
    }
  }, [
    hasManuallySelectedSection,
    rwTotalCount,
    mathTotalCount,
    rw1Count,
    math1Count,
    selectedModuleFilter,
  ]);

  const handleSelectSection = (sec: 'rw' | 'math') => {
    setHasManuallySelectedSection(true);
    setConfirmDeleteId(null);
    if (sec === 'rw') {
      setSelectedModuleFilter(selectedSubModuleNumber === 2 ? 'rw_2' : 'rw_1');
    } else {
      setSelectedModuleFilter(selectedSubModuleNumber === 2 ? 'math_2' : 'math_1');
    }
  };

  const handleSelectSubModule = (subNum: 1 | 2) => {
    setHasManuallySelectedSection(true);
    setConfirmDeleteId(null);
    const nextMod: ModuleId =
      selectedSection === 'rw'
        ? subNum === 1
          ? 'rw_1'
          : 'rw_2'
        : subNum === 1
        ? 'math_1'
        : 'math_2';
    setSelectedModuleFilter(nextMod);
  };

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.fullName.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      s.password.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'completed'
        ? s.status === 'completed'
        : s.status !== 'completed');
    return matchesSearch && matchesStatus;
  });

  // Helper to check section completion for a session
  const isSectionCompleted = (s: StudentSession, sec: 'rw' | 'math') => {
    if (s.status === 'completed') return true;
    const mod2: ModuleId = sec === 'rw' ? 'rw_2' : 'math_2';
    return Array.isArray(s.completedModules) && s.completedModules.includes(mod2);
  };

  const getSessionEffectiveResult = (s: StudentSession) => {
    if (s.result && s.result.rw && s.result.math) {
      return s.result;
    }
    const variantQs = getSessionVariantQuestions(questions, s.id);
    return scoreSession(s, variantQs, scoringConfig);
  };

  const getSessionEffectiveRouting = (s: StudentSession) => {
    const variantQs = getSessionVariantQuestions(questions, s.id);
    const rwStage1 = computeStage1Routing('rw', variantQs, s.answers || {}, scoringConfig);
    const mathStage1 = computeStage1Routing(
      'math',
      variantQs,
      s.answers || {},
      scoringConfig
    );
    return {
      rw: s.routing?.rw || rwStage1.variant,
      math: s.routing?.math || mathStage1.variant,
      rwTheta: s.routingTheta?.rw ?? rwStage1.theta,
      mathTheta: s.routingTheta?.math ?? mathStage1.theta,
    };
  };

  const totalStudents = sessions.length;
  const activeStudents = sessions.filter((s) => s.status !== 'completed').length;
  const completedSessions = sessions.filter(
    (s) =>
      s.status === 'completed' ||
      (isSectionCompleted(s, 'rw') && isSectionCompleted(s, 'math'))
  );
  const avgScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce(
            (acc, s) => acc + (s.result?.total ?? s.score.total),
            0
          ) / completedSessions.length
        )
      : 0;
  const maxScore =
    completedSessions.length > 0
      ? Math.max(...completedSessions.map((s) => s.result?.total ?? s.score.total))
      : 0;

  const inspectedSession = sessions.find((s) => s.id === inspectedSessionId) || null;

  const moduleQuestions = useMemo(() => {
    return questions
      .filter((q) => {
        if (q.moduleId !== selectedModuleFilter) return false;
        if (selectedSubModuleNumber === 2 && selectedVariantFilter !== 'all') {
          if (selectedVariantFilter === 'common') return !q.variant;
          return q.variant === selectedVariantFilter;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (a.variant || '').localeCompare(b.variant || '') || a.number - b.number
      );
  }, [questions, selectedModuleFilter, selectedSubModuleNumber, selectedVariantFilter]);

  const duplicateNumbersInModule = useMemo(() => {
    const seen = new Map<string, string[]>();
    for (const q of moduleQuestions) {
      const vTag = q.variant ? `${q.variant}:` : '';
      const key = `${vTag}${(q.passage || '').trim().toLowerCase()}|||${(
        q.prompt || ''
      )
        .trim()
        .toLowerCase()}`;
      const list = seen.get(key) || [];
      list.push(`${q.variant ? `[${q.variant}] ` : ''}#${q.number}`);
      seen.set(key, list);
    }
    const dupGroups: string[] = [];
    for (const nums of seen.values()) {
      if (nums.length > 1) {
        dupGroups.push(nums.join(', '));
      }
    }
    return dupGroups;
  }, [moduleQuestions]);

  // Item statistics across sessions for the Baholash tab
  const itemResponseStats = useMemo(() => {
    const stats = new Map<string, { n: number; correct: number }>();
    for (const q of questions) {
      stats.set(q.id, { n: 0, correct: 0 });
    }

    for (const s of sessions) {
      const variantQs = getSessionVariantQuestions(questions, s.id);
      const routingInfo = getSessionEffectiveRouting(s);
      const routing = { rw: routingInfo.rw, math: routingInfo.math };

      const seenModules: ModuleId[] =
        s.status === 'completed'
          ? MODULE_ORDER
          : Array.from(new Set([...(s.completedModules || []), s.currentModule]));

      for (const modId of seenModules) {
        const seenQs = getModuleQuestionsForSession(variantQs, modId, routing);
        for (const q of seenQs) {
          const ans = s.answers?.[q.id];
          const modCompleted =
            s.status === 'completed' || (s.completedModules || []).includes(modId);
          if (modCompleted || (ans !== undefined && ans !== '')) {
            const entry = stats.get(q.id) || { n: 0, correct: 0 };
            entry.n += 1;
            if (isAnswerCorrect(q, ans || '')) {
              entry.correct += 1;
            }
            stats.set(q.id, entry);
          }
        }
      }
    }
    return stats;
  }, [questions, sessions, scoringConfig]);

  const sortedItemTableQuestions = useMemo(() => {
    const filtered = questions.filter((q) =>
      itemTableModuleFilter === 'all' ? true : q.moduleId === itemTableModuleFilter
    );
    return [...filtered].sort((a, b) => {
      const dir = itemTableSortDir === 'asc' ? 1 : -1;
      if (itemTableSortBy === 'b') {
        const bA = itemDifficulty(a, scoringConfig);
        const bB = itemDifficulty(b, scoringConfig);
        return (bA - bB) * dir;
      }
      if (itemTableSortBy === 'infit') {
        return ((a.infit ?? 1) - (b.infit ?? 1)) * dir;
      }
      if (itemTableSortBy === 'outfit') {
        return ((a.outfit ?? 1) - (b.outfit ?? 1)) * dir;
      }
      if (itemTableSortBy === 'n') {
        const nA = itemResponseStats.get(a.id)?.n ?? 0;
        const nB = itemResponseStats.get(b.id)?.n ?? 0;
        return (nA - nB) * dir;
      }
      return (
        (MODULE_ORDER.indexOf(a.moduleId) - MODULE_ORDER.indexOf(b.moduleId) ||
          (a.variant || '').localeCompare(b.variant || '') ||
          a.number - b.number) * dir
      );
    });
  }, [
    questions,
    itemTableModuleFilter,
    itemTableSortBy,
    itemTableSortDir,
    scoringConfig,
    itemResponseStats,
  ]);

  const handleExportCSV = () => {
    const headers = [
      'Full Name',
      'Password',
      'Status',
      'Current Module',
      'Taxminiy Total Score (400-1600)',
      'R&W Taxminiy (200-800)',
      'R&W Stage 2 Routing',
      'R&W Theta',
      'Math Taxminiy (200-800)',
      'Math Stage 2 Routing',
      'Math Theta',
      'R&W Scored Correct',
      'Math Scored Correct',
      'Updated At',
    ];
    const rows = sessions.map((s) => {
      const rwDone = isSectionCompleted(s, 'rw');
      const mathDone = isSectionCompleted(s, 'math');
      const bothDone = rwDone && mathDone;
      const eff = getSessionEffectiveResult(s);
      const rInfo = getSessionEffectiveRouting(s);
      return [
        `"${s.fullName.replace(/"/g, '""')}"`,
        `"${s.password}"`,
        s.status,
        MODULE_CONFIGS[s.currentModule]?.shortTitle || s.currentModule,
        bothDone ? eff.total : '—',
        rwDone ? eff.rw.score : '—',
        rInfo.rw,
        rwDone ? eff.rw.theta : '—',
        mathDone ? eff.math.score : '—',
        rInfo.math,
        mathDone ? eff.math.theta : '—',
        `${eff.rw.rawScored}/${eff.rw.nScored}`,
        `${eff.math.rawScored}/${eff.math.nScored}`,
        s.updatedAt,
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `sat_results_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export responses CSV for calibration/calibrate.py: sessionId,section,questionId,scored,correct
  const handleExportCalibrationResponsesCSV = () => {
    const targetSessions =
      sessions.filter((s) => s.status === 'completed').length > 0
        ? sessions.filter((s) => s.status === 'completed')
        : sessions;

    const lines: string[] = ['sessionId,section,questionId,scored,correct'];

    for (const s of targetSessions) {
      const variantQs = getSessionVariantQuestions(questions, s.id);
      const rInfo = getSessionEffectiveRouting(s);
      const routing = { rw: rInfo.rw, math: rInfo.math };

      for (const modId of MODULE_ORDER) {
        const sec = modId.startsWith('rw_') ? 'rw' : 'math';
        const seenQs = getModuleQuestionsForSession(variantQs, modId, routing);
        for (const q of seenQs) {
          const scoredBit = q.scored === false ? 0 : 1;
          const correctBit = isAnswerCorrect(q, s.answers?.[q.id] || '') ? 1 : 0;
          lines.push(`${s.id},${sec},${q.id},${scoredBit},${correctBit}`);
        }
      }
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + lines.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `responses_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openCreateModal = (modId: ModuleId) => {
    const domains = domainsForModule(modId);
    setNewQModule(modId);
    setNewQVariant(
      modId.endsWith('_2') &&
        (selectedVariantFilter === 'easy' || selectedVariantFilter === 'hard')
        ? selectedVariantFilter
        : ''
    );
    setNewQScored(true);
    setNewQType('mcq');
    setNewQDomain(domains[0]);
    setNewQSkill('');
    setNewQDifficulty('medium');
    setNewQPassage('');
    setNewQPrompt('');
    setNewQOptA('');
    setNewQOptB('');
    setNewQOptC('');
    setNewQOptD('');
    setNewQCorrect('A');
    setNewQExplanation('');
    setCreateError(null);
    setIsCreatingQuestion(true);
  };

  const handleNewModuleChange = (modId: ModuleId) => {
    setNewQModule(modId);
    if (modId === 'rw_1' || modId === 'math_1') {
      setNewQVariant('');
    }
    const allowedDomains = domainsForModule(modId);
    if (!allowedDomains.includes(newQDomain)) {
      setNewQDomain(allowedDomains[0]);
    }
    if (modId.startsWith('rw_')) {
      setNewQType('mcq');
    }
  };

  const handleSaveNewQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const effectiveType: QuestionType = newQModule.startsWith('rw_') ? 'mcq' : newQType;
    const candidate = normalizeQuestionInput({
      moduleId: newQModule,
      variant:
        (newQModule === 'rw_2' || newQModule === 'math_2') && newQVariant
          ? (newQVariant as QuestionVariant)
          : undefined,
      scored: newQScored,
      type: effectiveType,
      domain: newQDomain,
      skill: newQSkill || undefined,
      difficulty: newQDifficulty ? (newQDifficulty as QuestionDifficulty) : undefined,
      passage: newQPassage,
      prompt: newQPrompt,
      options:
        effectiveType === 'mcq'
          ? [
              { id: 'A' as const, text: newQOptA },
              { id: 'B' as const, text: newQOptB },
              { id: 'C' as const, text: newQOptC },
              { id: 'D' as const, text: newQOptD },
            ]
          : undefined,
      correctAnswer: newQCorrect,
      explanation: newQExplanation,
    });

    const validationErr = validateQuestionInput(candidate);
    if (validationErr) {
      setCreateError(validationErr);
      return;
    }

    setIsSavingQuestion(true);
    try {
      await onAddQuestion({
        moduleId: candidate.moduleId!,
        variant: candidate.variant,
        scored: candidate.scored !== false,
        type: candidate.type!,
        domain: candidate.domain,
        skill: candidate.skill,
        difficulty: candidate.difficulty,
        passage: candidate.passage,
        prompt: candidate.prompt!,
        options: candidate.options,
        correctAnswer: candidate.correctAnswer!,
        explanation: candidate.explanation,
      });
      setIsCreatingQuestion(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleSaveEditedQuestion = async () => {
    if (!editingQuestion) return;
    setEditError(null);

    const effectiveType: QuestionType = editingQuestion.moduleId.startsWith('rw_')
      ? 'mcq'
      : editingQuestion.type;

    const candidate = normalizeQuestionInput({
      ...editingQuestion,
      type: effectiveType,
      options:
        effectiveType === 'mcq'
          ? editingQuestion.options && editingQuestion.options.length === 4
            ? editingQuestion.options
            : [
                { id: 'A', text: '' },
                { id: 'B', text: '' },
                { id: 'C', text: '' },
                { id: 'D', text: '' },
              ]
          : undefined,
    });

    const validationErr = validateQuestionInput(candidate);
    if (validationErr) {
      setEditError(validationErr);
      return;
    }

    setIsSavingQuestion(true);
    try {
      await onUpdateQuestion(candidate as SATQuestion);
      setEditingQuestion(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleConfirmDeleteQuestion = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteQuestion(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setImportJsonText(content);
      setImportCheckResult(
        parseQuestionImport(content, {
          targetPlacement: importPlacement,
          autoBalanceModules: true,
          fallbackSection: selectedSection,
        })
      );
      setImportActionError(null);
    };
    reader.readAsText(file);
  };

  const handleCheckImportJson = () => {
    setImportActionError(null);
    setImportCheckResult(
      parseQuestionImport(importJsonText, {
        targetPlacement: importPlacement,
        autoBalanceModules: true,
        fallbackSection: selectedSection,
      })
    );
  };

  const handleExecuteImport = async () => {
    const res = parseQuestionImport(importJsonText, {
      targetPlacement: importPlacement,
      autoBalanceModules: true,
      fallbackSection: selectedSection,
    });
    setImportCheckResult(res);
    if (res.errors.length > 0 || res.items.length === 0) return;

    setIsImporting(true);
    setImportActionError(null);
    try {
      await onImportQuestions(res.items, importMode);
      setIsImportModalOpen(false);
      setImportJsonText('');
      setImportCheckResult(null);
      const firstImportedMod = MODULE_ORDER.find((m) => res.counts[m] > 0);
      if (firstImportedMod) {
        setHasManuallySelectedSection(true);
        setSelectedModuleFilter(firstImportedMod);
      }
    } catch (err) {
      setImportActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
    }
  };

  const handleTriggerRedistributeSection = async (sec: 'rw' | 'math') => {
    if (!onRedistributeSectionQuestions) return;
    setIsRedistributing(true);
    try {
      await onRedistributeSectionQuestions(sec);
    } finally {
      setIsRedistributing(false);
    }
  };

  const handleSubmitScoringConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigFeedback(null);
    try {
      await onSaveScoringConfig({
        A_rw: Number(cfgArw),
        B_rw: Number(cfgBrw),
        A_math: Number(cfgAmath),
        B_math: Number(cfgBmath),
        cutRW: Number(cfgCutRw),
        cutMath: Number(cfgCutMath),
        extremeAdjust: Number(cfgExtremeAdjust),
        provisionalB: {
          easy: Number(cfgProvEasy),
          medium: Number(cfgProvMedium),
          hard: Number(cfgProvHard),
        },
      });
      setConfigFeedback({
        type: 'success',
        text: 'Baholash konfiguratsiyasi saqlandi (versiya yangilandi).',
      });
    } catch (err) {
      setConfigFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleTriggerRecalculateAll = async () => {
    setIsRecalculating(true);
    setConfigFeedback(null);
    try {
      const { updatedCount } = await onRecalculateAllSessions();
      setConfigFeedback({
        type: 'success',
        text: `Barcha sessiyalar (${updatedCount} ta) joriy Rasch konfiguratsiyasi asosida qayta hisoblandi.`,
      });
    } catch (err) {
      setConfigFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleItemParamFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setItemParamJsonText(content);
      setItemParamFeedback(null);
    };
    reader.readAsText(file);
  };

  const handleExecuteImportItemParams = async () => {
    setItemParamFeedback(null);
    const trimmed = itemParamJsonText.trim();
    if (!trimmed) {
      setItemParamFeedback({
        type: 'error',
        text: 'JSON matni bo‘sh.',
      });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      setItemParamFeedback({
        type: 'error',
        text: `JSON xato: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    const rawItems: unknown[] | null = Array.isArray(parsed)
      ? parsed
      : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as Record<string, unknown>).items)
      ? ((parsed as Record<string, unknown>).items as unknown[])
      : null;

    if (!rawItems || rawItems.length === 0) {
      setItemParamFeedback({
        type: 'error',
        text: 'JSON ichida "items" massivi topilmadi.',
      });
      return;
    }

    const rawCalAt =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>).calibratedAt
        : undefined;
    const calibratedAtMs =
      typeof rawCalAt === 'number' && Number.isFinite(rawCalAt)
        ? rawCalAt
        : typeof rawCalAt === 'string' && !isNaN(Date.parse(rawCalAt))
        ? Date.parse(rawCalAt)
        : Date.now();

    const validParams: CalibratedItemParamInput[] = [];
    for (const raw of rawItems) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const id = String(obj.id || obj.questionId || '').trim();
      const bVal = Number(obj.b);
      if (!id || !Number.isFinite(bVal)) continue;
      validParams.push({
        id,
        b: bVal,
        bSE: Number.isFinite(Number(obj.bSE)) ? Number(obj.bSE) : undefined,
        infit: Number.isFinite(Number(obj.infit)) ? Number(obj.infit) : undefined,
        outfit: Number.isFinite(Number(obj.outfit)) ? Number(obj.outfit) : undefined,
        calibratedAt: calibratedAtMs,
      });
    }

    if (validParams.length === 0) {
      setItemParamFeedback({
        type: 'error',
        text: 'Hech qanday yaroqli {id, b} parametri topilmadi.',
      });
      return;
    }

    setIsImportingItemParams(true);
    try {
      const res = await onImportItemParams(validParams);
      setItemParamFeedback({
        type: 'success',
        text: `${res.updatedCount} ta savolning Rasch (b) parametrlari yangilandi.${
          res.skippedIds.length > 0
            ? ` Bazada topilmagan IDlar (${res.skippedIds.length} ta): ${res.skippedIds
                .slice(0, 5)
                .join(', ')}`
            : ''
        }`,
      });
    } catch (err) {
      setItemParamFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsImportingItemParams(false);
    }
  };

  // Platform-wide KPIs, Weekly Activity, Leaderboard, Global Errors & Domain Metrics
  const platformDashboardStats = useMemo(() => {
    let totalAnswered = 0;
    let totalCorrect = 0;
    let totalSpentSeconds = 0;

    const totalDefaultSeconds =
      MODULE_CONFIGS.rw_1.durationSeconds +
      MODULE_CONFIGS.rw_2.durationSeconds +
      MODULE_CONFIGS.math_1.durationSeconds +
      MODULE_CONFIGS.math_2.durationSeconds;

    const errorCountsByQuestionId = new Map<
      string,
      { question: SATQuestion; wrongCount: number; attemptCount: number }
    >();
    const qLookup = new Map<string, SATQuestion>();
    for (const q of questions) {
      qLookup.set(q.id, q);
    }

    const rwDomains: Record<string, { correct: number; total: number }> = {};
    const mathDomains: Record<string, { correct: number; total: number }> = {};

    for (const s of sessions) {
      const rem =
        (s.moduleTimeRemaining?.rw_1 ?? MODULE_CONFIGS.rw_1.durationSeconds) +
        (s.moduleTimeRemaining?.rw_2 ?? MODULE_CONFIGS.rw_2.durationSeconds) +
        (s.moduleTimeRemaining?.math_1 ?? MODULE_CONFIGS.math_1.durationSeconds) +
        (s.moduleTimeRemaining?.math_2 ?? MODULE_CONFIGS.math_2.durationSeconds);
      totalSpentSeconds += Math.max(0, totalDefaultSeconds - rem);

      for (const [qId, ans] of Object.entries(s.answers || {})) {
        if (ans === undefined || String(ans).trim() === '') continue;
        const qObj = qLookup.get(qId);
        if (!qObj) continue;

        totalAnswered += 1;
        const ok = isAnswerCorrect(qObj, ans);
        if (ok) {
          totalCorrect += 1;
        }

        const prevErr = errorCountsByQuestionId.get(qId) || {
          question: qObj,
          wrongCount: 0,
          attemptCount: 0,
        };
        prevErr.attemptCount += 1;
        if (!ok) prevErr.wrongCount += 1;
        errorCountsByQuestionId.set(qId, prevErr);

        const dom = qObj.domain || 'General';
        const targetDomMap = qObj.moduleId.startsWith('rw_') ? rwDomains : mathDomains;
        if (!targetDomMap[dom]) {
          targetDomMap[dom] = { correct: 0, total: 0 };
        }
        targetDomMap[dom].total += 1;
        if (ok) targetDomMap[dom].correct += 1;
      }
    }

    const accuracy =
      totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const totalPoints = totalCorrect * 175;
    const totalMinutes = Math.max(
      totalAnswered > 0 ? 1 : 0,
      Math.round(totalSpentSeconds / 60)
    );
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    // Weekly Activity (Sat -> Fri)
    const days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
    const mapDayToIdx: Record<number, number> = {
      6: 0,
      0: 1,
      1: 2,
      2: 3,
      3: 4,
      4: 5,
      5: 6,
    };
    for (const s of sessions) {
      const d = new Date(s.updatedAt || s.startedAt || Date.now());
      const idx = mapDayToIdx[d.getDay()] ?? 5;
      dayCounts[idx] += Math.max(1, Object.keys(s.answers || {}).length);
    }
    const todayIdx = mapDayToIdx[new Date().getDay()] ?? 5;
    if (!dayCounts.some((c) => c > 0)) {
      dayCounts[todayIdx] = Math.max(totalAnswered, 4);
    }

    const weeklyBars = days.map((day, idx) => ({
      day,
      count: dayCounts[idx],
      isActive: dayCounts[idx] > 0 || idx === todayIdx,
    }));

    const globalErrorList = Array.from(errorCountsByQuestionId.values())
      .filter((item) => item.wrongCount > 0)
      .sort((a, b) => b.wrongCount - a.wrongCount);

    return {
      totalAnswered,
      totalCorrect,
      accuracy,
      totalPoints,
      streak: Math.max(1, sessions.length),
      studyTimeFormatted: `${hours}h ${mins}m`,
      weeklyBars,
      globalErrorList,
      rwDomains,
      mathDomains,
    };
  }, [sessions, questions]);

  // Leaderboard entries (Real sessions + benchmark students matching screenshot)
  const leaderboard = useMemo(() => {
    const entries: {
      id: string;
      sessionId?: string;
      name: string;
      email?: string;
      points: number;
      initial: string;
      color: string;
      statusLabel?: string;
    }[] = [
      {
        id: 'bench_top_1',
        name: 'Mamataliyev Baxtiyor',
        points: leaderboardPeriod === 'weekly' ? 18130 : 36200,
        initial: 'M',
        color: 'bg-[#059669]',
        statusLabel: 'Top 1',
      },
      {
        id: 'bench_top_2',
        name: 'Akbar Yoldoshev',
        points: leaderboardPeriod === 'weekly' ? 14525 : 29800,
        initial: 'A',
        color: 'bg-[#2563eb]',
        statusLabel: 'Top 2',
      },
      {
        id: 'bench_top_3',
        name: 'Nasrin Hridy',
        points: leaderboardPeriod === 'weekly' ? 12070 : 28450,
        initial: 'N',
        color: 'bg-[#ea580c]',
        statusLabel: 'Top 3',
      },
    ];

    const colors = ['bg-[#2563eb]', 'bg-[#059669]', 'bg-[#ea580c]', 'bg-[#7c3aed]'];
    sessions.forEach((s, i) => {
      const answered = Object.keys(s.answers || {}).length;
      const pts =
        Math.max(s.score?.rwRaw || 0, answered) * 175 +
        (s.status === 'completed' ? s.score?.total || 0 : 0);
      const existingIdx = entries.findIndex(
        (e) => e.name.toLowerCase() === s.fullName.toLowerCase()
      );
      const entry = {
        id: s.id,
        sessionId: s.id,
        name: s.fullName,
        email: s.email,
        points: pts,
        initial: (s.fullName.trim()[0] || 'S').toUpperCase(),
        color: colors[i % colors.length],
        statusLabel: s.status === 'completed' ? 'Yakunlangan' : 'Jarayonda',
      };
      if (existingIdx >= 0) {
        entries[existingIdx] = {
          ...entry,
          points: Math.max(entries[existingIdx].points, pts),
        };
      } else {
        entries.push(entry);
      }
    });

    return entries.sort((a, b) => b.points - a.points);
  }, [sessions, leaderboardPeriod]);

  const topThree = leaderboard.slice(0, 3);

  const countdownDays = useMemo(() => {
    if (!selectedExamDate) return null;
    const target = new Date(selectedExamDate).getTime();
    const now = Date.now();
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [selectedExamDate]);

  const navSelect = (tab: AdminSidebarTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const handleAddExamDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamLabel.trim() || !newExamIso.trim()) return;
    const next: PlatformContentConfig = {
      ...platformContent,
      examDates: [
        ...platformContent.examDates,
        {
          id: `date_${Date.now()}`,
          label: newExamLabel.trim(),
          iso: newExamIso.trim(),
        },
      ],
    };
    updatePlatformContent(next);
    setNewExamLabel('');
    setNewExamIso('');
    setIsAddingExamDate(false);
  };

  const handleRemoveExamDate = (id: string) => {
    updatePlatformContent({
      ...platformContent,
      examDates: platformContent.examDates.filter((d) => d.id !== id),
    });
  };

  const handleAddPlanTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanTitle.trim()) return;
    updatePlatformContent({
      ...platformContent,
      studyPlanTemplates: [
        ...platformContent.studyPlanTemplates,
        {
          id: `tpl_${Date.now()}`,
          title: newPlanTitle.trim(),
          duration: newPlanDuration.trim() || '30 min',
          moduleId: newPlanModule || undefined,
        },
      ],
    });
    setNewPlanTitle('');
    setIsAddingPlanTask(false);
  };

  const handleRemovePlanTemplate = (id: string) => {
    updatePlatformContent({
      ...platformContent,
      studyPlanTemplates: platformContent.studyPlanTemplates.filter((t) => t.id !== id),
    });
  };

  const handleCreateStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateStudentAccount) return;
    setNewStudentFeedback(null);
    const res = await onCreateStudentAccount(
      newStudentName,
      newStudentEmail,
      newStudentPassword
    );
    if (res.ok) {
      setNewStudentFeedback({
        type: 'success',
        text: res.message || 'O‘quvchi akkaunti muvaffaqiyatli yaratildi!',
      });
      setNewStudentName('');
      setNewStudentEmail('');
      setNewStudentPassword('');
    } else {
      setNewStudentFeedback({
        type: 'error',
        text: res.message || 'Xatolik yuz berdi.',
      });
    }
  };

  const adminInitial = (adminName.trim()[0] || 'A').toUpperCase();

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col md:flex-row p-2 sm:p-4 gap-4 sm:gap-6">
      {/* Mobile Header Bar */}
      <div className="flex md:hidden items-center justify-between px-3 py-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-base font-extrabold tracking-tight text-slate-900">
            Bluebook
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-slate-900 text-white rounded">
            SAT
          </span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-[#2563eb] rounded border border-blue-200">
            ADMIN
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              navSelect('questions');
              openCreateModal(selectedModuleFilter);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#2563eb] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Savol</span>
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

      {/* Left Sidebar (Exact Match to image_c60a7b94.png on White Theme) */}
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

          {/* Home Button (Active Bordered Pill like image_c60a7b94.png) */}
          <div>
            <button
              type="button"
              onClick={() => navSelect('home')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'home'
                  ? 'bg-slate-100/80 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
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
              onClick={() => navSelect('questions')}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'questions'
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>Question Bank</span>}
              </span>
              {!sidebarCollapsed && (
                <span className="text-[11px] font-mono text-slate-400">
                  {questions.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navSelect('results')}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'results'
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
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
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <span className="flex items-center gap-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>Error Notebook</span>}
              </span>
              {!sidebarCollapsed && platformDashboardStats.globalErrorList.length > 0 && (
                <span className="text-[11px] font-bold text-red-600">
                  {platformDashboardStats.globalErrorList.length}
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
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <BarChart2 className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>My Metrics</span>}
            </button>

            <button
              type="button"
              onClick={() => navSelect('scoring')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'scoring'
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
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
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
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
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
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
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Sigma className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Formula Sheet</span>}
            </button>
          </div>
        </div>

        {/* Bottom Links & Admin Profile Card */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => navSelect('referrals')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'referrals'
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
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
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Ticket className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>Promocode</span>}
            </button>
          </div>

          {/* Admin Profile Pill at Bottom */}
          <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#2563eb] text-white font-bold text-xs flex items-center justify-center shrink-0">
                {adminInitial}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {adminName}
                  </div>
                  <div className="text-[10px] font-semibold text-[#2563eb] truncate">
                    Boshqaruv Paneli
                  </div>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={onLogout}
                title="Admin panelidan chiqish"
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
        {activeTab === 'home' ? (
          <>
            {/* Top Header matching image_c60a7b94.png */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Dashboard
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#2563eb] border border-blue-200">
                  Admin Boshqaruvi
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navSelect('results')}
                  className="px-3.5 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#2563eb]" />
                  <span>O‘quvchilar ({sessions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navSelect('questions');
                    openCreateModal(selectedModuleFilter);
                  }}
                  className="px-4 py-2.5 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Practice Test / Savol Qo‘shish</span>
                </button>
              </div>
            </div>

            {/* 5-Column Top KPI Strip with Vertical Dividers (Exact Match to image_c60a7b94.png) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-6 py-4 px-2 border-b border-slate-100 lg:divide-x lg:divide-slate-200">
              <div className="px-4 first:pl-0 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Accuracy</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {platformDashboardStats.accuracy}%
                </div>
                <div className="text-xs text-slate-400">
                  {platformDashboardStats.totalCorrect} correct
                </div>
              </div>

              <div className="px-4 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Total points</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {platformDashboardStats.totalPoints}
                </div>
                <div className="text-xs text-slate-400">Lifetime points</div>
              </div>

              <div className="px-4 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Streak</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {platformDashboardStats.streak}
                </div>
                <div className="text-xs text-slate-400">Start your streak</div>
              </div>

              <div className="px-4 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Study Time</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {platformDashboardStats.studyTimeFormatted}
                </div>
                <div className="text-xs text-slate-400">Total time spent</div>
              </div>

              <div className="px-4 space-y-2">
                <div className="text-xs font-semibold text-slate-600">Total Attempts</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {platformDashboardStats.totalAnswered}
                </div>
                <div className="text-xs text-slate-400">All questions tried</div>
              </div>
            </div>

            {/* Middle 3-Card Row: Weekly Activity | Exam Countdown | Today's plan */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Card 1: Weekly Activity */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between min-h-[240px]">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">Weekly Activity</h2>
                  <span className="text-xs font-semibold text-slate-600">
                    {platformDashboardStats.totalAnswered} questions
                  </span>
                </div>

                <div className="relative pt-8 pb-2 flex-1 flex flex-col justify-end">
                  <div className="absolute inset-x-0 top-8 bottom-8 flex flex-col justify-between pointer-events-none">
                    <div className="border-b border-dashed border-slate-200 w-full" />
                    <div className="border-b border-dashed border-slate-200 w-full" />
                    <div className="border-b border-dashed border-slate-200 w-full" />
                    <div className="border-b border-slate-200 w-full" />
                  </div>

                  <div className="relative z-10 grid grid-cols-7 gap-2 items-end h-28 pt-4">
                    {platformDashboardStats.weeklyBars.map((bar) => (
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

              {/* Card 2: Exam Countdown (with Admin Date Manager) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between min-h-[240px]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <h2 className="text-base font-bold text-slate-900">
                        Exam Countdown
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingExamDate(!isAddingExamDate)}
                      className="text-xs font-semibold text-[#2563eb] hover:underline cursor-pointer"
                    >
                      {isAddingExamDate ? 'Yopish' : '+ Sana'}
                    </button>
                  </div>

                  {isAddingExamDate ? (
                    <form onSubmit={handleAddExamDate} className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newExamLabel}
                          onChange={(e) => setNewExamLabel(e.target.value)}
                          placeholder="Masalan: Aug 28, 2027"
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                        <input
                          type="date"
                          value={newExamIso}
                          onChange={(e) => setNewExamIso(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-1.5 rounded-lg bg-[#2563eb] text-white text-xs font-bold cursor-pointer"
                      >
                        Sanani saqlash
                      </button>
                    </form>
                  ) : selectedExamDate ? (
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
                      <div
                        key={d.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          isSelected
                            ? 'bg-[#2563eb] text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedExamDate(isSelected ? null : d.iso)
                          }
                          className="cursor-pointer"
                        >
                          {d.label}
                        </button>
                        {isAddingExamDate && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExamDate(d.id)}
                            title="Sanani o‘chirish"
                            className="text-red-500 hover:text-red-700 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 3: Today's plan (with Admin Plan Manager) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between min-h-[240px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <h2 className="text-base font-bold text-slate-900">Today's plan</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navSelect('study_plan')}
                    className="text-xs font-semibold text-[#2563eb] hover:underline cursor-pointer"
                  >
                    View all
                  </button>
                </div>

                <div className="space-y-2 pt-3">
                  {platformContent.studyPlanTemplates.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      onClick={() => navSelect('study_plan')}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          readOnly
                          checked={false}
                          className="rounded border-slate-300 text-[#2563eb] pointer-events-none"
                        />
                        <span className="truncate font-medium text-slate-800">
                          {task.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                        {task.duration}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Leaderboard Section (Exact Podium Match + Quick Session Inspector) */}
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

              {/* Full Leaderboard & Quick Admin Actions */}
              {showAllLeaderboard && (
                <div className="pt-4 border-t border-slate-200 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Points</th>
                        <th className="py-2.5 px-3 text-right">Admin Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaderboard.map((item, index) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {index + 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full ${item.color} text-white text-[11px] font-bold flex items-center justify-center`}
                            >
                              {item.initial}
                            </span>
                            <div>
                              <div className="font-semibold">{item.name}</div>
                              {item.email && (
                                <div className="text-[10px] text-slate-400">
                                  {item.email}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {item.statusLabel || 'Active'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                            {item.points.toLocaleString('ru-RU')} pts
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {item.sessionId ? (
                              <button
                                type="button"
                                onClick={() => setInspectedSessionId(item.sessionId!)}
                                className="text-xs font-bold text-[#2563eb] hover:underline cursor-pointer"
                              >
                                Tahlilni ko‘rish
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">Benchmark</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'results' ? (
          <>
            {/* Top Header for Practice Tests / Student Sessions Management */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Practice Tests & O‘quvchilar Boshqaruvi ({sessions.length})
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Barcha ro‘yxatdan o‘tgan o‘quvchilarning real vaqtdagi natijalari, javoblar varaqasi va akkaunt boshqaruvi.
                </p>
              </div>
              {onCreateStudentAccount && (
                <button
                  type="button"
                  onClick={() => {
                    setNewStudentFeedback(null);
                    setIsAddingStudent(!isAddingStudent);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isAddingStudent ? 'Formani yopish' : '+ Yangi O‘quvchi Akkaunti'}</span>
                </button>
              )}
            </div>

            {isAddingStudent && onCreateStudentAccount && (
              <form
                onSubmit={handleCreateStudentSubmit}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4"
              >
                <div className="text-xs font-bold text-slate-900">
                  Yangi o‘quvchi akkauntini ro‘yxatdan o‘tkazish
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="Ism va Familiya"
                    className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                  />
                  <input
                    type="email"
                    required
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    placeholder="Elektron pochta (masalan: ali@gmail.com)"
                    className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={newStudentPassword}
                    onChange={(e) => setNewStudentPassword(e.target.value)}
                    placeholder="Maxsus parol (kamida 4 belgi)"
                    className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                  />
                </div>
                {newStudentFeedback && (
                  <div
                    className={`text-xs font-semibold ${
                      newStudentFeedback.type === 'success'
                        ? 'text-emerald-700'
                        : 'text-red-600'
                    }`}
                  >
                    {newStudentFeedback.text}
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-bold cursor-pointer"
                  >
                    Akkauntni yaratish
                  </button>
                </div>
              </form>
            )}

            {/* 4 KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
                <span className="text-xs font-medium text-slate-500">Jami O‘quvchilar</span>
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {totalStudents}
                </div>
                <p className="text-xs text-slate-500">Ro‘yxatdan o‘tgan urinishlar</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
                <span className="text-xs font-medium text-slate-500">Hozir Topshirmoqda</span>
                <div className="text-3xl font-bold text-[#2563eb] tabular-nums">
                  {activeStudents}
                </div>
                <p className="text-xs text-slate-500">Real vaqtda faol sessiyalar</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
                <span className="text-xs font-medium text-slate-500">
                  O‘rtacha Taxminiy Ball
                </span>
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {completedSessions.length > 0 ? avgScore : '—'}
                </div>
                <p className="text-xs text-slate-500">
                  Yakunlangan urinishlar (400–1600)
                </p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
                <span className="text-xs font-medium text-slate-500">
                  Eng Yuqori Taxminiy Ball
                </span>
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {completedSessions.length > 0 ? maxScore : '—'}
                </div>
                <p className="text-xs text-slate-500">Maksimal qayd etilgan natija</p>
              </div>
            </div>

            {/* Filters & Actions Bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Ism-familiya yoki parol bo‘yicha qidirish..."
                      className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:border-[#2563eb] focus:outline-none text-slate-900"
                    />
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        statusFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Barchasi
                    </button>
                    <button
                      onClick={() => setStatusFilter('in_progress')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        statusFilter === 'in_progress'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Jarayonda
                    </button>
                    <button
                      onClick={() => setStatusFilter('completed')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        statusFilter === 'completed'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Yakunlangan
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Natijalarni yuklab olish (CSV)</span>
                </button>
              </div>

              {/* Live Student Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">O‘quvchi (Ism Familiya)</th>
                      <th className="py-3 px-4">Parol</th>
                      <th className="py-3 px-4">Holati va Modul</th>
                      <th className="py-3 px-4">Belgilanishi</th>
                      <th className="py-3 px-4">R&W Taxminiy (200–800)</th>
                      <th className="py-3 px-4">Math Taxminiy (200–800)</th>
                      <th className="py-3 px-4">Taxminiy Jami (1600)</th>
                      <th className="py-3 px-4 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-500">
                          Hozircha o‘quvchilar topilmadi.
                        </td>
                      </tr>
                    ) : (
                      filteredSessions.map((s) => {
                        const rwDone = isSectionCompleted(s, 'rw');
                        const mathDone = isSectionCompleted(s, 'math');
                        const bothDone = rwDone && mathDone;
                        const eff = getSessionEffectiveResult(s);
                        const rInfo = getSessionEffectiveRouting(s);
                        const rwRoute =
                          s.routing?.rw ||
                          (s.completedModules.includes('rw_1') ? rInfo.rw : undefined);
                        const mathRoute =
                          s.routing?.math ||
                          (s.completedModules.includes('math_1') ? rInfo.math : undefined);

                        return (
                          <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{s.fullName}</div>
                              {s.email && (
                                <div className="text-[11px] font-normal text-slate-500">
                                  {s.email}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">
                              {s.password}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700">
                              <span className="font-semibold">
                                {s.status === 'completed'
                                  ? 'Yakunlangan'
                                  : s.status === 'break'
                                  ? 'Tanaffusda'
                                  : 'Topshirmoqda'}
                              </span>
                              <span aria-hidden="true"> · </span>
                              <span className="text-slate-500">
                                {MODULE_CONFIGS[s.currentModule]?.shortTitle} (Q
                                {s.currentQuestionIndex + 1})
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700">
                              {s.score.totalAnswered} / {s.score.totalQuestions}
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums">
                              {rwDone ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900">
                                    {eff.rw.score}
                                  </span>
                                  <span className="text-slate-400 text-[11px]">
                                    ({eff.rw.rawScored}/{eff.rw.nScored})
                                  </span>
                                  {rwRoute && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                                        rwRoute === 'hard'
                                          ? 'bg-purple-100 text-purple-800'
                                          : 'bg-sky-100 text-sky-800'
                                      }`}
                                    >
                                      {rwRoute}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <span className="font-bold text-slate-500">—</span>
                                  {rwRoute && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-slate-100 text-slate-600 uppercase">
                                      M2: {rwRoute}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums">
                              {mathDone ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900">
                                    {eff.math.score}
                                  </span>
                                  <span className="text-slate-400 text-[11px]">
                                    ({eff.math.rawScored}/{eff.math.nScored})
                                  </span>
                                  {mathRoute && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                                        mathRoute === 'hard'
                                          ? 'bg-purple-100 text-purple-800'
                                          : 'bg-sky-100 text-sky-800'
                                      }`}
                                    >
                                      {mathRoute}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <span className="font-bold text-slate-500">—</span>
                                  {mathRoute && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-sans bg-slate-100 text-slate-600 uppercase">
                                      M2: {mathRoute}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums">
                              {bothDone ? (
                                <span className="text-base font-bold text-[#2563eb]">
                                  {eff.total}
                                </span>
                              ) : (
                                <span className="text-base font-bold text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setInspectedSessionId(s.id)}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                  title="Javoblar va Rasch ko‘rsatkichlarini tekshirish"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onResetSession(s.id)}
                                  className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                  title="Urinishni nolga tushirish"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onDeleteSession(s.id)}
                                  className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                                  title="O‘chirish"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
          </>
        ) : activeTab === 'questions' ? (
          /* Question Bank Management Tab */
          <div className="space-y-5">
            {/* Top-Level Section Switcher: Reading vs Math */}
            <div className="grid grid-cols-1 sm:grid-cols-2 max-w-xl mx-auto gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => handleSelectSection('rw')}
                className={`w-full px-5 sm:px-6 py-3.5 rounded-xl border text-sm font-bold transition-all flex items-center justify-between gap-4 cursor-pointer ${
                  selectedSection === 'rw'
                    ? 'bg-[#2563eb] text-white border-[#2563eb] shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>Reading & Writing</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold tabular-nums ${
                    selectedSection === 'rw'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {rwTotalCount} ta
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSection('math')}
                className={`w-full px-5 sm:px-6 py-3.5 rounded-xl border text-sm font-bold transition-all flex items-center justify-between gap-4 cursor-pointer ${
                  selectedSection === 'math'
                    ? 'bg-[#2563eb] text-white border-[#2563eb] shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Calculator className="w-4 h-4 shrink-0" />
                  <span>Math</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold tabular-nums ${
                    selectedSection === 'math'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {mathTotalCount} ta
                </span>
              </button>
            </div>

            {/* Stage 2 Fallback Warnings if any */}
            {stage2Warnings.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Adaptiv 2-modul (Stage 2) bo‘yicha ogohlantirish:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  {stage2Warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Inner Card with M1 & M2 Sub-Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleSelectSubModule(1)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                        selectedSubModuleNumber === 1
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>M1 (Stage 1)</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] tabular-nums ${
                          selectedSubModuleNumber === 1
                            ? 'bg-[#2563eb] text-white'
                            : 'bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        {selectedSection === 'rw' ? rw1Count : math1Count}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectSubModule(2)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                        selectedSubModuleNumber === 2
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>M2 (Adaptiv Stage 2)</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] tabular-nums ${
                          selectedSubModuleNumber === 2
                            ? 'bg-[#2563eb] text-white'
                            : 'bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        {selectedSection === 'rw' ? rw2Count : math2Count}
                      </span>
                    </button>
                  </div>

                  {selectedSubModuleNumber === 2 && (
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
                      {(
                        [
                          { id: 'all', label: 'Barchasi' },
                          { id: 'easy', label: 'Easy' },
                          { id: 'hard', label: 'Hard' },
                          { id: 'common', label: 'Umumiy' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSelectedVariantFilter(tab.id)}
                          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                            selectedVariantFilter === tab.id
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {onRedistributeSectionQuestions &&
                    ((selectedSection === 'rw' && rwTotalCount >= 2) ||
                      (selectedSection === 'math' && mathTotalCount >= 2)) && (
                      <button
                        type="button"
                        disabled={isRedistributing}
                        onClick={() => handleTriggerRedistributeSection(selectedSection)}
                        className="px-3.5 py-2 rounded-lg border border-blue-200 bg-blue-50/70 text-[#2563eb] text-xs font-bold hover:bg-blue-100/80 flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        title="Savollarni qiyinchilik darajasi va joylashuviga qarab M1 va M2 (Easy/Hard) modullariga avtomatik ajratish"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isRedistributing ? 'animate-spin' : ''}`}
                        />
                        <span>
                          {isRedistributing
                            ? 'Taqsimlanmoqda...'
                            : 'M1 va M2 ga avtomatik ajratish'}
                        </span>
                      </button>
                    )}

                  <button
                    onClick={() => {
                      setImportJsonText('');
                      setImportCheckResult(null);
                      setImportActionError(null);
                      if (
                        selectedSubModuleNumber === 2 &&
                        (selectedVariantFilter === 'easy' || selectedVariantFilter === 'hard')
                      ) {
                        setImportPlacement(
                          `${selectedModuleFilter}_${selectedVariantFilter}` as ImportPlacementTarget
                        );
                      } else {
                        setImportPlacement(
                          selectedSection === 'rw' ? 'rw_auto' : 'math_auto'
                        );
                      }
                      setIsImportModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>JSON orqali import</span>
                  </button>

                  <button
                    onClick={() => openCreateModal(selectedModuleFilter)}
                    className="px-4 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Yangi Savol Qo‘shish</span>
                  </button>
                </div>
              </div>

              {/* Per-(module, variant) Counters Bar */}
              {selectedSubModuleNumber === 1 ? (
                (() => {
                  const st =
                    selectedSection === 'rw'
                      ? moduleGroupStats.rw_1
                      : moduleGroupStats.math_1;
                  const badgeColor = st.isError
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : st.isExact
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900';
                  return (
                    <div
                      className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${badgeColor}`}
                    >
                      <div className="flex flex-wrap items-center gap-4 font-semibold">
                        <span>
                          {selectedSection === 'rw' ? 'Reading & Writing M1' : 'Math M1'} — Jami:{' '}
                          <strong className="font-mono">
                            {st.total} / {st.maxTotal}
                          </strong>
                        </span>
                        <span>
                          Hisoblanadi (Scored):{' '}
                          <strong className="font-mono">
                            {st.scored} / {st.maxScored}
                          </strong>
                        </span>
                        <span>
                          Sinov (Pretest):{' '}
                          <strong className="font-mono">{st.pretest} / 2</strong>
                        </span>
                      </div>
                      <span className="text-[11px]">
                        {st.isExact
                          ? 'Standart SAT me’yoriga to‘liq mos'
                          : `Tavsiya: ${st.maxScored} ta hisoblanadigan + 2 ta sinov = ${st.maxTotal} ta savol`}
                      </span>
                    </div>
                  );
                })()
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(
                    [
                      {
                        label: 'M2 — Easy varianti',
                        stat:
                          selectedSection === 'rw'
                            ? moduleGroupStats.rw_2_easy
                            : moduleGroupStats.math_2_easy,
                      },
                      {
                        label: 'M2 — Hard varianti',
                        stat:
                          selectedSection === 'rw'
                            ? moduleGroupStats.rw_2_hard
                            : moduleGroupStats.math_2_hard,
                      },
                      {
                        label: 'M2 — Umumiy (zahira)',
                        stat:
                          selectedSection === 'rw'
                            ? moduleGroupStats.rw_2_common
                            : moduleGroupStats.math_2_common,
                      },
                    ] as const
                  ).map((item, idx) => {
                    const st = item.stat;
                    const color = st.isError
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : st.isExact
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50/70 border-amber-200 text-amber-900';
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs space-y-1 ${color}`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>{item.label}</span>
                          <span className="font-mono">
                            Jami: {st.total}/{st.maxTotal}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span>
                            Hisoblanadi: <strong>{st.scored}</strong>/{st.maxScored}
                          </span>
                          <span>
                            Sinov: <strong>{st.pretest}</strong>/2
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {duplicateNumbersInModule.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Diqqat: Takroriy savol matni aniqlandi!</span>{' '}
                    Ushbu modulda bir xil matn va shartga (`passage + prompt`) ega savollar bor:{' '}
                    <span className="font-mono font-semibold">
                      {duplicateNumbersInModule.join(' | ')}
                    </span>
                  </div>
                </div>
              )}

              {moduleQuestions.length === 0 ? (
                <div className="py-12 px-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
                  <div className="text-sm font-bold text-slate-800">
                    {selectedSection === 'rw' ? 'Reading & Writing' : 'Math'} — M
                    {selectedSubModuleNumber} qismida hozircha savollar yo‘q
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Ushbu modulga yangi savol qo‘shishingiz yoki JSON fayl orqali savollar to‘plamini yuklashingiz mumkin.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setImportJsonText('');
                        setImportCheckResult(null);
                        setImportActionError(null);
                        setImportPlacement(
                          selectedSection === 'rw' ? 'rw_auto' : 'math_auto'
                        );
                        setIsImportModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>JSON orqali import</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateModal(selectedModuleFilter)}
                      className="px-4 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Yangi Savol Qo‘shish</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {moduleQuestions.map((q) => {
                    const effectiveB = itemDifficulty(q, scoringConfig);
                    return (
                      <div
                        key={q.id}
                        className="border border-slate-200 rounded-xl p-5 space-y-3 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="w-7 h-7 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                              {q.number}
                            </span>

                            <span
                              className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px] font-bold tracking-wide select-all"
                              title="Savolning 7 belgili unikal ID kodi"
                            >
                              ID: {q.id}
                            </span>

                            {q.moduleId.endsWith('_2') && (
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                                  q.variant === 'hard'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : q.variant === 'easy'
                                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {q.variant || 'Umumiy'}
                              </span>
                            )}

                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                q.scored === false
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {q.scored === false ? 'Sinov (Pretest)' : 'Hisoblanadi'}
                            </span>

                            <span className="text-xs font-semibold text-slate-700">
                              {q.domain || 'General'}
                              {q.skill ? ` · ${q.skill}` : ''}
                              {q.difficulty ? ` · ${q.difficulty.toUpperCase()}` : ''} ·{' '}
                              {q.type === 'spr' ? 'Yozma javob (SPR)' : 'Variantli (A-D)'}
                            </span>

                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                              b = {effectiveB >= 0 ? `+${effectiveB.toFixed(2)}` : effectiveB.toFixed(2)}
                              {typeof q.b === 'number' ? ' (kalibrlangan)' : ''}
                            </span>

                            <span className="text-xs text-[#2563eb] font-bold">
                              To‘g‘ri javob: {q.correctAnswer}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditError(null);
                                setEditingQuestion({ ...q });
                              }}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Tahrirlash</span>
                            </button>

                            {confirmDeleteId === q.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  disabled={deletingId === q.id}
                                  onClick={() => handleConfirmDeleteQuestion(q.id)}
                                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                                >
                                  {deletingId === q.id ? 'O‘chirilmoqda...' : 'Tasdiqlash'}
                                </button>
                                <button
                                  disabled={deletingId === q.id}
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                  Bekor
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(q.id)}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>O‘chirish</span>
                              </button>
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

                        {q.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt) => (
                              <div
                                key={opt.id}
                                className={`text-xs px-3 py-2 rounded-lg border sat-serif ${
                                  opt.id === q.correctAnswer
                                    ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-950'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <strong className="font-sans">{opt.id}.</strong>{' '}
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: renderSATTextWithMath(opt.text, true),
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="text-xs text-slate-600 bg-slate-50/80 border-t border-slate-100 pt-2">
                            <span className="font-semibold text-slate-700">Izoh: </span>
                            <span
                              dangerouslySetInnerHTML={{
                                __html: renderSATTextWithMath(q.explanation, true),
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'scoring' ? (
          /* BAHOLASH (RASCH IRT SCORING & CALIBRATION) TAB */
          <div className="space-y-8">
            {/* 1. ScoringConfig Editor & Session Recalculation */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-bold text-slate-900">
                      Rasch (1PL IRT) Baholash Konfiguratsiyasi
                    </h2>
                    <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 text-xs font-mono font-bold">
                      v{scoringConfig.version}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Shkalalash: S = clamp(round((A · θ + B) / 10) · 10, 200, 800).
                    {scoringConfig.updatedAt > 0
                      ? ` Oxirgi yangilanish: ${new Date(scoringConfig.updatedAt).toLocaleString()}`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isRecalculating}
                    onClick={handleTriggerRecalculateAll}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isRecalculating
                        ? 'Qayta hisoblanmoqda...'
                        : 'Barcha sessiyalarni qayta hisoblash'}
                    </span>
                  </button>
                </div>
              </div>

              {configFeedback && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold border ${
                    configFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {configFeedback.text}
                </div>
              )}

              <form onSubmit={handleSubmitScoringConfig} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      A_rw (R&W og‘ish koeffitsiyenti)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={cfgArw}
                      onChange={(e) => setCfgArw(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      B_rw (R&W markaziy ball, θ=0)
                    </label>
                    <input
                      type="number"
                      step="10"
                      value={cfgBrw}
                      onChange={(e) => setCfgBrw(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      A_math (Math og‘ish koeffitsiyenti)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={cfgAmath}
                      onChange={(e) => setCfgAmath(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      B_math (Math markaziy ball, θ=0)
                    </label>
                    <input
                      type="number"
                      step="10"
                      value={cfgBmath}
                      onChange={(e) => setCfgBmath(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      cutRW (R&W M2 chegara θ)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={cfgCutRw}
                      onChange={(e) => setCfgCutRw(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      cutMath (Math M2 chegara θ)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      value={cfgCutMath}
                      onChange={(e) => setCfgCutMath(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      extremeAdjust (r=0 / r=n tuzatish)
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.05"
                      max="0.49"
                      value={cfgExtremeAdjust}
                      onChange={(e) => setCfgExtremeAdjust(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      provisionalB.easy (Standart Easy b)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={cfgProvEasy}
                      onChange={(e) => setCfgProvEasy(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      provisionalB.medium (Standart Medium b)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={cfgProvMedium}
                      onChange={(e) => setCfgProvMedium(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      provisionalB.hard (Standart Hard b)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={cfgProvHard}
                      onChange={(e) => setCfgProvHard(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 p-2 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="px-5 py-2.5 rounded-lg bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {isSavingConfig
                        ? 'Saqlanmoqda...'
                        : 'Konfiguratsiyani saqlash (/config/scoring)'}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* 2. Item Parameters Table & Calibration Import/Export */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Savollar Psixometrik Parametrlari (Item Parameters)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Python JML kalibrlash skripti (`calibration/calibrate.py`) uchun javoblarni eksport qilish va kalibrlangan `b`, `bSE`, `infit`, `outfit` qiymatlarini yuklash
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportCalibrationResponsesCSV}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Javoblarni eksport qilish (CSV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setItemParamJsonText('');
                      setItemParamFeedback(null);
                      setIsItemParamModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    <span>Item parametrlarini import qilish</span>
                  </button>
                </div>
              </div>

              {/* Filters & Sort */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                  {(
                    [
                      { id: 'all', label: 'Barcha modullar' },
                      { id: 'rw_1', label: 'R&W M1' },
                      { id: 'rw_2', label: 'R&W M2' },
                      { id: 'math_1', label: 'Math M1' },
                      { id: 'math_2', label: 'Math M2' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setItemTableModuleFilter(m.id)}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                        itemTableModuleFilter === m.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Saralash:</span>
                  <select
                    value={itemTableSortBy}
                    onChange={(e) =>
                      setItemTableSortBy(
                        e.target.value as 'number' | 'b' | 'infit' | 'outfit' | 'n'
                      )
                    }
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white font-semibold text-slate-800"
                  >
                    <option value="number">Tartib raqami (#)</option>
                    <option value="b">Qiyinlik (b logit)</option>
                    <option value="infit">Infit MNSQ</option>
                    <option value="outfit">Outfit MNSQ</option>
                    <option value="n">Javoblar soni (n)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setItemTableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                    }
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>{itemTableSortDir === 'asc' ? 'O‘sish' : 'Kamayish'}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-3">ID / #</th>
                      <th className="py-3 px-3">Modul / Variant</th>
                      <th className="py-3 px-3">Holati</th>
                      <th className="py-3 px-3">Difficulty</th>
                      <th className="py-3 px-3">b (Logit)</th>
                      <th className="py-3 px-3">bSE</th>
                      <th className="py-3 px-3">Infit</th>
                      <th className="py-3 px-3">Outfit</th>
                      <th className="py-3 px-3">Javoblar (n)</th>
                      <th className="py-3 px-3">Bayroqlar (Flags)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedItemTableQuestions.map((q) => {
                      const effB = itemDifficulty(q, scoringConfig);
                      const resp = itemResponseStats.get(q.id) || { n: 0, correct: 0 };
                      const flags: { code: string; color: string }[] = [];
                      if (resp.n < 30) {
                        flags.push({
                          code: 'kam_javob',
                          color: 'bg-amber-100 text-amber-900',
                        });
                      }
                      if (
                        (typeof q.infit === 'number' &&
                          (q.infit < 0.7 || q.infit > 1.3)) ||
                        (typeof q.outfit === 'number' &&
                          (q.outfit < 0.7 || q.outfit > 1.3))
                      ) {
                        flags.push({
                          code: 'moslik',
                          color: 'bg-red-100 text-red-800',
                        });
                      }
                      if (
                        (resp.n > 0 && (resp.correct === 0 || resp.correct === resp.n)) ||
                        Math.abs(effB) >= 5.5
                      ) {
                        flags.push({
                          code: 'ekstremal',
                          color: 'bg-purple-100 text-purple-900',
                        });
                      }

                      return (
                        <tr key={q.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono">
                            <span className="font-bold text-slate-900">#{q.number}</span>{' '}
                            <span className="text-slate-400 text-[11px]">{q.id}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800">
                              {MODULE_CONFIGS[q.moduleId].shortTitle}
                            </span>
                            {q.variant && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold uppercase">
                                {q.variant}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                q.scored === false
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-50 text-emerald-800'
                              }`}
                            >
                              {q.scored === false ? 'Sinov' : 'Scored'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 uppercase font-semibold text-slate-700">
                            {q.difficulty || 'medium*'}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-900">
                            {effB >= 0 ? `+${effB.toFixed(3)}` : effB.toFixed(3)}
                            {typeof q.b !== 'number' && (
                              <span className="ml-1 text-[10px] text-slate-400 font-normal">
                                (def)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                            {typeof q.bSE === 'number' ? q.bSE.toFixed(3) : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                            {typeof q.infit === 'number' ? q.infit.toFixed(2) : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                            {typeof q.outfit === 'number' ? q.outfit.toFixed(2) : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700">
                            {resp.n} ({resp.correct} to‘g‘ri)
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {flags.length === 0 ? (
                                <span className="text-emerald-700 font-semibold text-[11px]">
                                  OK
                                </span>
                              ) : (
                                flags.map((f) => (
                                  <span
                                    key={f.code}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${f.color}`}
                                  >
                                    {f.code}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'error_notebook' ? (
          /* ADMIN ERROR NOTEBOOK: GLOBAL STUDENT ERROR ANALYTICS */
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Error Notebook — O‘quvchilar Eng Ko‘p Xato Qilgan Savollar (
                {platformDashboardStats.globalErrorList.length})
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Platformadagi barcha o‘quvchilar tomonidan xato belgilangan savollar statistikasi va ularni tezkor tahrirlash.
              </p>
            </div>

            {platformDashboardStats.globalErrorList.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900">
                  Hozircha xato belgilangan savollar qayd etilmagan
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  O‘quvchilar Practice Test ishlagan sari eng ko‘p xato qilinayotgan savollar shu yerda avtomatik tahlil qilinadi.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {platformDashboardStats.globalErrorList.map(
                  ({ question: q, wrongCount, attemptCount }) => {
                    const errRate =
                      attemptCount > 0
                        ? Math.round((wrongCount / attemptCount) * 100)
                        : 0;
                    return (
                      <div
                        key={q.id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {MODULE_CONFIGS[q.moduleId]?.shortTitle} · #{q.number}
                            </span>
                            <span className="font-mono text-[#2563eb] font-bold">
                              ID: {q.id}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold border border-red-200">
                              Xatolar: {wrongCount} / {attemptCount} ({errRate}%)
                            </span>
                            <span className="text-emerald-700 font-bold">
                              To‘g‘ri javob: {q.correctAnswer}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditError(null);
                              setEditingQuestion({ ...q });
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Savolni tahrirlash</span>
                          </button>
                        </div>

                        <div
                          className="text-sm font-medium text-slate-900 sat-serif"
                          dangerouslySetInnerHTML={{
                            __html: renderSATTextWithMath(q.prompt),
                          }}
                        />
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'my_metrics' ? (
          /* ADMIN METRICS: PLATFORM-WIDE DOMAIN ACCURACY & SCORE ANALYTICS */
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                My Metrics — Platforma Umumiy Ko‘rsatkichlari
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Barcha o‘quvchilarning Reading & Writing hamda Mathematics bo‘limlari bo‘yicha o‘zlashtirish ko‘rsatkichlari.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
                <span className="text-xs text-slate-500 font-medium">
                  O‘rtacha Taxminiy Ball
                </span>
                <div className="text-3xl font-extrabold text-[#2563eb] tabular-nums">
                  {completedSessions.length > 0 ? avgScore : '—'}
                </div>
                <span className="text-[11px] text-slate-400">Shkala: 400–1600</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
                <span className="text-xs text-slate-500 font-medium">
                  Maksimal Ball
                </span>
                <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {completedSessions.length > 0 ? maxScore : '—'}
                </div>
                <span className="text-[11px] text-slate-400">Eng yuqori natija</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
                <span className="text-xs text-slate-500 font-medium">
                  Umumiy Aniqlik (Accuracy)
                </span>
                <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {platformDashboardStats.accuracy}%
                </div>
                <span className="text-[11px] text-slate-400">
                  {platformDashboardStats.totalCorrect} / {platformDashboardStats.totalAnswered} to‘g‘ri
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
                <span className="text-xs text-slate-500 font-medium">
                  Savollar Bazasi
                </span>
                <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
                  {questions.length}
                </div>
                <span className="text-[11px] text-slate-400">
                  R&W: {rwTotalCount} · Math: {mathTotalCount}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">
                  Reading & Writing Yo‘nalishlari (Domains)
                </h2>
                {Object.keys(platformDashboardStats.rwDomains).length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Hozircha o‘quvchilar javoblari mavjud emas.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(platformDashboardStats.rwDomains).map(
                      ([dom, dStat]) => {
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
                      }
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">
                  Mathematics Yo‘nalishlari (Domains)
                </h2>
                {Object.keys(platformDashboardStats.mathDomains).length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Hozircha o‘quvchilar javoblari mavjud emas.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(platformDashboardStats.mathDomains).map(
                      ([dom, dStat]) => {
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
                      }
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'study_plan' ? (
          /* ADMIN AI STUDY PLAN MANAGEMENT */
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  AI Study Plan Boshqaruvi ({platformContent.studyPlanTemplates.length})
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  O‘quvchilarning «Today's plan» va «AI Study Plan» bo‘limlarida ko‘rinadigan kundalik o‘quv rejasi vazifalarini boshqarish.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingPlanTask(!isAddingPlanTask)}
                className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingPlanTask ? 'Bekor qilish' : 'Yangi Vazifa Qo‘shish'}</span>
              </button>
            </div>

            {isAddingPlanTask && (
              <form
                onSubmit={handleAddPlanTemplate}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={newPlanTitle}
                    onChange={(e) => setNewPlanTitle(e.target.value)}
                    placeholder="Vazifa nomi (masalan: Section 1: Reading Module 1)"
                    className="sm:col-span-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                  />
                  <input
                    type="text"
                    value={newPlanDuration}
                    onChange={(e) => setNewPlanDuration(e.target.value)}
                    placeholder="Vaqt (masalan: 32 min)"
                    className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <select
                    value={newPlanModule}
                    onChange={(e) => setNewPlanModule(e.target.value as ModuleId | '')}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
                  >
                    <option value="">Modulga bog‘lanmagan</option>
                    <option value="rw_1">Reading & Writing M1</option>
                    <option value="rw_2">Reading & Writing M2</option>
                    <option value="math_1">Math M1</option>
                    <option value="math_2">Math M2</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-bold cursor-pointer"
                  >
                    Saqlash
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
              {platformContent.studyPlanTemplates.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-[#2563eb]" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {task.title}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Davomiyligi: {task.duration}
                        {task.moduleId
                          ? ` · Modul: ${MODULE_CONFIGS[task.moduleId]?.shortTitle}`
                          : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePlanTemplate(task.id)}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                    title="O‘chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'vocabulary' ? (
          /* ADMIN VOCABULARY MANAGEMENT */
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                SAT Vocabulary Boshqaruvi ({platformContent.vocabulary.length})
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                O‘quvchilar uchun SAT Words in Context lug‘at bazasiga yangi so‘zlar qo‘shish va tahrirlash.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newVocabWord.trim() || !newVocabDef.trim()) return;
                updatePlatformContent({
                  ...platformContent,
                  vocabulary: [
                    {
                      id: `voc_${Date.now()}`,
                      word: newVocabWord.trim(),
                      part: newVocabPart.trim() || 'adjective',
                      definition: newVocabDef.trim(),
                      example: newVocabEx.trim(),
                    },
                    ...platformContent.vocabulary,
                  ],
                });
                setNewVocabWord('');
                setNewVocabDef('');
                setNewVocabEx('');
              }}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3"
            >
              <div className="text-xs font-bold text-slate-900">
                Yangi SAT so‘zini qo‘shish
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={newVocabWord}
                  onChange={(e) => setNewVocabWord(e.target.value)}
                  placeholder="So‘z (masalan: Resilient)"
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                />
                <input
                  type="text"
                  value={newVocabPart}
                  onChange={(e) => setNewVocabPart(e.target.value)}
                  placeholder="So‘z turkumi (adjective / verb / noun)"
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                />
                <input
                  type="text"
                  required
                  value={newVocabDef}
                  onChange={(e) => setNewVocabDef(e.target.value)}
                  placeholder="Ma’nosi (Definition)"
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={newVocabEx}
                  onChange={(e) => setNewVocabEx(e.target.value)}
                  placeholder="Misol gap (Example sentence)"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-bold cursor-pointer"
                >
                  + Qo‘shish
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {platformContent.vocabulary.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-base font-bold text-slate-900">{item.word}</h3>
                      <span className="text-xs italic text-[#2563eb]">{item.part}</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium">
                      {item.definition}
                    </p>
                    {item.example && (
                      <p className="text-xs text-slate-500 italic">“{item.example}”</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updatePlatformContent({
                        ...platformContent,
                        vocabulary: platformContent.vocabulary.filter(
                          (v) => v.id !== item.id
                        ),
                      })
                    }
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'formula_sheet' ? (
          /* ADMIN FORMULA SHEET MANAGEMENT */
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                SAT Math Formula Sheet Boshqaruvi
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                O‘quvchilarning Formula Sheet bo‘limidagi matematik formulalar to‘plamini boshqarish.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newFormulaGroupTitle.trim() || !newFormulaGroupLines.trim()) return;
                const lines = newFormulaGroupLines
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean);
                if (lines.length === 0) return;
                updatePlatformContent({
                  ...platformContent,
                  formulaGroups: [
                    ...platformContent.formulaGroups,
                    {
                      id: `fg_${Date.now()}`,
                      title: newFormulaGroupTitle.trim(),
                      formulas: lines,
                    },
                  ],
                });
                setNewFormulaGroupTitle('');
                setNewFormulaGroupLines('');
              }}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3"
            >
              <div className="text-xs font-bold text-slate-900">
                Yangi formulalar bo‘limini qo‘shish
              </div>
              <input
                type="text"
                required
                value={newFormulaGroupTitle}
                onChange={(e) => setNewFormulaGroupTitle(e.target.value)}
                placeholder="Bo‘lim nomi (masalan: Quadratic & Exponential Equations)"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
              />
              <textarea
                rows={3}
                required
                value={newFormulaGroupLines}
                onChange={(e) => setNewFormulaGroupLines(e.target.value)}
                placeholder="Har bir qatorga bittadan formula yozing..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-bold cursor-pointer"
                >
                  + Bo‘limni saqlash
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {platformContent.formulaGroups.map((grp) => (
                <div
                  key={grp.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{grp.title}</h3>
                    <button
                      type="button"
                      onClick={() =>
                        updatePlatformContent({
                          ...platformContent,
                          formulaGroups: platformContent.formulaGroups.filter(
                            (g) => g.id !== grp.id
                          ),
                        })
                      }
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1.5 font-mono">
                    {grp.formulas.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'referrals' ? (
          /* ADMIN REFERRALS OVERVIEW */
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Referrals — O‘quvchilar Taklif Kodlari ({sessions.length})
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Har bir o‘quvchiga biriktirilgan shaxsiy taklif (referral) kodlari ro‘yxati.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                    <th className="py-3 px-4">O‘quvchi</th>
                    <th className="py-3 px-4">Elektron pochta</th>
                    <th className="py-3 px-4">Referral Kod</th>
                    <th className="py-3 px-4 text-right">To‘plangan Ball</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{s.fullName}</td>
                      <td className="py-3 px-4 text-slate-500">{s.email || '—'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#2563eb]">
                        SAT-{s.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {Object.keys(s.answers || {}).length * 175} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ADMIN PROMOCODE MANAGEMENT */
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Promocode Boshqaruvi ({platformContent.promocodes.length})
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                O‘quvchilar Pro plan va bonus ballar olishi uchun ishlatadigan promokodlarni yaratish va o‘chirish.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newPromoCode.trim()) return;
                updatePlatformContent({
                  ...platformContent,
                  promocodes: [
                    {
                      id: `prm_${Date.now()}`,
                      code: newPromoCode.trim().toUpperCase(),
                      planName: newPromoPlan.trim() || 'Pro plan',
                      bonusPoints: Number(newPromoBonus) || 500,
                      active: true,
                    },
                    ...platformContent.promocodes,
                  ],
                });
                setNewPromoCode('');
              }}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-wrap items-center gap-3"
            >
              <input
                type="text"
                required
                value={newPromoCode}
                onChange={(e) => setNewPromoCode(e.target.value)}
                placeholder="Yangi promokod (masalan: SAT2027)"
                className="flex-1 min-w-[180px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono uppercase"
              />
              <input
                type="text"
                value={newPromoPlan}
                onChange={(e) => setNewPromoPlan(e.target.value)}
                placeholder="Tarif nomi (Pro plan)"
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs"
              />
              <input
                type="number"
                value={newPromoBonus}
                onChange={(e) => setNewPromoBonus(Number(e.target.value))}
                placeholder="Bonus ball"
                className="w-28 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-bold cursor-pointer"
              >
                + Promokod Yaratish
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {platformContent.promocodes.map((p) => (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-mono font-extrabold text-[#2563eb]">
                      {p.code}
                    </div>
                    <div className="text-xs text-slate-600">
                      {p.planName} · +{p.bonusPoints} bonus pts
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updatePlatformContent({
                        ...platformContent,
                        promocodes: platformContent.promocodes.filter(
                          (item) => item.id !== p.id
                        ),
                      })
                    }
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal: Inspect Student Session Answer Sheet */}
      {inspectedSession && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
            {(() => {
              const sessionVariantQs = getSessionVariantQuestions(
                questions,
                inspectedSession.id
              );
              const effRes = getSessionEffectiveResult(inspectedSession);
              const rInfo = getSessionEffectiveRouting(inspectedSession);
              const effRouting = { rw: rInfo.rw, math: rInfo.math };

              return (
                <>
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {inspectedSession.fullName} — Javoblar va Rasch Tahlili
                        </h3>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-bold">
                          Taxminiy ball: {effRes.total}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        R&W: {effRes.rw.score} (θ = {effRes.rw.theta}, SE = {effRes.rw.se}, M2:{' '}
                        {effRouting.rw.toUpperCase()}) · Math: {effRes.math.score} (θ ={' '}
                        {effRes.math.theta}, SE = {effRes.math.se}, M2:{' '}
                        {effRouting.math.toUpperCase()}) · Versiya: v{effRes.scoringVersion}
                      </p>
                    </div>
                    <button
                      onClick={() => setInspectedSessionId(null)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900">
                          Section 1: Reading & Writing ({effRes.rw.score} / 800)
                        </div>
                        <div className="text-slate-600 font-mono">
                          θ = {effRes.rw.theta} ± {effRes.rw.se} · Stage 1 θ ={' '}
                          {rInfo.rwTheta} → M2:{' '}
                          <strong className="uppercase">{effRouting.rw}</strong>
                        </div>
                        <div className="text-slate-600">
                          Hisoblangan to‘g‘ri javoblar: {effRes.rw.rawScored} /{' '}
                          {effRes.rw.nScored}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="font-bold text-slate-900">
                          Section 2: Mathematics ({effRes.math.score} / 800)
                        </div>
                        <div className="text-slate-600 font-mono">
                          θ = {effRes.math.theta} ± {effRes.math.se} · Stage 1 θ ={' '}
                          {rInfo.mathTheta} → M2:{' '}
                          <strong className="uppercase">{effRouting.math}</strong>
                        </div>
                        <div className="text-slate-600">
                          Hisoblangan to‘g‘ri javoblar: {effRes.math.rawScored} /{' '}
                          {effRes.math.nScored}
                        </div>
                      </div>
                    </div>

                    {MODULE_ORDER.map((modId) => {
                      const modQs = getModuleQuestionsForSession(
                        sessionVariantQs,
                        modId,
                        effRouting
                      );
                      if (modQs.length === 0) return null;
                      const scoredQs = modQs.filter((q) => q.scored !== false);
                      const scoredCorrect = scoredQs.filter((q) =>
                        isAnswerCorrect(q, inspectedSession.answers[q.id] || '')
                      ).length;

                      return (
                        <div key={modId} className="space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <h4 className="text-sm font-bold text-slate-900">
                              {MODULE_CONFIGS[modId].title}
                              {modId.endsWith('_2') && (
                                <span className="ml-2 px-2 py-0.5 rounded bg-slate-100 text-xs font-mono uppercase">
                                  Variant:{' '}
                                  {modId === 'rw_2' ? effRouting.rw : effRouting.math}
                                </span>
                              )}
                            </h4>
                            <span className="text-xs font-semibold text-[#2563eb] tabular-nums">
                              Hisoblangan to‘g‘ri: {scoredCorrect} / {scoredQs.length} (Jami:{' '}
                              {modQs.length})
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                            {modQs.map((q) => {
                              const ans = inspectedSession.answers[q.id] || '';
                              const isCorr = isAnswerCorrect(q, ans);
                              const isPretest = q.scored === false;
                              return (
                                <div
                                  key={q.id}
                                  className={`p-2.5 rounded-lg border text-xs flex flex-col gap-1 ${
                                    !ans
                                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                                      : isCorr
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                      : 'bg-red-50 border-red-200 text-red-900'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold">#{q.number}</span>
                                    {isPretest && (
                                      <span className="px-1 rounded bg-amber-200/80 text-amber-950 text-[9px] font-bold">
                                        SINOV
                                      </span>
                                    )}
                                    {ans ? (
                                      isCorr ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      ) : (
                                        <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                      )
                                    ) : null}
                                  </div>
                                  <div className="font-mono text-[11px]">
                                    {ans || '—'} ({q.correctAnswer})
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal: Edit Existing Question */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  Savol #{editingQuestion.number} ni tahrirlash (
                  {MODULE_CONFIGS[editingQuestion.moduleId].shortTitle})
                </h3>
                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs font-bold select-all">
                  ID: {editingQuestion.id}
                </span>
              </div>
              <button
                onClick={() => setEditingQuestion(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {editError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">
                  {editError}
                </div>
              )}

              {editingQuestion.scored !== false && !editingQuestion.difficulty && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                  Ogohlantirish: Hisoblanadigan savol uchun qiyinlik darajasi (difficulty) tanlanmagan — standart &quot;medium&quot; (b = 0.0) qo‘llaniladi.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Savol Turi</label>
                  <select
                    value={
                      editingQuestion.moduleId.startsWith('rw_')
                        ? 'mcq'
                        : editingQuestion.type
                    }
                    onChange={(e) => {
                      const nextType = e.target.value as QuestionType;
                      setEditingQuestion({
                        ...editingQuestion,
                        type: nextType,
                        options:
                          nextType === 'mcq'
                            ? editingQuestion.options &&
                              editingQuestion.options.length === 4
                              ? editingQuestion.options
                              : [
                                  { id: 'A', text: '' },
                                  { id: 'B', text: '' },
                                  { id: 'C', text: '' },
                                  { id: 'D', text: '' },
                                ]
                            : undefined,
                      });
                    }}
                    className="w-full rounded-lg border border-slate-300 p-2"
                  >
                    <option value="mcq">Multiple Choice (A, B, C, D)</option>
                    {!editingQuestion.moduleId.startsWith('rw_') && (
                      <option value="spr">Student-Produced Response (Yozma)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Domain (Bo‘lim)
                  </label>
                  <select
                    value={
                      editingQuestion.domain ||
                      domainsForModule(editingQuestion.moduleId)[0]
                    }
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, domain: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 p-2"
                  >
                    {domainsForModule(editingQuestion.moduleId).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(editingQuestion.moduleId === 'rw_2' ||
                  editingQuestion.moduleId === 'math_2') && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      2-modul Varianti
                    </label>
                    <select
                      value={editingQuestion.variant || ''}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          variant: e.target.value
                            ? (e.target.value as QuestionVariant)
                            : undefined,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 p-2"
                    >
                      <option value="">Umumiy (belgilanmagan)</option>
                      <option value="easy">Easy (Oson variant)</option>
                      <option value="hard">Hard (Qiyin variant)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qiyinlik darajasi (Difficulty)
                  </label>
                  <select
                    value={editingQuestion.difficulty || ''}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        difficulty: e.target.value
                          ? (e.target.value as QuestionDifficulty)
                          : undefined,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 p-2"
                  >
                    <option value="">Tanlanmagan</option>
                    <option value="easy">Easy (Oson)</option>
                    <option value="medium">Medium (O‘rtacha)</option>
                    <option value="hard">Hard (Qiyin)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Rasch b (faqat o‘qish uchun)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={
                      typeof editingQuestion.b === 'number'
                        ? `${editingQuestion.b.toFixed(3)} (kalibrlangan)`
                        : `${itemDifficulty(editingQuestion, scoringConfig).toFixed(
                            2
                          )} (standart)`
                    }
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 p-2 font-mono text-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Skill (Ko‘nikma — ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={editingQuestion.skill || ''}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, skill: e.target.value })
                    }
                    placeholder="Masalan: Words in Context / Linear equations"
                    className="w-full rounded-lg border border-slate-300 p-2"
                  />
                </div>

                <div className="pt-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingQuestion.scored !== false}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          scored: e.target.checked,
                        })
                      }
                      className="rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
                    />
                    <span className="font-semibold text-slate-800">
                      Ballga kiradi (scored savol; o‘chirilsa — sinov/pretest)
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Matn (Passage — ixtiyoriy)
                  </label>
                  <span className="text-[11px] text-slate-500">Formulalar: $x^2+1$</span>
                </div>
                <textarea
                  rows={4}
                  value={editingQuestion.passage || ''}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, passage: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-[#2563eb] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Savol sharti (Prompt) *
                  </label>
                  <span className="text-[11px] text-slate-500">Formulalar: $x^2+1$</span>
                </div>
                <textarea
                  rows={3}
                  value={editingQuestion.prompt}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, prompt: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-[#2563eb] focus:outline-none"
                />
              </div>

              {editingQuestion.type === 'mcq' && editingQuestion.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {editingQuestion.options.map((opt, idx) => (
                    <div key={opt.id}>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Variant {opt.id}
                      </label>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const nextOpts = [...(editingQuestion.options || [])];
                          nextOpts[idx] = { ...opt, text: e.target.value };
                          setEditingQuestion({ ...editingQuestion, options: nextOpts });
                        }}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  To‘g‘ri javob (
                  {editingQuestion.type === 'mcq'
                    ? 'A, B, C yoki D'
                    : 'Son yoki kasr: 12, -3.5, 3/4'}
                  )
                </label>
                <input
                  type="text"
                  value={editingQuestion.correctAnswer}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      correctAnswer: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Izoh (Explanation — ixtiyoriy)
                  </label>
                  <span className="text-[11px] text-slate-500">Formulalar: $x^2+1$</span>
                </div>
                <textarea
                  rows={2}
                  value={editingQuestion.explanation || ''}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      explanation: e.target.value,
                    })
                  }
                  placeholder="Yechim izohi..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-[#2563eb] focus:outline-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Bekor qilish
              </button>
              <button
                disabled={isSavingQuestion}
                onClick={handleSaveEditedQuestion}
                className="px-4 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingQuestion ? 'Saqlanmoqda...' : 'Saqlash'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Question */}
      {isCreatingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveNewQuestion}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Yangi SAT Savol Qo‘shish
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingQuestion(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {createError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">
                  {createError}
                </div>
              )}

              {newQScored && !newQDifficulty && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium">
                  Ogohlantirish: Hisoblanadigan savol uchun qiyinlik darajasi (difficulty) tanlanmagan — standart &quot;medium&quot; (b = 0.0) qo‘llaniladi.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Modul</label>
                  <select
                    value={newQModule}
                    onChange={(e) => handleNewModuleChange(e.target.value as ModuleId)}
                    className="w-full rounded-lg border border-slate-300 p-2"
                  >
                    {MODULE_ORDER.map((m) => (
                      <option key={m} value={m}>
                        {MODULE_CONFIGS[m].title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Savol Turi
                  </label>
                  <select
                    value={newQModule.startsWith('rw_') ? 'mcq' : newQType}
                    onChange={(e) => setNewQType(e.target.value as QuestionType)}
                    className="w-full rounded-lg border border-slate-300 p-2"
                  >
                    <option value="mcq">Multiple Choice (A, B, C, D)</option>
                    {!newQModule.startsWith('rw_') && (
                      <option value="spr">Student-Produced Response (Yozma)</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Domain (Bo‘lim)
                  </label>
                  <select
                    value={newQDomain}
                    onChange={(e) => setNewQDomain(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2"
                  >
                    {domainsForModule(newQModule).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Skill (ixtiyoriy)
                  </label>
                  <input
                    type="text"
                    value={newQSkill}
                    onChange={(e) => setNewQSkill(e.target.value)}
                    placeholder="Masalan: Linear equations"
                    className="w-full rounded-lg border border-slate-300 p-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qiyinlik (Difficulty)
                  </label>
                  <select
                    value={newQDifficulty}
                    onChange={(e) =>
                      setNewQDifficulty(e.target.value as QuestionDifficulty | '')
                    }
                    className="w-full rounded-lg border border-slate-300 p-2"
                  >
                    <option value="">Tanlanmagan</option>
                    <option value="easy">Easy (Oson)</option>
                    <option value="medium">Medium (O‘rtacha)</option>
                    <option value="hard">Hard (Qiyin)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {(newQModule === 'rw_2' || newQModule === 'math_2') && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      2-modul Varianti (Easy / Hard / Umumiy)
                    </label>
                    <select
                      value={newQVariant}
                      onChange={(e) =>
                        setNewQVariant(e.target.value as QuestionVariant | '')
                      }
                      className="w-full rounded-lg border border-slate-300 p-2"
                    >
                      <option value="">Umumiy (belgilanmagan)</option>
                      <option value="easy">Easy (Oson variant)</option>
                      <option value="hard">Hard (Qiyin variant)</option>
                    </select>
                  </div>
                )}

                <div className={newQModule.endsWith('_2') ? 'pt-4' : ''}>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newQScored}
                      onChange={(e) => setNewQScored(e.target.checked)}
                      className="rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
                    />
                    <span className="font-semibold text-slate-800">
                      Ballga kiradi (scored savol; o‘chirilsa — sinov/pretest)
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Matn (Passage — ixtiyoriy)
                  </label>
                  <span className="text-[11px] text-slate-500">Formulalar: $x^2+1$</span>
                </div>
                <textarea
                  rows={3}
                  value={newQPassage}
                  onChange={(e) => setNewQPassage(e.target.value)}
                  placeholder="Matnni kiriting..."
                  className="w-full rounded-lg border border-slate-300 p-2.5"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Savol sharti (Prompt) *
                  </label>
                  <span className="text-[11px] text-slate-500">Formulalar: $x^2+1$</span>
                </div>
                <textarea
                  rows={2}
                  value={newQPrompt}
                  onChange={(e) => setNewQPrompt(e.target.value)}
                  placeholder="Savolni kiriting..."
                  className="w-full rounded-lg border border-slate-300 p-2.5"
                />
              </div>

              {(newQModule.startsWith('rw_') || newQType === 'mcq') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Variant A
                    </label>
                    <input
                      type="text"
                      value={newQOptA}
                      onChange={(e) => setNewQOptA(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Variant B
                    </label>
                    <input
                      type="text"
                      value={newQOptB}
                      onChange={(e) => setNewQOptB(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Variant C
                    </label>
                    <input
                      type="text"
                      value={newQOptC}
                      onChange={(e) => setNewQOptC(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Variant D
                    </label>
                    <input
                      type="text"
                      value={newQOptD}
                      onChange={(e) => setNewQOptD(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  To‘g‘ri javob * (
                  {newQModule.startsWith('rw_') || newQType === 'mcq'
                    ? 'A, B, C yoki D'
                    : 'Son yoki kasr: 12, -3.5, 3/4'}
                  )
                </label>
                <input
                  type="text"
                  value={newQCorrect}
                  onChange={(e) => setNewQCorrect(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 font-bold"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">
                    Izoh (Explanation — ixtiyoriy)
                  </label>
                  <span className="text-[11px] text-slate-500">Formulalar: $x^2+1$</span>
                </div>
                <textarea
                  rows={2}
                  value={newQExplanation}
                  onChange={(e) => setNewQExplanation(e.target.value)}
                  placeholder="Yechim izohi..."
                  className="w-full rounded-lg border border-slate-300 p-2.5"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreatingQuestion(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={isSavingQuestion}
                className="px-4 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {isSavingQuestion ? 'Saqlanmoqda...' : 'Qo‘shish'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: JSON Import */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  JSON orqali savollarni import qilish
                </h3>
                <p className="text-xs text-slate-500">
                  Almashtirish (module, variant) juftligi bo‘yicha bajariladi (masalan, rw_2/hard import qilinsa, rw_2/easy saqlanib qoladi).
                </p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Qaysi bo‘lim / modulga joylashtirilsin?
                  </label>
                  <select
                    value={importPlacement}
                    onChange={(e) => {
                      const val = e.target.value as ImportPlacementTarget;
                      setImportPlacement(val);
                      if (importJsonText.trim()) {
                        setImportCheckResult(
                          parseQuestionImport(importJsonText, {
                            targetPlacement: val,
                            autoBalanceModules: true,
                            fallbackSection: selectedSection,
                          })
                        );
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-medium"
                  >
                    <option value="auto">
                      Avtomatik (moduleId, qiyinlik darajasi va joylashuv bo‘yicha)
                    </option>
                    <option value="rw_auto">
                      Reading & Writing — Qiyinlik va joylashuv bo‘yicha M1 va M2 ga ajratish
                    </option>
                    <option value="rw_1">Reading & Writing — M1</option>
                    <option value="rw_2">Reading & Writing — M2 (Umumiy)</option>
                    <option value="rw_2_easy">Reading & Writing — M2 (Easy)</option>
                    <option value="rw_2_hard">Reading & Writing — M2 (Hard)</option>
                    <option value="math_auto">
                      Math — Qiyinlik va joylashuv bo‘yicha M1 va M2 ga ajratish
                    </option>
                    <option value="math_1">Math — M1</option>
                    <option value="math_2">Math — M2 (Umumiy)</option>
                    <option value="math_2_easy">Math — M2 (Easy)</option>
                    <option value="math_2_hard">Math — M2 (Hard)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Saqlash rejimi
                  </label>
                  <select
                    value={importMode}
                    onChange={(e) =>
                      setImportMode(e.target.value as 'replace_all' | 'append')
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-medium"
                  >
                    <option value="replace_all">
                      Tanlangan (modul, variant) savollarini almashtirish
                    </option>
                    <option value="append">
                      Mavjud savollar ustiga qo‘shish (Append)
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="font-semibold text-slate-700">
                  JSON faylni tanlang yoki quyidagi maydonga JSON matnini joylashtiring:
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFileChange}
                  className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              <textarea
                rows={10}
                value={importJsonText}
                onChange={(e) => {
                  const val = e.target.value;
                  setImportJsonText(val);
                  setImportActionError(null);
                  if (val.trim()) {
                    setImportCheckResult(
                      parseQuestionImport(val, {
                        targetPlacement: importPlacement,
                        autoBalanceModules: true,
                        fallbackSection: selectedSection,
                      })
                    );
                  } else {
                    setImportCheckResult(null);
                  }
                }}
                placeholder='[{"moduleId": "rw_2", "variant": "hard", "scored": true, "difficulty": "hard", "prompt": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correctAnswer": "A"}]'
                className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-[#2563eb] focus:outline-none"
              />

              {importActionError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">
                  {importActionError}
                </div>
              )}

              {importCheckResult && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                    <div className="font-bold text-emerald-950">
                      Topilgan to‘g‘ri savollar: {importCheckResult.items.length} ta
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {Object.entries(importCheckResult.groupCounts).map(([gKey, st]) => (
                        <span
                          key={gKey}
                          className="px-2.5 py-1 rounded bg-white border border-emerald-200 font-mono text-slate-800"
                        >
                          {formatModuleVariantLabel(gKey)}: {st.total}/{st.max} (scored:{' '}
                          {st.scored}, sinov: {st.pretest})
                        </span>
                      ))}
                    </div>
                  </div>

                  {importCheckResult.warnings.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                      <div className="font-bold">Ogohlantirishlar:</div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {importCheckResult.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {importCheckResult.errors.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 space-y-1 max-h-48 overflow-y-auto">
                      <div className="font-bold">
                        Xatolar ({importCheckResult.errors.length}):
                      </div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {importCheckResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleCheckImportJson}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                Tekshirish
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  disabled={
                    isImporting ||
                    !importCheckResult ||
                    importCheckResult.items.length === 0 ||
                    importCheckResult.errors.length > 0
                  }
                  onClick={handleExecuteImport}
                  className="px-4 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isImporting ? 'Import qilinmoqda...' : 'Import qilish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import Calibrated Item Parameters */}
      {isItemParamModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Item parametrlarini import qilish (item_params.json)
                </h3>
                <p className="text-xs text-slate-500">
                  calibration/calibrate.py skripti hosil qilgan JSON faylni tanlang yoki joylashtiring
                </p>
              </div>
              <button
                onClick={() => setIsItemParamModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="font-semibold text-slate-700">
                  JSON faylni tanlang (item_params.json):
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleItemParamFileUpload}
                  className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              <textarea
                rows={10}
                value={itemParamJsonText}
                onChange={(e) => {
                  setItemParamJsonText(e.target.value);
                  setItemParamFeedback(null);
                }}
                placeholder='{"calibratedAt": 1761650000000, "items": [{"id": "rw_1_q1", "b": -0.842, "bSE": 0.145, "infit": 0.98, "outfit": 1.02}]}'
                className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-[#2563eb] focus:outline-none"
              />

              {itemParamFeedback && (
                <div
                  className={`p-3.5 rounded-xl font-semibold border ${
                    itemParamFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {itemParamFeedback.text}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsItemParamModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Yopish
              </button>
              <button
                type="button"
                disabled={isImportingItemParams}
                onClick={handleExecuteImportItemParams}
                className="px-4 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {isImportingItemParams ? 'Saqlanmoqda...' : 'Parametrlarni saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
