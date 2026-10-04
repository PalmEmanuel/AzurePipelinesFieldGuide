import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { predefinedVariables, predefinedVariablesByName } from '../catalog/predefinedVariables';
import {
  formatVariableSyntax,
  type VariableCopySyntax,
} from '../language/variableCopyCommands';
import type { PipelineVariable } from '../model/variable';

export const VARIABLE_CATALOG_VIEW_TYPE = 'azurePipelinesFieldGuide.variables';

export class VariableCatalogWebviewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  private view: vscode.WebviewView | undefined;
  private messageSubscription: vscode.Disposable | undefined;
  private disposeSubscription: vscode.Disposable | undefined;

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = renderVariableCatalogHtml(webviewView.webview);

    this.messageSubscription?.dispose();
    this.disposeSubscription?.dispose();
    this.messageSubscription = webviewView.webview.onDidReceiveMessage((message: unknown) => {
      void this.handleMessage(message);
    });
    this.disposeSubscription = webviewView.onDidDispose(() => {
      if (this.view === webviewView) {
        this.view = undefined;
      }
    });
  }

  public dispose(): void {
    this.messageSubscription?.dispose();
    this.disposeSubscription?.dispose();
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isRecord(message) || typeof message.name !== 'string') {
      return;
    }

    const variable = predefinedVariablesByName.get(message.name.toLowerCase());
    if (variable === undefined) {
      return;
    }

    if (message.type === 'copy' && isVariableCopySyntax(message.syntax)) {
      if (message.syntax === 'property' && !isSimpleVariableName(variable.name)) {
        return;
      }
      await vscode.env.clipboard.writeText(
        formatVariableSyntax(message.syntax, variable.name),
      );
      return;
    }

    if (
      message.type === 'openDocumentation' &&
      variable.documentationUrl !== undefined
    ) {
      await vscode.env.openExternal(vscode.Uri.parse(variable.documentationUrl));
    }
  }
}

export function renderVariableCatalogHtml(webview: vscode.Webview): string {
  const nonce = randomBytes(16).toString('hex');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.5;
      margin: 0;
      padding: 8px;
    }
    #catalog {
      padding-left: 24px;
    }
    header {
      padding-bottom: 6px;
    }
    h1, h3 {
      font-weight: 600;
      line-height: 1.3;
    }
    h1 {
      font-size: 1.1em;
      margin: 0 0 3px;
    }
    h3 {
      font-size: 0.9em;
      margin: 9px 0 4px;
    }
    p {
      margin: 0 0 8px;
    }
    .intro, .metadata, .empty {
      color: var(--vscode-descriptionForeground);
    }
    .intro {
      font-size: 0.9em;
      margin-bottom: 7px;
    }
    .search {
      box-sizing: border-box;
      width: 100%;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      color: var(--vscode-input-foreground);
      padding: 5px 7px;
    }
    .search:focus {
      border-color: var(--vscode-focusBorder);
      outline: 1px solid var(--vscode-focusBorder);
    }
    .variable-card {
      border-bottom: 1px solid var(--vscode-tree-tableColumnsBorder, transparent);
      padding: 1px 0;
    }
    .variable-card > summary {
      color: var(--vscode-list-foreground, var(--vscode-foreground));
      cursor: pointer;
      list-style-position: outside;
      overflow-wrap: anywhere;
      padding: 2px 0;
    }
    .variable-card > summary:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .variable-name {
      color: inherit;
      font-family: var(--vscode-editor-font-family);
    }
    .variable-body {
      padding: 3px 6px 6px 6px;
    }
    .description {
      overflow-wrap: anywhere;
    }
    code {
      color: var(--vscode-textPreformat-foreground);
      background: var(--vscode-textCodeBlock-background);
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
      padding: 1px 4px;
      overflow-wrap: anywhere;
    }
    .syntax-list {
      display: grid;
      gap: 4px;
      margin-bottom: 8px;
    }
    .syntax-row {
      align-items: center;
      display: flex;
      gap: 4px;
    }
    .syntax-row code {
      flex: 1;
      min-width: 0;
    }
    button {
      appearance: none;
      background: var(--vscode-button-background);
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 2px;
      color: var(--vscode-button-foreground);
      cursor: pointer;
      font: inherit;
      line-height: 1.2;
      padding: 2px 6px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    .metadata {
      font-size: 0.9em;
    }
    .metadata p {
      margin-bottom: 5px;
    }
    .documentation {
      margin-top: 8px;
    }
    .syntax-heading {
      align-items: center;
      display: flex;
      justify-content: space-between;
    }
    a {
      color: var(--vscode-textLink-foreground);
    }
    ul {
      padding-left: 20px;
    }
    .context-menu {
      background: var(--vscode-menu-background);
      border: 1px solid var(--vscode-menu-border, transparent);
      box-sizing: border-box;
      box-shadow: 0 2px 8px var(--vscode-widget-shadow);
      display: grid;
      max-width: calc(100vw - 24px);
      min-width: min(220px, calc(100vw - 24px));
      padding: 3px 0;
      position: fixed;
      z-index: 10;
      width: max-content;
    }
    .context-menu[hidden] {
      display: none;
    }
    .context-menu button {
      background: transparent;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      color: var(--vscode-menu-foreground);
      overflow: hidden;
      padding: 3px 6px;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }
    .context-menu button + button {
      position: relative;
    }
    .context-menu button + button::before {
      border-top: 1px solid var(--vscode-menu-separatorBackground, var(--vscode-menu-border, transparent));
      content: '';
      left: 8px;
      position: absolute;
      right: 8px;
      top: 0;
    }
    .context-menu button:hover,
    .context-menu button:focus-visible {
      background: var(--vscode-menu-selectionBackground);
      color: var(--vscode-menu-selectionForeground);
    }
  </style>
</head>
<body>
  <header>
    <h1>Azure Pipelines Variables</h1>
    <p class="intro">Browse predefined variables. Expand one for its full description, syntax, and documentation.</p>
    <input class="search" id="search" type="search" placeholder="Filter variables" aria-label="Filter variables">
  </header>
  <main id="catalog">
    ${renderVariableCatalogBody(predefinedVariables)}
  </main>
  <div class="context-menu" id="context-menu" role="menu" hidden></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const contextMenu = document.getElementById('context-menu');
    let activeVariable = null;

    function hideContextMenu() {
      contextMenu.hidden = true;
      contextMenu.replaceChildren();
      activeVariable = null;
    }

    function showContextMenuAt(x, y, card, alignRight) {
      activeVariable = card.dataset.name;
      contextMenu.replaceChildren();
      card.querySelectorAll('.syntax-row[data-syntax]').forEach((syntaxRow) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.role = 'menuitem';
        option.textContent = 'Copy as "' + syntaxRow.dataset.value + '"';
        option.title = option.textContent;
        option.addEventListener('click', () => {
          vscode.postMessage({
            type: 'copy',
            name: activeVariable,
            syntax: syntaxRow.dataset.syntax,
          });
          hideContextMenu();
        });
        contextMenu.append(option);
      });
      contextMenu.hidden = false;
      const bounds = contextMenu.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const rightGutter = 16;
      const desiredLeft = alignRight ? x - bounds.width : x;
      const left = Math.max(4, Math.min(desiredLeft, viewportWidth - bounds.width - rightGutter));
      const top = Math.max(4, Math.min(y, viewportHeight - bounds.height - 4));
      contextMenu.style.left = left + 'px';
      contextMenu.style.top = top + 'px';
    }

    document.querySelectorAll('.variable-card').forEach((card) => {
      card.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        showContextMenuAt(event.clientX, event.clientY, card);
      });
    });

    document.querySelectorAll('button[data-action="openCopyMenu"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        const card = button.closest('.variable-card');
        if (!card) {
          return;
        }
        event.stopPropagation();
        const bounds = button.getBoundingClientRect();
        showContextMenuAt(bounds.right, bounds.bottom + 4, card, true);
      });
    });

    document.querySelectorAll('button[data-action="openDocumentation"]').forEach((button) => {
      button.addEventListener('click', () => {
        vscode.postMessage({ type: 'openDocumentation', name: button.dataset.name });
      });
    });

    document.getElementById('search').addEventListener('input', (event) => {
      const query = event.target.value.trim().toLowerCase();
      document.querySelectorAll('.variable-card').forEach((card) => {
        card.hidden = !card.dataset.search.includes(query);
      });
    });

    document.addEventListener('click', (event) => {
      if (!contextMenu.contains(event.target)) {
        hideContextMenu();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideContextMenu();
      }
    });
    window.addEventListener('blur', hideContextMenu);
  </script>
</body>
</html>`;
}

export function renderVariableCatalogBody(
  variables: readonly PipelineVariable[],
): string {
  return [...variables]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(renderVariableCard)
    .join('');
}

function renderVariableCard(variable: PipelineVariable): string {
  const templateAvailability = variable.availableInTemplates === undefined
    ? 'Not documented'
    : variable.availableInTemplates ? 'Yes' : 'No';
  const syntaxRows = copySyntaxesFor(variable)
    .map((syntax) => {
      const value = formatVariableSyntax(syntax, variable.name);
      return `<div class="syntax-row" data-syntax="${syntax}" data-value="${escapeHtml(value)}"><code>${escapeHtml(value)}</code></div>`;
    })
    .join('');
  const environmentVariable = variable.environmentVariableName === undefined
    ? ''
    : `<p>Environment variable: <code>${escapeHtml(variable.environmentVariableName)}</code></p>`;
  const documentation = variable.documentationUrl === undefined
    ? ''
    : `<div class="documentation"><button type="button" data-action="openDocumentation" data-name="${escapeHtml(variable.name)}">Open official documentation</button></div>`;

  return `<details class="variable-card" data-name="${escapeHtml(variable.name)}" data-search="${escapeHtml(`${variable.name} ${plainDescription(variable.description)}`.toLowerCase())}">
    <summary><span class="variable-name">${escapeHtml(variable.name)}</span></summary>
    <div class="variable-body">
      <div class="description">${renderMarkdown(variable.description)}</div>
      <div class="syntax-heading">
        <h3>Use in Azure Pipelines</h3>
        <button type="button" data-action="openCopyMenu" data-name="${escapeHtml(variable.name)}" title="Choose syntax to copy" aria-label="Choose syntax to copy">Copy…</button>
      </div>
      <div class="syntax-list">${syntaxRows}</div>
      <section class="metadata">
        <p>Source: ${variable.source === 'document' ? 'Current document' : 'Azure Pipelines predefined variable'}</p>
        <p>Available in templates: <strong>${templateAvailability}</strong></p>
        ${environmentVariable}
      </section>
      ${documentation}
    </div>
  </details>`;
}

function renderMarkdown(markdown: string): string {
  return markdown
    .split(/\n\s*\n/gu)
    .map((block) => {
      const lines = block.split(/\r?\n/gu).map((line) => line.trim()).filter(Boolean);
      if (lines.length > 0 && lines.every((line) => /^[-*]\s+/u.test(line))) {
        return `<ul>${lines
          .map((line) => `<li>${formatInlineMarkdown(line.replace(/^[-*]\s+/u, ''))}</li>`)
          .join('')}</ul>`;
      }
      return `<p>${lines.map(formatInlineMarkdown).join('<br>')}</p>`;
    })
    .join('');
}

function formatInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/gu, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gu,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
}

function plainDescription(description: string): string {
  return description
    .replace(/`([^`]*)`/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

function copySyntaxesFor(variable: PipelineVariable): readonly VariableCopySyntax[] {
  const syntaxes: VariableCopySyntax[] = isSimpleVariableName(variable.name)
    ? ['macro', 'expression', 'property']
    : ['macro', 'expression'];
  if (variable.environmentVariableName !== undefined) {
    syntaxes.push('environment');
  }
  return syntaxes;
}

function isSimpleVariableName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(name);
}

function isVariableCopySyntax(value: unknown): value is VariableCopySyntax {
  return value === 'macro' || value === 'expression' || value === 'property' || value === 'environment';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
