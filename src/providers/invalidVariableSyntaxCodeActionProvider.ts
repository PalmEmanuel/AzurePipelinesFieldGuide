import * as vscode from 'vscode';
import { predefinedVariablesByName } from '../catalog/predefinedVariables';
import {
  incorrectExpressionVariableCasingDiagnosticCode,
  invalidVariablePropertyDiagnosticCode,
  invalidVariableSyntaxDiagnosticCode,
} from './invalidVariableSyntaxDiagnostics';

export class InvalidVariableSyntaxCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
  };

  public provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    return context.diagnostics.flatMap((diagnostic) => {
      if (
        diagnostic.code !== invalidVariableSyntaxDiagnosticCode &&
        diagnostic.code !== incorrectExpressionVariableCasingDiagnosticCode &&
        diagnostic.code !== invalidVariablePropertyDiagnosticCode
      ) {
        return [];
      }

      const currentName = document.getText(diagnostic.range);
      const canonicalName = predefinedVariablesByName.get(currentName.toLowerCase())?.name;
      const replacementName = canonicalName ?? currentName;
      const isIncorrectCasing = diagnostic.code === incorrectExpressionVariableCasingDiagnosticCode;
      const isInvalidProperty = diagnostic.code === invalidVariablePropertyDiagnosticCode;
      const action = new vscode.CodeAction(
        isIncorrectCasing
          ? `Use canonical expression casing '${replacementName}'`
          : `Use index syntax variables['${replacementName}']`,
        vscode.CodeActionKind.QuickFix,
      );
      action.diagnostics = [diagnostic];
      action.edit = new vscode.WorkspaceEdit();
      const editRange = isInvalidProperty
        ? new vscode.Range(
            diagnostic.range.start.line,
            diagnostic.range.start.character - 1,
            diagnostic.range.end.line,
            diagnostic.range.end.character,
          )
        : diagnostic.range;
      const replacement = isInvalidProperty
        ? `['${replacementName}']`
        : isIncorrectCasing
          ? replacementName
          : `'${replacementName}'`;
      action.edit.replace(document.uri, editRange, replacement);
      action.isPreferred = true;
      return [action];
    });
  }
}
