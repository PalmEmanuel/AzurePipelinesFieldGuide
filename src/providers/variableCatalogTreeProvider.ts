import * as vscode from 'vscode';
import { predefinedVariables } from '../catalog/predefinedVariables';
import type { PipelineVariable } from '../model/variable';

type CatalogNode = NamespaceNode | VariableCatalogNode | VariableDetailNode;

interface NamespaceNode {
  readonly kind: 'namespace';
  readonly name: string;
  readonly variables: readonly PipelineVariable[];
}

export interface VariableCatalogNode {
  readonly kind: 'variable';
  readonly variable: PipelineVariable;
}

interface VariableDetailNode {
  readonly kind: 'detail';
  readonly variable: PipelineVariable;
}

export class VariableCatalogTreeProvider
  implements vscode.TreeDataProvider<CatalogNode>, vscode.Disposable
{
  private readonly changeEmitter = new vscode.EventEmitter<
    CatalogNode | undefined | null | void
  >();

  public readonly onDidChangeTreeData = this.changeEmitter.event;

  private readonly namespaces: readonly NamespaceNode[] = buildNamespaces();

  public getTreeItem(element: CatalogNode): vscode.TreeItem {
    if (element.kind === 'namespace') {
      const item = new vscode.TreeItem(
        element.name,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.contextValue = 'azurePipelinesVariableNamespace';
      item.description = `${element.variables.length} variables`;
      return item;
    }

    if (element.kind === 'variable') {
      const item = new vscode.TreeItem(
        element.variable.name,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.contextValue = /^[A-Za-z_][A-Za-z0-9_]*$/u.test(element.variable.name)
        ? 'azurePipelinesVariable.simple'
        : 'azurePipelinesVariable';
      item.description = compactDescription(element.variable.description);
      item.tooltip = createTooltip(element.variable);
      return item;
    }

    return createDetailItem(element);
  }

  public getChildren(element?: CatalogNode): CatalogNode[] {
    if (element === undefined) {
      return [...this.namespaces];
    }
    if (element.kind === 'namespace') {
      return element.variables.map((variable) => ({ kind: 'variable', variable }));
    }
    if (element.kind === 'variable') {
      return [{ kind: 'detail', variable: element.variable }];
    }
    return [];
  }

  public refresh(): void {
    this.changeEmitter.fire();
  }

  public dispose(): void {
    this.changeEmitter.dispose();
  }
}

function buildNamespaces(): readonly NamespaceNode[] {
  const grouped = new Map<string, PipelineVariable[]>();
  for (const variable of predefinedVariables) {
    const namespace = variable.name.split('.')[0] ?? 'Other';
    const variables = grouped.get(namespace) ?? [];
    variables.push(variable);
    grouped.set(namespace, variables);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, variables]) => ({
      kind: 'namespace',
      name,
      variables: variables.sort((left, right) => left.name.localeCompare(right.name)),
    }));
}

function createTooltip(variable: PipelineVariable): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString();
  tooltip.appendCodeblock(variable.name, 'azure-pipelines');
  tooltip.appendMarkdown(variable.description);
  tooltip.appendMarkdown('\n\nUse in Azure Pipelines as:');
  tooltip.appendMarkdown(`\n\n- Macro: \`$(${variable.name})\``);
  tooltip.appendMarkdown(`\n- Expression: \`variables['${variable.name}']\``);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(variable.name)) {
    tooltip.appendMarkdown(`\n- Property: \`variables.${variable.name}\``);
  }
  tooltip.appendMarkdown(
    `\n\n_Source: ${variable.source === 'document' ? 'current document' : 'Azure Pipelines predefined variable'}_`,
  );
  tooltip.appendMarkdown(
    `\n\nAvailable in templates: **${variable.availableInTemplates ? 'Yes' : 'No'}**`,
  );
  if (variable.environmentVariableName !== undefined) {
    tooltip.appendMarkdown(`\n\nEnvironment variable: \`${variable.environmentVariableName}\``);
  }
  if (variable.documentationUrl !== undefined) {
    tooltip.appendMarkdown(`\n\n[Open official documentation](${variable.documentationUrl})`);
  }
  return tooltip;
}

function createDetailItem(element: VariableDetailNode): vscode.TreeItem {
  const variable = element.variable;
  const item = new vscode.TreeItem(
    'View description and documentation',
    vscode.TreeItemCollapsibleState.None,
  );
  item.contextValue = 'azurePipelinesVariableDetails';
  item.description = 'Open the full Markdown details';
  item.tooltip = createTooltip(variable);
  if (variable.documentationUrl !== undefined) {
    item.command = {
      command: 'vscode.open',
      title: 'Open official Microsoft Learn documentation',
      arguments: [vscode.Uri.parse(variable.documentationUrl)],
    };
  }
  return item;
}

function compactDescription(description: string): string {
  const plainText = plainDescription(description);
  return plainText.length > 120 ? `${plainText.slice(0, 117)}…` : plainText;
}

function plainDescription(description: string): string {
  return description
    .replace(/`([^`]*)`/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}
