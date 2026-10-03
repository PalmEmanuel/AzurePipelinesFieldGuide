import * as vscode from 'vscode';
import { predefinedVariablesByName } from '../catalog/predefinedVariables';
import { collectDocumentVariables } from '../language/documentVariables';
import { findVariableReferences } from '../language/variableReferences';
import type { PipelineVariable } from '../model/variable';

const CONFIGURATION_SECTION = 'azurePipelinesFieldGuide';

export class VariableHoverProvider implements vscode.HoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION, document.uri);
    if (!configuration.get<boolean>('hovers.enabled', true)) {
      return undefined;
    }

    const lineStart = document.offsetAt(new vscode.Position(position.line, 0));
    const reference = findVariableReferences(
      document.lineAt(position.line).text,
      document.getText(),
      lineStart,
    ).find(
      ({ start, end }) => position.character >= start && position.character <= end,
    );
    if (reference === undefined) {
      return undefined;
    }

    const variable =
      collectDocumentVariables(document.getText()).find(
        (candidate) => candidate.name.toLowerCase() === reference.name.toLowerCase(),
      ) ?? predefinedVariablesByName.get(reference.name.toLowerCase());
    if (variable === undefined) {
      return undefined;
    }

    return new vscode.Hover(
      createHoverContent(variable),
      new vscode.Range(position.line, reference.start, position.line, reference.end),
    );
  }
}

function createHoverContent(variable: PipelineVariable): vscode.MarkdownString {
  const content = new vscode.MarkdownString();
  content.appendCodeblock(variable.name, 'azure-pipelines');
  content.appendMarkdown(variable.description);
  content.appendMarkdown('\n\nUse in Azure Pipelines as:');
  content.appendMarkdown(`\n\n- Macro: \`$(${variable.name})\``);
  content.appendMarkdown(`\n- Expression: \`variables['${variable.name}']\``);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(variable.name)) {
    content.appendMarkdown(`\n- Property: \`variables.${variable.name}\``);
  }
  content.appendMarkdown(
    `\n\n_Source: ${variable.source === 'document' ? 'current document' : 'Azure Pipelines predefined variable'}_`,
  );
  if (variable.availableInTemplates !== undefined) {
    content.appendMarkdown(
      `\n\nAvailable in templates: **${variable.availableInTemplates ? 'Yes' : 'No'}**`,
    );
  }
  if (variable.documentationUrl !== undefined) {
    content.appendMarkdown(
      `\n\n[Open this variable in the official documentation](${variable.documentationUrl})`,
    );
  }
  if (variable.environmentVariableName !== undefined) {
    content.appendMarkdown(
      `\n\nEnvironment variable: \`${variable.environmentVariableName}\``,
    );
  }
  return content;
}
