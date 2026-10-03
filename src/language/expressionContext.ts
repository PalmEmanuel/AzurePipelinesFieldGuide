import {
  lineAtOffset,
  leadingWhitespace,
  maskYamlComments,
  offsetLineNumber,
} from './sourceText';

export function isExpressionContext(text: string, referenceStart: number): boolean {
  const maskedText = maskYamlComments(text);
  const line = lineAtOffset(maskedText, referenceStart);
  const prefix = maskedText.slice(0, referenceStart);
  return (
    /\$\{\{[^}]*$/u.test(prefix) ||
    /\$\[[^\]]*$/u.test(prefix) ||
    /^\s*condition\s*:/iu.test(line) ||
    isInsideConditionBlock(maskedText, offsetLineNumber(maskedText, referenceStart))
  );
}

function isInsideConditionBlock(text: string, currentLineNumber: number): boolean {
  const lines = text.split(/\r?\n/u);
  let activeIndent: number | undefined;

  for (let lineNumber = 0; lineNumber <= currentLineNumber; lineNumber += 1) {
    const line = lines[lineNumber] ?? '';
    const blockHeader = /^(\s*)condition\s*:\s*[|>][+-]?\s*$/iu.exec(line);
    if (blockHeader !== null) {
      activeIndent = blockHeader[1]?.length ?? 0;
      continue;
    }

    if (
      activeIndent !== undefined &&
      line.trim() !== '' &&
      leadingWhitespace(line) <= activeIndent
    ) {
      activeIndent = undefined;
    }
  }

  const currentLine = lines[currentLineNumber] ?? '';
  return activeIndent !== undefined && leadingWhitespace(currentLine) > activeIndent;
}
