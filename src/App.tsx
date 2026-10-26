import { useState, useEffect, useCallback, useRef } from 'react';
import { SATQuestion, StudentSession, MODULE_CONFIGS } from './types/sat';
import {
  generateDefaultQuestions,
  calculateSATScore,
} from './data/defaultQuestions';
import {
  subscribeToSessions,
  subscribeToQuestions,
  saveSessionToFirestore,
  removeSessionFromFirestore,
  saveQuestionToFirestore,
} from './firebase';
import { LoginView } from './components/LoginView';
import { BluebookExamView } from './components/BluebookExamView';
import { StudentResultView } from './components/StudentResultModal';
import { AdminDashboard } from './components/AdminDashboard';

export default function App() {
  const [role, setRole] = useState<'guest' | 'student' | 'admin'>('guest');
  const [adminName, setAdminName] = useState('Administrator');
  const [questions, setQuestions] = useState<SATQuestion[]>(() =>
    generateDefaultQuestions()
  );
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [viewingResultEarly, setViewingResultEarly] = useState(false);

  // Refs to prevent stale closures in timers or async callbacks
  const sessionsRef = useRef<StudentSession[]>(sessions);
  sessionsRef.current = sessions;

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
      if (firestoreQuestions.length > 0) {
        setQuestions((prev) => {
          const map = new Map<string, SATQuestion>();
          for (const q of prev) {
            map.set(q.id, q);
          }
          for (const fq of firestoreQuestions) {
            map.set(fq.id, fq);
          }
          return Array.from(map.values());
        });
      }
    });

    return () => {
      unsubSessions();
      unsubQuestions();
    };
  }, []);

  // Load initial state from server
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setQuestions((prev) => {
            const map = new Map<string, SATQuestion>();
            for (const q of data.questions as SATQuestion[]) map.set(q.id, q);
            for (const q of prev) map.set(q.id, q);
            return Array.from(map.values());
          });
        }
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

  const handleUpdateQuestion = async (updatedQ: SATQuestion) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updatedQ.id ? updatedQ : q))
    );
    await saveQuestionToFirestore(updatedQ);
    fetch(`/api/questions/${updatedQ.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedQ),
    }).catch(() => {});
  };

  const handleAddQuestion = async (
    newQ: Omit<SATQuestion, 'id' | 'number'>
  ) => {
    const modQs = questionsRef.current.filter(
      (q) => q.moduleId === newQ.moduleId
    );
    const created: SATQuestion = {
      ...newQ,
      id: `${newQ.moduleId}_q${Date.now()}`,
      number: modQs.length + 1,
    };
    setQuestions((prev) => [...prev, created]);
    await saveQuestionToFirestore(created);
    fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQ),
    }).catch(() => {});
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
