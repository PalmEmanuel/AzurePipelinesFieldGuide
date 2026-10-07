import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import { findTemplateExpressionStart } from './parameterCompletionContext';
import { lineStartAt, maskYamlComments } from './sourceText';

type ParameterValue = string | number | boolean;

export interface ParameterValueCompletion {
  readonly parameterName: string;
  readonly label: string;
  readonly insertText: string;
  readonly replaceStart: number;
  readonly replaceEnd: number;
}

interface ParameterDefinition {
  readonly name: string;
  readonly values: readonly ParameterValue[];
  readonly defaultKeyOffset?: number;
  readonly literals: readonly ParameterValueReference[];
}

export interface ParameterValueReference {
  readonly type: 'string' | 'number' | 'boolean';
  readonly start: number;
  readonly end: number;
}

interface Token {
  readonly text: string;
  readonly start: number;
}

export function findParameterValueCompletions(
  text: string,
  offset: number,
): readonly ParameterValueCompletion[] {
  const lineStart = lineStartAt(text, offset);
  const lineEnd = text.indexOf('\n', offset);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const defaultMatch = /^(\s*)default\s*:\s*/u.exec(line);
  const defaultValueStart = defaultMatch === null ? undefined : lineStart + defaultMatch[0].length;
  const expressionStart = findTemplateExpressionStart(text, offset, true);
  if (defaultValueStart === undefined && expressionStart === undefined) {
    return [];
  }
  // Mask the scalar being edited so an unfinished YAML quote cannot invalidate the declarations.
  const declarationText = defaultValueStart === undefined
    ? text
    : text.slice(0, defaultValueStart) +
      ' '.repeat(line.length - (defaultValueStart - lineStart)) +
      text.slice(lineStart + line.length);
  const definitions = collectDefinitions(declarationText);
  if (defaultMatch !== null && defaultValueStart !== undefined && offset >= defaultValueStart) {
    const definition = definitions.find(
      (candidate) => candidate.defaultKeyOffset === lineStart + (defaultMatch[1]?.length ?? 0),
    );
    return definition === undefined
      ? []
      : completeLiteral(text, offset, defaultValueStart, definition, 'yaml');
  }

  if (expressionStart === undefined) {
    return [];
  }
  const comparison = findComparison(text, expressionStart, offset, definitions);
  if (comparison === undefined) {
    return [];
  }
  return completeLiteral(text, offset, comparison.start, comparison.definition, 'expression');
}

function findComparison(
  text: string,
  expressionStart: number,
  offset: number,
  definitions: readonly ParameterDefinition[],
): { definition: ParameterDefinition; start: number } | undefined {
  const tokens = tokenize(maskYamlComments(text).slice(expressionStart, offset), expressionStart);
  const calls: Array<{ name: string; args: Token[][] }> = [];
  let previous: Token | undefined;
  let beforePrevious: Token | undefined;
  for (const token of tokens) {
    if (token.text === '(') {
      calls.push({
        name: beforePrevious?.text === '.' ? '' : previous?.text ?? '',
        args: [[]],
      });
    } else if (token.text === ')') {
      calls.pop();
    } else if (token.text === ',') {
      calls.at(-1)?.args.push([]);
    } else {
      calls.at(-1)?.args.at(-1)?.push(token);
    }
    beforePrevious = previous;
    previous = token;
  }

  const call = calls.at(-1);
  if (call === undefined || !/^(?:eq|ne|gt|ge|lt|le|in|notIn)$/iu.test(call.name)) {
    return undefined;
  }
  if (call.args.length !== 2 && !/^(?:in|notIn)$/iu.test(call.name)) {
    return undefined;
  }
  if (call.args.length < 2) {
    return undefined;
  }
  const firstArgument = call.args[0];
  if (firstArgument?.length !== 3 ||
      firstArgument[0]?.text !== 'parameters' ||
      firstArgument[1]?.text !== '.') {
    return undefined;
  }
  const definition = definitions.find((candidate) => candidate.name === firstArgument[2]?.text);
  const valueTokens = call.args.at(-1) ?? [];
  if (definition === undefined || valueTokens.length > 1) {
    return undefined;
  }
  const start = valueTokens[0]?.start ?? offset;
  return { definition, start };
}

export function findParameterValueReferences(text: string): readonly ParameterValueReference[] {
  const definitions = collectDefinitions(text);
  const references = definitions.flatMap((definition) => definition.literals);
  const masked = maskYamlComments(text);
  for (const opening of masked.matchAll(/\$\{\{/gu)) {
    const expressionStart = opening.index + 3;
    for (const token of tokenize(masked.slice(expressionStart), expressionStart)) {
      if (token.text === '}' && masked.startsWith('}}', token.start)) {
        break;
      }
      const value = expressionLiteral(token.text);
      if (value === undefined ||
          findTemplateExpressionStart(text, token.start) !== expressionStart) {
        continue;
      }
      const comparison = findComparison(text, expressionStart, token.start, definitions);
      const end = token.start + token.text.length;
      if (comparison === undefined || comparison.start !== token.start ||
          !comparison.definition.values.includes(value) ||
          !/^\s*[,)]/u.test(masked.slice(end)) ||
          /[\r\n]/u.test(token.text)) {
        continue;
      }
      references.push({
        type: literalType(value),
        start: token.start,
        end,
      });
    }
  }
  return references.sort((left, right) => left.start - right.start);
}

function expressionLiteral(text: string): ParameterValue | undefined {
  if (/^'(?:[^']|'')*'$/u.test(text)) {
    return text.slice(1, -1).replace(/''/gu, "'");
  }
  if (/^(?:true|false)$/iu.test(text)) {
    return text.toLowerCase() === 'true';
  }
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(text)) {
    const value = Number(text);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}

function literalType(value: ParameterValue): ParameterValueReference['type'] {
  if (typeof value === 'string') {
    return 'string';
  }
  return typeof value === 'number' ? 'number' : 'boolean';
}

function collectDefinitions(text: string): readonly ParameterDefinition[] {
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length !== 0 || !isMap(document.contents)) {
    return [];
  }
  const parameters: unknown = document.contents.get('parameters', true);
  if (!isSeq(parameters)) {
    return [];
  }
  const definitions: ParameterDefinition[] = [];
  for (const node of parameters.items) {
    if (!isMap(node)) {
      continue;
    }
    const name: unknown = node.get('name');
    const type: unknown = node.get('type');
    const values: unknown = node.get('values', true);
    if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) ||
        !isSeq(values) || !['string', 'number', 'boolean'].includes(String(type))) {
      continue;
    }
    const allowed: ParameterValue[] = [];
    const literals: ParameterValueReference[] = [];
    for (const value of values.items) {
      if (!isScalar(value) || typeof value.value !== type ||
          (typeof value.value === 'number' && !Number.isFinite(value.value)) ||
          (typeof value.value === 'string' && /[\r\n]|\$\{\{/u.test(value.value))) {
        continue;
      }
      if (typeof value.value === 'string' || typeof value.value === 'boolean' ||
          typeof value.value === 'number') {
        allowed.push(value.value);
        if (value.range != null && !/[\r\n]/u.test(
          text.slice(value.range[0], value.range[1]),
        )) {
          literals.push({
            type: literalType(value.value),
            start: value.range[0],
            end: value.range[1],
          });
        }
      }
    }
    const defaultPair = node.items.find((pair) => isScalar(pair.key) && pair.key.value === 'default');
    const defaultValue = defaultPair?.value;
    const matchedDefault = isScalar(defaultValue)
      ? allowed.find((value) => value === defaultValue.value) : undefined;
    if (isScalar(defaultValue) && defaultValue.range != null &&
        matchedDefault !== undefined &&
        !/[\r\n]/u.test(text.slice(defaultValue.range[0], defaultValue.range[1]))) {
      literals.push({
        type: literalType(matchedDefault),
        start: defaultValue.range[0],
        end: defaultValue.range[1],
      });
    }
    definitions.push({
      name,
      values: [...new Set(allowed)],
      defaultKeyOffset: isScalar(defaultPair?.key) ? defaultPair.key.range?.[0] : undefined,
      literals,
    });
  }
  return definitions;
}

function completeLiteral(
  text: string,
  offset: number,
  start: number,
  definition: ParameterDefinition,
  syntax: 'yaml' | 'expression',
): readonly ParameterValueCompletion[] {
  const prefix = text.slice(start, offset);
  const quote = prefix[0] === "'" || prefix[0] === '"' ? prefix[0] : undefined;
  if (syntax === 'expression' && quote === '"') {
    return [];
  }
  if (quote === undefined && !/^[A-Za-z0-9_.+-]*$/u.test(prefix)) {
    return [];
  }
  if (quote !== undefined && hasClosingQuote(prefix, quote)) {
    return [];
  }
  const typedValue = quote === undefined ? prefix : prefix.slice(1).replace(/''/gu, "'");
  let end = offset;
  if (quote !== undefined) {
    const suffix = text.slice(start, text.indexOf('\n', offset) === -1
      ? text.length : text.indexOf('\n', offset));
    const closing = closingQuoteIndex(suffix, quote);
    if (closing !== undefined) {
      end = start + closing + 1;
    }
  } else {
    const remainder = /^[A-Za-z0-9_.+-]*/u.exec(text.slice(offset))?.[0] ?? '';
    end += remainder.length;
  }

  return definition.values
    .filter((value) => (quote === undefined || typeof value === 'string') &&
      String(value).toLowerCase().startsWith(typedValue.toLowerCase()))
    .map((value) => ({
      parameterName: definition.name,
      label: String(value),
      insertText: typeof value === 'string'
        ? syntax === 'yaml' ? JSON.stringify(value) : `'${value.replace(/'/gu, "''")}'`
        : String(value),
      replaceStart: start,
      replaceEnd: end,
    }));
}

function hasClosingQuote(text: string, quote: string): boolean {
  return closingQuoteIndex(text, quote) !== undefined;
}

function closingQuoteIndex(text: string, quote: string): number | undefined {
  for (let index = 1; index < text.length; index += 1) {
    if (quote === '"' && text[index] === '\\') {
      index += 1;
    } else if (text[index] === quote) {
      if (quote === "'" && text[index + 1] === "'") {
        index += 1;
      } else {
        return index;
      }
    }
  }
  return undefined;
}

function tokenize(text: string, baseOffset: number): readonly Token[] {
  const tokens: Token[] = [];
  const pattern = /'(?:[^']|'')*(?:'|$)|[+-]?(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z_][A-Za-z0-9_]*|[^\s]/gu;
  for (const match of text.matchAll(pattern)) {
    tokens.push({
      text: match[0],
      start: baseOffset + match.index,
    });
  }
  return tokens;
}
