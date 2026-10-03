import * as vscode from 'vscode';
import { VariableCompletionProvider } from './providers/variableCompletionProvider';
import { VariableHoverProvider } from './providers/variableHoverProvider';
import { InvalidVariableSyntaxCodeActionProvider } from './providers/invalidVariableSyntaxCodeActionProvider';
import { InvalidVariableSyntaxDiagnostics } from './providers/invalidVariableSyntaxDiagnostics';
import {
  VariableSemanticTokensProvider,
  variableSemanticTokensLegend,
} from './providers/variableSemanticTokensProvider';
import {
  VariableCatalogTreeProvider,
  type VariableCatalogNode,
} from './providers/variableCatalogTreeProvider';

const AZURE_PIPELINES_SELECTOR: vscode.DocumentSelector = {
  language: 'azure-pipelines',
  scheme: '*',
};

export function activate(context: vscode.ExtensionContext): void {
  const invalidVariableSyntaxDiagnostics = new InvalidVariableSyntaxDiagnostics();
  const variableCatalog = new VariableCatalogTreeProvider();

  context.subscriptions.push(
    invalidVariableSyntaxDiagnostics,
    variableCatalog,
    vscode.window.registerTreeDataProvider(
      'azurePipelinesFieldGuide.variables',
      variableCatalog,
    ),
    vscode.commands.registerCommand(
      'azurePipelinesFieldGuide.browseVariables',
      () => vscode.commands.executeCommand('workbench.view.explorer'),
    ),
    vscode.commands.registerCommand(
      'azurePipelinesFieldGuide.refreshVariables',
      () => variableCatalog.refresh(),
    ),
    vscode.commands.registerCommand(
      'azurePipelinesFieldGuide.copyMacroSyntax',
      (node: VariableCatalogNode) => copyVariableSyntax(node, (name) => `$(${name})`),
    ),
    vscode.commands.registerCommand(
      'azurePipelinesFieldGuide.copyExpressionSyntax',
      (node: VariableCatalogNode) =>
        copyVariableSyntax(node, (name) => `variables['${name}']`),
    ),
    vscode.commands.registerCommand(
      'azurePipelinesFieldGuide.copyPropertySyntax',
      (node: VariableCatalogNode) =>
        copyVariableSyntax(node, (name) => `variables.${name}`),
    ),
    vscode.languages.registerCompletionItemProvider(
      AZURE_PIPELINES_SELECTOR,
      new VariableCompletionProvider(),
      '.',
      '(',
      "'",
      '"',
    ),
    vscode.languages.registerHoverProvider(
      AZURE_PIPELINES_SELECTOR,
      new VariableHoverProvider(),
    ),
    vscode.languages.registerDocumentSemanticTokensProvider(
      AZURE_PIPELINES_SELECTOR,
      new VariableSemanticTokensProvider(),
      variableSemanticTokensLegend,
    ),
    vscode.languages.registerCodeActionsProvider(
      AZURE_PIPELINES_SELECTOR,
      new InvalidVariableSyntaxCodeActionProvider(),
      InvalidVariableSyntaxCodeActionProvider.metadata,
    ),
  );
}

export function deactivate(): void {
  // Providers are disposed through the extension context.
}

async function copyVariableSyntax(
  node: VariableCatalogNode,
  format: (name: string) => string,
): Promise<void> {
  if (node?.kind !== 'variable') {
    return;
  }
  await vscode.env.clipboard.writeText(format(node.variable.name));
}
