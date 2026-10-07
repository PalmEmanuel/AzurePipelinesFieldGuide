import * as vscode from 'vscode';
import { collectDocumentParameters } from '../language/documentParameters';
import { findParameterCompletionContext } from '../language/parameterCompletionContext';
import { findParameterValueCompletions } from '../language/parameterValues';

const CONFIGURATION_SECTION = 'azurePipelinesFieldGuide';

export class ParameterCompletionProvider implements vscode.CompletionItemProvider {
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionList | undefined {
    const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION, document.uri);
    if (!configuration.get<boolean>('completions.enabled', true)) {
      return undefined;
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
    const valueCompletions = findParameterValueCompletions(
      document.getText(), document.offsetAt(position),
    );
    if (valueCompletions.length !== 0) {
      return new vscode.CompletionList(valueCompletions.map((completion) => {
        const item = new vscode.CompletionItem(completion.label, vscode.CompletionItemKind.Value);
        item.insertText = completion.insertText;
        item.range = new vscode.Range(
          document.positionAt(completion.replaceStart), document.positionAt(completion.replaceEnd),
        );
        item.detail = `Allowed value for parameter ${completion.parameterName}`;
        return item;
      }), false);
    }
    const context = findParameterCompletionContext(
      linePrefix,
      document.getText(),
      document.offsetAt(new vscode.Position(position.line, 0)),
    );
    if (context === undefined) {
      return undefined;
    }

    const range = new vscode.Range(
      position.line,
      context.replaceStart,
      position.line,
      context.replaceEnd,
    );
    const items = collectDocumentParameters(document.getText())
      .filter((name) => startsWithIgnoreCase(name, context.typedName))
      .map((name) => createCompletionItem(name, range));

    return new vscode.CompletionList(items, false);
  }
}

function createCompletionItem(name: string, range: vscode.Range): vscode.CompletionItem {
  const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
  item.insertText = name;
  item.filterText = name;
  item.range = range;
  item.detail = 'Azure Pipelines template parameter · Current document';
  item.documentation = new vscode.MarkdownString(
    `Use this parameter in a compile-time template expression: \`\${{ parameters.${name} }}\`.`,
  );
  return item;
}

function startsWithIgnoreCase(value: string, prefix: string): boolean {
  return value.toLowerCase().startsWith(prefix.toLowerCase());
}
