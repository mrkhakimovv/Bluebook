import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  SATQuestion,
  StudentSession,
  MODULE_CONFIGS,
  MODULE_ORDER,
  ModuleId,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
} from './types/sat';
import {
  generateDefaultQuestions,
  calculateSATScore,
  isAnswerCorrect,
} from './data/defaultQuestions';
import { scoreSession } from './lib/scoring/rasch';
import {
  subscribeToSessions,
  subscribeToQuestions,
  subscribeToScoringConfig,
  saveSessionToFirestore,
  saveBatchSessionsToFirestore,
  removeSessionFromFirestore,
  applyQuestionChanges,
  saveScoringConfig,
  saveItemParams,
  CalibratedItemParamInput,
} from './firebase';
import {
  normalizeQuestionInput,
  validateQuestionInput,
  getSessionVariantQuestions,
  getActiveModulesForQuestions,
  getModuleVariantKey,
  isSevenCharQuestionId,
  toDeterministicSevenCharId,
  generateSevenCharQuestionId,
  redistributeQuestionsByDifficultyAndPosition,
} from './utils/questionValidation';
import { LoginView } from './components/LoginView';
import { BluebookExamView } from './components/BluebookExamView';
import { StudentResultView } from './components/StudentResultModal';
import { StudentDashboardView } from './components/StudentDashboardView';
import { AdminDashboard } from './components/AdminDashboard';

export default function App() {
  const [role, setRole] = useState<'guest' | 'student' | 'admin'>('guest');
  const [studentScreen, setStudentScreen] = useState<
    'dashboard' | 'exam' | 'results'
  >('dashboard');
  const [adminName, setAdminName] = useState('Administrator');
  const defaultQuestions = useMemo(() => generateDefaultQuestions(), []);
  const [fsQuestions, setFsQuestions] = useState<SATQuestion[]>([]);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(
    DEFAULT_SCORING_CONFIG
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [viewingResultEarly, setViewingResultEarly] = useState(false);

  // Question bank source: if Firestore has any questions, use strictly the Firestore questions;
  // otherwise fall back to defaultQuestions. Always deduplicate by question ID.
  const questions = useMemo(() => {
    const rawSource = fsQuestions.length > 0 ? fsQuestions : defaultQuestions;
    const uniqueById = new Map<string, SATQuestion>();
    for (const q of rawSource) {
      if (q && q.id) {
        uniqueById.set(q.id, q);
      }
    }
    const source = Array.from(uniqueById.values());
    const result: SATQuestion[] = [];
    for (const modId of MODULE_ORDER) {
      const modQs = source
        .filter((q) => q.moduleId === modId)
        .sort(
          (a, b) =>
            (a.variant || '').localeCompare(b.variant || '') ||
            a.number - b.number ||
            a.id.localeCompare(b.id)
        );
      result.push(...modQs);
    }
    return result;
  }, [fsQuestions, defaultQuestions]);

  // Refs to prevent stale closures in timers or async callbacks
  const sessionsRef = useRef<StudentSession[]>(sessions);
  sessionsRef.current = sessions;

  const fsQuestionsRef = useRef<SATQuestion[]>(fsQuestions);
  fsQuestionsRef.current = fsQuestions;

  const questionsRef = useRef<SATQuestion[]>(questions);
  questionsRef.current = questions;

  const scoringConfigRef = useRef<ScoringConfig>(scoringConfig);
  scoringConfigRef.current = scoringConfig;

  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const roleRef = useRef<'guest' | 'student' | 'admin'>(role);
  roleRef.current = role;

  const migratingIdsRef = useRef<Set<string>>(new Set());

  // Remaps any legacy non-7-character question ID keys inside a session's answers/flagged/eliminated/highlights
  const normalizeSessionQuestionIds = useCallback((s: StudentSession): StudentSession => {
    let changed = false;
    const nextAnswers: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.answers || {})) {
      const nk = isSevenCharQuestionId(k) ? k : toDeterministicSevenCharId(k);
      if (nk !== k) changed = true;
      nextAnswers[nk] = v;
    }

    const nextFlagged: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(s.flagged || {})) {
      const nk = isSevenCharQuestionId(k) ? k : toDeterministicSevenCharId(k);
      if (nk !== k) changed = true;
      nextFlagged[nk] = v;
    }

    const nextEliminated: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(s.eliminated || {})) {
      const nk = isSevenCharQuestionId(k) ? k : toDeterministicSevenCharId(k);
      if (nk !== k) changed = true;
      nextEliminated[nk] = v;
    }

    const nextHighlights = (s.highlights || []).map((h) => {
      if (isSevenCharQuestionId(h.questionId)) return h;
      changed = true;
      return {
        ...h,
        questionId: toDeterministicSevenCharId(h.questionId),
      };
    });

    if (!changed) return s;
    return {
      ...s,
      answers: nextAnswers,
      flagged: nextFlagged,
      eliminated: nextEliminated,
      highlights: nextHighlights,
    };
  }, []);

  // Sync with Firebase Firestore (wissenapk1) in real time
  useEffect(() => {
    const unsubSessions = subscribeToSessions((firestoreSessions) => {
      setSessions((prev) => {
        const mergedMap = new Map<string, StudentSession>();
        for (const s of prev) {
          mergedMap.set(s.id, normalizeSessionQuestionIds(s));
        }
        for (const rawFs of firestoreSessions) {
          const fs = normalizeSessionQuestionIds(rawFs);
          const existingLocal = mergedMap.get(fs.id);
          if (
            roleRef.current === 'student' &&
            activeSessionIdRef.current === fs.id &&
            existingLocal
          ) {
            const localTime = new Date(existingLocal.updatedAt || 0).getTime();
            const remoteTime = new Date(fs.updatedAt || 0).getTime();
            if (localTime >= remoteTime) {
              continue;
            }
          }
          mergedMap.set(fs.id, fs);
        }
        return Array.from(mergedMap.values()).sort(
          (a, b) =>
            new Date(b.updatedAt || 0).getTime() -
            new Date(a.updatedAt || 0).getTime()
        );
      });
    });

    const unsubQuestions = subscribeToQuestions((firestoreQuestions) => {
      const usedIds = new Set<string>();
      const map = new Map<string, SATQuestion>();
      const toMigrateSave: SATQuestion[] = [];
      const toMigrateRemove: string[] = [];

      // First pass: register already-valid 7-char IDs
      for (const q of firestoreQuestions) {
        if (q && q.id && isSevenCharQuestionId(q.id)) {
          usedIds.add(q.id);
        }
      }

      // Second pass: normalize all questions to 7-char IDs
      for (const q of firestoreQuestions) {
        if (!q || !q.id) continue;
        if (isSevenCharQuestionId(q.id)) {
          map.set(q.id, q);
        } else {
          const newId = toDeterministicSevenCharId(q.id, usedIds);
          const migratedQ: SATQuestion = {
            ...q,
            id: newId,
          };
          map.set(newId, migratedQ);
          if (!migratingIdsRef.current.has(q.id)) {
            migratingIdsRef.current.add(q.id);
            toMigrateSave.push(migratedQ);
            toMigrateRemove.push(q.id);
          }
        }
      }

      setFsQuestions(Array.from(map.values()));

      if (toMigrateSave.length > 0) {
        applyQuestionChanges(toMigrateSave, toMigrateRemove).catch((err) =>
          console.error('Error migrating question IDs to 7-char format:', err)
        );
      }
    });

    const unsubScoringConfig = subscribeToScoringConfig((cfg) => {
      setScoringConfig(cfg);
    });

    return () => {
      unsubSessions();
      unsubQuestions();
      unsubScoringConfig();
    };
  }, [normalizeSessionQuestionIds]);

  // Load initial sessions state from server
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        if (data.sessions && Array.isArray(data.sessions)) {
          setSessions((prev) => {
            if (prev.length > 0) return prev;
            return data.sessions;
          });
        }
      }
    } catch (err) {
      console.error('Error loading state:', err);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || null;

  const activeVariantQuestions = useMemo(() => {
    if (!activeSession) return questions;
    return getSessionVariantQuestions(questions, activeSession.id);
  }, [questions, activeSession?.id]);

  const handleLogin = async (
    emailOrIdentifier: string,
    password: string,
    forceNew?: boolean
  ) => {
    setLoading(true);
    setLoginError(null);
    const cleanIdentifier = emailOrIdentifier.trim();
    const cleanEmail = cleanIdentifier.toLowerCase();
    const cleanPass = password.trim();

    if (!cleanPass) {
      setLoginError('Iltimos, parolni kiriting.');
      setLoading(false);
      return;
    }

    if (cleanPass === '7788') {
      setAdminName(
        cleanIdentifier && !cleanIdentifier.includes('@')
          ? cleanIdentifier
          : 'Administrator'
      );
      setRole('admin');
      setLoading(false);
      return;
    }

    if (!cleanIdentifier) {
      setLoginError('Iltimos, elektron pochta manzilingizni kiriting.');
      setLoading(false);
      return;
    }

    try {
      // Match account by email first, or fallback to fullName for legacy sessions created before email support
      const matchedAccount = sessionsRef.current.find(
        (s) =>
          (s.email && s.email.toLowerCase() === cleanEmail) ||
          (!s.email && s.fullName.toLowerCase() === cleanEmail)
      );

      if (!matchedAccount) {
        setLoginError(
          'Ushbu elektron pochta manzili bilan akkaunt topilmadi. Avval «Ro‘yxatdan o‘tish» bo‘limi orqali akkaunt yarating.'
        );
        setLoading(false);
        return;
      }

      if (matchedAccount.password !== cleanPass) {
        setLoginError('Elektron pochta manzili yoki parol noto‘g‘ri! Qaytadan tekshiring.');
        setLoading(false);
        return;
      }

      const cfg = scoringConfigRef.current;
      let targetSession: StudentSession;

      if (forceNew) {
        const now = new Date().toISOString();
        const variantQs = getSessionVariantQuestions(
          questionsRef.current,
          matchedAccount.id
        );
        const activeMods = getActiveModulesForQuestions(variantQs);
        const firstModule: ModuleId = activeMods[0] || 'rw_1';

        targetSession = {
          ...matchedAccount,
          status: 'in_progress',
          currentModule: firstModule,
          currentQuestionIndex: 0,
          viewMode: 'question',
          answers: {},
          flagged: {},
          eliminated: {},
          highlights: [],
          moduleTimeRemaining: {
            rw_1: MODULE_CONFIGS.rw_1.durationSeconds,
            rw_2: MODULE_CONFIGS.rw_2.durationSeconds,
            math_1: MODULE_CONFIGS.math_1.durationSeconds,
            math_2: MODULE_CONFIGS.math_2.durationSeconds,
          },
          completedModules: [],
          routing: undefined,
          routingTheta: undefined,
          result: undefined,
          startedAt: now,
          updatedAt: now,
          completedAt: undefined,
          score: calculateSATScore(variantQs, {}, cfg),
        };
      } else {
        const variantQs = getSessionVariantQuestions(
          questionsRef.current,
          matchedAccount.id
        );
        const activeMods = getActiveModulesForQuestions(variantQs);
        const validCurrentModule = activeMods.includes(
          matchedAccount.currentModule
        )
          ? matchedAccount.currentModule
          : activeMods[0] || 'rw_1';

        targetSession = {
          ...matchedAccount,
          currentModule: validCurrentModule,
          updatedAt: new Date().toISOString(),
          score: calculateSATScore(
            variantQs,
            matchedAccount.answers || {},
            cfg,
            matchedAccount.routing
          ),
        };
      }

      const finalSession = targetSession;
      activeSessionIdRef.current = finalSession.id;
      roleRef.current = 'student';

      setSessions((prev) => {
        const exists = prev.some((s) => s.id === finalSession.id);
        return exists
          ? prev.map((s) => (s.id === finalSession.id ? finalSession : s))
          : [finalSession, ...prev];
      });
      setActiveSessionId(finalSession.id);
      setViewingResultEarly(false);
      setStudentScreen('dashboard');
      setRole('student');

      await saveSessionToFirestore(finalSession);

      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: finalSession.fullName,
          email: finalSession.email,
          password: cleanPass,
          forceNew,
        }),
      }).catch(() => {});
    } catch {
      setLoginError('Ma’lumotlar bazasiga ulanishda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterAccount = async (
    fullName: string,
    email: string,
    password: string,
    startImmediately = false
  ): Promise<{ ok: boolean; message?: string }> => {
    setLoading(true);
    setLoginError(null);
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanName || cleanName.length < 2) {
      const msg = 'Iltimos, ism va familiyangizni to‘liq kiriting.';
      setLoginError(msg);
      setLoading(false);
      return { ok: false, message: msg };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      const msg = 'Iltimos, yaroqli elektron pochta manzilini kiriting (masalan: student@example.com).';
      setLoginError(msg);
      setLoading(false);
      return { ok: false, message: msg };
    }

    if (!cleanPass || cleanPass.length < 4) {
      const msg = 'Maxsus parol kamida 4 ta belgidan iborat bo‘lishi kerak.';
      setLoginError(msg);
      setLoading(false);
      return { ok: false, message: msg };
    }

    if (cleanPass === '7788') {
      const msg = 'Ushbu kod tizim administratori uchun band qilingan. Boshqa maxsus parol tanlang.';
      setLoginError(msg);
      setLoading(false);
      return { ok: false, message: msg };
    }

    const existingSameEmail = sessionsRef.current.find(
      (s) => s.email && s.email.toLowerCase() === cleanEmail
    );
    if (existingSameEmail) {
      if (existingSameEmail.password === cleanPass && startImmediately) {
        await handleLogin(cleanEmail, cleanPass, false);
        return { ok: true };
      }
      const msg =
        'Ushbu elektron pochta manzili bilan akkaunt allaqachon yaratilgan. «Tizimga kirish» bo‘limi orqali elektron pochta va parolingiz bilan kiring.';
      setLoginError(msg);
      setLoading(false);
      return { ok: false, message: msg };
    }

    try {
      const cfg = scoringConfigRef.current;
      const now = new Date().toISOString();
      const sessionId = `sess_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const variantQs = getSessionVariantQuestions(
        questionsRef.current,
        sessionId
      );
      const activeMods = getActiveModulesForQuestions(variantQs);
      const firstModule: ModuleId = activeMods[0] || 'rw_1';

      const newSession: StudentSession = {
        id: sessionId,
        fullName: cleanName,
        email: cleanEmail,
        password: cleanPass,
        status: 'in_progress',
        currentModule: firstModule,
        currentQuestionIndex: 0,
        viewMode: 'question',
        answers: {},
        flagged: {},
        eliminated: {},
        highlights: [],
        moduleTimeRemaining: {
          rw_1: MODULE_CONFIGS.rw_1.durationSeconds,
          rw_2: MODULE_CONFIGS.rw_2.durationSeconds,
          math_1: MODULE_CONFIGS.math_1.durationSeconds,
          math_2: MODULE_CONFIGS.math_2.durationSeconds,
        },
        completedModules: [],
        startedAt: now,
        updatedAt: now,
        score: calculateSATScore(variantQs, {}, cfg),
      };

      setSessions((prev) => [newSession, ...prev]);
      await saveSessionToFirestore(newSession);

      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          password: cleanPass,
          forceNew: true,
        }),
      }).catch(() => {});

      if (startImmediately) {
        activeSessionIdRef.current = newSession.id;
        roleRef.current = 'student';
        setActiveSessionId(newSession.id);
        setViewingResultEarly(false);
        setStudentScreen('dashboard');
        setRole('student');
      }

      return {
        ok: true,
        message:
          'Akkaunt muvaffaqiyatli yaratildi! Endi elektron pochta manzilingiz va parolingiz orqali tizimga kirishingiz mumkin.',
      };
    } catch {
      const msg = 'Akkaunt yaratishda ma’lumotlar bazasi bilan xatolik yuz berdi.';
      setLoginError(msg);
      return { ok: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  // Real-time Firestore + Server sync using latest state ref (never stale!)
  const handleSyncSession = useCallback(
    (updates: Partial<StudentSession>) => {
      const currentId = activeSessionIdRef.current;
      if (!currentId) return;

      const latestActive = sessionsRef.current.find((s) => s.id === currentId);
      if (!latestActive) return;

      const cfg = scoringConfigRef.current;
      const mergedAnswers = updates.answers ?? latestActive.answers;
      const mergedRouting = updates.routing ?? latestActive.routing;
      const mergedRoutingTheta =
        updates.routingTheta ?? latestActive.routingTheta;
      const mergedStatus = updates.status ?? latestActive.status;

      const variantQs = getSessionVariantQuestions(
        questionsRef.current,
        currentId
      );
      const newScore = calculateSATScore(
        variantQs,
        mergedAnswers,
        cfg,
        mergedRouting
      );
      const nowIso = new Date().toISOString();

      const draftSession: StudentSession = {
        ...latestActive,
        ...updates,
        answers: mergedAnswers,
        flagged: updates.flagged ?? latestActive.flagged,
        eliminated: updates.eliminated ?? latestActive.eliminated,
        highlights: updates.highlights ?? latestActive.highlights,
        moduleTimeRemaining:
          updates.moduleTimeRemaining ?? latestActive.moduleTimeRemaining,
        completedModules:
          updates.completedModules ?? latestActive.completedModules,
        routing: mergedRouting,
        routingTheta: mergedRoutingTheta,
        score: newScore,
        updatedAt: nowIso,
        ...(mergedStatus === 'completed' && !latestActive.completedAt
          ? { completedAt: nowIso }
          : {}),
      };

      if (mergedStatus === 'completed' || draftSession.result) {
        draftSession.result = scoreSession(
          draftSession,
          variantQs,
          cfg
        );
      }

      sessionsRef.current = sessionsRef.current.map((s) =>
        s.id === currentId ? draftSession : s
      );
      setSessions(sessionsRef.current);

      saveSessionToFirestore(draftSession).catch((err) =>
        console.error('Firestore session sync error:', err)
      );

      fetch('/api/sessions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentId,
          ...updates,
        }),
      }).catch(() => {});
    },
    []
  );

  const handleResetSession = async (sessionId: string) => {
    const target = sessionsRef.current.find((s) => s.id === sessionId);
    if (!target) return;

    const now = new Date().toISOString();
    const variantQs = getSessionVariantQuestions(
      questionsRef.current,
      sessionId
    );
    const activeMods = getActiveModulesForQuestions(variantQs);
    const firstModule: ModuleId = activeMods[0] || 'rw_1';

    const resetSession: StudentSession = {
      ...target,
      status: 'in_progress',
      currentModule: firstModule,
      currentQuestionIndex: 0,
      viewMode: 'question',
      answers: {},
      flagged: {},
      eliminated: {},
      highlights: [],
      moduleTimeRemaining: {
        rw_1: MODULE_CONFIGS.rw_1.durationSeconds,
        rw_2: MODULE_CONFIGS.rw_2.durationSeconds,
        math_1: MODULE_CONFIGS.math_1.durationSeconds,
        math_2: MODULE_CONFIGS.math_2.durationSeconds,
      },
      completedModules: [],
      routing: undefined,
      routingTheta: undefined,
      result: undefined,
      startedAt: now,
      updatedAt: now,
      completedAt: undefined,
      score: calculateSATScore(variantQs, {}, scoringConfigRef.current),
    };

    sessionsRef.current = sessionsRef.current.map((s) =>
      s.id === sessionId ? resetSession : s
    );
    setSessions(sessionsRef.current);
    setViewingResultEarly(false);

    await saveSessionToFirestore(resetSession);
    fetch(`/api/sessions/${sessionId}/reset`, { method: 'POST' }).catch(() => {});
  };

  const handleDeleteSession = async (sessionId: string) => {
    sessionsRef.current = sessionsRef.current.filter((s) => s.id !== sessionId);
    setSessions(sessionsRef.current);
    await removeSessionFromFirestore(sessionId);
    fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleUpdateQuestion = async (rawUpdatedQ: SATQuestion) => {
    const normalized = normalizeQuestionInput(rawUpdatedQ);
    const err = validateQuestionInput(normalized);
    if (err) {
      throw new Error(err);
    }

    const hasAnyFs = fsQuestionsRef.current.length > 0;
    const toSave: SATQuestion[] = hasAnyFs
      ? [normalized]
      : questionsRef.current.map((q) =>
          q.id === normalized.id ? normalized : q
        );

    await applyQuestionChanges(toSave, []);

    setFsQuestions((prev) => {
      const map = new Map<string, SATQuestion>();
      for (const q of prev) map.set(q.id, q);
      for (const q of toSave) map.set(q.id, q);
      return Array.from(map.values());
    });
  };

  const handleAddQuestion = async (
    rawNewQ: Omit<SATQuestion, 'id' | 'number'>
  ) => {
    const normalized = normalizeQuestionInput(rawNewQ);
    const err = validateQuestionInput(normalized);
    if (err) {
      throw new Error(err);
    }

    const modId = normalized.moduleId;
    const groupKey = getModuleVariantKey(modId, normalized.variant);
    const hasAnyFs = fsQuestionsRef.current.length > 0;
    const allCurrentQuestions = hasAnyFs ? fsQuestionsRef.current : questionsRef.current;
    const currentGroupQuestions = allCurrentQuestions
      .filter((q) => getModuleVariantKey(q.moduleId, q.variant) === groupKey)
      .sort((a, b) => a.number - b.number);

    const usedIds = new Set<string>(allCurrentQuestions.map((q) => q.id));
    const created: SATQuestion = {
      ...normalized,
      id: generateSevenCharQuestionId(usedIds),
      number: currentGroupQuestions.length + 1,
    };

    const toSave: SATQuestion[] = hasAnyFs
      ? [created]
      : [...questionsRef.current, created];

    await applyQuestionChanges(toSave, []);

    setFsQuestions((prev) => {
      const map = new Map<string, SATQuestion>();
      for (const q of prev) map.set(q.id, q);
      for (const q of toSave) map.set(q.id, q);
      return Array.from(map.values());
    });
  };

  const handleDeleteQuestion = async (questionId: string) => {
    const target = questionsRef.current.find((q) => q.id === questionId);
    if (!target) return;

    const groupKey = getModuleVariantKey(target.moduleId, target.variant);
    const hasAnyFs = fsQuestionsRef.current.length > 0;
    const baseAll = hasAnyFs ? fsQuestionsRef.current : questionsRef.current;

    const otherQuestions = baseAll.filter(
      (q) => getModuleVariantKey(q.moduleId, q.variant) !== groupKey
    );
    const remainingInGroup = baseAll
      .filter(
        (q) =>
          getModuleVariantKey(q.moduleId, q.variant) === groupKey &&
          q.id !== questionId
      )
      .sort((a, b) => a.number - b.number)
      .map((q, idx) => ({
        ...q,
        number: idx + 1,
      }));

    const toSave = hasAnyFs
      ? remainingInGroup
      : [...otherQuestions, ...remainingInGroup];

    await applyQuestionChanges(toSave, [questionId]);

    setFsQuestions((prev) => {
      const filtered = prev.filter((q) => q.id !== questionId);
      const map = new Map<string, SATQuestion>();
      for (const q of filtered) map.set(q.id, q);
      for (const q of toSave) map.set(q.id, q);
      return Array.from(map.values());
    });
  };

  const handleImportQuestions = async (
    items: Omit<SATQuestion, 'id' | 'number'>[],
    mode: 'replace_all' | 'append' = 'replace_all'
  ) => {
    if (items.length === 0) return;

    // Group by (moduleId, variant) pair so importing e.g. rw_2/hard does not delete rw_2/easy
    const byGroup = new Map<string, Omit<SATQuestion, 'id' | 'number'>[]>();
    for (const item of items) {
      const normalized = normalizeQuestionInput(item);
      const err = validateQuestionInput(normalized);
      if (err) {
        throw new Error(err);
      }
      const gKey = getModuleVariantKey(normalized.moduleId, normalized.variant);
      const list = byGroup.get(gKey) || [];
      list.push(normalized);
      byGroup.set(gKey, list);
    }

    const toSave: SATQuestion[] = [];
    const removeIds: string[] = [];

    if (mode === 'replace_all') {
      const replaceGroupKeys = new Set<string>(byGroup.keys());
      // If replacing both easy & hard variants of a Stage 2 module (or M1 + M2), also clear un-split common M2 questions
      if (
        (replaceGroupKeys.has('rw_2:easy') && replaceGroupKeys.has('rw_2:hard')) ||
        (replaceGroupKeys.has('rw_1') &&
          (replaceGroupKeys.has('rw_2:easy') || replaceGroupKeys.has('rw_2:hard')))
      ) {
        replaceGroupKeys.add('rw_2');
      }
      if (
        (replaceGroupKeys.has('math_2:easy') && replaceGroupKeys.has('math_2:hard')) ||
        (replaceGroupKeys.has('math_1') &&
          (replaceGroupKeys.has('math_2:easy') || replaceGroupKeys.has('math_2:hard')))
      ) {
        replaceGroupKeys.add('math_2');
      }

      const existingInImportedGroups = fsQuestionsRef.current.filter((q) =>
        replaceGroupKeys.has(getModuleVariantKey(q.moduleId, q.variant))
      );
      const keptQuestions = fsQuestionsRef.current.filter(
        (q) => !replaceGroupKeys.has(getModuleVariantKey(q.moduleId, q.variant))
      );
      const usedIds = new Set<string>(keptQuestions.map((q) => q.id));

      const newSavedIds = new Set<string>();
      for (const [, groupItems] of byGroup.entries()) {
        groupItems.forEach((item, idx) => {
          const num = idx + 1;
          const id = generateSevenCharQuestionId(usedIds);
          newSavedIds.add(id);
          toSave.push({
            ...item,
            id,
            number: num,
          });
        });
      }

      for (const oldQ of existingInImportedGroups) {
        if (!newSavedIds.has(oldQ.id)) {
          removeIds.push(oldQ.id);
        }
      }

      await applyQuestionChanges(toSave, removeIds);
      setFsQuestions((prev) => {
        const map = new Map<string, SATQuestion>();
        for (const q of prev) {
          if (!replaceGroupKeys.has(getModuleVariantKey(q.moduleId, q.variant))) {
            map.set(q.id, q);
          }
        }
        for (const q of toSave) {
          map.set(q.id, q);
        }
        return Array.from(map.values());
      });
    } else {
      const baseExisting = fsQuestionsRef.current;
      const usedIds = new Set<string>(baseExisting.map((q) => q.id));
      for (const [gKey, groupItems] of byGroup.entries()) {
        const existingCount = baseExisting.filter(
          (q) => getModuleVariantKey(q.moduleId, q.variant) === gKey
        ).length;
        groupItems.forEach((item, idx) => {
          const num = existingCount + idx + 1;
          const id = generateSevenCharQuestionId(usedIds);
          toSave.push({
            ...item,
            id,
            number: num,
          });
        });
      }

      await applyQuestionChanges(toSave, []);
      setFsQuestions((prev) => {
        const map = new Map<string, SATQuestion>();
        for (const q of prev) map.set(q.id, q);
        for (const q of toSave) map.set(q.id, q);
        return Array.from(map.values());
      });
    }
  };

  const handleRedistributeSectionQuestions = async (section: 'rw' | 'math') => {
    const hasAnyFs = fsQuestionsRef.current.length > 0;
    const baseAll = hasAnyFs ? fsQuestionsRef.current : questionsRef.current;
    const redistributed = redistributeQuestionsByDifficultyAndPosition(baseAll, section);
    if (redistributed.length === 0) return;

    const secPrefix = section === 'rw' ? 'rw_' : 'math_';
    const otherSectionQuestions = baseAll.filter((q) => !q.moduleId.startsWith(secPrefix));
    const toSave = hasAnyFs ? redistributed : [...otherSectionQuestions, ...redistributed];

    await applyQuestionChanges(toSave, []);
    setFsQuestions((prev) => {
      const map = new Map<string, SATQuestion>();
      for (const q of prev) map.set(q.id, q);
      for (const q of toSave) map.set(q.id, q);
      return Array.from(map.values());
    });
  };

  const handleSaveScoringConfig = async (
    nextConfigInput: Omit<ScoringConfig, 'version' | 'updatedAt'>
  ) => {
    const nextCfg: ScoringConfig = {
      ...nextConfigInput,
      version: (scoringConfigRef.current.version || 1) + 1,
      updatedAt: Date.now(),
    };
    await saveScoringConfig(nextCfg);
    setScoringConfig(nextCfg);
  };

  const handleRecalculateAllSessions = async (): Promise<{
    updatedCount: number;
  }> => {
    const cfg = scoringConfigRef.current;
    const allQs = questionsRef.current;
    const currentSessions = sessionsRef.current;

    const updatedSessions: StudentSession[] = [];
    const nextAllSessions = currentSessions.map((s) => {
      const variantQs = getSessionVariantQuestions(allQs, s.id);
      const nextScore = calculateSATScore(
        variantQs,
        s.answers || {},
        cfg,
        s.routing
      );
      const nextResult = scoreSession(s, variantQs, cfg);
      const updated: StudentSession = {
        ...s,
        score: nextScore,
        result: nextResult,
        updatedAt: new Date().toISOString(),
      };
      updatedSessions.push(updated);
      return updated;
    });

    if (updatedSessions.length > 0) {
      await saveBatchSessionsToFirestore(updatedSessions);
      sessionsRef.current = nextAllSessions;
      setSessions(nextAllSessions);
    }

    return { updatedCount: updatedSessions.length };
  };

  const handleImportItemParams = async (
    items: CalibratedItemParamInput[]
  ): Promise<{ updatedCount: number; skippedIds: string[] }> => {
    const hasAnyFs = fsQuestionsRef.current.length > 0;
    const baseQuestions = hasAnyFs
      ? fsQuestionsRef.current
      : questionsRef.current;

    if (!hasAnyFs) {
      await applyQuestionChanges(baseQuestions, []);
    }

    const res = await saveItemParams(items, baseQuestions);

    const paramMap = new Map<string, CalibratedItemParamInput>();
    for (const item of items) {
      paramMap.set(item.id, item);
    }
    const nowMs = Date.now();
    setFsQuestions((prev) => {
      const source = prev.length > 0 ? prev : baseQuestions;
      return source.map((q) => {
        const p = paramMap.get(q.id);
        if (!p || typeof p.b !== 'number' || !Number.isFinite(p.b)) return q;
        return {
          ...q,
          b: Math.max(-20, Math.min(20, p.b)),
          bSE: typeof p.bSE === 'number' && Number.isFinite(p.bSE) ? p.bSE : q.bSE,
          infit:
            typeof p.infit === 'number' && Number.isFinite(p.infit)
              ? p.infit
              : q.infit,
          outfit:
            typeof p.outfit === 'number' && Number.isFinite(p.outfit)
              ? p.outfit
              : q.outfit,
          calibratedAt:
            typeof p.calibratedAt === 'number' && Number.isFinite(p.calibratedAt)
              ? p.calibratedAt
              : nowMs,
        };
      });
    });

    return res;
  };

  if (role === 'admin') {
    return (
      <AdminDashboard
        adminName={adminName}
        sessions={sessions}
        questions={questions}
        scoringConfig={scoringConfig}
        onDeleteSession={handleDeleteSession}
        onResetSession={handleResetSession}
        onCreateStudentAccount={(fullName, email, password) =>
          handleRegisterAccount(fullName, email, password, false)
        }
        onUpdateQuestion={handleUpdateQuestion}
        onAddQuestion={handleAddQuestion}
        onDeleteQuestion={handleDeleteQuestion}
        onImportQuestions={handleImportQuestions}
        onRedistributeSectionQuestions={handleRedistributeSectionQuestions}
        onSaveScoringConfig={handleSaveScoringConfig}
        onRecalculateAllSessions={handleRecalculateAllSessions}
        onImportItemParams={handleImportItemParams}
        onLogout={() => {
          setRole('guest');
          setActiveSessionId(null);
        }}
      />
    );
  }

  if (role === 'student' && activeSession) {
    if (studentScreen === 'dashboard') {
      return (
        <StudentDashboardView
          session={activeSession}
          allSessions={sessions}
          questions={activeVariantQuestions}
          scoringConfig={scoringConfig}
          onStartExam={() => {
            setViewingResultEarly(false);
            setStudentScreen(
              activeSession.status === 'completed' ? 'results' : 'exam'
            );
          }}
          onViewResults={() => {
            setViewingResultEarly(true);
            setStudentScreen('results');
          }}
          onRestartExam={async () => {
            await handleResetSession(activeSession.id);
            setViewingResultEarly(false);
            setStudentScreen('exam');
          }}
          onLogout={() => {
            setRole('guest');
            setActiveSessionId(null);
            setViewingResultEarly(false);
            setStudentScreen('dashboard');
          }}
        />
      );
    }

    if (
      studentScreen === 'results' ||
      activeSession.status === 'completed' ||
      viewingResultEarly
    ) {
      return (
        <StudentResultView
          session={activeSession}
          questions={activeVariantQuestions}
          scoringConfig={scoringConfig}
          onRestartExam={async () => {
            await handleResetSession(activeSession.id);
            setViewingResultEarly(false);
            setStudentScreen('exam');
          }}
          onReturnToDashboard={() => {
            setViewingResultEarly(false);
            setStudentScreen('dashboard');
          }}
          onReturnToExam={
            activeSession.status !== 'completed'
              ? () => {
                  setViewingResultEarly(false);
                  setStudentScreen('exam');
                }
              : undefined
          }
          onLogout={() => {
            setRole('guest');
            setActiveSessionId(null);
            setViewingResultEarly(false);
            setStudentScreen('dashboard');
          }}
        />
      );
    }

    return (
      <BluebookExamView
        session={activeSession}
        questions={activeVariantQuestions}
        scoringConfig={scoringConfig}
        onSyncSession={handleSyncSession}
        onExitExam={() => {
          setViewingResultEarly(false);
          setStudentScreen('dashboard');
        }}
      />
    );
  }

  return (
    <LoginView
      onLogin={handleLogin}
      onRegister={handleRegisterAccount}
      loading={loading}
      error={loginError}
    />
  );
}
