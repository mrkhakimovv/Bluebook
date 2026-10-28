import {
  probCorrect,
  itemDifficulty,
  estimateTheta,
  thetaToScore,
  routeStage2,
  scoreSection,
  scoreSession,
  selectStage2Questions,
} from '../src/lib/scoring/rasch';
import { DEFAULT_SCORING_CONFIG, SATQuestion } from '../src/types/sat';

function assertClose(
  actual: number,
  expected: number,
  tol: number,
  message: string
) {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tol) {
    throw new Error(
      `FAIL [${message}]: expected ${expected} (±${tol}), got ${actual}`
    );
  }
  console.log(`PASS [${message}]: ${actual.toFixed(4)} ≈ ${expected}`);
}

function assertTrue(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL [${message}]`);
  }
  console.log(`PASS [${message}]`);
}

function runSelftest() {
  console.log('=== Rasch 1PL IRT & Adaptive Routing Self-Test ===');

  // 1. Easy item set: b = [-2, -1.5, -1, -0.5, 0, 0.5]
  const bsEasy = [-2, -1.5, -1, -0.5, 0, 0.5];
  const e3 = estimateTheta(bsEasy, 3, 0.3);
  assertClose(e3.theta, -0.75, 0.01, 'Easy set r=3 -> theta ≈ -0.75');

  const e4 = estimateTheta(bsEasy, 4, 0.3);
  assertClose(e4.theta, 0.06, 0.01, 'Easy set r=4 -> theta ≈ 0.06');
  assertClose(e4.se, 0.93, 0.01, 'Easy set r=4 -> SE ≈ 0.93');

  const e5 = estimateTheta(bsEasy, 5, 0.3);
  assertClose(e5.theta, 1.09, 0.01, 'Easy set r=5 -> theta ≈ 1.09');

  // 2. Hard item set: b = [-0.5, 0, 0.5, 1, 1.5, 2]
  const bsHard = [-0.5, 0, 0.5, 1, 1.5, 2];
  const h3 = estimateTheta(bsHard, 3, 0.3);
  assertClose(h3.theta, 0.75, 0.01, 'Hard set r=3 -> theta ≈ 0.75');

  const h4 = estimateTheta(bsHard, 4, 0.3);
  assertClose(h4.theta, 1.56, 0.01, 'Hard set r=4 -> theta ≈ 1.56');

  const h5 = estimateTheta(bsHard, 5, 0.3);
  assertClose(h5.theta, 2.59, 0.01, 'Hard set r=5 -> theta ≈ 2.59');

  // 3. Extreme scores r=0 and r=n must be finite
  const e0 = estimateTheta(bsEasy, 0, 0.3);
  assertTrue(
    Number.isFinite(e0.theta) &&
      Number.isFinite(e0.se) &&
      e0.extreme === 'zero',
    `r=0 finite theta=${e0.theta}, se=${e0.se}, extreme=${e0.extreme}`
  );

  const eFull = estimateTheta(bsEasy, bsEasy.length, 0.3);
  assertTrue(
    Number.isFinite(eFull.theta) &&
      Number.isFinite(eFull.se) &&
      eFull.extreme === 'perfect',
    `r=n finite theta=${eFull.theta}, se=${eFull.se}, extreme=${eFull.extreme}`
  );

  // 4. thetaToScore always in [200, 800] and divisible by 10
  for (let t = -8; t <= 8; t += 0.37) {
    const s = thetaToScore(t, 100, 500);
    if (s < 200 || s > 800 || s % 10 !== 0) {
      throw new Error(`Invalid score ${s} for theta=${t}`);
    }
  }
  console.log('PASS [thetaToScore bounds 200-800 and multiple of 10]');

  // 5. Stage 2 routing & pretest exclusion test
  assertTrue(routeStage2(0.0, 0.0) === 'hard', 'routeStage2(0, 0) === hard');
  assertTrue(routeStage2(-0.01, 0.0) === 'easy', 'routeStage2(-0.01, 0) === easy');
  assertTrue(
    Math.abs(probCorrect(0, 0) - 0.5) < 1e-9,
    'probCorrect(0, 0) === 0.5'
  );
  assertTrue(
    itemDifficulty({ difficulty: 'hard' }, DEFAULT_SCORING_CONFIG) === 1,
    'itemDifficulty fallback to provisionalB.hard'
  );

  // 6. Full adaptive section & session test (high vs low routing + pretest ignored)
  const mockQuestions: SATQuestion[] = [
    {
      id: 'rw_1_q1',
      moduleId: 'rw_1',
      number: 1,
      type: 'mcq',
      prompt: 'Q1',
      correctAnswer: 'A',
      difficulty: 'easy',
      scored: true,
      domain: 'Craft and Structure',
    },
    {
      id: 'rw_1_q2',
      moduleId: 'rw_1',
      number: 2,
      type: 'mcq',
      prompt: 'Q2',
      correctAnswer: 'B',
      difficulty: 'hard',
      scored: true,
      domain: 'Information and Ideas',
    },
    {
      id: 'rw_1_pretest',
      moduleId: 'rw_1',
      number: 3,
      type: 'mcq',
      prompt: 'Pretest',
      correctAnswer: 'C',
      difficulty: 'hard',
      scored: false,
      domain: 'Craft and Structure',
    },
    {
      id: 'rw_2_easy_1',
      moduleId: 'rw_2',
      number: 1,
      type: 'mcq',
      prompt: 'M2 Easy',
      correctAnswer: 'A',
      variant: 'easy',
      difficulty: 'easy',
      scored: true,
      domain: 'Craft and Structure',
    },
    {
      id: 'rw_2_hard_1',
      moduleId: 'rw_2',
      number: 1,
      type: 'mcq',
      prompt: 'M2 Hard',
      correctAnswer: 'D',
      variant: 'hard',
      difficulty: 'hard',
      scored: true,
      domain: 'Craft and Structure',
    },
    {
      id: 'math_1_q1',
      moduleId: 'math_1',
      number: 1,
      type: 'spr',
      prompt: '3/4',
      correctAnswer: '0.75',
      difficulty: 'medium',
      scored: true,
      domain: 'Algebra',
    },
    {
      id: 'math_2_hard_1',
      moduleId: 'math_2',
      number: 1,
      type: 'spr',
      prompt: 'Math M2 Hard',
      correctAnswer: '12',
      variant: 'hard',
      difficulty: 'hard',
      scored: true,
      domain: 'Algebra',
    },
    {
      id: 'math_2_easy_1',
      moduleId: 'math_2',
      number: 1,
      type: 'spr',
      prompt: 'Math M2 Easy',
      correctAnswer: '5',
      variant: 'easy',
      difficulty: 'easy',
      scored: true,
      domain: 'Algebra',
    },
  ];

  // Low performer on RW1 (0/2 scored, even if pretest is answered right!)
  const lowRw = scoreSection(
    'rw',
    mockQuestions,
    { rw_1_pretest: 'C' },
    DEFAULT_SCORING_CONFIG
  );
  assertTrue(
    lowRw.resolvedVariant === 'easy' && lowRw.rawScored === 0 && lowRw.nScored === 3,
    'Low RW1 routes to easy and ignores pretest item'
  );

  // High performer on RW1 (2/2 scored, even if pretest is wrong) + SPR fraction equivalence (3/4 == 0.75)
  const highSession = scoreSession(
    {
      answers: {
        rw_1_q1: 'A',
        rw_1_q2: 'B',
        rw_2_hard_1: 'D',
        math_1_q1: '3/4',
        math_2_hard_1: '12',
      },
    },
    mockQuestions,
    DEFAULT_SCORING_CONFIG
  );
  assertTrue(
    highSession.rw.rawScored === 3 &&
      highSession.math.rawScored === 2 &&
      highSession.total > 1200,
    `High session scored properly (total=${highSession.total})`
  );

  // Fallback check when a variant has no questions
  const onlyEasyM2 = mockQuestions.filter((q) => q.id !== 'rw_2_hard_1');
  const fb = selectStage2Questions(onlyEasyM2, 'rw_2', 'hard');
  assertTrue(
    fb.items.length === 1 && fb.usedFallback && fb.fallbackType === 'opposite_variant',
    'Stage 2 fallback to opposite variant when hard variant is missing'
  );

  console.log('=== ALL SELFTESTS PASSED ===');
}

runSelftest();
