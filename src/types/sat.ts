export type QuestionType = 'mcq' | 'spr';

export type ModuleId = 'rw_1' | 'rw_2' | 'math_1' | 'math_2';

export interface ModuleConfig {
  id: ModuleId;
  sectionNumber: 1 | 2;
  moduleNumber: 1 | 2;
  title: string;
  shortTitle: string;
  durationSeconds: number;
  questionCount: number;
  directions: string;
}

export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface SATQuestion {
  id: string;
  moduleId: ModuleId;
  number: number;
  type: QuestionType;
  passage?: string;
  prompt: string;
  mathEquation?: string[];
  options?: QuestionOption[];
  correctAnswer: string;
  explanation?: string;
  domain?: string;
}

export interface HighlightAnnotation {
  id: string;
  questionId: string;
  text: string;
  color: 'yellow' | 'blue' | 'pink' | 'underline';
  note?: string;
  createdAt: string;
}

export interface ModuleScoreBreakdown {
  correct: number;
  total: number;
  answered: number;
}

export interface SATScoreReport {
  total: number; // 400 - 1600
  rwScaled: number; // 200 - 800
  mathScaled: number; // 200 - 800
  rwRaw: number;
  rwTotal: number;
  mathRaw: number;
  mathTotal: number;
  totalAnswered: number;
  totalQuestions: number;
  accuracyPercent: number;
  moduleScores: Record<ModuleId, ModuleScoreBreakdown>;
}

export interface StudentSession {
  id: string;
  fullName: string;
  password: string;
  status: 'in_progress' | 'break' | 'completed';
  currentModule: ModuleId;
  currentQuestionIndex: number;
   viewMode: 'question' | 'review';
  answers: Record<string, string>;
  flagged: Record<string, boolean>;
  eliminated: Record<string, string[]>;
  highlights: HighlightAnnotation[];
  moduleTimeRemaining: Record<ModuleId, number>;
  completedModules: ModuleId[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  score: SATScoreReport;
}

export const MODULE_CONFIGS: Record<ModuleId, ModuleConfig> = {
  rw_1: {
    id: 'rw_1',
    sectionNumber: 1,
    moduleNumber: 1,
    title: 'Section 1, Module 1: Reading and Writing',
    shortTitle: 'Reading & Writing M1',
    durationSeconds: 32 * 60,
    questionCount: 27,
    directions:
      'The questions in this section address a number of important reading and writing skills. Each question includes one or more passages, which may include a table or graph. Read each passage and question carefully, and then choose the best answer to the question based on the passage(s). All questions in this section are multiple-choice with four answer choices. Each question has a single best answer.',
  },
  rw_2: {
    id: 'rw_2',
    sectionNumber: 1,
    moduleNumber: 2,
    title: 'Section 1, Module 2: Reading and Writing',
    shortTitle: 'Reading & Writing M2',
    durationSeconds: 32 * 60,
    questionCount: 27,
    directions:
      'The questions in this section address a number of important reading and writing skills. Each question includes one or more passages, which may include a table or graph. Read each passage and question carefully, and then choose the best answer to the question based on the passage(s). All questions in this section are multiple-choice with four answer choices. Each question has a single best answer.',
  },
  math_1: {
    id: 'math_1',
    sectionNumber: 2,
    moduleNumber: 1,
    title: 'Section 2, Module 1: Math',
    shortTitle: 'Math M1',
    durationSeconds: 32 * 60, // Matching 31:57 screenshot timer default (32 mins)
    questionCount: 22,
    directions:
      'The questions in this section address a number of important math skills. Use of an approved calculator is permitted for all questions. Unless otherwise indicated: all variables and expressions represent real numbers; figures provided are drawn to scale; all figures lie in a plane; and the domain of a given function f is the set of all real numbers x for which f(x) is a real number.',
  },
  math_2: {
    id: 'math_2',
    sectionNumber: 2,
    moduleNumber: 2,
    title: 'Section 2, Module 2: Math',
    shortTitle: 'Math M2',
    durationSeconds: 32 * 60,
    questionCount: 22,
    directions:
      'The questions in this section address a number of important math skills. Use of an approved calculator is permitted for all questions. Unless otherwise indicated: all variables and expressions represent real numbers; figures provided are drawn to scale; all figures lie in a plane; and the domain of a given function f is the set of all real numbers x for which f(x) is a real number.',
  },
};

export const MODULE_ORDER: ModuleId[] = ['rw_1', 'rw_2', 'math_1', 'math_2'];
