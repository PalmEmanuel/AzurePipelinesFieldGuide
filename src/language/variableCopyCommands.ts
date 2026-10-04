export type VariableCopySyntax = 'macro' | 'expression' | 'property' | 'environment';


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
