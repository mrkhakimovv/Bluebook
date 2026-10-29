import React, { useState, useMemo, useEffect } from 'react';
import {
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

interface AdminDashboardProps {
  adminName: string;
  sessions: StudentSession[];
  questions: SATQuestion[];
  scoringConfig: ScoringConfig;
  onDeleteSession: (id: string) => Promise<void>;
  onResetSession: (id: string) => Promise<void>;
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
  const [activeTab, setActiveTab] = useState<'results' | 'questions' | 'scoring'>('results');
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
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.password.toLowerCase().includes(searchQuery.toLowerCase());
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

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Top Bar following 3-zone contract */}
      <header className="flex items-center justify-between gap-8 px-8 py-4 bg-white border-b border-slate-200">
        <div className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          Bluebook SAT Admin Panel
        </div>

        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('results')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'results'
                ? 'text-slate-900 font-bold border-b-2 border-[#2563eb]'
                : 'hover:text-slate-900'
            }`}
          >
            Real-Vaqt Natijalar ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'questions'
                ? 'text-slate-900 font-bold border-b-2 border-[#2563eb]'
                : 'hover:text-slate-900'
            }`}
          >
            Savollar Bazasi ({questions.length})
          </button>
          <button
            onClick={() => setActiveTab('scoring')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'scoring'
                ? 'text-slate-900 font-bold border-b-2 border-[#2563eb]'
                : 'hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Baholash</span>
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onLogout}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Chiqish ({adminName})</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {activeTab === 'results' ? (
          <>
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
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
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

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
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
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap cursor-pointer"
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
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              {s.fullName}
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
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => handleSelectSection('rw')}
                className={`min-w-[240px] px-6 py-3.5 rounded-xl border text-sm font-bold transition-all flex items-center justify-between gap-4 cursor-pointer ${
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
                className={`min-w-[240px] px-6 py-3.5 rounded-xl border text-sm font-bold transition-all flex items-center justify-between gap-4 cursor-pointer ${
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
        ) : (
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
