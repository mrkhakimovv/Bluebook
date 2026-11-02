import katex from 'katex';
import 'katex/dist/katex.min.css';

const ENGLISH_OPTION_WORDS =
  /\b(and|or|nor|only|neither|both|none|all|no|yes|true|false|if|when|where|for|the|is|are|was|were|than|less|greater|equal|approximately|dollars|years|value|values|table|tables|graph|equation|function|system|solution|solutions|real|number|numbers|point|points|line|lines|triangle|circle|increase|decrease|every|between|end|of|in|to|at|by|with|from|that|this|which|not|have|has|can|will|be)\b/i;

/**
 * Normalizes plain-text math notation (e.g. ^x, ^(2x+1), √(...), <=, >=, π)
 * into clean LaTeX syntax ready for KaTeX.
 */
function toLatexSyntax(rawExpr: string): string {
  return rawExpr
    .trim()
    .replace(/π/g, '\\pi ')
    .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
    .replace(/√([0-9a-zA-Z]+)/g, '\\sqrt{$1}')
    .replace(/\bsqrt\(([^)]+)\)/gi, '\\sqrt{$1}')
    .replace(/²/g, '^{2}')
    .replace(/³/g, '^{3}')
    .replace(/⁴/g, '^{4}')
    .replace(/≤|<=/g, ' \\le ')
    .replace(/≥|>=/g, ' \\ge ')
    .replace(/≠|!=/g, ' \\ne ')
    .replace(/±/g, ' \\pm ')
    .replace(/·/g, ' \\cdot ')
    // Convert ^(expr) to ^{expr}
    .replace(/\^\(\s*([^()]+?)\s*\)/g, '^{$1}')
    // Convert ^-2 or ^2x or ^x to ^{...} when not already braced
    .replace(/\^(-?[0-9a-zA-Z]+(?:\.[0-9]+)?)/g, '^{$1}');
}

function renderKatexSafe(latexExpr: string, displayMode = false): string {
  try {
    return katex.renderToString(latexExpr, {
      throwOnError: false,
      displayMode,
    });
  } catch {
    return latexExpr;
  }
}

/**
 * Checks whether a parenthesized or candidate math substring contains only mathematical tokens
 * (no 2+ letter English words other than standard math functions).
 */
function containsOnlyMathTokens(str: string): boolean {
  const stripped = str.replace(
    /\\(?:frac|sqrt|pi|theta|alpha|beta|gamma|delta|le|ge|leq|geq|ne|neq|pm|cdot|times|div|infty|left|right|text)\b|\b(?:sqrt|sin|cos|tan|sec|csc|cot|log|ln|pi)\b/gi,
    ''
  );
  // Reject if there is any 2+ letter word (including Roman numerals II, III)
  return !/[a-zA-Z]{2,}/.test(stripped);
}

/**
 * Automatically detects un-delimited math expressions, equations, inequalities,
 * polynomials, exponential functions, coordinate pairs, and contextual variables
 * in SAT text and renders them with KaTeX.
 */
function autoRenderUnwrappedMath(segment: string): string {
  if (!segment) return '';

  const placeholders: string[] = [];
  const pushMath = (expr: string, displayMode = false, pre = '', post = ''): string => {
    const idx = placeholders.length;
    placeholders.push(renderKatexSafe(toLatexSyntax(expr), displayMode));
    return `${pre}\u0000M${idx}\u0000${post}`;
  };

  let out = segment;

  // 0. Protect any existing HTML tags (<br/>, <u>, <mark...>, etc.)
  const htmlTags: string[] = [];
  out = out.replace(/<[^>]+>/g, (tag) => {
    const idx = htmlTags.length;
    htmlTags.push(tag);
    return `\u0000H${idx}\u0000`;
  });

  // 1. Raw LaTeX commands without $...$ (e.g. \frac{a}{b}, \sqrt{x})
  out = out.replace(
    /(?:\\(?:frac|sqrt|pi|theta|le|ge|leq|geq|ne|neq|pm|cdot|times)\b(?:\s*\{[^{}]*\})*(?:\s*[\w^_{}()+\-*/=<>.,]+)*)/g,
    (match) => pushMath(match)
  );

  // 2. Contextual SAT prose phrases before general math detection:
  // e.g. "in the xy-plane", "x-axis", "y-axis", "x-intercept", "y-intercept"
  out = out.replace(/\b(xy|x|y)-(plane|axis|axes|intercept|intercepts|coordinate|coordinates)\b/g, (_m, v, noun) => {
    return `${pushMath(v)}-${noun}`;
  });

  // 3. Multi-term equations, inequalities, functions, and algebraic expressions with exponents/operators
  // Atomic math building blocks (numbers, single-letter variables, parenthesized math groups, exponents)
  const ATOM =
    '(?:\\d+(?:\\.\\d+)?(?:[a-zA-Z](?![a-zA-Z]))?|(?<![a-zA-Z])[a-zA-Z](?![a-zA-Z])|(?:(?<![a-zA-Z])[fghFGHpP]\\s*)?\\([^()\\n]{1,35}\\))(?:\\s*\\([0-9a-zA-Z+\\-*/^_.,\\s]{1,25}\\))*(?:\\s*\\^\\s*(?:\\{[^{}]+\\}|\\([^()]+\\)|-?[0-9a-zA-Z]+(?:\\.[0-9]+)?))?';
  const OP = '(?:\\s*(?:<=|>=|!=|≤|≥|≠|=|<|>|\\+|-|\\*|/|±|·)\\s*)';
  const EXPR_REGEX = new RegExp(`(?<![a-zA-Z0-9_])([+\\-]?\\s*${ATOM}(?:${OP}${ATOM})*)(?![a-zA-Z])`, 'g');

  out = out.replace(EXPR_REGEX, (fullMatch) => {
    const trimmed = fullMatch.trim();
    if (!trimmed) return fullMatch;

    // Must not contain multi-letter words (like "I and II" or "392-megawatt")
    if (!containsOnlyMathTokens(trimmed)) {
      return fullMatch;
    }

    // Check if this match actually has mathematical structure:
    // - Has an exponent (^, ², ³, ⁴)
    // - Has an equality/inequality operator (=, <, >, ≤, ≥, ≠)
    // - Has a binary operator (+, -, *, /) connecting terms (not a date range like 1953-1973)
    // - Is a function notation like f(x), f(5), g(t)
    // - Is a coefficient + variable like 10x, 4x, 2y
    // - Is a coordinate pair like (x, y), (3, 4)
    const hasExponent = /[\^²³⁴]/.test(trimmed);
    const hasComparisonOrEquals = /(?:<=|>=|!=|≤|≥|≠|=|<|>)/.test(trimmed);
    const isFunctionCall = /^[fghFGHpP]\s*\([^()]+\)$/.test(trimmed);
    const isCoordPair = /^\(\s*-?[0-9a-zA-Z./]+\s*,\s*-?[0-9a-zA-Z./]+\s*\)$/.test(trimmed);
    const hasCoeffVar = /\d\s*[a-zA-Z](?![a-zA-Z])/.test(trimmed);
    const hasBinaryOpWithVar =
      /[a-zA-Z]/.test(trimmed) && /(?:[+\-*/±·])/.test(trimmed);
    const hasMultiTermArithmetic =
      /^\d+(?:\.\d+)?\s*[+*/]\s*\d+/.test(trimmed);

    if (
      hasExponent ||
      hasComparisonOrEquals ||
      isFunctionCall ||
      isCoordPair ||
      hasCoeffVar ||
      hasBinaryOpWithVar ||
      hasMultiTermArithmetic
    ) {
      const leadingSpace = fullMatch.match(/^\s*/)?.[0] || '';
      const trailingSpace = fullMatch.match(/\s*$/)?.[0] || '';
      return pushMath(trimmed, false, leadingSpace, trailingSpace);
    }

    return fullMatch;
  });

  // 4. Contextual single-letter variables in SAT Math prose:
  // e.g. "values of x", "value of y", "where x is", "terms of x", "function f"
  out = out.replace(
    /\b(values?\s+of|terms?\s+of|where|variable|constant|function|line|inequality|equation)\s+([a-zA-Z])(?=\s+(?:and|or|is|are|be|in|to|from|represents?|models?|denotes?|gives?|for|at)\b|[.,;?:)]|$)/gi,
    (_m, prefix, variable) => {
      // Do not italicize the English article "a" after "is" or similar, only after the specific math nouns above
      return `${prefix} ${pushMath(variable)}`;
    }
  );

  // Restore math placeholders
  out = out.replace(/\u0000M(\d+)\u0000/g, (_m, idx) => placeholders[Number(idx)] ?? '');

  // Restore HTML tags
  out = out.replace(/\u0000H(\d+)\u0000/g, (_m, idx) => htmlTags[Number(idx)] ?? '');

  return out;
}

/**
 * Renders inline ($...$) and block ($$...$$) LaTeX expressions AND automatically
 * converts un-delimited mathematical equations, expressions, exponents, and variables
 * using KaTeX while preserving surrounding SAT serif prose and HTML tags.
 */
export function renderSATTextWithMath(text: string, isPureMathOption = false): string {
  if (!text) return '';

  // 1. Handle explicit $$...$$, $...$, \[...\], \(...\) blocks first, while also running
  // auto-detection on any unwrapped text outside the explicit delimiters.
  if (text.includes('$') || text.includes('\\(') || text.includes('\\[')) {
    const explicitBlocks: string[] = [];
    const withPlaceholders = text.replace(
      /\$\$([^$]+)\$\$|\$([^$]+)\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g,
      (_match, blockDollar, inlineDollar, blockBracket, inlineParen) => {
        const expr = blockDollar ?? inlineDollar ?? blockBracket ?? inlineParen;
        const displayMode = Boolean(blockDollar || blockBracket);
        const idx = explicitBlocks.length;
        explicitBlocks.push(renderKatexSafe(toLatexSyntax(expr), displayMode));
        return `\u0000EXP${idx}\u0000`;
      }
    );

    const processed = autoRenderUnwrappedMath(withPlaceholders);
    return processed.replace(
      /\u0000EXP(\d+)\u0000/g,
      (_m, idx) => explicitBlocks[Number(idx)] ?? ''
    );
  }

  // 2. If it's a short option/cell in Math and purely mathematical (no English words like "I and II" or "only"),
  // render the whole expression directly in KaTeX.
  const trimmed = text.trim();
  if (
    isPureMathOption &&
    trimmed.length > 0 &&
    trimmed.length <= 55 &&
    !ENGLISH_OPTION_WORDS.test(trimmed) &&
    containsOnlyMathTokens(trimmed) &&
    !/^(?:I|II|III|IV|V)$/i.test(trimmed)
  ) {
    // If it's a simple fraction like -3/4 or 7/2, format as \frac
    const simpleFrac = trimmed.match(/^(-?)(\d+)\/(\d+)$/);
    if (simpleFrac) {
      return renderKatexSafe(`${simpleFrac[1]}\\frac{${simpleFrac[2]}}{${simpleFrac[3]}}`, false);
    }
    return renderKatexSafe(toLatexSyntax(trimmed), false);
  }

  // 3. Otherwise, run smart inline math auto-detection across the text
  return autoRenderUnwrappedMath(text);
}

/**
 * Renders the Student-Produced Response (SPR) Answer Preview using KaTeX.
 * Automatically formats fractions (e.g. "7/2", "-1/3") as vertical stacked fractions.
 */
export function renderSprAnswerPreview(rawAnswer: string): string {
  const trimmed = (rawAnswer || '').trim();
  if (!trimmed) return '';

  // Match fraction pattern: optional leading '-', numerator digits/decimal, '/', denominator digits/decimal
  const fracMatch = trimmed.match(/^(-?)([0-9.]*)\/([0-9.]*)$/);
  if (fracMatch) {
    const sign = fracMatch[1] || '';
    const num = fracMatch[2] || '\\phantom{0}';
    const den = fracMatch[3] || '\\phantom{0}';
    try {
      return katex.renderToString(`${sign}\\frac{${num}}{${den}}`, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      return trimmed;
    }
  }

  try {
    return katex.renderToString(trimmed, {
      throwOnError: false,
      displayMode: false,
    });
  } catch {
    return trimmed;
  }
}


