import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Renders inline ($...$) and block ($$...$$) LaTeX expressions using KaTeX,
 * while preserving surrounding SAT serif prose and HTML tags (<u>, <mark>, <br/>).
 */
export function renderSATTextWithMath(text: string, isPureMathOption = false): string {
  if (!text) return '';

  // If the text already contains $...$ LaTeX delimiters, render each segment with KaTeX
  if (text.includes('$')) {
    return text.replace(/\$\$([^$]+)\$\$|\$([^$]+)\$/g, (_match, blockMath, inlineMath) => {
      const expr = blockMath ?? inlineMath;
      const displayMode = Boolean(blockMath);
      try {
        return katex.renderToString(expr, {
          throwOnError: false,
          displayMode,
        });
      } catch {
        return expr;
      }
    });
  }

  // If it's a math option or math equation without explicit $ delimiters (e.g. added by Admin)
  // and looks like a math expression/number/inequality, render it with KaTeX automatically
  const trimmed = text.trim();
  if (
    isPureMathOption &&
    trimmed.length > 0 &&
    trimmed.length <= 45 &&
    !/[a-zA-Z]{4,}/.test(trimmed.replace(/sqrt|sin|cos|tan/gi, ''))
  ) {
    try {
      const latexReady = trimmed
        .replace(/π/g, '\\pi ')
        .replace(/√\(([^)]+)\)/g, '\\sqrt{$1}')
        .replace(/√([0-9a-zA-Z]+)/g, '\\sqrt{$1}')
        .replace(/²/g, '^2')
        .replace(/³/g, '^3')
        .replace(/⁴/g, '^4');
      return katex.renderToString(latexReady, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      return text;
    }
  }

  return text;
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

