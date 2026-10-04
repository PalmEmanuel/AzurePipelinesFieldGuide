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
  VARIABLE_CATALOG_VIEW_TYPE,
  VariableCatalogWebviewProvider,
} from './providers/variableCatalogWebviewProvider';

const AZURE_PIPELINES_SELECTOR: vscode.DocumentSelector = {
  language: 'azure-pipelines',
  scheme: '*',
};

export function activate(context: vscode.ExtensionContext): void {
  const invalidVariableSyntaxDiagnostics = new InvalidVariableSyntaxDiagnostics();
  const variableCatalog = new VariableCatalogWebviewProvider();

  context.subscriptions.push(
    invalidVariableSyntaxDiagnostics,
    variableCatalog,
    vscode.window.registerWebviewViewProvider(
      VARIABLE_CATALOG_VIEW_TYPE,
      variableCatalog,
    ),
    vscode.commands.registerCommand(
      'azurePipelinesFieldGuide.browseVariables',
      () => vscode.commands.executeCommand('workbench.view.extension.azurePipelinesFieldGuide'),
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
