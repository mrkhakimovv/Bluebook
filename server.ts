import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import {
  SATQuestion,
  StudentSession,
  MODULE_CONFIGS,
} from './src/types/sat';
import {
  generateDefaultQuestions,
  calculateSATScore,
} from './src/data/defaultQuestions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'sat_database.json');

interface DatabaseSchema {
  questions: SATQuestion[];
  sessions: StudentSession[];
}

function ensureDatabase(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const questions = generateDefaultQuestions();
    const now = new Date().toISOString();
    const sampleAnswers1: Record<string, string> = {
      rw_1_q1: 'A',
      rw_1_q2: 'B',
      rw_1_q3: 'B',
      rw_1_q4: 'B',
      rw_1_q5: 'A',
      rw_1_q6: 'A',
      rw_1_q7: 'D',
      rw_1_q8: 'B',
      math_1_q1: 'B',
      math_1_q7: '5940',
      math_1_q9: 'C',
    };
    const initialSessions: StudentSession[] = [
      {
        id: 'sess_demo_1',
        fullName: 'Sardorbek Alimov',
        password: '1234',
        status: 'in_progress',
        currentModule: 'math_1',
        currentQuestionIndex: 8,
        viewMode: 'question',
        answers: sampleAnswers1,
        flagged: { math_1_q9: true },
        eliminated: { math_1_q9: ['A'] },
        highlights: [],
        moduleTimeRemaining: {
          rw_1: 1420,
          rw_2: 1920,
          math_1: 1783,
          math_2: 1920,
        },
        completedModules: ['rw_1', 'rw_2'],
        startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        updatedAt: now,
        score: calculateSATScore(questions, sampleAnswers1),
      },
    ];
    const initialData: DatabaseSchema = {
      questions,
      sessions: initialSessions,
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    const freshDefaults = generateDefaultQuestions();
    if (!parsed.questions || parsed.questions.length === 0) {
      parsed.questions = freshDefaults;
    } else {
      const freshMap = new Map(freshDefaults.map((q) => [q.id, q]));
      parsed.questions = parsed.questions.map((q) => freshMap.get(q.id) || q);
    }
    if (!parsed.sessions) {
      parsed.sessions = [];
    }
    // Recalculate scores to ensure consistency
    parsed.sessions = parsed.sessions.map((s) => ({
      ...s,
      score: calculateSATScore(parsed.questions, s.answers || {}),
    }));
    return parsed;
  } catch (err) {
    console.error('Failed to read DB, initializing fresh DB:', err);
    const fallback: DatabaseSchema = {
      questions: generateDefaultQuestions(),
      sessions: [],
    };
    return fallback;
  }
}

let db: DatabaseSchema = ensureDatabase();

function saveDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database:', err);
  }
}

// SSE clients for real-time updates
const sseClients = new Set<express.Response>();

function broadcastUpdate() {
  const payload = JSON.stringify({
    type: 'STATE_UPDATE',
    timestamp: new Date().toISOString(),
    sessions: db.sessions,
  });
  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // Real-time SSE stream for Admin and active clients
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const initPayload = JSON.stringify({
      type: 'INITIAL',
      sessions: db.sessions,
    });
    res.write(`data: ${initPayload}\n\n`);

    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Get full state
  app.get('/api/state', (_req, res) => {
    db.sessions = db.sessions.map((s) => ({
      ...s,
      score: calculateSATScore(db.questions, s.answers || {}),
    }));
    res.json({
      questions: db.questions,
      sessions: db.sessions,
    });
  });

  // Login endpoint (checks 7788 for admin, otherwise creates/resumes student session)
  app.post('/api/auth/login', (req, res) => {
    const { fullName, email, password, forceNew } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
      forceNew?: boolean;
    };

    const cleanName = (fullName || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanPass) {
      res.status(400).json({ error: 'Iltimos, parolni kiriting.' });
      return;
    }

    if (cleanPass === '7788') {
      res.json({
        role: 'admin',
        fullName: cleanName || 'Administrator',
      });
      return;
    }

    if (!cleanName && !cleanEmail) {
      res.status(400).json({ error: 'Iltimos, elektron pochta manzilini kiriting.' });
      return;
    }

    // Find existing session for this student
    let session = !forceNew
      ? db.sessions.find(
          (s) =>
            ((cleanEmail && s.email && s.email.toLowerCase() === cleanEmail) ||
              (cleanName && s.fullName.toLowerCase() === cleanName.toLowerCase())) &&
            s.password === cleanPass
        )
      : undefined;

    if (!session) {
      const now = new Date().toISOString();
      session = {
        id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fullName: cleanName || cleanEmail,
        ...(cleanEmail ? { email: cleanEmail } : {}),
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
        score: calculateSATScore(db.questions, {}),
      };
      db.sessions.unshift(session);
      saveDatabase();
      broadcastUpdate();
    } else {
      if (cleanEmail && !session.email) {
        session.email = cleanEmail;
      }
      session.updatedAt = new Date().toISOString();
      session.score = calculateSATScore(db.questions, session.answers);
      saveDatabase();
      broadcastUpdate();
    }

    res.json({
      role: 'student',
      session,
      questions: db.questions,
    });
  });

  // Real-time student session sync
  app.post('/api/sessions/sync', (req, res) => {
    const incoming = req.body as Partial<StudentSession> & { id: string };
    if (!incoming || !incoming.id) {
      res.status(400).json({ error: 'Session ID required' });
      return;
    }

    const idx = db.sessions.findIndex((s) => s.id === incoming.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const existing = db.sessions[idx];
    const updatedAnswers = incoming.answers ?? existing.answers;
    const newScore = calculateSATScore(db.questions, updatedAnswers);

    const updatedSession: StudentSession = {
      ...existing,
      ...incoming,
      answers: updatedAnswers,
      flagged: incoming.flagged ?? existing.flagged,
      eliminated: incoming.eliminated ?? existing.eliminated,
      highlights: incoming.highlights ?? existing.highlights,
      moduleTimeRemaining:
        incoming.moduleTimeRemaining ?? existing.moduleTimeRemaining,
      completedModules: incoming.completedModules ?? existing.completedModules,
      updatedAt: new Date().toISOString(),
      completedAt:
        incoming.status === 'completed' && !existing.completedAt
          ? new Date().toISOString()
          : existing.completedAt,
      score: newScore,
    };

    db.sessions[idx] = updatedSession;
    saveDatabase();
    broadcastUpdate();

    res.json({ session: updatedSession });
  });

  // Reset a student's exam session
  app.post('/api/sessions/:id/reset', (req, res) => {
    const { id } = req.params;
    const idx = db.sessions.findIndex((s) => s.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const existing = db.sessions[idx];
    const now = new Date().toISOString();
    const resetSession: StudentSession = {
      ...existing,
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
      score: calculateSATScore(db.questions, {}),
    };

    db.sessions[idx] = resetSession;
    saveDatabase();
    broadcastUpdate();
    res.json({ session: resetSession });
  });

  // Delete a student session (Admin)
  app.delete('/api/sessions/:id', (req, res) => {
    const { id } = req.params;
    db.sessions = db.sessions.filter((s) => s.id !== id);
    saveDatabase();
    broadcastUpdate();
    res.json({ success: true });
  });

  // Update a question (Admin)
  app.put('/api/questions/:id', (req, res) => {
    const { id } = req.params;
    const updatedQ = req.body as SATQuestion;
    const idx = db.questions.findIndex((q) => q.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    db.questions[idx] = {
      ...db.questions[idx],
      ...updatedQ,
      id,
    };

    // Recalculate all student scores in real time
    db.sessions = db.sessions.map((s) => ({
      ...s,
      score: calculateSATScore(db.questions, s.answers),
    }));

    saveDatabase();
    broadcastUpdate();
    res.json({ question: db.questions[idx], questions: db.questions });
  });

  // Add a new question (Admin)
  app.post('/api/questions', (req, res) => {
    const newQ = req.body as Omit<SATQuestion, 'id' | 'number'>;
    const moduleQuestions = db.questions.filter(
      (q) => q.moduleId === newQ.moduleId
    );
    const nextNumber = moduleQuestions.length + 1;
    const created: SATQuestion = {
      ...newQ,
      id: `${newQ.moduleId}_q${Date.now()}`,
      number: nextNumber,
    };
    db.questions.push(created);

    db.sessions = db.sessions.map((s) => ({
      ...s,
      score: calculateSATScore(db.questions, s.answers),
    }));

    saveDatabase();
    broadcastUpdate();
    res.json({ question: created, questions: db.questions });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bluebook SAT Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
