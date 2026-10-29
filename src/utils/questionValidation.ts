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

const ALPHANUM = '0123456789abcdefghijklmnopqrstuvwxyz';
const LOWER_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';

/**
 * Checks whether an ID is exactly 7 characters of lowercase letters and digits,
 * containing at least one lowercase letter and at least one digit.
 */
export function isSevenCharQuestionId(id: string): boolean {
  return /^(?=.*[a-z])(?=.*[0-9])[a-z0-9]{7}$/.test(id);
}

/**
 * Deterministically converts any legacy question ID (e.g., "math_1_q1") into a
 * 7-character lowercase letter + digit combination (e.g., "a7k9m2x"), avoiding collisions.
 */
export function toDeterministicSevenCharId(
  rawId: string,
  usedIds?: Set<string>
): string {
  const clean = (rawId || '').trim();
  if (isSevenCharQuestionId(clean) && (!usedIds || !usedIds.has(clean))) {
    usedIds?.add(clean);
    return clean;
  }

  let attempt = 0;
  while (true) {
    const input = attempt === 0 ? clean || 'q' : `${clean}#${attempt}`;
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 ^= (c + i * 31) & 0xff;
      h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
    }

    const chars: string[] = [];
    let v1 = h1;
    let v2 = h2;
    for (let i = 0; i < 7; i++) {
      const combined = ((v1 ^ (v2 >>> (i * 3))) + i * 17) >>> 0;
      chars.push(ALPHANUM[combined % 36]);
      v1 = ((v1 >>> 5) | (v1 << 27)) >>> 0;
      v2 = Math.imul(v2 ^ (i + 1), 0x27d4eb2d) >>> 0;
    }

    // Guarantee at least one lowercase letter and at least one digit
    if (!chars.some((ch) => ch >= 'a' && ch <= 'z')) {
      const pos = h1 % 7;
      chars[pos] = LOWER_LETTERS[h2 % 26];
    }
    if (!chars.some((ch) => ch >= '0' && ch <= '9')) {
      const pos = (h1 % 7 === h2 % 7 ? h2 + 1 : h2) % 7;
      chars[pos] = DIGITS[(h1 >>> 4) % 10];
    }

    const candidate = chars.join('');
    if (!usedIds || !usedIds.has(candidate)) {
      usedIds?.add(candidate);
      return candidate;
    }
    attempt++;
  }
}

/**
 * Generates a new random 7-character ID made of lowercase letters and digits.
 */
export function generateSevenCharQuestionId(usedIds?: Set<string>): string {
  const randomSeed = `q_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}_${Math.random().toString(36).slice(2)}`;
  return toDeterministicSevenCharId(randomSeed, usedIds);
}


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
  fallbackSection?: 'rw' | 'math';
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

function inferDifficultyTier(q: {
  difficulty?: QuestionDifficulty;
  b?: number;
  variant?: QuestionVariant;
}): QuestionDifficulty {
  if (q.difficulty === 'easy' || q.difficulty === 'medium' || q.difficulty === 'hard') {
    return q.difficulty;
  }
  if (typeof q.b === 'number' && Number.isFinite(q.b)) {
    if (q.b <= -0.35) return 'easy';
    if (q.b >= 0.35) return 'hard';
    return 'medium';
  }
  if (q.variant === 'easy') return 'easy';
  if (q.variant === 'hard') return 'hard';
  return 'medium';
}

function getDifficultyNumericRank(q: {
  difficulty?: QuestionDifficulty;
  b?: number;
  variant?: QuestionVariant;
}): number {
  const tier = inferDifficultyTier(q);
  const tierBase = tier === 'easy' ? 0 : tier === 'medium' ? 1 : 2;
  const bOffset =
    typeof q.b === 'number' && Number.isFinite(q.b)
      ? Math.max(-0.49, Math.min(0.49, q.b / 12))
      : 0;
  return tierBase + bOffset;
}

interface DistributableEntry {
  item: ImportedQuestionItem;
  originalIndex: number;
  section: 'rw' | 'math';
  explicitModuleId?: ModuleId;
  explicitVariant?: QuestionVariant | 'common';
}

/**
 * Distributes questions of a single section ('rw' or 'math') into Module 1 (m1Id)
 * and Module 2 (m2Id: easy / hard) based on their difficulty level and position.
 */
function distributeSectionEntriesByDifficultyAndPosition(
  secEntries: DistributableEntry[],
  section: 'rw' | 'math',
  targetPlacement: ImportPlacementTarget,
  autoBalance: boolean
): void {
  if (secEntries.length === 0) return;

  const m1Id: ModuleId = section === 'rw' ? 'rw_1' : 'math_1';
  const m2Id: ModuleId = section === 'rw' ? 'rw_2' : 'math_2';
  const maxPerMod = section === 'rw' ? 27 : 22;

  // Ensure every item has a resolved difficulty property if b or explicitVariant was provided
  for (const entry of secEntries) {
    if (!entry.item.difficulty) {
      if (typeof entry.item.b === 'number' && Number.isFinite(entry.item.b)) {
        entry.item.difficulty = inferDifficultyTier(entry.item);
      } else if (entry.explicitVariant === 'easy' || entry.explicitVariant === 'hard') {
        entry.item.difficulty = entry.explicitVariant;
      }
    }
  }

  const hasExplicitM1 = secEntries.some((e) => e.explicitModuleId === m1Id);
  const hasExplicitM2 = secEntries.some(
    (e) =>
      e.explicitModuleId === m2Id ||
      e.explicitVariant === 'easy' ||
      e.explicitVariant === 'hard'
  );
  const hasBothModulesExplicit = hasExplicitM1 && hasExplicitM2;

  // Case 1: Small batch (<= maxPerMod) with an explicit single-module / single-variant target
  // and without conflicting explicit multi-module tags.
  if (secEntries.length <= maxPerMod && !hasBothModulesExplicit) {
    if (targetPlacement === 'rw_2_easy' || targetPlacement === 'math_2_easy') {
      for (const e of secEntries) {
        e.item.moduleId = m2Id;
        e.item.variant = 'easy';
      }
      return;
    }
    if (targetPlacement === 'rw_2_hard' || targetPlacement === 'math_2_hard') {
      for (const e of secEntries) {
        e.item.moduleId = m2Id;
        e.item.variant = 'hard';
      }
      return;
    }
    if (targetPlacement === m1Id && !hasExplicitM2) {
      for (const e of secEntries) {
        e.item.moduleId = m1Id;
        e.item.variant = undefined;
      }
      return;
    }
    if (targetPlacement === m2Id) {
      for (const e of secEntries) {
        e.item.moduleId = m2Id;
        if (e.explicitVariant === 'easy' || e.explicitVariant === 'hard') {
          e.item.variant = e.explicitVariant;
        } else {
          const tier = inferDifficultyTier(e.item);
          if (tier === 'easy') e.item.variant = 'easy';
          else if (tier === 'hard') e.item.variant = 'hard';
          else e.item.variant = undefined;
        }
      }
      return;
    }
    if (
      targetPlacement === 'auto' &&
      !autoBalance &&
      secEntries.every((e) => e.explicitModuleId)
    ) {
      for (const e of secEntries) {
        e.item.moduleId = e.explicitModuleId!;
        e.item.variant =
          e.item.moduleId === m2Id &&
          (e.explicitVariant === 'easy' || e.explicitVariant === 'hard')
            ? e.explicitVariant
            : undefined;
      }
      return;
    }
  }

  // If only 1 question in total for this section, keep it in its resolved module
  if (secEntries.length === 1) {
    const only = secEntries[0];
    if (only.explicitModuleId === m2Id || targetPlacement.endsWith('_2')) {
      only.item.moduleId = m2Id;
      only.item.variant =
        only.explicitVariant === 'easy' || only.explicitVariant === 'hard'
          ? only.explicitVariant
          : inferDifficultyTier(only.item) === 'hard'
          ? 'hard'
          : 'easy';
    } else {
      only.item.moduleId = m1Id;
      only.item.variant = undefined;
    }
    return;
  }

  // Case 2: Split across Module 1 (m1Id) and Module 2 (m2Id) based on difficulty level and position.
  // Calculate target count for M1:
  // - For 54 R&W questions -> 27 M1 + 27 M2
  // - For 81 R&W questions -> 27 M1 + 54 M2 (27 easy + 27 hard)
  // - For 44 Math questions -> 22 M1 + 22 M2
  // - For 87 Math questions -> 29 M1 + 58 M2 (29 easy + 29 hard) or maxPerMod if <= 3*maxPerMod
  const total = secEntries.length;
  let targetM1Count: number;
  if (total > maxPerMod * 3) {
    targetM1Count = Math.ceil(total / 3);
  } else if (total > maxPerMod) {
    targetM1Count = Math.min(maxPerMod, Math.ceil(total / 2));
  } else {
    targetM1Count = Math.ceil(total / 2);
  }

  const m1Set = new Set<DistributableEntry>();
  const expM1Only = secEntries.filter(
    (e) =>
      e.explicitModuleId === m1Id &&
      e.explicitVariant !== 'easy' &&
      e.explicitVariant !== 'hard'
  );
  const expM2Only = secEntries.filter(
    (e) =>
      e.explicitModuleId === m2Id ||
      e.explicitVariant === 'easy' ||
      e.explicitVariant === 'hard'
  );

  // If the JSON already explicitly divided questions between M1 and M2 and M1 count is within limits,
  // honor the explicit M1 questions first.
  if (
    expM1Only.length > 0 &&
    expM2Only.length > 0 &&
    expM1Only.length <= targetM1Count
  ) {
    for (const e of expM1Only) {
      m1Set.add(e);
    }
    const remainingPool = secEntries.filter(
      (e) => !m1Set.has(e) && !expM2Only.includes(e)
    );
    for (const e of remainingPool) {
      if (m1Set.size >= targetM1Count) break;
      m1Set.add(e);
    }
  } else {
    // Either all items had the same moduleId (e.g., all 54 labeled rw_1 or all 54 labeled rw_2),
    // or none had moduleId, or M1 had > targetM1Count items.
    // Split into Module 1 and Module 2 using difficulty tier ('easy', 'medium', 'hard') and position (originalIndex):
    // Group by difficulty tier while preserving original position order in each tier.
    const easyTier: DistributableEntry[] = [];
    const mediumTier: DistributableEntry[] = [];
    const hardTier: DistributableEntry[] = [];

    for (const e of secEntries) {
      const tier = inferDifficultyTier(e.item);
      if (tier === 'easy') easyTier.push(e);
      else if (tier === 'hard') hardTier.push(e);
      else mediumTier.push(e);
    }

    const ratio = targetM1Count / total;
    let wantEasy = Math.min(easyTier.length, Math.round(easyTier.length * ratio));
    let wantMed = Math.min(mediumTier.length, Math.round(mediumTier.length * ratio));
    let wantHard = Math.max(
      0,
      Math.min(hardTier.length, targetM1Count - wantEasy - wantMed)
    );

    // Adjust if rounding left us short or over targetM1Count
    while (wantEasy + wantMed + wantHard < targetM1Count) {
      if (wantMed < mediumTier.length) wantMed++;
      else if (wantEasy < easyTier.length) wantEasy++;
      else if (wantHard < hardTier.length) wantHard++;
      else break;
    }
    while (wantEasy + wantMed + wantHard > targetM1Count) {
      if (wantHard > 0) wantHard--;
      else if (wantMed > 0) wantMed--;
      else if (wantEasy > 0) wantEasy--;
      else break;
    }

    // Within each difficulty tier, prefer items that were NOT explicitly tagged for M2, ordered by original position
    const sortForM1Preference = (arr: DistributableEntry[]) =>
      [...arr].sort((a, b) => {
        const aIsM1 = a.explicitModuleId === m1Id ? 0 : a.explicitModuleId === m2Id ? 2 : 1;
        const bIsM1 = b.explicitModuleId === m1Id ? 0 : b.explicitModuleId === m2Id ? 2 : 1;
        return aIsM1 - bIsM1 || a.originalIndex - b.originalIndex;
      });

    for (const e of sortForM1Preference(easyTier).slice(0, wantEasy)) m1Set.add(e);
    for (const e of sortForM1Preference(mediumTier).slice(0, wantMed)) m1Set.add(e);
    for (const e of sortForM1Preference(hardTier).slice(0, wantHard)) m1Set.add(e);
  }

  const m1Entries = secEntries
    .filter((e) => m1Set.has(e))
    .sort(
      (a, b) =>
        getDifficultyNumericRank(a.item) - getDifficultyNumericRank(b.item) ||
        a.originalIndex - b.originalIndex
    );

  const m2Entries = secEntries
    .filter((e) => !m1Set.has(e))
    .sort(
      (a, b) =>
        getDifficultyNumericRank(a.item) - getDifficultyNumericRank(b.item) ||
        a.originalIndex - b.originalIndex
    );

  // Assign Module 1
  for (const e of m1Entries) {
    e.item.moduleId = m1Id;
    e.item.variant = undefined;
  }

  // Assign Module 2 and Stage 2 Variants ('easy' | 'hard') based on difficulty and position
  if (m2Entries.length > 0) {
    // Sort m2Entries by difficulty rank (easy -> medium -> hard) then original position
    const targetEasyCount =
      m2Entries.length > maxPerMod
        ? Math.min(maxPerMod, Math.ceil(m2Entries.length / 2))
        : Math.ceil(m2Entries.length / 2);

    m2Entries.forEach((e, idx) => {
      e.item.moduleId = m2Id;
      const tier = inferDifficultyTier(e.item);
      if (tier === 'easy' && idx < maxPerMod) {
        e.item.variant = 'easy';
      } else if (tier === 'hard' && m2Entries.length - idx <= maxPerMod) {
        e.item.variant = 'hard';
      } else {
        e.item.variant = idx < targetEasyCount ? 'easy' : 'hard';
      }
    });
  }
}

/**
 * Redistributes existing SATQuestions of a given section ('rw' or 'math') into
 * Module 1 (rw_1 / math_1) and Module 2 (rw_2 / math_2 with easy & hard variants)
 * based on each question's difficulty level and current position, re-numbering each bucket 1..N.
 */
export function redistributeQuestionsByDifficultyAndPosition(
  allQuestions: SATQuestion[],
  section: 'rw' | 'math'
): SATQuestion[] {
  const secPrefix = section === 'rw' ? 'rw_' : 'math_';
  const sectionQuestions = allQuestions
    .filter((q) => q.moduleId.startsWith(secPrefix))
    .sort(
      (a, b) =>
        MODULE_ORDER.indexOf(a.moduleId) - MODULE_ORDER.indexOf(b.moduleId) ||
        a.number - b.number
    );

  if (sectionQuestions.length === 0) return [];

  const entries: DistributableEntry[] = sectionQuestions.map((q, idx) => ({
    item: {
      moduleId: q.moduleId,
      variant: q.variant,
      scored: q.scored !== false,
      type: q.type,
      domain: q.domain,
      skill: q.skill,
      difficulty: q.difficulty,
      b: q.b,
      bSE: q.bSE,
      infit: q.infit,
      outfit: q.outfit,
      passage: q.passage,
      prompt: q.prompt,
      mathEquation: q.mathEquation,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    },
    originalIndex: idx,
    section,
    explicitModuleId: undefined,
    explicitVariant: undefined,
  }));

  distributeSectionEntriesByDifficultyAndPosition(entries, section, 'auto', true);

  const counters = new Map<string, number>();
  return entries.map((entry, idx) => {
    const origQ = sectionQuestions[idx];
    const gKey = getModuleVariantKey(entry.item.moduleId, entry.item.variant);
    const nextNum = (counters.get(gKey) || 0) + 1;
    counters.set(gKey, nextNum);
    return {
      ...origQ,
      ...entry.item,
      id: origQ.id,
      number: nextNum,
    };
  });
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
  const fallbackSection: 'rw' | 'math' = importOptions?.fallbackSection ?? 'rw';

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

  const parsedEntries: DistributableEntry[] = [];

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
    const explicitModuleId: ModuleId | undefined = VALID_MODULES.includes(
      rawModuleStr as ModuleId
    )
      ? (rawModuleStr as ModuleId)
      : undefined;

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

    const explicitVariant: QuestionVariant | 'common' | undefined =
      rawVariantStr === 'common'
        ? 'common'
        : rawVariantStr && VALID_VARIANTS.includes(rawVariantStr as QuestionVariant)
        ? (rawVariantStr as QuestionVariant)
        : undefined;

    // Determine section ('rw' or 'math')
    let section: 'rw' | 'math';
    if (targetPlacement.startsWith('rw_')) {
      section = 'rw';
    } else if (targetPlacement.startsWith('math_')) {
      section = 'math';
    } else if (explicitModuleId) {
      section = explicitModuleId.startsWith('rw_') ? 'rw' : 'math';
    } else {
      section = inferSectionFromQuestionData(
        {
          domain: obj.domain ? String(obj.domain) : undefined,
          type: inferredType,
          passage: obj.passage ? String(obj.passage) : undefined,
          prompt: obj.prompt !== undefined ? String(obj.prompt) : '',
          mathEquation: obj.mathEquation,
          options,
        },
        fallbackSection
      );
    }

    if (section === 'rw' && inferredType === 'spr') {
      if (targetPlacement === 'auto' || targetPlacement === 'rw_auto') {
        section = 'math';
      }
    }

    const initialModuleId: ModuleId =
      explicitModuleId && explicitModuleId.startsWith(section === 'rw' ? 'rw_' : 'math_')
        ? explicitModuleId
        : section === 'rw'
        ? 'rw_1'
        : 'math_1';

    const initialVariant: QuestionVariant | undefined =
      initialModuleId.endsWith('_2') &&
      (explicitVariant === 'easy' || explicitVariant === 'hard')
        ? explicitVariant
        : undefined;

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

    const defaultDomain = section === 'rw' ? 'Craft and Structure' : 'Algebra';

    const candidate: Partial<SATQuestion> = normalizeQuestionInput({
      moduleId: initialModuleId,
      variant: initialVariant,
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

    parsedEntries.push({
      item: {
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
      },
      originalIndex: idx,
      section,
      explicitModuleId,
      explicitVariant,
    });
  });

  // Distribute RW and Math questions into Module 1 and Module 2 (Easy/Hard) based on difficulty and position
  const rwEntries = parsedEntries.filter((e) => e.section === 'rw');
  const mathEntries = parsedEntries.filter((e) => e.section === 'math');

  distributeSectionEntriesByDifficultyAndPosition(
    rwEntries,
    'rw',
    targetPlacement,
    autoBalance
  );
  distributeSectionEntriesByDifficultyAndPosition(
    mathEntries,
    'math',
    targetPlacement,
    autoBalance
  );

  // Order final items cleanly by module order, variant, difficulty, and position
  const orderedEntries = [...rwEntries, ...mathEntries].sort(
    (a, b) =>
      MODULE_ORDER.indexOf(a.item.moduleId) - MODULE_ORDER.indexOf(b.item.moduleId) ||
      (a.item.variant || '').localeCompare(b.item.variant || '') ||
      getDifficultyNumericRank(a.item) - getDifficultyNumericRank(b.item) ||
      a.originalIndex - b.originalIndex
  );

  for (const entry of orderedEntries) {
    items.push(entry.item);
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

  // Validate per-(module, variant) counts and pretest counts as non-blocking warnings
  for (const [gKey, stat] of Object.entries(groupCounts)) {
    const label = formatModuleVariantLabel(gKey);
    const isRw2Sub = gKey.startsWith('rw_2:');
    const isMath2Sub = gKey.startsWith('math_2:');
    const parentM2Total = isRw2Sub
      ? counts.rw_2
      : isMath2Sub
      ? counts.math_2
      : stat.total;

    if (stat.total > stat.max) {
      warnings.push(
        `${label} guruhida ${stat.total} ta savol kiritildi (har bir o‘quvchiga shundan ${stat.max} tasi tasodifiy tanlab beriladi).`
      );
    } else if (stat.total < stat.max && parentM2Total < stat.max) {
      warnings.push(
        `${label}: ${stat.total} / ${stat.max} ta savol kiritildi (standart modul uchun ${stat.max} ta tavsiya etiladi).`
      );
    }

    if (stat.pretest > 2) {
      warnings.push(
        `${label} guruhida sinov (scored=false) savollari ${stat.pretest} ta (standart SAT modulida 2 ta sinov savoli bo‘ladi).`
      );
    } else if (stat.pretest < 2 && !(isRw2Sub || isMath2Sub)) {
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
