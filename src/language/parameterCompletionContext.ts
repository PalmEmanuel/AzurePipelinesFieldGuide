import { maskYamlComments } from './sourceText';

export interface ParameterCompletionContext {
  readonly typedName: string;
  readonly replaceStart: number;
  readonly replaceEnd: number;
}

const PARAMETER_REFERENCE = /(?<![A-Za-z0-9_.])parameters\.([A-Za-z_][A-Za-z0-9_]*)?$/;

export function findParameterCompletionContext(
  linePrefix: string,
  contextText = linePrefix,
  contextOffset = contextText.length - linePrefix.length,
): ParameterCompletionContext | undefined {
  const searchablePrefix = maskYamlComments(linePrefix);
  const match = PARAMETER_REFERENCE.exec(searchablePrefix);
  if (match === null) {
    return undefined;
  }

  const referenceStart = contextOffset + match.index;
  if (!isInsideTemplateExpression(contextText, referenceStart)) {
    return undefined;
  }

  const typedName = match[1] ?? '';
  return {
    typedName,
    replaceStart: searchablePrefix.length - typedName.length,
    replaceEnd: searchablePrefix.length,
  };
}

function isInsideTemplateExpression(text: string, referenceStart: number): boolean {
  return findTemplateExpressionStart(text, referenceStart) !== undefined;
}

export function findTemplateExpressionStart(
  text: string,
  offset: number,
  includeStrings = false,
): number | undefined {
  const prefix = maskYamlComments(text).slice(0, offset);
  let expressionStart: number | undefined;
  let inString = false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (expressionStart === undefined) {
      if (prefix.startsWith('${{', index)) {
        expressionStart = index + 3;
        index += 2;
      }
      continue;
    }

    if (inString && prefix[index] === "'" && prefix[index + 1] === "'") {
      index += 1;
    } else if (prefix[index] === "'") {
      inString = !inString;
    } else if (!inString && prefix.startsWith('}}', index)) {
      expressionStart = undefined;
      index += 1;
    }
  }
  return includeStrings || !inString ? expressionStart : undefined;
}
