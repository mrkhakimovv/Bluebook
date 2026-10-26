import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  where,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { SATQuestion, StudentSession } from './types/sat';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

// Sanitize StudentSession payload to match firebase-blueprint.json & firestore.rules
export function sanitizeSessionForFirestore(
  session: StudentSession
): Record<string, unknown> {
  const safeId = session.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const payload: Record<string, unknown> = {
    id: safeId,
    fullName: (session.fullName || 'Student').slice(0, 120),
    password: (session.password || '0000').slice(0, 64),
    status: ['in_progress', 'break', 'completed'].includes(session.status)
      ? session.status
      : 'in_progress',
    currentModule: ['rw_1', 'rw_2', 'math_1', 'math_2'].includes(
      session.currentModule
    )
      ? session.currentModule
      : 'rw_1',
    currentQuestionIndex: Math.max(
      0,
      Math.min(100, Number(session.currentQuestionIndex) || 0)
    ),
    viewMode: session.viewMode === 'review' ? 'review' : 'question',
    answers: session.answers || {},
    flagged: session.flagged || {},
    eliminated: session.eliminated || {},
    highlights: (session.highlights || []).slice(0, 100).map((h) => ({
      id: h.id,
      questionId: h.questionId,
      text: h.text,
      color: h.color,
      ...(h.note ? { note: h.note } : {}),
      createdAt: h.createdAt,
    })),
    moduleTimeRemaining: session.moduleTimeRemaining || {
      rw_1: 1920,
      rw_2: 1920,
      math_1: 1920,
      math_2: 1920,
    },
    completedModules: (session.completedModules || []).slice(0, 4),
    startedAt: (session.startedAt || new Date().toISOString()).slice(0, 64),
    updatedAt: new Date().toISOString().slice(0, 64),
    score: session.score,
  };

  if (session.completedAt) {
    payload.completedAt = session.completedAt.slice(0, 64);
  }

  return payload;
}

export function sanitizeQuestionForFirestore(
  q: SATQuestion
): Record<string, unknown> {
  const safeId = q.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const payload: Record<string, unknown> = {
    id: safeId,
    moduleId: ['rw_1', 'rw_2', 'math_1', 'math_2'].includes(q.moduleId)
      ? q.moduleId
      : 'rw_1',
    number: Math.max(1, Math.min(100, Number(q.number) || 1)),
    type: q.type === 'spr' ? 'spr' : 'mcq',
    prompt: (q.prompt || '').slice(0, 4000),
    correctAnswer: (q.correctAnswer || 'A').slice(0, 64),
  };

  if (q.passage) {
    payload.passage = q.passage.slice(0, 8000);
  }
  if (q.explanation) {
    payload.explanation = q.explanation.slice(0, 4000);
  }
  if (q.domain) {
    payload.domain = q.domain.slice(0, 120);
  }
  if (q.options && q.options.length > 0) {
    payload.options = q.options.slice(0, 8);
  }
  if (q.mathEquation && q.mathEquation.length > 0) {
    payload.mathEquation = q.mathEquation.slice(0, 10);
  }

  return payload;
}

export async function saveSessionToFirestore(session: StudentSession) {
  const sanitized = sanitizeSessionForFirestore(session);
  const docId = String(sanitized.id);
  const path = `sessions/${docId}`;
  try {
    await setDoc(doc(db, 'sessions', docId), sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeSessionFromFirestore(sessionId: string) {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `sessions/${safeId}`;
  try {
    await deleteDoc(doc(db, 'sessions', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveQuestionToFirestore(question: SATQuestion) {
  const sanitized = sanitizeQuestionForFirestore(question);
  const docId = String(sanitized.id);
  const path = `questions/${docId}`;
  try {
    await setDoc(doc(db, 'questions', docId), sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToSessions(
  onData: (sessions: StudentSession[]) => void
) {
  const path = 'sessions';
  const q = query(
    collection(db, path),
    where('status', 'in', ['in_progress', 'break', 'completed']),
    limit(200)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: StudentSession[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as StudentSession);
      });
      list.sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime()
      );
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToQuestions(
  onData: (questions: SATQuestion[]) => void
) {
  const path = 'questions';
  const q = query(
    collection(db, path),
    where('type', 'in', ['mcq', 'spr']),
    limit(200)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: SATQuestion[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as SATQuestion);
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
