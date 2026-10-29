import {
  SATQuestion,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
  SectionResult,
  SessionResult,
  StudentSession,
  QuestionVariant,
  ModuleId,
  SectionId,
  DomainBreakdown,
} from '../../types/sat';

export function normalizeSprAnswer(val: string): number | string {
  const trimmed = (val || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 2) {
      const num = Number(parts[0]);
      const den = Number(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        return Math.round((num / den) * 10000) / 10000;
      }
    }
  }
  const parsed = Number(trimmed);
  if (!isNaN(parsed)) {
    return Math.round(parsed * 10000) / 10000;
  }
  return trimmed.toLowerCase();
}

export function isAnswerCorrect(
  question: Pick<SATQuestion, 'type' | 'correctAnswer'>,
  userAnswer?: string
): boolean {
  if (!userAnswer || !userAnswer.trim()) return false;
  if (question.type === 'mcq') {
    return (
      userAnswer.trim().toUpperCase() ===
      question.correctAnswer.trim().toUpperCase()
    );
  }
  const acceptedList = question.correctAnswer.split(',').map((s) => s.trim());
  const normUser = normalizeSprAnswer(userAnswer);
  return acceptedList.some((acc) => normalizeSprAnswer(acc) === normUser);
}

export function probCorrect(theta: number, b: number): number {
  const z = theta - b;
  if (z > 30) return 1 - 1e-13;
  if (z < -30) return 1e-13;
  return 1 / (1 + Math.exp(-z));
}

export function itemDifficulty(
  q: Pick<SATQuestion, 'b' | 'difficulty'>,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG
): number {
  if (typeof q.b === 'number' && Number.isFinite(q.b)) {
    return q.b;
  }
  const diff = q.difficulty ?? 'medium';
  const prov = cfg.provisionalB ?? DEFAULT_SCORING_CONFIG.provisionalB;
  if (diff === 'easy' && typeof prov.easy === 'number') return prov.easy;
  if (diff === 'hard' && typeof prov.hard === 'number') return prov.hard;
  return typeof prov.medium === 'number' ? prov.medium : 0;
}

export function estimateTheta(
  bs: number[],
  rawScore: number,
  extremeAdjust: number = DEFAULT_SCORING_CONFIG.extremeAdjust
): {
  theta: number;
  se: number;
  extreme: 'none' | 'zero' | 'perfect';
} {
  const n = bs.length;
  if (n === 0) {
    return { theta: 0, se: 1, extreme: 'none' };
  }

  const adj =
    typeof extremeAdjust === 'number' &&
    Number.isFinite(extremeAdjust) &&
    extremeAdjust > 0 &&
    extremeAdjust < 0.5
      ? extremeAdjust
      : 0.3;

  let extreme: 'none' | 'zero' | 'perfect' = 'none';
  let r = Math.max(0, Math.min(n, rawScore));

  if (r <= 0) {
    r = adj;
    extreme = 'zero';
  } else if (r >= n) {
    r = n - adj;
    extreme = 'perfect';
  }

  let theta = 0;
  const maxIter = 50;
  const tol = 1e-6;

  for (let iter = 0; iter < maxIter; iter++) {
    let sumP = 0;
    let sumInfo = 0;
    for (let i = 0; i < n; i++) {
      const p = probCorrect(theta, bs[i]);
      sumP += p;
      sumInfo += p * (1 - p);
    }

    if (sumInfo < 1e-12) {
      break;
    }

    const step = (r - sumP) / sumInfo;
    const nextTheta = Math.max(-6, Math.min(6, theta + step));

    if (Math.abs(nextTheta - theta) < tol && Math.abs(step) < tol) {
      theta = nextTheta;
      break;
    }
    theta = nextTheta;
  }

  let finalInfo = 0;
  for (let i = 0; i < n; i++) {
    const p = probCorrect(theta, bs[i]);
    finalInfo += p * (1 - p);
  }
  const se = finalInfo > 1e-12 ? 1 / Math.sqrt(finalInfo) : 6;

  return {
    theta: Math.round(theta * 1e6) / 1e6,
    se: Math.round(se * 1e6) / 1e6,
    extreme,
  };
}

export function thetaToScore(theta: number, A: number, B: number): number {
  const raw = Math.round((A * theta + B) / 10) * 10;
  return Math.max(200, Math.min(800, raw));
}

export function routeStage2(theta: number, cut: number): QuestionVariant {
  return theta >= cut ? 'hard' : 'easy';
}

export interface Stage2SelectionResult {
  items: SATQuestion[];
  usedFallback: boolean;
  fallbackType: 'none' | 'common_only' | 'opposite_variant';
}

/**
 * Selects the questions for a 2nd-stage module (`rw_2` or `math_2`) given a routed variant (`easy` | `hard`).
 * Rule:
 * 1) Prefer questions where `q.variant === variant` or `!q.variant` (common).
 * 2) If there are no questions with `q.variant === variant`, use common (`!q.variant`) questions (flagged as fallback).
 * 3) If even common questions don't exist, fall back to the opposite variant so the module is never empty.
 * Questions are sorted by `number` and re-numbered `1..N` for the student's view.
 */
export function selectStage2Questions(
  allQuestions: SATQuestion[],
  moduleId: 'rw_2' | 'math_2',
  variant?: QuestionVariant
): Stage2SelectionResult {
  const modAll = allQuestions
    .filter((q) => q.moduleId === moduleId)
    .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));

  if (modAll.length === 0) {
    return { items: [], usedFallback: false, fallbackType: 'none' };
  }

  const targetVariant: QuestionVariant = variant ?? 'easy';
  const exactVariantQs = modAll.filter((q) => q.variant === targetVariant);
  const commonQs = modAll.filter((q) => !q.variant);
  const oppositeVariant: QuestionVariant =
    targetVariant === 'hard' ? 'easy' : 'hard';
  const oppositeQs = modAll.filter((q) => q.variant === oppositeVariant);

  let chosen: SATQuestion[];
  let usedFallback = false;
  let fallbackType: 'none' | 'common_only' | 'opposite_variant' = 'none';

  const maxCount = moduleId === 'rw_2' ? 27 : 22;

  if (exactVariantQs.length > 0) {
    // Combine exact variant + common questions, sorted by number
    chosen = modAll.filter((q) => q.variant === targetVariant || !q.variant);
    // If total M2 pool was split between easy and hard (e.g. 27 M2 questions split into 13 easy + 14 hard),
    // top up to maxCount using the remaining M2 questions ordered by closest difficulty to targetVariant.
    if (chosen.length < maxCount && oppositeQs.length > 0) {
      const sortedOpposite = [...oppositeQs].sort((a, b) => {
        const diffA = itemDifficulty(a);
        const diffB = itemDifficulty(b);
        if (targetVariant === 'easy') {
          return diffA - diffB || a.number - b.number;
        }
        return diffB - diffA || a.number - b.number;
      });
      const needed = maxCount - chosen.length;
      chosen = [...chosen, ...sortedOpposite.slice(0, needed)];
    }
  } else if (commonQs.length > 0) {
    // Fallback 1: no specific variant questions, use common (variantless) questions
    chosen = commonQs;
    if (oppositeQs.length > 0) {
      usedFallback = true;
      fallbackType = 'common_only';
      if (chosen.length < maxCount) {
        const needed = maxCount - chosen.length;
        chosen = [...chosen, ...oppositeQs.slice(0, needed)];
      }
    }
  } else {
    // Fallback 2: use opposite variant so exam never freezes on an empty module
    chosen = oppositeQs;
    usedFallback = true;
    fallbackType = 'opposite_variant';
  }

  const sliced = chosen.slice(0, maxCount).map((q, idx) => ({
    ...q,
    number: idx + 1,
  }));

  return {
    items: sliced,
    usedFallback,
    fallbackType,
  };
}

/**
 * Returns the ordered questions for a specific module (`rw_1`, `rw_2`, `math_1`, `math_2`)
 * taking into account the student's Stage 2 adaptive routing (`session.routing`).
 */
export function getModuleQuestionsForSession(
  allQuestions: SATQuestion[],
  moduleId: ModuleId,
  routing?: { rw?: QuestionVariant; math?: QuestionVariant }
): SATQuestion[] {
  if (moduleId === 'rw_1' || moduleId === 'math_1') {
    const maxCount = moduleId === 'rw_1' ? 27 : 22;
    return allQuestions
      .filter((q) => q.moduleId === moduleId)
      .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id))
      .slice(0, maxCount)
      .map((q, idx) => ({ ...q, number: idx + 1 }));
  }

  const variant = moduleId === 'rw_2' ? routing?.rw : routing?.math;
  return selectStage2Questions(allQuestions, moduleId, variant).items;
}

/**
 * Computes Stage 1 ability (`theta`) and Stage 2 routing (`easy` | `hard`) from Module 1 scored questions.
 */
export function computeStage1Routing(
  section: SectionId,
  allQuestions: SATQuestion[],
  answers: Record<string, string>,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG
): {
  variant: QuestionVariant;
  theta: number;
  se: number;
  rawScored: number;
  nScored: number;
} {
  const mod1Id: ModuleId = section === 'rw' ? 'rw_1' : 'math_1';
  const mod1Questions = getModuleQuestionsForSession(allQuestions, mod1Id);
  const scoredMod1 = mod1Questions.filter((q) => q.scored !== false);

  let rawScored = 0;
  const bs: number[] = [];
  for (const q of scoredMod1) {
    bs.push(itemDifficulty(q, cfg));
    if (isAnswerCorrect(q, answers[q.id])) {
      rawScored += 1;
    }
  }

  const est = estimateTheta(bs, rawScored, cfg.extremeAdjust);
  const cut = section === 'rw' ? cfg.cutRW : cfg.cutMath;
  const variant = routeStage2(est.theta, cut);

  return {
    variant,
    theta: est.theta,
    se: est.se,
    rawScored,
    nScored: scoredMod1.length,
  };
}

/**
 * Scores a single section (`rw` or `math`) using Rasch 1PL IRT over Module 1 + routed Module 2 scored items.
 */
export function scoreSection(
  section: SectionId,
  questions: SATQuestion[],
  answers: Record<string, string>,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
  routingInput?: QuestionVariant | { rw?: QuestionVariant; math?: QuestionVariant }
): SectionResult & { resolvedVariant: QuestionVariant; routingTheta: number } {
  const mod1Id: ModuleId = section === 'rw' ? 'rw_1' : 'math_1';
  const mod2Id: 'rw_2' | 'math_2' = section === 'rw' ? 'rw_2' : 'math_2';

  const stage1 = computeStage1Routing(section, questions, answers, cfg);

  const explicitVariant: QuestionVariant | undefined =
    typeof routingInput === 'string'
      ? routingInput
      : routingInput && typeof routingInput === 'object'
      ? routingInput[section]
      : undefined;

  const resolvedVariant: QuestionVariant = explicitVariant ?? stage1.variant;

  const mod1Questions = getModuleQuestionsForSession(questions, mod1Id);
  const mod2Questions = selectStage2Questions(
    questions,
    mod2Id,
    resolvedVariant
  ).items;

  const combinedScored = [...mod1Questions, ...mod2Questions].filter(
    (q) => q.scored !== false
  );

  let rawScored = 0;
  const bs: number[] = [];
  const domains: Record<string, DomainBreakdown> = {};
  const defaultDomain =
    section === 'rw' ? 'Craft and Structure' : 'Algebra';

  for (const q of combinedScored) {
    bs.push(itemDifficulty(q, cfg));
    const corr = isAnswerCorrect(q, answers[q.id]);
    if (corr) {
      rawScored += 1;
    }
    const domName = (q.domain || defaultDomain).trim() || defaultDomain;
    if (!domains[domName]) {
      domains[domName] = { correct: 0, total: 0 };
    }
    domains[domName].total += 1;
    if (corr) {
      domains[domName].correct += 1;
    }
  }

  const est = estimateTheta(bs, rawScored, cfg.extremeAdjust);
  const A = section === 'rw' ? cfg.A_rw : cfg.A_math;
  const B = section === 'rw' ? cfg.B_rw : cfg.B_math;
  const score =
    combinedScored.length === 0 ? 200 : thetaToScore(est.theta, A, B);

  return {
    theta: est.theta,
    se: est.se,
    rawScored,
    nScored: combinedScored.length,
    score,
    extreme: est.extreme,
    domains,
    resolvedVariant,
    routingTheta: stage1.theta,
  };
}

/**
 * Scores an entire StudentSession across both `rw` and `math` sections using Rasch 1PL IRT.
 */
export function scoreSession(
  session: Pick<StudentSession, 'answers' | 'routing'>,
  questions: SATQuestion[],
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG
): SessionResult {
  const rwRes = scoreSection(
    'rw',
    questions,
    session.answers || {},
    cfg,
    session.routing?.rw
  );
  const mathRes = scoreSection(
    'math',
    questions,
    session.answers || {},
    cfg,
    session.routing?.math
  );

  const rw: SectionResult = {
    theta: rwRes.theta,
    se: rwRes.se,
    rawScored: rwRes.rawScored,
    nScored: rwRes.nScored,
    score: rwRes.score,
    extreme: rwRes.extreme,
    domains: rwRes.domains,
  };

  const math: SectionResult = {
    theta: mathRes.theta,
    se: mathRes.se,
    rawScored: mathRes.rawScored,
    nScored: mathRes.nScored,
    score: mathRes.score,
    extreme: mathRes.extreme,
    domains: mathRes.domains,
  };

  return {
    rw,
    math,
    total: rw.score + math.score,
    scoringVersion: cfg.version,
    computedAt: Date.now(),
  };
}

/**
 * Checks whether Stage 2 modules (`rw_2`, `math_2`) have both `easy` and `hard` variants
 * or if they will fall back to common / opposite variant questions.
 */
export function getStage2RoutingWarnings(questions: SATQuestion[]): string[] {
  const warnings: string[] = [];
  const configs: Array<{ modId: 'rw_2' | 'math_2'; label: string }> = [
    { modId: 'rw_2', label: 'Reading & Writing M2' },
    { modId: 'math_2', label: 'Math M2' },
  ];

  for (const { modId, label } of configs) {
    const modQs = questions.filter((q) => q.moduleId === modId);
    if (modQs.length === 0) {
      warnings.push(`${label} modulida savollar mavjud emas.`);
      continue;
    }
    const easyCount = modQs.filter((q) => q.variant === 'easy').length;
    const hardCount = modQs.filter((q) => q.variant === 'hard').length;
    const commonCount = modQs.filter((q) => !q.variant).length;

    if (easyCount === 0 && hardCount === 0 && commonCount > 0) {
      warnings.push(
        `${label}: Easy va Hard variantlari alohida kiritilmagan — barcha o‘quvchilarga umumiy (${commonCount} ta) savollar tushadi.`
      );
    } else {
      if (easyCount === 0) {
        if (commonCount > 0) {
          warnings.push(
            `${label} (Easy): Maxsus 'easy' savollar yo‘q — umumiy savollar (${commonCount} ta) ishlatiladi.`
          );
        } else {
          warnings.push(
            `${label} (Easy): 'easy' va umumiy savollar yo‘q — majburan 'hard' variant savollari ishlatiladi!`
          );
        }
      }
      if (hardCount === 0) {
        if (commonCount > 0) {
          warnings.push(
            `${label} (Hard): Maxsus 'hard' savollar yo‘q — umumiy savollar (${commonCount} ta) ishlatiladi.`
          );
        } else {
          warnings.push(
            `${label} (Hard): 'hard' va umumiy savollar yo‘q — majburan 'easy' variant savollari ishlatiladi!`
          );
        }
      }
    }
  }

  return warnings;
}
