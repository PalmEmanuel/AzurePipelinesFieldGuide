import { isExpressionContext } from './expressionContext';
import { maskYamlComments } from './sourceText';

export interface VariableReference {
  readonly name: string;
  readonly start: number;
  readonly end: number;
}

const REFERENCE_PATTERNS = [
  /\$\(([A-Za-z0-9_.-]+)\)/g,
  /\bvariables\s*\[\s*['"]([A-Za-z0-9_.-]+)['"]\s*\]/gi,
  /\bvariables\.([A-Za-z_][A-Za-z0-9_]*)(?![A-Za-z0-9_.-])/gi,
] as const;

export function findVariableReferences(
  line: string,
  contextText = line,
  lineOffset = 0,
): readonly VariableReference[] {
  const references: VariableReference[] = [];
  const searchableLine = maskYamlComments(line);

  for (const [patternIndex, pattern] of REFERENCE_PATTERNS.entries()) {
    pattern.lastIndex = 0;
    for (const match of searchableLine.matchAll(pattern)) {
      const name = match[1];
      const wholeMatch = match[0];
      if (name === undefined || match.index === undefined) {
        continue;
      }
      if (
        (patternIndex === 1 || patternIndex === 2) &&
        !isExpressionContext(contextText, lineOffset + match.index)
      ) {
        continue;
      }
      if (
        (patternIndex === 1 || patternIndex === 2) &&
        (searchableLine[match.index - 1] === "'" ||
          searchableLine[match.index - 1] === '"')
      ) {
        continue;
      }
      const start = match.index + wholeMatch.indexOf(name);
      references.push({ name, start, end: start + name.length });
    }
  }

  return references.sort((left, right) => left.start - right.start);
}
