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
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  SATQuestion,
  StudentSession,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
  PracticeTest,
} from './types/sat';

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
      Math.min(10000, Number(session.currentQuestionIndex) || 0)
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
      math_1: 2100,
      math_2: 2100,
    },
    completedModules: (session.completedModules || []).slice(0, 4),
    startedAt: (session.startedAt || new Date().toISOString()).slice(0, 64),
    updatedAt: new Date().toISOString().slice(0, 64),
    score: session.score,
  };

  if (session.testId && typeof session.testId === 'string' && session.testId.trim()) {
    payload.testId = session.testId.trim().slice(0, 128);
  }

  if (session.email && typeof session.email === 'string' && session.email.trim()) {
    payload.email = session.email.trim().toLowerCase().slice(0, 160);
  }

  if (session.completedAt) {
    payload.completedAt = session.completedAt.slice(0, 64);
  }

  if (session.routing && typeof session.routing === 'object') {
    const cleanRouting: Record<string, 'easy' | 'hard'> = {};
    if (session.routing.rw === 'easy' || session.routing.rw === 'hard') {
      cleanRouting.rw = session.routing.rw;
    }
    if (session.routing.math === 'easy' || session.routing.math === 'hard') {
      cleanRouting.math = session.routing.math;
    }
    payload.routing = cleanRouting;
  }

  if (session.routingTheta && typeof session.routingTheta === 'object') {
    const cleanTheta: Record<string, number> = {};
    if (
      typeof session.routingTheta.rw === 'number' &&
      Number.isFinite(session.routingTheta.rw)
    ) {
      cleanTheta.rw = Number(session.routingTheta.rw.toFixed(4));
    }
    if (
      typeof session.routingTheta.math === 'number' &&
      Number.isFinite(session.routingTheta.math)
    ) {
      cleanTheta.math = Number(session.routingTheta.math.toFixed(4));
    }
    payload.routingTheta = cleanTheta;
  }

  if (session.result && typeof session.result === 'object') {
    payload.result = {
      rw: session.result.rw,
      math: session.result.math,
      total: session.result.total,
      scoringVersion: session.result.scoringVersion,
      computedAt:
        typeof session.result.computedAt === 'number'
          ? session.result.computedAt
          : Date.now(),
    };
  }

  return payload;
}

function serializeTableDataForFirestore(
  td: SATQuestion['tableData']
): Record<string, unknown> | undefined {
  if (
    !td ||
    typeof td !== 'object' ||
    !Array.isArray(td.headers) ||
    td.headers.length === 0
  ) {
    return undefined;
  }
  const colCount = Math.min(12, td.headers.length);
  const cleanHeaders = td.headers
    .slice(0, colCount)
    .map((h) => String(h ?? '').trim().slice(0, 300));
  const rawRows = Array.isArray(td.rows) ? td.rows.slice(0, 40) : [];
  const firestoreRows = rawRows.map((row) => {
    const arr = Array.isArray(row)
      ? row
      : row && typeof row === 'object' && Array.isArray((row as { cells?: unknown[] }).cells)
      ? (row as { cells: unknown[] }).cells
      : [];
    const cells: string[] = [];
    for (let i = 0; i < colCount; i++) {
      cells.push(String(arr[i] ?? '').trim().slice(0, 500));
    }
    return { cells };
  });
  return {
    ...(td.title && td.title.trim() ? { title: td.title.trim().slice(0, 300) } : {}),
    headers: cleanHeaders,
    rows: firestoreRows,
  };
}

export function deserializeTableDataFromFirestore(
  rawTd: unknown
): SATQuestion['tableData'] {
  if (!rawTd || typeof rawTd !== 'object') return undefined;
  const td = rawTd as Record<string, unknown>;
  const headers = Array.isArray(td.headers)
    ? td.headers.map((h) => String(h ?? ''))
    : [];
  if (headers.length === 0) return undefined;
  const rawRows = Array.isArray(td.rows) ? td.rows : [];
  const rows: string[][] = rawRows.map((r) => {
    if (Array.isArray(r)) {
      return r.map((c) => String(c ?? ''));
    }
    if (r && typeof r === 'object' && Array.isArray((r as { cells?: unknown[] }).cells)) {
      return (r as { cells: unknown[] }).cells.map((c) => String(c ?? ''));
    }
    return headers.map(() => '');
  });
  return {
    ...(typeof td.title === 'string' && td.title.trim()
      ? { title: td.title.trim() }
      : {}),
    headers,
    rows,
  };
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
    number: Math.max(1, Math.min(10000, Number(q.number) || 1)),
    type: q.type === 'spr' ? 'spr' : 'mcq',
    prompt: (q.prompt || '').slice(0, 4000),
    correctAnswer: (q.correctAnswer || 'A').slice(0, 64),
    scored: q.scored !== false,
  };

  if (q.testId && typeof q.testId === 'string' && q.testId.trim()) {
    payload.testId = q.testId.trim().slice(0, 128);
  }

  if (
    (q.moduleId === 'rw_2' || q.moduleId === 'math_2') &&
    (q.variant === 'easy' || q.variant === 'hard')
  ) {
    payload.variant = q.variant;
  }
  if (q.passage) {
    payload.passage = q.passage.slice(0, 8000);
  }
  if (q.explanation) {
    payload.explanation = q.explanation.slice(0, 4000);
  }
  if (q.domain) {
    payload.domain = q.domain.slice(0, 120);
  }
  if (q.skill) {
    payload.skill = q.skill.slice(0, 120);
  }
  if (q.difficulty && ['easy', 'medium', 'hard'].includes(q.difficulty)) {
    payload.difficulty = q.difficulty;
  }
  if (typeof q.b === 'number' && Number.isFinite(q.b)) {
    payload.b = Math.max(-20, Math.min(20, Number(q.b.toFixed(4))));
  }
  if (typeof q.bSE === 'number' && Number.isFinite(q.bSE)) {
    payload.bSE = Math.max(0, Math.min(100, Number(q.bSE.toFixed(4))));
  }
  if (typeof q.infit === 'number' && Number.isFinite(q.infit)) {
    payload.infit = Math.max(0, Math.min(100, Number(q.infit.toFixed(4))));
  }
  if (typeof q.outfit === 'number' && Number.isFinite(q.outfit)) {
    payload.outfit = Math.max(0, Math.min(100, Number(q.outfit.toFixed(4))));
  }
  if (typeof q.calibratedAt === 'number' && Number.isFinite(q.calibratedAt)) {
    payload.calibratedAt = Math.max(0, Math.round(q.calibratedAt));
  }
  if (q.options && q.options.length > 0) {
    payload.options = q.options.slice(0, 8).map((opt) => {
      const serializedOptTable = serializeTableDataForFirestore(opt.tableData);
      return {
        id: opt.id,
        text: String(opt.text ?? '').slice(0, 2000),
        ...(serializedOptTable ? { tableData: serializedOptTable } : {}),
      };
    });
  }
  if (q.mathEquation && q.mathEquation.length > 0) {
    payload.mathEquation = q.mathEquation.slice(0, 10);
  }
  if (q.imageUrl && typeof q.imageUrl === 'string' && q.imageUrl.trim()) {
    payload.imageUrl = q.imageUrl.trim().slice(0, 800000);
  }
  const serializedTable = serializeTableDataForFirestore(q.tableData);
  if (serializedTable) {
    payload.tableData = serializedTable;
  }

  return payload;
}

export function sanitizeScoringConfigForFirestore(
  cfg: ScoringConfig
): Record<string, unknown> {
  return {
    version: Math.max(1, Math.round(Number(cfg.version) || 1)),
    A_rw: Math.max(1, Math.min(1000, Number(cfg.A_rw) || 100)),
    B_rw: Math.max(0, Math.min(1000, Number(cfg.B_rw) || 500)),
    A_math: Math.max(1, Math.min(1000, Number(cfg.A_math) || 100)),
    B_math: Math.max(0, Math.min(1000, Number(cfg.B_math) || 500)),
    cutRW: Math.max(-10, Math.min(10, Number(cfg.cutRW) || 0)),
    cutMath: Math.max(-10, Math.min(10, Number(cfg.cutMath) || 0)),
    provisionalB: {
      easy: Math.max(
        -10,
        Math.min(
          10,
          Number(cfg.provisionalB?.easy ?? DEFAULT_SCORING_CONFIG.provisionalB.easy)
        )
      ),
      medium: Math.max(
        -10,
        Math.min(
          10,
          Number(
            cfg.provisionalB?.medium ?? DEFAULT_SCORING_CONFIG.provisionalB.medium
          )
        )
      ),
      hard: Math.max(
        -10,
        Math.min(
          10,
          Number(cfg.provisionalB?.hard ?? DEFAULT_SCORING_CONFIG.provisionalB.hard)
        )
      ),
    },
    extremeAdjust: Math.max(
      0.01,
      Math.min(0.49, Number(cfg.extremeAdjust) || 0.3)
    ),
    updatedAt: Math.max(0, Math.round(Number(cfg.updatedAt) || Date.now())),
  };
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

export async function saveBatchSessionsToFirestore(sessions: StudentSession[]) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < sessions.length; i += CHUNK_SIZE) {
    const chunk = sessions.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const s of chunk) {
      const sanitized = sanitizeSessionForFirestore(s);
      const docId = String(sanitized.id);
      batch.set(doc(db, 'sessions', docId), sanitized);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
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

export async function applyQuestionChanges(
  save: SATQuestion[],
  removeIds: string[]
) {
  type Op =
    | { kind: 'save'; docId: string; data: Record<string, unknown> }
    | { kind: 'delete'; docId: string };

  const ops: Op[] = [];

  for (const rawId of removeIds) {
    const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    if (safeId) {
      ops.push({ kind: 'delete', docId: safeId });
    }
  }

  for (const q of save) {
    const sanitized = sanitizeQuestionForFirestore(q);
    const docId = String(sanitized.id);
    ops.push({ kind: 'save', docId, data: sanitized });
  }

  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      const ref = doc(db, 'questions', op.docId);
      if (op.kind === 'save') {
        batch.set(ref, op.data);
      } else {
        batch.delete(ref);
      }
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'questions');
    }
  }
}

export interface CalibratedItemParamInput {
  id: string;
  b: number;
  bSE?: number;
  infit?: number;
  outfit?: number;
  calibratedAt?: number;
}

export async function saveItemParams(
  items: CalibratedItemParamInput[],
  existingQuestions: SATQuestion[]
): Promise<{ updatedCount: number; skippedIds: string[] }> {
  const questionMap = new Map<string, SATQuestion>();
  for (const q of existingQuestions) {
    questionMap.set(q.id, q);
  }

  const nowMs = Date.now();
  const toSave: SATQuestion[] = [];
  const skippedIds: string[] = [];

  for (const item of items) {
    const existing = questionMap.get(item.id);
    if (!existing) {
      skippedIds.push(item.id);
      continue;
    }
    if (typeof item.b !== 'number' || !Number.isFinite(item.b)) {
      skippedIds.push(item.id);
      continue;
    }
    toSave.push({
      ...existing,
      b: Math.max(-20, Math.min(20, item.b)),
      bSE:
        typeof item.bSE === 'number' && Number.isFinite(item.bSE)
          ? item.bSE
          : existing.bSE,
      infit:
        typeof item.infit === 'number' && Number.isFinite(item.infit)
          ? item.infit
          : existing.infit,
      outfit:
        typeof item.outfit === 'number' && Number.isFinite(item.outfit)
          ? item.outfit
          : existing.outfit,
      calibratedAt:
        typeof item.calibratedAt === 'number' && Number.isFinite(item.calibratedAt)
          ? item.calibratedAt
          : nowMs,
    });
  }

  if (toSave.length > 0) {
    await applyQuestionChanges(toSave, []);
  }

  return { updatedCount: toSave.length, skippedIds };
}

export async function saveScoringConfig(cfg: ScoringConfig) {
  const sanitized = sanitizeScoringConfigForFirestore(cfg);
  const path = 'config/scoring';
  try {
    await setDoc(doc(db, 'config', 'scoring'), sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToScoringConfig(
  onData: (cfg: ScoringConfig) => void
) {
  const path = 'config/scoring';
  return onSnapshot(
    doc(db, 'config', 'scoring'),
    (docSnap) => {
      if (docSnap.exists()) {
        const raw = docSnap.data() as Partial<ScoringConfig>;
        onData({
          version:
            typeof raw.version === 'number'
              ? raw.version
              : DEFAULT_SCORING_CONFIG.version,
          A_rw:
            typeof raw.A_rw === 'number'
              ? raw.A_rw
              : DEFAULT_SCORING_CONFIG.A_rw,
          B_rw:
            typeof raw.B_rw === 'number'
              ? raw.B_rw
              : DEFAULT_SCORING_CONFIG.B_rw,
          A_math:
            typeof raw.A_math === 'number'
              ? raw.A_math
              : DEFAULT_SCORING_CONFIG.A_math,
          B_math:
            typeof raw.B_math === 'number'
              ? raw.B_math
              : DEFAULT_SCORING_CONFIG.B_math,
          cutRW:
            typeof raw.cutRW === 'number'
              ? raw.cutRW
              : DEFAULT_SCORING_CONFIG.cutRW,
          cutMath:
            typeof raw.cutMath === 'number'
              ? raw.cutMath
              : DEFAULT_SCORING_CONFIG.cutMath,
          provisionalB: {
            easy:
              typeof raw.provisionalB?.easy === 'number'
                ? raw.provisionalB.easy
                : DEFAULT_SCORING_CONFIG.provisionalB.easy,
            medium:
              typeof raw.provisionalB?.medium === 'number'
                ? raw.provisionalB.medium
                : DEFAULT_SCORING_CONFIG.provisionalB.medium,
            hard:
              typeof raw.provisionalB?.hard === 'number'
                ? raw.provisionalB.hard
                : DEFAULT_SCORING_CONFIG.provisionalB.hard,
          },
          extremeAdjust:
            typeof raw.extremeAdjust === 'number'
              ? raw.extremeAdjust
              : DEFAULT_SCORING_CONFIG.extremeAdjust,
          updatedAt:
            typeof raw.updatedAt === 'number'
              ? raw.updatedAt
              : DEFAULT_SCORING_CONFIG.updatedAt,
        });
      } else {
        onData(DEFAULT_SCORING_CONFIG);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
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
    limit(1000)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const map = new Map<string, SATQuestion>();
      snapshot.forEach((docSnap) => {
        const rawData = docSnap.data() as Record<string, unknown>;
        const id = (rawData.id as string) || docSnap.id;
        const normalizedTableData = deserializeTableDataFromFirestore(rawData.tableData);
        const normalizedOptions = Array.isArray(rawData.options)
          ? (rawData.options as Record<string, unknown>[]).map((opt) => {
              const optTable = deserializeTableDataFromFirestore(opt.tableData);
              return {
                id: (String(opt.id || 'A').trim().toUpperCase() as 'A' | 'B' | 'C' | 'D'),
                text: String(opt.text ?? ''),
                ...(optTable ? { tableData: optTable } : {}),
              };
            })
          : undefined;
        const qItem: SATQuestion = {
          ...(rawData as unknown as SATQuestion),
          id,
          tableData: normalizedTableData,
          ...(normalizedOptions ? { options: normalizedOptions } : {}),
        };
        map.set(id, qItem);
      });
      onData(Array.from(map.values()));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function sanitizePracticeTestForFirestore(
  test: PracticeTest
): Record<string, unknown> {
  const safeId = test.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return {
    id: safeId,
    title: (test.title || 'Practice Test').slice(0, 160),
    description: (test.description || '').slice(0, 1000),
    status: test.status === 'draft' ? 'draft' : 'active',
    rwDurationMinutes: Math.max(
      5,
      Math.min(180, Math.round(Number(test.rwDurationMinutes) || 32))
    ),
    mathDurationMinutes: Math.max(
      5,
      Math.min(180, Math.round(Number(test.mathDurationMinutes) || 35))
    ),
    createdAt: (test.createdAt || new Date().toISOString()).slice(0, 64),
    updatedAt: (test.updatedAt || new Date().toISOString()).slice(0, 64),
  };
}

export async function savePracticeTestToFirestore(test: PracticeTest) {
  const sanitized = sanitizePracticeTestForFirestore(test);
  const docId = String(sanitized.id);
  const path = `practice_tests/${docId}`;
  try {
    await setDoc(doc(db, 'practice_tests', docId), sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removePracticeTestFromFirestore(testId: string) {
  const safeId = testId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  const path = `practice_tests/${safeId}`;
  try {
    await deleteDoc(doc(db, 'practice_tests', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToPracticeTests(
  onData: (tests: PracticeTest[]) => void
) {
  const path = 'practice_tests';
  const q = query(
    collection(db, path),
    where('status', 'in', ['active', 'draft']),
    limit(100)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: PracticeTest[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as PracticeTest;
        list.push({ ...data, id: data.id || docSnap.id });
      });
      list.sort(
        (a, b) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
      );
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

