import {
  SATQuestion,
  ModuleId,
  QuestionType,
  QuestionDifficulty,
  QuestionOption,
  MODULE_CONFIGS,
  MODULE_ORDER,
} from '../types/sat';

const VALID_MODULES: ModuleId[] = ['rw_1', 'rw_2', 'math_1', 'math_2'];
const VALID_DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const OPTION_IDS: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

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
  // Fraction e.g. 3/4 or -5/2
  if (/^-?\d+\/\d+$/.test(t)) {
    const parts = t.split('/');
    const den = Number(parts[1]);
    return den !== 0;
  }
  // Integer or decimal e.g. 12, -3.5, .75, 0.75
  if (/^-?(\d+(\.\d+)?|\.\d+)$/.test(t)) {
    return !isNaN(Number(t));
  }
  return false;
}

export function validateQuestionInput(raw: Partial<SATQuestion>): string | null {
  const q = normalizeQuestionInput(raw);

  if (!q.moduleId || !VALID_MODULES.includes(q.moduleId)) {
    return 'Modul noto‘g‘ri tanlangan (rw_1, rw_2, math_1 yoki math_2 bo‘lishi kerak).';
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

export function parseQuestionImport(text: string): QuestionImportResult {
  const counts: Record<ModuleId, number> = {
    rw_1: 0,
    rw_2: 0,
    math_1: 0,
    math_2: 0,
  };
  const items: ImportedQuestionItem[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const trimmed = (text || '').trim();
  if (!trimmed) {
    return {
      items,
      errors: ['JSON matni bo‘sh.'],
      warnings,
      counts,
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
      errors: ['JSON fayl savollar massividan ([...]) yoki {"questions": [...]} obyektidan iborat bo‘lishi kerak.'],
      warnings,
      counts,
    };
  }

  if (rawList.length === 0) {
    return {
      items,
      errors: ['JSON ichida hech qanday savol topilmadi.'],
      warnings,
      counts,
    };
  }

  rawList.forEach((rawItem, idx) => {
    const num = idx + 1;
    if (!rawItem || typeof rawItem !== 'object') {
      errors.push(`#${num}: Savol obyekti noto‘g‘ri.`);
      return;
    }

    const obj = rawItem as Record<string, unknown>;
    const moduleId = String(obj.moduleId || '').trim() as ModuleId;
    const options = parseRawOptions(obj.options);
    const inferredType: QuestionType = obj.type
      ? (String(obj.type).trim().toLowerCase() as QuestionType)
      : options
      ? 'mcq'
      : 'spr';

    const rawDifficulty =
      obj.difficulty !== undefined && obj.difficulty !== null && String(obj.difficulty).trim() !== ''
        ? (String(obj.difficulty).trim().toLowerCase() as QuestionDifficulty)
        : undefined;

    if (rawDifficulty !== undefined && !VALID_DIFFICULTIES.includes(rawDifficulty)) {
      errors.push(`#${num}: Qiyinlik darajasi noto‘g‘ri ("${String(obj.difficulty)}"). Faqat easy, medium yoki hard bo‘lishi kerak.`);
      return;
    }

    const candidate: Partial<SATQuestion> = normalizeQuestionInput({
      moduleId,
      type: inferredType,
      domain: obj.domain ? String(obj.domain) : undefined,
      skill: obj.skill ? String(obj.skill) : undefined,
      difficulty: rawDifficulty,
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

    counts[moduleId] += 1;
    items.push({
      moduleId,
      type: candidate.type!,
      domain: candidate.domain,
      skill: candidate.skill,
      difficulty: candidate.difficulty,
      passage: candidate.passage,
      prompt: candidate.prompt!,
      mathEquation: candidate.mathEquation,
      options: candidate.options,
      correctAnswer: candidate.correctAnswer!,
      explanation: candidate.explanation,
    });
  });

  for (const modId of MODULE_ORDER) {
    const count = counts[modId];
    if (count === 0) continue;
    const maxAllowed = MODULE_CONFIGS[modId].questionCount;
    if (count > maxAllowed) {
      errors.push(
        `${MODULE_CONFIGS[modId].shortTitle} modulida ruxsat etilgan ${maxAllowed} tadan ko‘p savol kiritilgan (${count} ta).`
      );
    } else if (count < maxAllowed) {
      warnings.push(
        `${MODULE_CONFIGS[modId].shortTitle} modulida ${count} / ${maxAllowed} ta savol bor (standart ${maxAllowed} tadan kam).`
      );
    }
  }

  return {
    items,
    errors,
    warnings,
    counts,
  };
}
