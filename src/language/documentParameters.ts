import { maskYamlComments } from './sourceText';

const PARAMETERS_HEADER = /^parameters\s*:\s*$/;
const PARAMETER_SEQUENCE_ITEM = /^(\s*)-\s+name\s*:\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))/;
const PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function collectDocumentParameters(text: string): readonly string[] {
  const lines = maskYamlComments(text).split(/\r?\n/u);
  const names = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    if (!PARAMETERS_HEADER.test(lines[index] ?? '')) {
      continue;
    }

    let sequenceIndent: number | undefined;
    for (index += 1; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      if (line.trim() === '') {
        continue;
      }

      const indent = leadingWhitespace(line);
      const isSequenceItem = /^\s*-/u.test(line);
      if (indent === 0 && !isSequenceItem) {
        index -= 1;
        break;
      }

      if (isSequenceItem) {
        sequenceIndent ??= indent;
      }
      const item = PARAMETER_SEQUENCE_ITEM.exec(line);
      if (item === null) {
        continue;
      }
      const itemIndent = item[1]?.length;
      if (itemIndent === undefined || itemIndent !== sequenceIndent) {
        continue;
      }

      const name = item[2] ?? item[3] ?? item[4];
      if (name !== undefined && PARAMETER_NAME.test(name)) {
        names.add(name);
      }
    }
  }

  return [...names];
}

function leadingWhitespace(value: string): number {
  return /^\s*/u.exec(value)?.[0].length ?? 0;
}
