import * as vscode from 'vscode';
import { predefinedVariablesByName } from '../catalog/predefinedVariables';
import { collectDocumentVariables } from '../language/documentVariables';
import { findVariableReferences } from '../language/variableReferences';
import { findParameterReferences } from '../language/parameterReferences';
import { findParameterValueReferences } from '../language/parameterValues';

export const variableSemanticTokensLegend = new vscode.SemanticTokensLegend(
  ['variable', 'parameter', 'string', 'number', 'keyword'],
  ['readonly', 'defaultLibrary'],
);

export class VariableSemanticTokensProvider
  implements vscode.DocumentSemanticTokensProvider
{
  public provideDocumentSemanticTokens(
    document: vscode.TextDocument,
  ): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(variableSemanticTokensLegend);
    const text = document.getText();
    const documentVariables = new Set(
      collectDocumentVariables(text).map((variable) =>
        variable.name.toLowerCase(),
      ),
    );

    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber += 1) {
      const line = document.lineAt(lineNumber).text;
      for (const reference of findVariableReferences(
        line,
        text,
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

    for (const reference of findParameterReferences(text)) {
      builder.push(
        new vscode.Range(document.positionAt(reference.start), document.positionAt(reference.end)),
        'parameter',
        ['readonly'],
      );
    }
    for (const reference of findParameterValueReferences(text)) {
      builder.push(
        new vscode.Range(document.positionAt(reference.start), document.positionAt(reference.end)),
        reference.type === 'boolean' ? 'keyword' : reference.type,
      );
    }

    return builder.build();
  }
}
