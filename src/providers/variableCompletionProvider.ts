import * as vscode from 'vscode';
import { predefinedVariables } from '../catalog/predefinedVariables';
import { findCompletionContext } from '../language/completionContext';
import { collectDocumentVariables } from '../language/documentVariables';
import type { PipelineVariable } from '../model/variable';

const CONFIGURATION_SECTION = 'azurePipelinesFieldGuide';

export class VariableCompletionProvider implements vscode.CompletionItemProvider {
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionList | undefined {
    const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION, document.uri);
    if (!configuration.get<boolean>('completions.enabled', true)) {
      return undefined;
    }

    const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
    const context = findCompletionContext(
      linePrefix,
      document.getText(),
      document.offsetAt(new vscode.Position(position.line, 0)),
    );
    if (context === undefined) {
      return undefined;
    }

    const variables = new Map(
      predefinedVariables.map((variable) => [variable.name.toLowerCase(), variable]),
    );

    if (configuration.get<boolean>('completions.includeDocumentVariables', true)) {
      for (const variable of collectDocumentVariables(document.getText())) {
        variables.set(variable.name.toLowerCase(), variable);
      }
    }

    const range = new vscode.Range(
      position.line,
      context.replaceStart,
      position.line,
      context.replaceEnd,
    );
    const items = [...variables.values()]
      .filter(
        (variable) =>
          context.syntax !== 'property' || /^[A-Za-z_][A-Za-z0-9_]*$/u.test(variable.name),
      )
      .filter((variable) => startsWithIgnoreCase(variable.name, context.typedName))
      .map((variable) => createCompletionItem(variable, range));

    return new vscode.CompletionList(items, false);
  }
}

function createCompletionItem(
  variable: PipelineVariable,
  range: vscode.Range,
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(variable.name, vscode.CompletionItemKind.Variable);
  item.insertText = variable.name;
  item.filterText = variable.name;
  item.range = range;
  item.sortText = `${variable.source === 'document' ? '0' : '1'}-${variable.name}`;
  item.detail =
    variable.source === 'document'
      ? 'Azure Pipelines variable · Current document'
      : 'Azure Pipelines predefined variable';

  const documentation = new vscode.MarkdownString(variable.description);
  documentation.appendMarkdown('\n\nUse in Azure Pipelines as:');
  documentation.appendMarkdown(`\n\n- Macro: \`$(${variable.name})\``);
  documentation.appendMarkdown(`\n- Expression: \`variables['${variable.name}']\``);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(variable.name)) {
    documentation.appendMarkdown(`\n- Property: \`variables.${variable.name}\``);
  }
  if (variable.availableInTemplates !== undefined) {
    documentation.appendMarkdown(
      `\n\nAvailable in templates: **${variable.availableInTemplates ? 'Yes' : 'No'}**`,
    );
  }
  if (variable.documentationUrl !== undefined) {
    documentation.appendMarkdown(
      `\n\n[Open this variable in the Azure Pipelines documentation](${variable.documentationUrl})`,
    );
  }
  if (variable.environmentVariableName !== undefined) {
    documentation.appendMarkdown(
      `\n\nEnvironment variable: \`${variable.environmentVariableName}\``,
    );
  }
  item.documentation = documentation;

  return item;
}

function startsWithIgnoreCase(value: string, prefix: string): boolean {
  return value.toLowerCase().startsWith(prefix.toLowerCase());
}
