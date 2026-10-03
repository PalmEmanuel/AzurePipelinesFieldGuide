import { predefinedVariablesByName } from '../catalog/predefinedVariables';
import { isExpressionContext } from './expressionContext';
import { maskYamlComments } from './sourceText';

export interface InvalidVariableIndex {
  readonly kind: 'missing-quotes';
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly canonicalName?: string;
}

export interface IncorrectExpressionVariableCasing {
  readonly kind: 'incorrect-casing';
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly canonicalName: string;
}

export interface InvalidVariableProperty {
  readonly kind: 'invalid-property';
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly canonicalName?: string;
}

const INVALID_INDEX_PATTERN = /\bvariables\s*\[\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\]/gi;

export function findInvalidVariableIndexes(
  line: string,
  contextText = line,
  lineOffset = 0,
): readonly InvalidVariableIndex[] {
  const invalidIndexes: InvalidVariableIndex[] = [];
  const searchableLine = maskYamlComments(line);

  for (const match of searchableLine.matchAll(INVALID_INDEX_PATTERN)) {
    const name = match[1];
    const wholeMatch = match[0];
    if (
      name === undefined ||
      match.index === undefined ||
      !isExpressionContext(contextText, lineOffset + match.index)
    ) {
      continue;
    }

    const start = match.index + wholeMatch.indexOf(name);
    invalidIndexes.push({
      kind: 'missing-quotes',
      name,
      start,
      end: start + name.length,
      canonicalName: predefinedVariablesByName.get(name.toLowerCase())?.name,
    });
  }

  return invalidIndexes;
}

const QUOTED_INDEX_PATTERN =
  /\bvariables\s*\[\s*(['"])([A-Za-z_][A-Za-z0-9_.-]*)\1\s*\]/g;

export function findIncorrectExpressionVariableCasing(
  line: string,
  contextText = line,
  lineOffset = 0,
): readonly IncorrectExpressionVariableCasing[] {
  const incorrectCasing: IncorrectExpressionVariableCasing[] = [];
  const searchableLine = maskYamlComments(line);

  for (const match of searchableLine.matchAll(QUOTED_INDEX_PATTERN)) {
    const name = match[2];
    const wholeMatch = match[0];
    if (
      name === undefined ||
      match.index === undefined ||
      !isExpressionContext(contextText, lineOffset + match.index)
    ) {
      continue;
    }

    const canonicalName = predefinedVariablesByName.get(name.toLowerCase())?.name;
    if (canonicalName === undefined || canonicalName === name) {
      continue;
    }

    const start = match.index + wholeMatch.indexOf(name);
    incorrectCasing.push({
      kind: 'incorrect-casing',
      name,
      start,
      end: start + name.length,
      canonicalName,
    });
  }

  return incorrectCasing;
}

const PROPERTY_PATTERN = /\bvariables\.([A-Za-z0-9_.-]+)/gi;

export function findInvalidVariableProperties(
  line: string,
  contextText = line,
  lineOffset = 0,
): readonly InvalidVariableProperty[] {
  const invalidProperties: InvalidVariableProperty[] = [];
  const searchableLine = maskYamlComments(line);

  for (const match of searchableLine.matchAll(PROPERTY_PATTERN)) {
    const name = match[1];
    const wholeMatch = match[0];
    if (
      name === undefined ||
      match.index === undefined ||
      isSimplePropertyName(name) ||
      !isExpressionContext(contextText, lineOffset + match.index)
    ) {
      continue;
    }

    const start = match.index + wholeMatch.indexOf(name);
    invalidProperties.push({
      kind: 'invalid-property',
      name,
      start,
      end: start + name.length,
      canonicalName: predefinedVariablesByName.get(name.toLowerCase())?.name,
    });
  }

  return invalidProperties;
}

function isSimplePropertyName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name);
}
