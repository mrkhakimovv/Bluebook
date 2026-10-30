export type QuestionType = 'mcq' | 'spr';

export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export type QuestionVariant = 'easy' | 'hard';

export type ModuleId = 'rw_1' | 'rw_2' | 'math_1' | 'math_2';

export type SectionId = 'rw' | 'math';

export const RW_DOMAINS = [
  'Craft and Structure',
  'Information and Ideas',
  'Standard English Conventions',
  'Expression of Ideas',
] as const;

export const MATH_DOMAINS = [
  'Algebra',
  'Advanced Math',
  'Problem-Solving and Data Analysis',
  'Geometry and Trigonometry',
] as const;

export function domainsForModule(moduleId: ModuleId): readonly string[] {
  return moduleId.startsWith('rw_') ? RW_DOMAINS : MATH_DOMAINS;
}

export interface ModuleConfig {
  id: ModuleId;
  sectionNumber: 1 | 2;
  moduleNumber: 1 | 2;
  title: string;
  shortTitle: string;
  durationSeconds: number;
  questionCount: number;
  scoredCount: number;
  pretestCount: number;
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
  skill?: string;
  difficulty?: QuestionDifficulty;
  variant?: QuestionVariant; // faqat rw_2 / math_2 uchun; bo'lmasa umumiy
  scored?: boolean; // bo'lmasa true (true = hisoblanadi, false = sinov/pretest)
  b?: number;
  bSE?: number;
  infit?: number;
  outfit?: number;
  calibratedAt?: number;
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

export interface DomainBreakdown {
  correct: number;
  total: number;
}

export interface SectionResult {
  theta: number;
  se: number;
  rawScored: number;
  nScored: number;
  score: number;
  extreme: 'none' | 'zero' | 'perfect';
  domains: Record<string, DomainBreakdown>;
}

export interface SessionResult {
  rw: SectionResult;
  math: SectionResult;
  total: number;
  scoringVersion: number;
  computedAt: number;
}

export interface SessionRouting {
  rw?: QuestionVariant;
  math?: QuestionVariant;
}

export interface SessionRoutingTheta {
  rw?: number;
  math?: number;
}

export interface ScoringConfig {
  version: number;
  A_rw: number;
  B_rw: number;
  A_math: number;
  B_math: number;
  cutRW: number;
  cutMath: number;
  provisionalB: {
    easy: number;
    medium: number;
    hard: number;
  };
  extremeAdjust: number;
  updatedAt: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  version: 1,
  A_rw: 100,
  B_rw: 500,
  A_math: 100,
  B_math: 500,
  cutRW: 0,
  cutMath: 0,
  provisionalB: {
    easy: -1,
    medium: 0,
    hard: 1,
  },
  extremeAdjust: 0.3,
  updatedAt: 0,
};

export interface StudentSession {
  id: string;
  fullName: string;
  email?: string;
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
  routing?: SessionRouting;
  routingTheta?: SessionRoutingTheta;
  result?: SessionResult;
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
    scoredCount: 25,
    pretestCount: 2,
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
    scoredCount: 25,
    pretestCount: 2,
    directions:
      'The questions in this section address a number of important reading and writing skills. Each question includes one or more passages, which may include a table or graph. Read each passage and question carefully, and then choose the best answer to the question based on the passage(s). All questions in this section are multiple-choice with four answer choices. Each question has a single best answer.',
  },
  math_1: {
    id: 'math_1',
    sectionNumber: 2,
    moduleNumber: 1,
    title: 'Section 2, Module 1: Math',
    shortTitle: 'Math M1',
    durationSeconds: 35 * 60,
    questionCount: 22,
    scoredCount: 20,
    pretestCount: 2,
    directions:
      'The questions in this section address a number of important math skills. Use of an approved calculator is permitted for all questions. Unless otherwise indicated: all variables and expressions represent real numbers; figures provided are drawn to scale; all figures lie in a plane; and the domain of a given function f is the set of all real numbers x for which f(x) is a real number.',
  },
  math_2: {
    id: 'math_2',
    sectionNumber: 2,
    moduleNumber: 2,
    title: 'Section 2, Module 2: Math',
    shortTitle: 'Math M2',
    durationSeconds: 35 * 60,
    questionCount: 22,
    scoredCount: 20,
    pretestCount: 2,
    directions:
      'The questions in this section address a number of important math skills. Use of an approved calculator is permitted for all questions. Unless otherwise indicated: all variables and expressions represent real numbers; figures provided are drawn to scale; all figures lie in a plane; and the domain of a given function f is the set of all real numbers x for which f(x) is a real number.',
  },
};

export const MODULE_ORDER: ModuleId[] = ['rw_1', 'rw_2', 'math_1', 'math_2'];
