import { collectDocumentParameters } from './documentParameters';
import { findTemplateExpressionStart } from './parameterCompletionContext';
import { maskYamlComments } from './sourceText';

export interface ParameterReference {
  readonly name: string;
  readonly start: number;
  readonly end: number;
}

export function findParameterReferences(text: string): readonly ParameterReference[] {
  const names = new Set(collectDocumentParameters(text));
  const references: ParameterReference[] = [];
  const pattern = /(?<![A-Za-z0-9_.])parameters\.([A-Za-z_][A-Za-z0-9_]*)(?![A-Za-z0-9_.-])/gu;
  for (const match of maskYamlComments(text).matchAll(pattern)) {
    const name = match[1];
    if (name === undefined || !names.has(name) ||
        findTemplateExpressionStart(text, match.index) === undefined) {
      continue;
    }
    const start = match.index + 'parameters.'.length;
    references.push({ name, start, end: start + name.length });
  }
  return references;
}
