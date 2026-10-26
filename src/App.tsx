import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  SATQuestion,
  StudentSession,
  MODULE_CONFIGS,
  MODULE_ORDER,
  ModuleId,
} from './types/sat';
import {
  generateDefaultQuestions,
  calculateSATScore,
} from './data/defaultQuestions';
import {
  subscribeToSessions,
  subscribeToQuestions,
  saveSessionToFirestore,
  removeSessionFromFirestore,
  applyQuestionChanges,
} from './firebase';
import {
  normalizeQuestionInput,
  validateQuestionInput,
} from './utils/questionValidation';
import { LoginView } from './components/LoginView';
import { BluebookExamView } from './components/BluebookExamView';
import { StudentResultView } from './components/StudentResultModal';
import { AdminDashboard } from './components/AdminDashboard';

export default function App() {
  const [role, setRole] = useState<'guest' | 'student' | 'admin'>('guest');
  const [adminName, setAdminName] = useState('Administrator');
  const defaultQuestions = useMemo(() => generateDefaultQuestions(), []);
  const [fsQuestions, setFsQuestions] = useState<SATQuestion[]>([]);
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [viewingResultEarly, setViewingResultEarly] = useState(false);

  // Per-module question source: if Firestore has questions for a module, use those (sorted by number);
  // otherwise fall back to generateDefaultQuestions() for that module.
  const questions = useMemo(() => {
    const result: SATQuestion[] = [];
    for (const modId of MODULE_ORDER) {
      const modFs = fsQuestions
        .filter((q) => q.moduleId === modId)
        .sort((a, b) => a.number - b.number);
      if (modFs.length > 0) {
        result.push(...modFs);
      } else {
        const modDef = defaultQuestions
          .filter((q) => q.moduleId === modId)
          .sort((a, b) => a.number - b.number);
        result.push(...modDef);
      }
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

  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const roleRef = useRef<'guest' | 'student' | 'admin'>(role);
  roleRef.current = role;

  // Sync with Firebase Firestore (wissenapk1) in real time
  useEffect(() => {
    const unsubSessions = subscribeToSessions((firestoreSessions) => {
      setSessions((prev) => {
        const mergedMap = new Map<string, StudentSession>();
        for (const s of prev) {
          mergedMap.set(s.id, s);
        }
        for (const fs of firestoreSessions) {
          const existingLocal = mergedMap.get(fs.id);
          // If this is the currently active student taking the test locally,
          // never let an older in-flight Firestore snapshot overwrite newer local progress
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
      setFsQuestions(firestoreQuestions);
    });

    return () => {
      unsubSessions();
      unsubQuestions();
    };
  }, []);

  // Load initial sessions state from server (questions come exclusively from Firestore / defaults)
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

  const handleLogin = async (
    fullName: string,
    password: string,
    forceNew?: boolean
  ) => {
    setLoading(true);
    setLoginError(null);
    const cleanName = fullName.trim();
    const cleanPass = password.trim();

    if (!cleanPass) {
      setLoginError('Iltimos, parolni kiriting.');
      setLoading(false);
      return;
    }

    if (cleanPass === '7788') {
      setAdminName(cleanName || 'Administrator');
      setRole('admin');
      setLoading(false);
      return;
    }

    if (!cleanName) {
      setLoginError('Iltimos, ism va familiyangizni kiriting.');
      setLoading(false);
      return;
    }

    try {
      let targetSession = !forceNew
        ? sessionsRef.current.find(
            (s) =>
              s.fullName.toLowerCase() === cleanName.toLowerCase() &&
              s.password === cleanPass
          )
        : undefined;

      if (!targetSession) {
        const now = new Date().toISOString();
        targetSession = {
          id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          fullName: cleanName,
          password: cleanPass,
          status: 'in_progress',
          currentModule: 'rw_1',
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
          score: calculateSATScore(questionsRef.current, {}),
        };
      } else {
        targetSession = {
          ...targetSession,
          updatedAt: new Date().toISOString(),
          score: calculateSATScore(
            questionsRef.current,
            targetSession.answers || {}
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
      setRole('student');

      // Save to Firestore (wissenapk1) in background
      await saveSessionToFirestore(finalSession);

      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanName,
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

  // Real-time Firestore + Server sync using latest state ref (never stale!)
  const handleSyncSession = useCallback(
    (updates: Partial<StudentSession>) => {
      const currentId = activeSessionIdRef.current;
      if (!currentId) return;

      const latestActive = sessionsRef.current.find((s) => s.id === currentId);
      if (!latestActive) return;

      const mergedAnswers = updates.answers ?? latestActive.answers;
      const newScore = calculateSATScore(questionsRef.current, mergedAnswers);
      const nowIso = new Date().toISOString();

      const updatedSession: StudentSession = {
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
        score: newScore,
        updatedAt: nowIso,
        ...(updates.status === 'completed' && !latestActive.completedAt
          ? { completedAt: nowIso }
          : {}),
      };

      // Update ref immediately so back-to-back calls never see stale state
      sessionsRef.current = sessionsRef.current.map((s) =>
        s.id === currentId ? updatedSession : s
      );
      setSessions(sessionsRef.current);

      // Persist to Firestore (wissenapk1)
      saveSessionToFirestore(updatedSession).catch((err) =>
        console.error('Firestore session sync error:', err)
      );

      // Mirror to backend API
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
    const resetSession: StudentSession = {
      ...target,
      status: 'in_progress',
      currentModule: 'rw_1',
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
      completedAt: undefined,
      score: calculateSATScore(questionsRef.current, {}),
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

    const modId = normalized.moduleId;
    const modHasFs = fsQuestionsRef.current.some((q) => q.moduleId === modId);
    const currentModQuestions = questionsRef.current
      .filter((q) => q.moduleId === modId)
      .sort((a, b) => a.number - b.number);

    const toSave: SATQuestion[] = modHasFs
      ? [normalized]
      : currentModQuestions.map((q) => (q.id === normalized.id ? normalized : q));

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
    const modHasFs = fsQuestionsRef.current.some((q) => q.moduleId === modId);
    const currentModQuestions = questionsRef.current
      .filter((q) => q.moduleId === modId)
      .sort((a, b) => a.number - b.number);

    const created: SATQuestion = {
      ...normalized,
      id: `${modId}_q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      number: currentModQuestions.length + 1,
    };

    const toSave: SATQuestion[] = modHasFs
      ? [created]
      : [...currentModQuestions, created];

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

    const modId = target.moduleId;
    const remaining = questionsRef.current
      .filter((q) => q.moduleId === modId && q.id !== questionId)
      .sort((a, b) => a.number - b.number)
      .map((q, idx) => ({
        ...q,
        number: idx + 1,
      }));

    await applyQuestionChanges(remaining, [questionId]);

    setFsQuestions((prev) => {
      const filtered = prev.filter((q) => q.id !== questionId);
      const map = new Map<string, SATQuestion>();
      for (const q of filtered) map.set(q.id, q);
      for (const q of remaining) map.set(q.id, q);
      return Array.from(map.values());
    });
  };

  const handleImportQuestions = async (
    items: Omit<SATQuestion, 'id' | 'number'>[]
  ) => {
    if (items.length === 0) return;

    const byModule = new Map<ModuleId, Omit<SATQuestion, 'id' | 'number'>[]>();
    for (const item of items) {
      const normalized = normalizeQuestionInput(item);
      const err = validateQuestionInput(normalized);
      if (err) {
        throw new Error(err);
      }
      const list = byModule.get(normalized.moduleId) || [];
      list.push(normalized);
      byModule.set(normalized.moduleId, list);
    }

    const toSave: SATQuestion[] = [];
    const removeIds: string[] = [];

    for (const [modId, modItems] of byModule.entries()) {
      const existingModIds = new Set<string>();
      for (const q of fsQuestionsRef.current) {
        if (q.moduleId === modId) existingModIds.add(q.id);
      }
      for (const q of questionsRef.current) {
        if (q.moduleId === modId) existingModIds.add(q.id);
      }

      const newSavedIds = new Set<string>();
      modItems.forEach((item, idx) => {
        const num = idx + 1;
        const id = `${modId}_q${num}`;
        newSavedIds.add(id);
        toSave.push({
          ...item,
          id,
          number: num,
        });
      });

      for (const oldId of existingModIds) {
        if (!newSavedIds.has(oldId)) {
          removeIds.push(oldId);
        }
      }
    }

    await applyQuestionChanges(toSave, removeIds);

    const importedModules = new Set(byModule.keys());
    setFsQuestions((prev) => {
      const kept = prev.filter((q) => !importedModules.has(q.moduleId));
      return [...kept, ...toSave];
    });
  };

  if (role === 'admin') {
    return (
      <AdminDashboard
        adminName={adminName}
        sessions={sessions}
        questions={questions}
        onDeleteSession={handleDeleteSession}
        onResetSession={handleResetSession}
        onUpdateQuestion={handleUpdateQuestion}
        onAddQuestion={handleAddQuestion}
        onDeleteQuestion={handleDeleteQuestion}
        onImportQuestions={handleImportQuestions}
        onLogout={() => {
          setRole('guest');
          setActiveSessionId(null);
        }}
      />
    );
  }

  if (role === 'student' && activeSession) {
    if (activeSession.status === 'completed' || viewingResultEarly) {
      return (
        <StudentResultView
          session={activeSession}
          questions={questions}
          onRestartExam={() => handleResetSession(activeSession.id)}
          onReturnToExam={
            activeSession.status !== 'completed'
              ? () => setViewingResultEarly(false)
              : undefined
          }
          onLogout={() => {
            setRole('guest');
            setActiveSessionId(null);
            setViewingResultEarly(false);
          }}
        />
      );
    }

    return (
      <BluebookExamView
        session={activeSession}
        questions={questions}
        onSyncSession={handleSyncSession}
        onExitExam={() => setViewingResultEarly(true)}
      />
    );
  }

  return (
    <LoginView
      onLogin={handleLogin}
      loading={loading}
      error={loginError}
    />
  );
}
