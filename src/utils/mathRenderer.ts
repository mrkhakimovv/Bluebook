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
