export type VariableCopySyntax = 'macro' | 'expression' | 'property' | 'environment';

export function variableCommandKey(name: string): string {
  return name.replace(/[^A-Za-z0-9]+/gu, '_').replace(/^_+|_+$/gu, '');
}

export function variableCopyCommandId(
  syntax: VariableCopySyntax,
  name: string,
): string {
  return `azurePipelinesFieldGuide.copy.${syntax}.${variableCommandKey(name)}`;
}

export function variableContextValue(name: string): string {
  const prefix = /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)
    ? 'azurePipelinesVariable.simple'
    : 'azurePipelinesVariable';
  return `${prefix}.${variableCommandKey(name)}`;
}

export function formatVariableSyntax(syntax: VariableCopySyntax, name: string): string {
  switch (syntax) {
    case 'macro':
      return `$(${name})`;
    case 'expression':
      return `variables['${name}']`;
    case 'property':
      return `variables.${name}`;
    case 'environment':
      return name.replaceAll('.', '_').toUpperCase();
  }
}
