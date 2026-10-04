import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { predefinedVariables } from '../../catalog/predefinedVariables';
import { renderVariableCatalogBody } from '../../providers/variableCatalogWebviewProvider';

suite('Azure Pipelines Field Guide integration', () => {
  let document: vscode.TextDocument;
  let extension: vscode.Extension<unknown>;

  suiteSetup(async () => {
    const fixture = vscode.Uri.joinPath(
      vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(process.cwd()),
      'azure-pipelines.yml',
    );
    document = await vscode.workspace.openTextDocument(fixture);
    await vscode.window.showTextDocument(document);

    const loadedExtension = vscode.extensions.getExtension(
      'PalmEmanuel.azure-pipelines-field-guide-vscode',
    );
    assert.ok(loadedExtension, 'The extension should be available in the Extension Host');
    extension = loadedExtension;
    await extension.activate();
  });

  test('the official extension assigns the Azure Pipelines language', () => {
    assert.equal(document.languageId, 'azure-pipelines');
  });

  test('provides a custom catalog webview with full variable details', () => {
    const catalogHtml = renderVariableCatalogBody(predefinedVariables);
    assert.match(catalogHtml, /Build\.BuildId/);
    assert.match(catalogHtml, /ID of the record for the completed build/);
    assert.match(catalogHtml, /\$\(Build\.BuildId\)/);
    assert.match(catalogHtml, /BUILD_BUILDID/);
    assert.match(catalogHtml, /data-syntax="environment"/);
    assert.match(catalogHtml, /data-action="openCopyMenu"/);
    assert.doesNotMatch(catalogHtml, /data-action="copy"/);
    assert.doesNotMatch(catalogHtml, /class="namespace"/);
    assert.match(catalogHtml, /Open official documentation/);

    const packageJson = extension.packageJSON as {
      contributes?: {
        commands?: Array<{ command: string; title: string; icon?: string }>;
        views?: {
          explorer?: Array<{ id: string; name: string; type?: string; icon?: string }>;
        };
      };
    };
    const catalogView = packageJson.contributes?.views?.explorer?.find(
      ({ id }) => id === 'azurePipelinesFieldGuide.variables',
    );
    assert.deepEqual(catalogView, {
      id: 'azurePipelinesFieldGuide.variables',
      name: 'Azure Pipelines Variables',
      type: 'webview',
      icon: 'AzurePipelinesFieldGuide.png',
    });
    assert.equal(
      packageJson.contributes?.commands?.some(({ command }) => command.includes('.copy.')),
      false,
    );
  });

  test('offers predefined variables after a namespace prefix', async () => {
    const line = document.lineAt(6).text;
    const position = new vscode.Position(6, line.indexOf(')'));
    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      document.uri,
      position,
    );

    const buildId = completions.items.find(
      (item) => completionLabel(item) === 'Build.BuildId',
    );
    assert.ok(buildId);
    assert.ok(completions.items.some((item) => completionLabel(item) === 'Build.SourceBranch'));
    assert.ok(completions.items.every((item) => completionLabel(item).startsWith('Build.')));
    assert.ok(buildId.documentation instanceof vscode.MarkdownString);
    assert.match(buildId.documentation.value, /Available in templates: \*\*No\*\*/);
    assert.match(buildId.documentation.value, /Environment variable: `BUILD_BUILDID`/);
    assert.match(buildId.documentation.value, /Macro: `\$\(Build\.BuildId\)`/);
    assert.match(buildId.documentation.value, /#build-variables/);
    assert.match(buildId.documentation.value, /wt\.mc_id=DT-MVP-5005372/);
    assert.doesNotMatch(buildId.documentation.value, /github\.com\/MicrosoftDocs/);
  });

  test('offers variables declared in the document', async () => {
    const line = document.lineAt(7).text;
    const position = new vscode.Position(7, line.indexOf(')'));
    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      document.uri,
      position,
    );

    assert.ok(
      completions.items.some((item) => completionLabel(item) === 'buildConfiguration'),
    );
  });

  test('offers simple document variables through property syntax', async () => {
    const line = document.lineAt(16).text;
    const position = new vscode.Position(16, line.indexOf(','));
    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      document.uri,
      position,
    );

    assert.ok(completions.items.some((item) => completionLabel(item) === 'buildConfiguration'));
    assert.ok(completions.items.every((item) => /^[A-Za-z_][A-Za-z0-9_]*$/u.test(completionLabel(item))));
  });

  test('warns about unquoted variable indexes and offers a quoting quick fix', async () => {
    const lineNumber = 12;
    const line = document.lineAt(lineNumber).text;
    const name = 'build.BuildId';
    const start = line.indexOf(name);
    const range = new vscode.Range(lineNumber, start, lineNumber, start + name.length);
    const diagnostic = vscode.languages
      .getDiagnostics(document.uri)
      .find((candidate) => candidate.range.isEqual(range));

    assert.ok(diagnostic);
    assert.equal(diagnostic.severity, vscode.DiagnosticSeverity.Warning);
    assert.match(diagnostic.message, /must quote the name/);

    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      document.uri,
      range,
      vscode.CodeActionKind.QuickFix.value,
    );
    const fix = actions.find((action) => action.title.includes("variables['Build.BuildId']"));
    assert.ok(fix?.edit);
    assert.equal(fix.isPreferred, true);
    assert.deepEqual(fix.edit.get(document.uri), [
      vscode.TextEdit.replace(range, "'Build.BuildId'"),
    ]);
  });

  test('warns about noncanonical casing only in expression syntax', async () => {
    const lineNumber = 14;
    const line = document.lineAt(lineNumber).text;
    const name = 'build.BuildId';
    const start = line.indexOf(name);
    const range = new vscode.Range(lineNumber, start, lineNumber, start + name.length);
    const diagnostic = vscode.languages
      .getDiagnostics(document.uri)
      .find((candidate) => candidate.range.isEqual(range));

    assert.ok(diagnostic);
    assert.match(diagnostic.message, /must match 'Build\.BuildId'/);

    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      document.uri,
      range,
      vscode.CodeActionKind.QuickFix.value,
    );
    const fix = actions.find((action) => action.title.includes("'Build.BuildId'"));
    assert.ok(fix?.edit);
    assert.deepEqual(fix.edit.get(document.uri), [
      vscode.TextEdit.replace(range, 'Build.BuildId'),
    ]);
  });

  test('warns about invalid property dereference and offers index syntax', async () => {
    const lineNumber = 18;
    const line = document.lineAt(lineNumber).text;
    const name = 'Build.BuildId';
    const start = line.indexOf(name);
    const range = new vscode.Range(lineNumber, start, lineNumber, start + name.length);
    const diagnostic = vscode.languages
      .getDiagnostics(document.uri)
      .find((candidate) => candidate.range.isEqual(range));

    assert.ok(diagnostic);
    assert.match(diagnostic.message, /requires a simple name/);

    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
      'vscode.executeCodeActionProvider',
      document.uri,
      range,
      vscode.CodeActionKind.QuickFix.value,
    );
    const fix = actions.find((action) => action.title.includes("variables['Build.BuildId']"));
    assert.ok(fix?.edit);
    const propertyEditRange = new vscode.Range(
      range.start.line,
      range.start.character - 1,
      range.end.line,
      range.end.character,
    );
    assert.deepEqual(fix.edit.get(document.uri), [
      vscode.TextEdit.replace(propertyEditRange, "['Build.BuildId']"),
    ]);
  });

  test('shows generated descriptions and official links on hover', async () => {
    const line = document.lineAt(8).text;
    const position = new vscode.Position(8, line.indexOf('BuildId'));
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      document.uri,
      position,
    );
    const markdown = hovers
      .flatMap((hover) => hover.contents)
      .map(hoverContent)
      .join('\n');

    assert.match(markdown, /ID of the record for the completed build/);
    assert.match(markdown, /Available in templates: \*\*No\*\*/);
    assert.match(markdown, /#build-variables/);
    assert.match(markdown, /wt\.mc_id=DT-MVP-5005372/);
    assert.doesNotMatch(markdown, /github\.com\/MicrosoftDocs/);
  });

  test('provides semantic highlighting only for recognized references', async () => {
    const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
      'vscode.provideDocumentSemanticTokens',
      document.uri,
    );

    assert.ok(tokens);
    assert.equal(
      tokens.data.length,
      30,
      'Expected six recognized variable references in valid syntax',
    );
  });

  test('diagnoses casing inside a multiline condition but ignores comments', () => {
    const lineNumber = 23;
    const line = document.lineAt(lineNumber).text;
    const name = 'build.BuildId';
    const start = line.indexOf(name);
    const range = new vscode.Range(lineNumber, start, lineNumber, start + name.length);
    const diagnostic = vscode.languages
      .getDiagnostics(document.uri)
      .find((candidate) => candidate.range.isEqual(range));

    assert.ok(diagnostic);
    assert.match(diagnostic.message, /must match 'Build\.BuildId'/);
    assert.equal(
      vscode.languages
        .getDiagnostics(document.uri)
        .some((candidate) => candidate.range.start.line === 24),
      false,
    );
  });

});

function completionLabel(item: vscode.CompletionItem): string {
  return typeof item.label === 'string' ? item.label : item.label.label;
}

function hoverContent(content: vscode.MarkdownString | vscode.MarkedString): string {
  if (typeof content === 'string') {
    return content;
  }
  return content instanceof vscode.MarkdownString ? content.value : content.value;
}
