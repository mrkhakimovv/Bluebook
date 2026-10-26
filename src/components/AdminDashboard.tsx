import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import {
  StudentSession,
  SATQuestion,
  MODULE_CONFIGS,
  MODULE_ORDER,
  ModuleId,
  QuestionType,
  QuestionDifficulty,
  domainsForModule,
} from '../types/sat';
import { isAnswerCorrect } from '../data/defaultQuestions';
import { renderSATTextWithMath } from '../utils/mathRenderer';
import {
  normalizeQuestionInput,
  validateQuestionInput,
  parseQuestionImport,
  QuestionImportResult,
} from '../utils/questionValidation';

interface AdminDashboardProps {
  adminName: string;
  sessions: StudentSession[];
  questions: SATQuestion[];
  onDeleteSession: (id: string) => Promise<void>;
  onResetSession: (id: string) => Promise<void>;
  onUpdateQuestion: (q: SATQuestion) => Promise<void>;
  onAddQuestion: (q: Omit<SATQuestion, 'id' | 'number'>) => Promise<void>;
  onDeleteQuestion: (id: string) => Promise<void>;
  onImportQuestions: (items: Omit<SATQuestion, 'id' | 'number'>[]) => Promise<void>;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminName,
  sessions,
  questions,
  onDeleteSession,
  onResetSession,
  onUpdateQuestion,
  onAddQuestion,
  onDeleteQuestion,
  onImportQuestions,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'results' | 'questions'>('results');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [inspectedSessionId, setInspectedSessionId] = useState<string | null>(null);
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<ModuleId>('rw_1');
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
  const [importCheckResult, setImportCheckResult] = useState<QuestionImportResult | null>(null);
  const [importActionError, setImportActionError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.password.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'completed' ? s.status === 'completed' : s.status !== 'completed');
    return matchesSearch && matchesStatus;
  });

  const totalStudents = sessions.length;
  const activeStudents = sessions.filter((s) => s.status !== 'completed').length;
  const avgScore =
    totalStudents > 0
      ? Math.round(sessions.reduce((acc, s) => acc + s.score.total, 0) / totalStudents)
      : 0;
  const maxScore =
    totalStudents > 0 ? Math.max(...sessions.map((s) => s.score.total)) : 0;

  const inspectedSession = sessions.find((s) => s.id === inspectedSessionId) || null;

  const moduleQuestions = useMemo(
    () =>
      questions
        .filter((q) => q.moduleId === selectedModuleFilter)
        .sort((a, b) => a.number - b.number),
    [questions, selectedModuleFilter]
  );

  // Detect duplicate passage+prompt in the currently selected module
  const duplicateNumbersInModule = useMemo(() => {
    const seen = new Map<string, number[]>();
    for (const q of moduleQuestions) {
      const key = `${(q.passage || '').trim().toLowerCase()}|||${(q.prompt || '')
        .trim()
        .toLowerCase()}`;
      const list = seen.get(key) || [];
      list.push(q.number);
      seen.set(key, list);
    }
    const dupGroups: string[] = [];
    for (const nums of seen.values()) {
      if (nums.length > 1) {
        dupGroups.push(nums.map((n) => `#${n}`).join(', '));
      }
    }
    return dupGroups;
  }, [moduleQuestions]);

  const handleExportCSV = () => {
    const headers = [
      'Full Name',
      'Password',
      'Status',
      'Current Module',
      'Total SAT Score (400-1600)',
      'R&W Scaled (200-800)',
      'Math Scaled (200-800)',
      'R&W Raw Correct',
      'Math Raw Correct',
      'Total Answered',
      'Accuracy %',
      'Updated At',
    ];
    const rows = sessions.map((s) => [
      `"${s.fullName.replace(/"/g, '""')}"`,
      `"${s.password}"`,
      s.status,
      MODULE_CONFIGS[s.currentModule]?.shortTitle || s.currentModule,
      s.score.total,
      s.score.rwScaled,
      s.score.mathScaled,
      `${s.score.rwRaw}/${s.score.rwTotal}`,
      `${s.score.mathRaw}/${s.score.mathTotal}`,
      `${s.score.totalAnswered}/${s.score.totalQuestions}`,
      `${s.score.accuracyPercent}%`,
      s.updatedAt,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sat_results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openCreateModal = (modId: ModuleId) => {
    const domains = domainsForModule(modId);
    setNewQModule(modId);
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
      setImportCheckResult(parseQuestionImport(content));
      setImportActionError(null);
    };
    reader.readAsText(file);
  };

  const handleCheckImportJson = () => {
    setImportActionError(null);
    setImportCheckResult(parseQuestionImport(importJsonText));
  };

  const handleExecuteImport = async () => {
    const res = parseQuestionImport(importJsonText);
    setImportCheckResult(res);
    if (res.errors.length > 0 || res.items.length === 0) return;

    setIsImporting(true);
    setImportActionError(null);
    try {
      await onImportQuestions(res.items);
      setIsImportModalOpen(false);
      setImportJsonText('');
      setImportCheckResult(null);
    } catch (err) {
      setImportActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
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
                ? 'text-slate-900 font-bold border-b-2 border-[#1b4332]'
                : 'hover:text-slate-900'
            }`}
          >
            Real-Vaqt Natijalar ({sessions.length})
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'questions'
                ? 'text-slate-900 font-bold border-b-2 border-[#1b4332]'
                : 'hover:text-slate-900'
            }`}
          >
            Savollar Bazasi ({questions.length})
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
                <div className="text-3xl font-bold text-[#1b4332] tabular-nums">
                  {activeStudents}
                </div>
                <p className="text-xs text-slate-500">Real vaqtda faol sessiyalar</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
                <span className="text-xs font-medium text-slate-500">O‘rtacha SAT Ball</span>
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {avgScore}
                </div>
                <p className="text-xs text-slate-500">400–1600 shkala bo‘yicha</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-1">
                <span className="text-xs font-medium text-slate-500">Eng Yuqori Natija</span>
                <div className="text-3xl font-bold text-slate-900 tabular-nums">
                  {maxScore}
                </div>
                <p className="text-xs text-slate-500">Maksimal qayd etilgan ball</p>
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
                      className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:border-[#1b4332] focus:outline-none text-slate-900"
                    />
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        statusFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Barchasi
                    </button>
                    <button
                      onClick={() => setStatusFilter('in_progress')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        statusFilter === 'in_progress'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Jarayonda
                    </button>
                    <button
                      onClick={() => setStatusFilter('completed')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
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
                  <span>Download CSV</span>
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
                      <th className="py-3 px-4">R&W (200–800)</th>
                      <th className="py-3 px-4">Math (200–800)</th>
                      <th className="py-3 px-4">Jami Ball (1600)</th>
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
                      filteredSessions.map((s) => (
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
                              {MODULE_CONFIGS[s.currentModule]?.shortTitle} (Q{s.currentQuestionIndex + 1})
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700">
                            {s.score.totalAnswered} / {s.score.totalQuestions} ({s.score.accuracyPercent}%)
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums">
                            <span className="font-bold text-slate-900">{s.score.rwScaled}</span>
                            <span className="text-slate-400"> ({s.score.rwRaw}/{s.score.rwTotal})</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums">
                            <span className="font-bold text-slate-900">{s.score.mathScaled}</span>
                            <span className="text-slate-400"> ({s.score.mathRaw}/{s.score.mathTotal})</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums">
                            <span className="text-base font-bold text-[#1b4332]">
                              {s.score.total}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setInspectedSessionId(s.id)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
                                title="Javoblarni tekshirish"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onResetSession(s.id)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
                                title="Urinishni nolga tushirish"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteSession(s.id)}
                                className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                                title="O‘chirish"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
          </>
        ) : (
          /* Question Bank Management Tab */
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {MODULE_ORDER.map((modId) => (
                    <button
                      key={modId}
                      onClick={() => {
                        setSelectedModuleFilter(modId);
                        setConfirmDeleteId(null);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        selectedModuleFilter === modId
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {MODULE_CONFIGS[modId].title}
                    </button>
                  ))}
                </div>

                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg tabular-nums">
                  Savollar: {moduleQuestions.length} / {MODULE_CONFIGS[selectedModuleFilter].questionCount}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    setImportJsonText('');
                    setImportCheckResult(null);
                    setImportActionError(null);
                    setIsImportModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>JSON orqali import</span>
                </button>

                <button
                  onClick={() => openCreateModal(selectedModuleFilter)}
                  className="px-4 py-2 rounded-lg bg-[#1b4332] text-white text-xs font-bold hover:bg-[#143325] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Yangi Savol Qo‘shish</span>
                </button>
              </div>
            </div>

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

            <div className="space-y-4">
              {moduleQuestions.map((q) => (
                <div
                  key={q.id}
                  className="border border-slate-200 rounded-xl p-5 space-y-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="w-7 h-7 rounded bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                        {q.number}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {q.domain || 'General'}
                        {q.skill ? ` · ${q.skill}` : ''}
                        {q.difficulty ? ` · ${q.difficulty.toUpperCase()}` : ''} ·{' '}
                        {q.type === 'spr' ? 'Yozma javob (Grid-in)' : 'Variantli (A-D)'}
                      </span>
                      <span className="text-xs text-[#1b4332] font-bold">
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
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modal: Inspect Student Session Answer Sheet */}
      {inspectedSession && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {inspectedSession.fullName} — Javoblar varaqasi
                </h3>
                <p className="text-xs text-slate-500">
                  Jami Ball: {inspectedSession.score.total} (R&W: {inspectedSession.score.rwScaled}, Math: {inspectedSession.score.mathScaled})
                </p>
              </div>
              <button
                onClick={() => setInspectedSessionId(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {MODULE_ORDER.map((modId) => {
                const modQs = questions.filter((q) => q.moduleId === modId);
                const modScore = inspectedSession.score.moduleScores[modId];
                return (
                  <div key={modId} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        {MODULE_CONFIGS[modId].title}
                      </h4>
                      <span className="text-xs font-semibold text-[#1b4332] tabular-nums">
                        To‘g‘ri: {modScore.correct} / {modScore.total}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                      {modQs.map((q) => {
                        const ans = inspectedSession.answers[q.id] || '';
                        const isCorr = isAnswerCorrect(q, ans);
                        return (
                          <div
                            key={q.id}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                              !ans
                                ? 'bg-slate-50 border-slate-200 text-slate-500'
                                : isCorr
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-red-50 border-red-200 text-red-900'
                            }`}
                          >
                            <span className="font-bold">#{q.number}</span>
                            <span className="font-mono">
                              {ans || '—'} ({q.correctAnswer})
                            </span>
                            {ans ? (
                              isCorr ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                              )
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Existing Question */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Savol #{editingQuestion.number} ni tahrirlash ({MODULE_CONFIGS[editingQuestion.moduleId].shortTitle})
              </h3>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Savol Turi</label>
                  <select
                    value={editingQuestion.moduleId.startsWith('rw_') ? 'mcq' : editingQuestion.type}
                    onChange={(e) => {
                      const nextType = e.target.value as QuestionType;
                      setEditingQuestion({
                        ...editingQuestion,
                        type: nextType,
                        options:
                          nextType === 'mcq'
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
                  <label className="block font-semibold text-slate-700 mb-1">Domain (Bo‘lim)</label>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-[#1b4332] focus:outline-none"
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
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-[#1b4332] focus:outline-none"
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
                  To‘g‘ri javob ({editingQuestion.type === 'mcq' ? 'A, B, C yoki D' : 'Son yoki kasr: 12, -3.5, 3/4'})
                </label>
                <input
                  type="text"
                  value={editingQuestion.correctAnswer}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })
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
                    setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                  }
                  placeholder="Yechim izohi..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-[#1b4332] focus:outline-none"
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
                className="px-4 py-2 rounded-lg bg-[#1b4332] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
                  <label className="block font-semibold text-slate-700 mb-1">Savol Turi</label>
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
                  <label className="block font-semibold text-slate-700 mb-1">Domain (Bo‘lim)</label>
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
                    <label className="block font-semibold text-slate-700 mb-1">Variant A</label>
                    <input
                      type="text"
                      value={newQOptA}
                      onChange={(e) => setNewQOptA(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Variant B</label>
                    <input
                      type="text"
                      value={newQOptB}
                      onChange={(e) => setNewQOptB(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Variant C</label>
                    <input
                      type="text"
                      value={newQOptC}
                      onChange={(e) => setNewQOptC(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Variant D</label>
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
                className="px-4 py-2 rounded-lg bg-[#1b4332] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
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
                  Import qilingan modullardagi savollar yangi ro‘yxat bilan almashtiriladi.
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
                  setImportJsonText(e.target.value);
                  setImportCheckResult(null);
                  setImportActionError(null);
                }}
                placeholder='[{"moduleId": "rw_2", "type": "mcq", "domain": "Craft and Structure", "prompt": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "correctAnswer": "A"}]'
                className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-[#1b4332] focus:outline-none"
              />

              {importActionError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 font-semibold">
                  {importActionError}
                </div>
              )}

              {importCheckResult && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-4">
                    <span className="font-bold text-slate-800">
                      Topilgan to‘g‘ri savollar: {importCheckResult.items.length} ta
                    </span>
                    {MODULE_ORDER.map((modId) => (
                      <span
                        key={modId}
                        className="px-2.5 py-1 rounded bg-white border border-slate-200 font-mono text-slate-700"
                      >
                        {MODULE_CONFIGS[modId].shortTitle}: {importCheckResult.counts[modId]} /{' '}
                        {MODULE_CONFIGS[modId].questionCount}
                      </span>
                    ))}
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
                      <div className="font-bold">Xatolar ({importCheckResult.errors.length}):</div>
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
                  className="px-4 py-2 rounded-lg bg-[#1b4332] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isImporting ? 'Import qilinmoqda...' : 'Import qilish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
