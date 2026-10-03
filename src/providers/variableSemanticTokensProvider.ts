import * as vscode from 'vscode';
import { predefinedVariablesByName } from '../catalog/predefinedVariables';
import { collectDocumentVariables } from '../language/documentVariables';
import { findVariableReferences } from '../language/variableReferences';

export const variableSemanticTokensLegend = new vscode.SemanticTokensLegend(
  ['variable'],
  ['readonly', 'defaultLibrary'],
);

export class VariableSemanticTokensProvider
  implements vscode.DocumentSemanticTokensProvider
{
  public provideDocumentSemanticTokens(
    document: vscode.TextDocument,
  ): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(variableSemanticTokensLegend);
    const documentVariables = new Set(
      collectDocumentVariables(document.getText()).map((variable) =>
        variable.name.toLowerCase(),
      ),
    );

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
      const line = document.lineAt(lineNumber).text;
      for (const reference of findVariableReferences(
        line,
        document.getText(),
        document.offsetAt(new vscode.Position(lineNumber, 0)),
      )) {
        const normalizedName = reference.name.toLowerCase();
        if (predefinedVariablesByName.has(normalizedName)) {
          builder.push(
            new vscode.Range(
              lineNumber,
              reference.start,
              lineNumber,
              reference.end,
            ),
            'variable',
            ['readonly', 'defaultLibrary'],
          );
        } else if (documentVariables.has(normalizedName)) {
          builder.push(
            new vscode.Range(
              lineNumber,
              reference.start,
              lineNumber,
              reference.end,
            ),
            'variable',
          );
        }
      }
    }

    return builder.build();
  }
}
