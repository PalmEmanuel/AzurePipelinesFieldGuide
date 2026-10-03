import { isExpressionContext } from './expressionContext';
import { maskYamlComments } from './sourceText';

export type VariableSyntax = 'macro' | 'index' | 'property';

export interface CompletionContext {
  readonly syntax: VariableSyntax;
  readonly typedName: string;
  readonly replaceStart: number;
  readonly replaceEnd: number;
}

const VARIABLE_NAME = '[A-Za-z0-9_.-]*';
const MACRO_PATTERN = new RegExp(`\\$\\((${VARIABLE_NAME})$`);
const INDEX_PATTERN = new RegExp(`\\bvariables\\s*\\[\\s*['"](${VARIABLE_NAME})$`, 'i');
const PROPERTY_PATTERN = /\bvariables\.([A-Za-z_][A-Za-z0-9_]*)$/i;

export function findCompletionContext(
  linePrefix: string,
  contextText = linePrefix,
  contextOffset = contextText.length - linePrefix.length,
): CompletionContext | undefined {
  const searchablePrefix = maskYamlComments(linePrefix);
  return (
    match(searchablePrefix, MACRO_PATTERN, 'macro') ??
    match(searchablePrefix, INDEX_PATTERN, 'index', true, contextText, contextOffset) ??
    match(searchablePrefix, PROPERTY_PATTERN, 'property', true, contextText, contextOffset)
  );
}

function match(
  linePrefix: string,
  pattern: RegExp,
  syntax: VariableSyntax,
  expressionOnly = false,
  contextText = linePrefix,
  contextOffset = 0,
): CompletionContext | undefined {
  const result = pattern.exec(linePrefix);
  const typedName = result?.[1];
  if (result === null || typedName === undefined) {
    return undefined;
  }
  if (expressionOnly && result.index === undefined) {
    return undefined;
  }
  if (expressionOnly && !isExpressionContext(contextText, contextOffset + result.index)) {
    return undefined;
  }

  return {
    syntax,
    typedName,
    replaceStart: linePrefix.length - typedName.length,
    replaceEnd: linePrefix.length,
  };
}
