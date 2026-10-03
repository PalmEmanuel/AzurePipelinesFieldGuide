/**
 * Returns the source with YAML comments replaced by spaces. Character offsets
 * remain stable, which lets language features report ranges against the
 * original document.
 */
export function maskYamlComments(text: string): string {
  // split('') preserves JavaScript string offsets, including UTF-16 offsets
  // used by VS Code document ranges.
  const characters = text.split('');
  let singleQuoted = false;
  let doubleQuoted = false;

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];

    if (character === '\n' || character === '\r') {
      continue;
    }

    if (singleQuoted) {
      if (character === "'" && characters[index + 1] === "'") {
        index += 1;
      } else if (character === "'") {
        singleQuoted = false;
      }
      continue;
    }

    if (doubleQuoted) {
      if (character === '"' && characters[index - 1] !== '\\') {
        doubleQuoted = false;
      }
      continue;
    }

    if (character === "'") {
      singleQuoted = true;
      continue;
    }
    if (character === '"') {
      doubleQuoted = true;
      continue;
    }

    if (
      character === '#' &&
      (index === 0 || characters[index - 1] === ' ' || characters[index - 1] === '\t')
    ) {
      let commentIndex = index;
      while (
        commentIndex < characters.length &&
        characters[commentIndex] !== '\n' &&
        characters[commentIndex] !== '\r'
      ) {
        characters[commentIndex] = ' ';
        commentIndex += 1;
      }
      index = commentIndex - 1;
    }
  }

  return characters.join('');
}

export function lineStartAt(text: string, offset: number): number {
  const newline = text.lastIndexOf('\n', Math.max(0, offset - 1));
  return newline === -1 ? 0 : newline + 1;
}

export function lineAtOffset(text: string, offset: number): string {
  const start = lineStartAt(text, offset);
  const end = text.indexOf('\n', offset);
  return text.slice(start, end === -1 ? text.length : end).replace(/\r$/u, '');
}

export function offsetLineNumber(text: string, offset: number): number {
  let lineNumber = 0;
  for (let index = 0; index < offset; index += 1) {
    if (text[index] === '\n') {
      lineNumber += 1;
    }
  }
  return lineNumber;
}

export function leadingWhitespace(value: string): number {
  return /^\s*/u.exec(value)?.[0].length ?? 0;
}
