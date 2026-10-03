import type { PipelineVariable } from '../model/variable';

const VARIABLES_HEADER = /^(\s*)variables\s*:\s*(?:#.*)?$/i;
const MAPPING_ENTRY = /^(\s*)(?:["']([^"']+)["']|([A-Za-z_][A-Za-z0-9_.-]*))\s*:/;
const SEQUENCE_NAME = /^\s*-\s*name\s*:\s*(?:["']([^"']+)["']|([^\s#]+))/i;
const SEQUENCE_GROUP = /^\s*-\s*group\s*:/i;

export function collectDocumentVariables(text: string): readonly PipelineVariable[] {
  const names = new Map<string, string>();
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const header = VARIABLES_HEADER.exec(line);
    if (header === null) {
      continue;
    }

    const headerIndent = header[1]?.length ?? 0;
    let childIndent: number | undefined;
    let listStyle = false;

    for (index += 1; index < lines.length; index += 1) {
      const candidate = lines[index] ?? '';
      if (candidate.trim() === '' || candidate.trimStart().startsWith('#')) {
        continue;
      }

      const indent = leadingWhitespace(candidate);
      const sequence = SEQUENCE_NAME.exec(candidate);
      const sequenceName = sequence?.[1] ?? sequence?.[2];
      if (sequenceName !== undefined && indent >= headerIndent) {
        listStyle = true;
        addName(names, sequenceName);
        continue;
      }
      if (SEQUENCE_GROUP.test(candidate) && indent >= headerIndent) {
        listStyle = true;
        continue;
      }

      if (indent <= headerIndent) {
        index -= 1;
        break;
      }

      if (listStyle) {
        continue;
      }

      childIndent ??= indent;
      if (indent !== childIndent || candidate.trimStart().startsWith('-')) {
        continue;
      }

      const mapping = MAPPING_ENTRY.exec(candidate);
      const mappingName = mapping?.[2] ?? mapping?.[3];
      if (mappingName !== undefined && mappingName.toLowerCase() !== 'group') {
        addName(names, mappingName);
      }
    }
  }

  return [...names.values()].map((name) => ({
    name,
    description: 'Variable declared in the current Azure Pipelines YAML document.',
    source: 'document',
  }));
}

function leadingWhitespace(value: string): number {
  return /^\s*/.exec(value)?.[0].length ?? 0;
}

function addName(names: Map<string, string>, name: string): void {
  const trimmed = name.trim();
  if (trimmed !== '' && !trimmed.includes('${{')) {
    names.set(trimmed.toLowerCase(), trimmed);
  }
}
