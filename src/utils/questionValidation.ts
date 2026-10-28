import {
  SATQuestion,
  ModuleId,
  QuestionType,
  QuestionDifficulty,
  QuestionVariant,
  QuestionOption,
  MODULE_CONFIGS,
  MODULE_ORDER,
  RW_DOMAINS,
  MATH_DOMAINS,
} from '../types/sat';

const VALID_MODULES: ModuleId[] = ['rw_1', 'rw_2', 'math_1', 'math_2'];
const VALID_DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const VALID_VARIANTS: QuestionVariant[] = ['easy', 'hard'];
const OPTION_IDS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

export function inferSectionFromQuestionData(
  obj: {
    domain?: string;
    type?: string;
    passage?: string;
    prompt?: string;
    mathEquation?: unknown;
    options?: QuestionOption[];
  },
  fallbackSection: 'rw' | 'math' = 'math'
): 'rw' | 'math' {
  const domainLower = (obj.domain || '').trim().toLowerCase();
  if (domainLower) {
    if (RW_DOMAINS.some((d) => d.toLowerCase() === domainLower)) {
      return 'rw';
    }
    if (MATH_DOMAINS.some((d) => d.toLowerCase() === domainLower)) {
      return 'math';
    }
  }

  if (obj.type === 'spr') {
    return 'math';
  }
  if (Array.isArray(obj.mathEquation) && obj.mathEquation.length > 0) {
    return 'math';
  }

  const promptText = (obj.prompt || '').toLowerCase();
  const passageText = (obj.passage || '').toLowerCase();
  const combinedText = `${passageText} ${promptText}`;

  const rwIndicators = [
    'which choice completes the text',
    'as used in the text',
    'main idea of the text',
    'main purpose of the text',
    'conforms to the conventions of standard english',
    'most logical transition',
    'most logically completes the text',
    'according to the text',
    'student has taken the following notes',
    'overall structure of the text',
    'based on the texts',
  ];
  if (rwIndicators.some((kw) => combinedText.includes(kw))) {
    return 'rw';
  }

  const mathIndicators = [
    'what is the value of',
    'which expression is equivalent',
    'which function',
    'which equation',
    'which inequality',
    'system of equations',
    'in the xy-plane',
    'right triangle',
    'radius of',
    'area of',
    'volume of',
    '\\frac',
    '\\sqrt',
    '\\pi',
    'f(x)',
    'f(n)',
    'g(x)',
    '>=',
    '<=',
    '≥',
    '≤',
  ];
  if (
    mathIndicators.some((kw) => combinedText.includes(kw)) ||
    /\$[^$]+\$/.test(obj.prompt || '') ||
    /\d+\s*[+\-*/=]\s*\d+/.test(obj.prompt || '')
  ) {
    return 'math';
  }

  if (obj.passage && obj.passage.trim().length > 80) {
    return 'rw';
  }

  return fallbackSection;
}

export function normalizeQuestionInput<T extends Partial<SATQuestion>>(input: T): T {
  const copy: Partial<SATQuestion> = { ...input };

  if (typeof copy.prompt === 'string') {
    copy.prompt = copy.prompt.trim();
  }
  if (typeof copy.passage === 'string') {
    const trimmed = copy.passage.trim();
    copy.passage = trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof copy.explanation === 'string') {
    const trimmed = copy.explanation.trim();
    copy.explanation = trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof copy.domain === 'string') {
    const trimmed = copy.domain.trim();
    copy.domain = trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof copy.skill === 'string') {
    const trimmed = copy.skill.trim();
    copy.skill = trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof copy.difficulty === 'string') {
    const trimmed = copy.difficulty.trim().toLowerCase() as QuestionDifficulty;
    copy.difficulty = VALID_DIFFICULTIES.includes(trimmed) ? trimmed : undefined;
  }

  if (!copy.type) {
    copy.type = Array.isArray(copy.options) && copy.options.length > 0 ? 'mcq' : 'spr';
  }

  if (!copy.moduleId || !VALID_MODULES.includes(copy.moduleId)) {
    const sec = inferSectionFromQuestionData(copy);
    copy.moduleId = sec === 'rw' ? 'rw_1' : 'math_1';
  }

  // Normalize variant (only valid on rw_2 and math_2)
  if (copy.moduleId === 'rw_2' || copy.moduleId === 'math_2') {
    if (typeof copy.variant === 'string') {
      const v = copy.variant.trim().toLowerCase() as QuestionVariant;
      copy.variant = VALID_VARIANTS.includes(v) ? v : undefined;
    } else {
      copy.variant = undefined;
    }
  } else {
    copy.variant = undefined;
  }

  // Normalize scored (default true)
  copy.scored = copy.scored !== false;

  // Normalize psychometric parameters if provided
  if (typeof copy.b === 'number' && Number.isFinite(copy.b)) {
    copy.b = Number(copy.b.toFixed(4));
  } else {
    copy.b = undefined;
  }
  if (typeof copy.bSE === 'number' && Number.isFinite(copy.bSE)) {
    copy.bSE = Number(copy.bSE.toFixed(4));
  } else {
    copy.bSE = undefined;
  }
  if (typeof copy.infit === 'number' && Number.isFinite(copy.infit)) {
    copy.infit = Number(copy.infit.toFixed(4));
  } else {
    copy.infit = undefined;
  }
  if (typeof copy.outfit === 'number' && Number.isFinite(copy.outfit)) {
    copy.outfit = Number(copy.outfit.toFixed(4));
  } else {
    copy.outfit = undefined;
  }

  if (typeof copy.correctAnswer === 'string') {
    const trimmed = copy.correctAnswer.trim();
    copy.correctAnswer = copy.type === 'mcq' ? trimmed.toUpperCase() : trimmed;
  }

  if (copy.type === 'mcq' && Array.isArray(copy.options)) {
    copy.options = copy.options.map((opt) => ({
      id: opt.id,
      text: (opt.text || '').trim(),
    }));
  } else if (copy.type === 'spr') {
    copy.options = undefined;
  }

  if (Array.isArray(copy.mathEquation)) {
    const cleaned = copy.mathEquation.map((eq) => String(eq).trim()).filter(Boolean);
    copy.mathEquation = cleaned.length > 0 ? cleaned : undefined;
  }

  return copy as T;
}

function isValidSprSingleToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (/^-?\d+\/\d+$/.test(t)) {
    const parts = t.split('/');
    const den = Number(parts[1]);
    return den !== 0;
  }
  if (/^-?(\d+(\.\d+)?|\.\d+)$/.test(t)) {
    return !isNaN(Number(t));
  }
  return false;
}

export function validateQuestionInput(raw: Partial<SATQuestion>): string | null {
  if (
    raw.variant !== undefined &&
    raw.variant !== ('' as unknown) &&
    raw.variant !== ('common' as unknown) &&
    !VALID_VARIANTS.includes(raw.variant as QuestionVariant)
  ) {
    return 'Variant faqat easy yoki hard bo‘lishi mumkin.';
  }

  if (
    (raw.moduleId === 'rw_1' || raw.moduleId === 'math_1') &&
    raw.variant !== undefined &&
    raw.variant !== ('' as unknown) &&
    raw.variant !== ('common' as unknown)
  ) {
    return '1-modul (rw_1, math_1) savollarida easy/hard varianti bo‘lmaydi.';
  }

  if (
    raw.b !== undefined &&
    raw.b !== (null as unknown) &&
    (typeof raw.b !== 'number' || !Number.isFinite(raw.b) || raw.b < -6 || raw.b > 6)
  ) {
    return 'Rasch qiyinlik parametri (b) -6 va +6 oralig‘ida son bo‘lishi kerak.';
  }

  const q = normalizeQuestionInput(raw);

  if (!q.moduleId || !VALID_MODULES.includes(q.moduleId)) {
    return 'Modul noto‘g‘ri tanlangan.';
  }

  if (!q.type || (q.type !== 'mcq' && q.type !== 'spr')) {
    return 'Savol turi noto‘g‘ri (mcq yoki spr bo‘lishi kerak).';
  }

  if (q.moduleId.startsWith('rw_') && q.type !== 'mcq') {
    return 'Reading & Writing modullarida faqat variantli (MCQ) savollar bo‘lishi mumkin.';
  }

  if (!q.prompt || q.prompt.length === 0) {
    return 'Savol sharti (prompt) bo‘sh bo‘lishi mumkin emas.';
  }
  if (q.prompt.length > 4000) {
    return 'Savol sharti 4000 belgidan oshmasligi kerak.';
  }

  if (q.passage && q.passage.length > 8000) {
    return 'Matn (passage) 8000 belgidan oshmasligi kerak.';
  }

  if (q.explanation && q.explanation.length > 4000) {
    return 'Izoh (explanation) 4000 belgidan oshmasligi kerak.';
  }

  if (q.domain && q.domain.length > 120) {
    return 'Domain nomi 120 belgidan oshmasligi kerak.';
  }

  if (q.skill && q.skill.length > 120) {
    return 'Skill nomi 120 belgidan oshmasligi kerak.';
  }

  if (
    raw.difficulty !== undefined &&
    raw.difficulty !== ('' as unknown) &&
    !VALID_DIFFICULTIES.includes(raw.difficulty as QuestionDifficulty)
  ) {
    return 'Qiyinlik darajasi faqat easy, medium yoki hard bo‘lishi mumkin.';
  }

  if (q.type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      return 'Variantli savolda A, B, C, D variantlarining barchasi bo‘lishi shart.';
    }
    for (const id of OPTION_IDS) {
      const found = q.options.find((o) => o.id === id);
      if (!found || !found.text || found.text.trim().length === 0) {
        return `Variant ${id} matni to‘ldirilishi shart.`;
      }
    }
    if (!q.correctAnswer || !OPTION_IDS.includes(q.correctAnswer as 'A' | 'B' | 'C' | 'D')) {
      return 'Variantli savolda to‘g‘ri javob faqat A, B, C yoki D bo‘lishi kerak.';
    }
  } else {
    if (!q.correctAnswer || q.correctAnswer.length === 0) {
      return 'Yozma savolda (SPR) to‘g‘ri javob kiritilishi shart.';
    }
    if (q.correctAnswer.length > 64) {
      return 'To‘g‘ri javob 64 belgidan oshmasligi kerak.';
    }
    const tokens = q.correctAnswer.split(',').map((s) => s.trim()).filter(Boolean);
    if (tokens.length === 0 || !tokens.every(isValidSprSingleToken)) {
      return 'Yozma savol (SPR) javobi faqat butun son, o‘nli kasr yoki oddiy kasr bo‘lishi kerak (masalan: 12, -3.5, 3/4).';
    }
  }

  return null;
}

export type ImportedQuestionItem = Omit<SATQuestion, 'id' | 'number'>;

export interface QuestionImportResult {
  items: ImportedQuestionItem[];
  errors: string[];
  warnings: string[];
  counts: Record<ModuleId, number>;
  groupCounts: Record<string, { total: number; scored: number; pretest: number; max: number }>;
}

export type ImportPlacementTarget =
  | 'auto'
  | 'rw_auto'
  | 'math_auto'
  | ModuleId
  | 'rw_2_easy'
  | 'rw_2_hard'
  | 'math_2_easy'
  | 'math_2_hard';

export interface ParseQuestionImportOptions {
  targetPlacement?: ImportPlacementTarget;
  autoBalanceModules?: boolean;
}

function parseRawOptions(rawOpts: unknown): QuestionOption[] | undefined {
  if (!rawOpts) return undefined;

  if (Array.isArray(rawOpts)) {
    if (rawOpts.length !== 4) return undefined;
    return OPTION_IDS.map((id, idx) => {
      const item = rawOpts[idx];
      if (typeof item === 'string') {
        return { id, text: item.trim() };
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const optId = String(obj.id || id).trim().toUpperCase() as 'A' | 'B' | 'C' | 'D';
        return {
          id: OPTION_IDS.includes(optId) ? optId : id,
          text: String(obj.text ?? '').trim(),
        };
      }
      return { id, text: '' };
    });
  }

  if (typeof rawOpts === 'object') {
    const obj = rawOpts as Record<string, unknown>;
    return OPTION_IDS.map((id) => ({
      id,
      text: String(obj[id] ?? obj[id.toLowerCase()] ?? '').trim(),
    }));
  }

  return undefined;
}

export function getModuleVariantKey(moduleId: ModuleId, variant?: QuestionVariant): string {
  if ((moduleId === 'rw_2' || moduleId === 'math_2') && (variant === 'easy' || variant === 'hard')) {
    return `${moduleId}:${variant}`;
  }
  return moduleId;
}

export function formatModuleVariantLabel(key: string): string {
  switch (key) {
    case 'rw_1':
      return 'Reading & Writing M1';
    case 'rw_2':
      return 'Reading & Writing M2 (Umumiy)';
    case 'rw_2:easy':
      return 'Reading & Writing M2 (Easy)';
    case 'rw_2:hard':
      return 'Reading & Writing M2 (Hard)';
    case 'math_1':
      return 'Math M1';
    case 'math_2':
      return 'Math M2 (Umumiy)';
    case 'math_2:easy':
      return 'Math M2 (Easy)';
    case 'math_2:hard':
      return 'Math M2 (Hard)';
    default:
      return key;
  }
}

export function parseQuestionImport(
  text: string,
  importOptions?: ParseQuestionImportOptions
): QuestionImportResult {
  const counts: Record<ModuleId, number> = {
    rw_1: 0,
    rw_2: 0,
    math_1: 0,
    math_2: 0,
  };
  const groupCounts: Record<
    string,
    { total: number; scored: number; pretest: number; max: number }
  > = {};
  const items: ImportedQuestionItem[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const targetPlacement: ImportPlacementTarget = importOptions?.targetPlacement ?? 'auto';
  const autoBalance = importOptions?.autoBalanceModules ?? true;

  const trimmed = (text || '').trim();
  if (!trimmed) {
    return {
      items,
      errors: ['JSON matni bo‘sh.'],
      warnings,
      counts,
      groupCounts,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      items,
      errors: [
        `JSON formati xato: ${msg}. Eslatma: LaTeX formulalarda teskari chiziq ikkita yozilishi kerak (masalan: "\\\\frac{1}{2}", "\\\\sqrt{x}", "\\\\pi").`,
      ],
      warnings,
      counts,
      groupCounts,
    };
  }

  const rawList: unknown[] | null = Array.isArray(parsed)
    ? parsed
    : parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as Record<string, unknown>).questions)
    ? ((parsed as Record<string, unknown>).questions as unknown[])
    : null;

  if (!rawList) {
    return {
      items,
      errors: [
        'JSON fayl savollar massividan ([...]) yoki {"questions": [...]} obyektidan iborat bo‘lishi kerak.',
      ],
      warnings,
      counts,
      groupCounts,
    };
  }

  if (rawList.length === 0) {
    return {
      items,
      errors: ['JSON ichida hech qanday savol topilmadi.'],
      warnings,
      counts,
      groupCounts,
    };
  }

  let rwAutoCounter = 0;
  let mathAutoCounter = 0;

  rawList.forEach((rawItem, idx) => {
    const num = idx + 1;
    if (!rawItem || typeof rawItem !== 'object') {
      errors.push(`#${num}: Savol obyekti noto‘g‘ri.`);
      return;
    }

    const obj = rawItem as Record<string, unknown>;
    const options = parseRawOptions(obj.options);
    const inferredType: QuestionType = obj.type
      ? (String(obj.type).trim().toLowerCase() as QuestionType)
      : options
      ? 'mcq'
      : 'spr';

    const rawModuleStr = obj.moduleId ? String(obj.moduleId).trim().toLowerCase() : '';
    const rawVariantStr =
      obj.variant !== undefined && obj.variant !== null && String(obj.variant).trim() !== ''
        ? String(obj.variant).trim().toLowerCase()
        : undefined;

    if (
      rawVariantStr !== undefined &&
      rawVariantStr !== 'common' &&
      !VALID_VARIANTS.includes(rawVariantStr as QuestionVariant)
    ) {
      errors.push(
        `#${num}: Variant noto‘g‘ri ("${String(obj.variant)}"). Faqat easy yoki hard bo‘lishi mumkin.`
      );
      return;
    }

    let resolvedModuleId: ModuleId;
    let resolvedVariant: QuestionVariant | undefined =
      rawVariantStr && VALID_VARIANTS.includes(rawVariantStr as QuestionVariant)
        ? (rawVariantStr as QuestionVariant)
        : undefined;

    if (targetPlacement === 'rw_2_easy') {
      resolvedModuleId = 'rw_2';
      resolvedVariant = 'easy';
    } else if (targetPlacement === 'rw_2_hard') {
      resolvedModuleId = 'rw_2';
      resolvedVariant = 'hard';
    } else if (targetPlacement === 'math_2_easy') {
      resolvedModuleId = 'math_2';
      resolvedVariant = 'easy';
    } else if (targetPlacement === 'math_2_hard') {
      resolvedModuleId = 'math_2';
      resolvedVariant = 'hard';
    } else if (targetPlacement === 'rw_auto') {
      resolvedModuleId = rwAutoCounter % 2 === 0 ? 'rw_1' : 'rw_2';
      rwAutoCounter += 1;
    } else if (targetPlacement === 'math_auto') {
      resolvedModuleId = mathAutoCounter % 2 === 0 ? 'math_1' : 'math_2';
      mathAutoCounter += 1;
    } else if (targetPlacement !== 'auto' && VALID_MODULES.includes(targetPlacement)) {
      resolvedModuleId = targetPlacement;
    } else if (VALID_MODULES.includes(rawModuleStr as ModuleId)) {
      resolvedModuleId = rawModuleStr as ModuleId;
    } else {
      const section = inferSectionFromQuestionData({
        domain: obj.domain ? String(obj.domain) : undefined,
        type: inferredType,
        passage: obj.passage ? String(obj.passage) : undefined,
        prompt: obj.prompt !== undefined ? String(obj.prompt) : '',
        mathEquation: obj.mathEquation,
        options,
      });

      if (section === 'rw') {
        resolvedModuleId = rwAutoCounter % 2 === 0 ? 'rw_1' : 'rw_2';
        rwAutoCounter += 1;
      } else {
        resolvedModuleId = mathAutoCounter % 2 === 0 ? 'math_1' : 'math_2';
        mathAutoCounter += 1;
      }
    }

    if (
      (targetPlacement === 'auto' || targetPlacement === 'rw_auto') &&
      resolvedModuleId.startsWith('rw_') &&
      inferredType === 'spr'
    ) {
      resolvedModuleId = mathAutoCounter % 2 === 0 ? 'math_1' : 'math_2';
      mathAutoCounter += 1;
    }

    if (resolvedModuleId === 'rw_1' || resolvedModuleId === 'math_1') {
      resolvedVariant = undefined;
    }

    const rawDifficulty =
      obj.difficulty !== undefined &&
      obj.difficulty !== null &&
      String(obj.difficulty).trim() !== ''
        ? (String(obj.difficulty).trim().toLowerCase() as QuestionDifficulty)
        : undefined;

    if (rawDifficulty !== undefined && !VALID_DIFFICULTIES.includes(rawDifficulty)) {
      errors.push(
        `#${num}: Qiyinlik darajasi noto‘g‘ri ("${String(
          obj.difficulty
        )}"). Faqat easy, medium yoki hard bo‘lishi mumkin.`
      );
      return;
    }

    const rawScored = obj.scored === undefined ? true : Boolean(obj.scored);
    const rawB =
      obj.b !== undefined && obj.b !== null && String(obj.b).trim() !== ''
        ? Number(obj.b)
        : undefined;

    if (rawB !== undefined && (!Number.isFinite(rawB) || rawB < -6 || rawB > 6)) {
      errors.push(`#${num}: Rasch b parametri -6 va +6 oralig‘ida son bo‘lishi kerak.`);
      return;
    }

    const defaultDomain = resolvedModuleId.startsWith('rw_')
      ? 'Craft and Structure'
      : 'Algebra';

    const candidate: Partial<SATQuestion> = normalizeQuestionInput({
      moduleId: resolvedModuleId,
      variant: resolvedVariant,
      scored: rawScored,
      type: inferredType,
      domain: obj.domain ? String(obj.domain) : defaultDomain,
      skill: obj.skill ? String(obj.skill) : undefined,
      difficulty: rawDifficulty,
      b: rawB,
      passage: obj.passage ? String(obj.passage) : undefined,
      prompt: obj.prompt !== undefined ? String(obj.prompt) : '',
      mathEquation: Array.isArray(obj.mathEquation)
        ? obj.mathEquation.map((x) => String(x))
        : undefined,
      options,
      correctAnswer: obj.correctAnswer !== undefined ? String(obj.correctAnswer) : '',
      explanation: obj.explanation ? String(obj.explanation) : undefined,
    });

    const validationError = validateQuestionInput(candidate);
    if (validationError) {
      errors.push(`#${num}: ${validationError}`);
      return;
    }

    items.push({
      moduleId: candidate.moduleId!,
      variant: candidate.variant,
      scored: candidate.scored !== false,
      type: candidate.type!,
      domain: candidate.domain,
      skill: candidate.skill,
      difficulty: candidate.difficulty,
      b: candidate.b,
      passage: candidate.passage,
      prompt: candidate.prompt!,
      mathEquation: candidate.mathEquation,
      options: candidate.options,
      correctAnswer: candidate.correctAnswer!,
      explanation: candidate.explanation,
    });
  });

  // Auto-balance if user selected auto/rw_auto/math_auto and all questions of a section landed in M1 while M2 is empty
  if (
    autoBalance &&
    (targetPlacement === 'auto' ||
      targetPlacement === 'rw_auto' ||
      targetPlacement === 'math_auto')
  ) {
    const rw1Items = items.filter((q) => q.moduleId === 'rw_1');
    const rw2Items = items.filter((q) => q.moduleId === 'rw_2');
    if (rw1Items.length >= 2 && rw2Items.length === 0) {
      rw1Items.forEach((q, idx) => {
        q.moduleId = idx % 2 === 0 ? 'rw_1' : 'rw_2';
      });
    }

    const m1Items = items.filter((q) => q.moduleId === 'math_1');
    const m2Items = items.filter((q) => q.moduleId === 'math_2');
    if (m1Items.length >= 2 && m2Items.length === 0) {
      m1Items.forEach((q, idx) => {
        q.moduleId = idx % 2 === 0 ? 'math_1' : 'math_2';
      });
    }
  }

  let missingDifficultyCount = 0;

  for (const item of items) {
    counts[item.moduleId] += 1;
    const gKey = getModuleVariantKey(item.moduleId, item.variant);
    const maxForMod = item.moduleId.startsWith('rw_') ? 27 : 22;
    if (!groupCounts[gKey]) {
      groupCounts[gKey] = { total: 0, scored: 0, pretest: 0, max: maxForMod };
    }
    groupCounts[gKey].total += 1;
    if (item.scored === false) {
      groupCounts[gKey].pretest += 1;
    } else {
      groupCounts[gKey].scored += 1;
      if (!item.difficulty && typeof item.b !== 'number') {
        missingDifficultyCount += 1;
      }
    }
  }

  // Validate per-(module, variant) counts and pretest counts
  for (const [gKey, stat] of Object.entries(groupCounts)) {
    const label = formatModuleVariantLabel(gKey);
    if (stat.total > stat.max) {
      errors.push(
        `${label} guruhida ruxsat etilgan ${stat.max} tadan ko‘p savol kiritilgan (${stat.total} ta).`
      );
    } else if (stat.total < stat.max) {
      warnings.push(
        `${label}: ${stat.total} / ${stat.max} ta savol kiritildi (standart modul uchun ${stat.max} ta tavsiya etiladi).`
      );
    }

    if (stat.pretest > 2) {
      errors.push(
        `${label} guruhida sinov (scored=false) savollari 2 tadan oshmasligi kerak (${stat.pretest} ta kiritilgan).`
      );
    } else if (stat.pretest < 2) {
      warnings.push(
        `${label}: sinov (scored=false) savollari ${stat.pretest} ta (standart SAT modulida 2 ta sinov savoli bo‘ladi).`
      );
    }
  }

  if (missingDifficultyCount > 0) {
    warnings.push(
      `${missingDifficultyCount} ta hisoblanadigan savolda "difficulty" ko‘rsatilmagan — ular uchun standart "medium" (b=0.0) ishlatiladi.`
    );
  }

  return {
    items,
    errors,
    warnings,
    counts,
    groupCounts,
  };
}

// Deterministic hash & shuffle for per-student test variant generation
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const copy = [...arr];
  let state = hashString(seedStr) || 1;
  for (let i = copy.length - 1; i > 0; i--) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const rand = (state >>> 0) / 4294967296;
    const j = Math.floor(rand * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Generates a deterministic test variant for a specific student session based on the questions
 * available in the database (`allQuestions`).
 * Preserves Stage 2 `variant` ('easy' | 'hard' | undefined) and `scored` flags so that
 * adaptive Stage 2 routing (`selectStage2Questions`) works seamlessly.
 */
export function getSessionVariantQuestions(
  allQuestions: SATQuestion[],
  sessionId: string
): SATQuestion[] {
  if (!allQuestions || allQuestions.length === 0) return [];

  const uniqueMap = new Map<string, SATQuestion>();
  for (const q of allQuestions) {
    if (q && q.id) {
      uniqueMap.set(q.id, q);
    }
  }
  const dedupedQuestions = Array.from(uniqueMap.values());

  const pools: Record<ModuleId, SATQuestion[]> = {
    rw_1: dedupedQuestions
      .filter((q) => q.moduleId === 'rw_1')
      .sort((a, b) => a.number - b.number),
    rw_2: dedupedQuestions
      .filter((q) => q.moduleId === 'rw_2')
      .sort((a, b) => a.number - b.number),
    math_1: dedupedQuestions
      .filter((q) => q.moduleId === 'math_1')
      .sort((a, b) => a.number - b.number),
    math_2: dedupedQuestions
      .filter((q) => q.moduleId === 'math_2')
      .sort((a, b) => a.number - b.number),
  };

  // If rw_1 has multiple questions and rw_2 is completely empty, split rw_1 pool across rw_1 and rw_2
  if (pools.rw_1.length >= 2 && pools.rw_2.length === 0) {
    const shuffledRw = seededShuffle(pools.rw_1, `${sessionId}_rw_split`);
    const half = Math.ceil(shuffledRw.length / 2);
    pools.rw_1 = shuffledRw.slice(0, half).map((q) => ({ ...q, moduleId: 'rw_1' }));
    pools.rw_2 = shuffledRw.slice(half).map((q) => ({ ...q, moduleId: 'rw_2' }));
  }

  // If math_1 has multiple questions and math_2 is completely empty, split math_1 pool across math_1 and math_2
  if (pools.math_1.length >= 2 && pools.math_2.length === 0) {
    const shuffledMath = seededShuffle(pools.math_1, `${sessionId}_math_split`);
    const half = Math.ceil(shuffledMath.length / 2);
    pools.math_1 = shuffledMath.slice(0, half).map((q) => ({ ...q, moduleId: 'math_1' }));
    pools.math_2 = shuffledMath.slice(half).map((q) => ({ ...q, moduleId: 'math_2' }));
  }

  const result: SATQuestion[] = [];

  for (const modId of MODULE_ORDER) {
    const modPool = pools[modId];
    if (modPool.length === 0) continue;
    const maxForMod = MODULE_CONFIGS[modId].questionCount;

    if (modId === 'rw_1' || modId === 'math_1') {
      const shuffled = seededShuffle(modPool, `${sessionId}_${modId}`);
      const selected = shuffled.slice(0, Math.min(shuffled.length, maxForMod));
      selected.forEach((q, idx) => {
        result.push({
          ...q,
          moduleId: modId,
          number: idx + 1,
        });
      });
    } else {
      // Stage 2 module (rw_2 or math_2): sample up to maxForMod per variant bucket ('easy', 'hard', and common)
      const easyPool = modPool.filter((q) => q.variant === 'easy');
      const hardPool = modPool.filter((q) => q.variant === 'hard');
      const commonPool = modPool.filter((q) => !q.variant);

      const addBucket = (bucket: SATQuestion[], tag: string) => {
        if (bucket.length === 0) return;
        const shuffled = seededShuffle(bucket, `${sessionId}_${modId}_${tag}`);
        const selected = shuffled.slice(0, Math.min(shuffled.length, maxForMod));
        selected.forEach((q, idx) => {
          result.push({
            ...q,
            moduleId: modId,
            number: idx + 1,
          });
        });
      };

      addBucket(easyPool, 'easy');
      addBucket(hardPool, 'hard');
      addBucket(commonPool, 'common');
    }
  }

  return result;
}

export function getActiveModulesForQuestions(questions: SATQuestion[]): ModuleId[] {
  const active = MODULE_ORDER.filter((modId) =>
    questions.some((q) => q.moduleId === modId)
  );
  return active.length > 0 ? active : MODULE_ORDER;
}
