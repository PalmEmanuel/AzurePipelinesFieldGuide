import * as vscode from 'vscode';
import {
  findIncorrectExpressionVariableCasing,
  findInvalidVariableProperties,
  findInvalidVariableIndexes,
} from '../language/invalidVariableSyntax';

const CONFIGURATION_SECTION = 'azurePipelinesFieldGuide';
const INVALID_SYNTAX_CONFIGURATION_KEY = 'diagnostics.invalidVariableSyntax.enabled';
const EXPRESSION_CASING_CONFIGURATION_KEY = 'diagnostics.expressionVariableCasing.enabled';

export const invalidVariableSyntaxDiagnosticCode = 'invalid-variable-index-syntax';
export const incorrectExpressionVariableCasingDiagnosticCode =
  'incorrect-expression-variable-casing';
export const invalidVariablePropertyDiagnosticCode = 'invalid-variable-property';

export class InvalidVariableSyntaxDiagnostics implements vscode.Disposable {
  private readonly diagnostics =
    vscode.languages.createDiagnosticCollection('azurePipelinesFieldGuide.variableSyntax');

  private readonly subscriptions: vscode.Disposable[];

  public constructor() {
    this.subscriptions = [
      vscode.workspace.onDidOpenTextDocument((document) => this.update(document)),
      vscode.workspace.onDidChangeTextDocument(({ document }) => this.update(document)),
      vscode.workspace.onDidCloseTextDocument((document) => this.diagnostics.delete(document.uri)),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (
          event.affectsConfiguration(
            `${CONFIGURATION_SECTION}.${INVALID_SYNTAX_CONFIGURATION_KEY}`,
          ) ||
          event.affectsConfiguration(
            `${CONFIGURATION_SECTION}.${EXPRESSION_CASING_CONFIGURATION_KEY}`,
          )
        ) {
          this.updateAllOpenDocuments();
        }
      }),
    ];

    this.updateAllOpenDocuments();
  }

  public dispose(): void {
    this.diagnostics.dispose();
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
  }

  private updateAllOpenDocuments(): void {
    for (const document of vscode.workspace.textDocuments) {
      this.update(document);
    }
  }

  private update(document: vscode.TextDocument): void {
    if (document.languageId !== 'azure-pipelines') {
      this.diagnostics.delete(document.uri);
      return;
    }

    const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION, document.uri);
    const invalidSyntaxEnabled = configuration.get<boolean>(
      INVALID_SYNTAX_CONFIGURATION_KEY,
      true,
    );
    const expressionCasingEnabled = configuration.get<boolean>(
      EXPRESSION_CASING_CONFIGURATION_KEY,
      true,
    );
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
      const line = document.lineAt(lineNumber).text;
      const lineOffset = document.offsetAt(new vscode.Position(lineNumber, 0));
      if (invalidSyntaxEnabled) {
        for (const reference of findInvalidVariableIndexes(line, text, lineOffset)) {
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(lineNumber, reference.start, lineNumber, reference.end),
            `Variable index syntax must quote the name: variables['${reference.canonicalName ?? reference.name}'].`,
            vscode.DiagnosticSeverity.Warning,
          );
          diagnostic.code = invalidVariableSyntaxDiagnosticCode;
          diagnostic.source = 'Azure Pipelines Field Guide';
          diagnostics.push(diagnostic);
        }
      }
      if (expressionCasingEnabled) {
        for (const reference of findIncorrectExpressionVariableCasing(line, text, lineOffset)) {
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(lineNumber, reference.start, lineNumber, reference.end),
            `Expression variable casing must match '${reference.canonicalName}'.`,
            vscode.DiagnosticSeverity.Warning,
          );
          diagnostic.code = incorrectExpressionVariableCasingDiagnosticCode;
          diagnostic.source = 'Azure Pipelines Field Guide';
          diagnostics.push(diagnostic);
        }
      }
      if (invalidSyntaxEnabled) {
        for (const reference of findInvalidVariableProperties(line, text, lineOffset)) {
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(lineNumber, reference.start, lineNumber, reference.end),
            `Property dereference requires a simple name. Use variables['${reference.canonicalName ?? reference.name}'] for this variable.`,
            vscode.DiagnosticSeverity.Warning,
          );
          diagnostic.code = invalidVariablePropertyDiagnosticCode;
          diagnostic.source = 'Azure Pipelines Field Guide';
          diagnostics.push(diagnostic);
        }
      }
    }

    this.diagnostics.set(document.uri, diagnostics);
  }
}
