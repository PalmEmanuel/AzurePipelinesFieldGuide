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

  test('provides a custom catalog webview with full variable details', async () => {
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
        viewsContainers?: {
          activitybar?: Array<{ id: string; title: string; icon: string }>;
        };
        views?: {
          azurePipelinesFieldGuide?: Array<{
            id: string;
            name: string;
            type?: string;
            icon?: string;
            contextualTitle?: string;
          }>;
        };
      };
    };
    assert.deepEqual(packageJson.contributes?.viewsContainers?.activitybar, [
      {
        id: 'azurePipelinesFieldGuide',
        title: 'Azure Pipelines Field Guide',
        icon: 'assets/AzurePipelinesFieldGuide.svg',
      },
    ]);
    const catalogView = packageJson.contributes?.views?.azurePipelinesFieldGuide?.find(
      ({ id }) => id === 'azurePipelinesFieldGuide.variables',
    );
    assert.deepEqual(catalogView, {
      id: 'azurePipelinesFieldGuide.variables',
      name: 'Azure Pipelines Variables',
      type: 'webview',
      icon: 'assets/AzurePipelinesFieldGuide.svg',
      contextualTitle: 'Azure Pipelines Variables',
    });
    assert.equal(
      packageJson.contributes?.commands?.some(({ command }) => command.includes('.copy.')),
      false,
    );
    await vscode.commands.executeCommand('azurePipelinesFieldGuide.browseVariables');
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

  test('offers only declared parameters in valid template-expression syntax', async () => {
    const parameterDocument = await vscode.workspace.openTextDocument({
      language: 'azure-pipelines',
      content: `parameters:
- name: releaseStage
  type: string
- name: buildConfiguration
  type: string
steps:
- script: echo \${{ parameters.releaseS }}
- script: echo parameters.releaseS
- script: echo $[ parameters.releaseS ]
- script: echo \${{ variables.parameters.releaseS }}
- script: echo \${{ eq('parameters.releaseS', 'other') }}
`,
    });

    const getCompletions = async (
      lineNumber: number,
      marker: string,
    ): Promise<vscode.CompletionList> => {
      const line = parameterDocument.lineAt(lineNumber).text;
      return vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        parameterDocument.uri,
        new vscode.Position(lineNumber, line.indexOf(marker) + marker.length),
      );
    };

    const validCompletions = await getCompletions(6, 'releaseS');
    const releaseStage = validCompletions.items.find(
      (item) => completionLabel(item) === 'releaseStage',
    );
    const parameterItems = validCompletions.items.filter(
      (item) => item.detail === 'Azure Pipelines template parameter · Current document',
    );
    assert.ok(releaseStage);
    assert.ok(
      parameterItems.every((item) => completionLabel(item).startsWith('releaseS')),
    );
    assert.equal(
      releaseStage.detail,
      'Azure Pipelines template parameter · Current document',
    );
    assert.match(
      (releaseStage.documentation as vscode.MarkdownString).value,
      /\$\{\{ parameters\.releaseStage \}\}/,
    );

    for (const lineNumber of [7, 8, 9, 10]) {
      const completions = await getCompletions(lineNumber, 'releaseS');
      assert.equal(
        completions.items.some(
          (item) =>
            item.detail === 'Azure Pipelines template parameter · Current document' &&
            completionLabel(item) === 'releaseStage',
        ),
        false,
        `Unexpected parameter completion on line ${lineNumber + 1}`,
      );
    }
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

  test('offers typed allowed values in defaults and compile-time comparisons', async () => {
    const content = [
      'parameters:',
      '- name: configuration',
      '  type: string',
      '  default: "Re"',
      '  values: [Debug, Release]',
      '- name: enabled',
      '  type: boolean',
      '  values: [true, false]',
      'steps:',
      "- script: echo ${{ eq(parameters.configuration, 'Re') }}",
      '- script: echo ${{ eq(parameters.enabled, ) }}',
      "- script: echo $[ eq(parameters.configuration, 'Re') ]",
      "# ${{ eq(parameters.configuration, 'Re') }}",
      '- template: build.yml',
      '  parameters:',
      '    default: "Re"',
    ].join('\n');
    const valueDocument = await vscode.workspace.openTextDocument({
      language: 'azure-pipelines', content,
    });
    const getItems = async (
      line: number,
      marker: string,
    ): Promise<vscode.CompletionItem[]> => {
      const lineText = valueDocument.lineAt(line).text;
      const result = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        valueDocument.uri,
        new vscode.Position(line, lineText.indexOf(marker) + marker.length),
      );
      return result.items.filter((item) => item.detail?.startsWith('Allowed value for parameter '));
    };

    const defaultItems = await getItems(3, '"Re');
    assert.deepEqual(defaultItems.map(completionLabel), ['Release']);
    assert.equal(defaultItems[0]?.insertText, '"Release"');
    assert.deepEqual(defaultItems[0]?.range, new vscode.Range(3, 11, 3, 15));

    const expressionItems = await getItems(9, "'Re");
    assert.deepEqual(expressionItems.map(completionLabel), ['Release']);
    assert.equal(expressionItems[0]?.insertText, "'Release'");

    const booleans = await getItems(10, 'parameters.enabled, ');
    assert.deepEqual(booleans.map((item) => item.insertText).sort(), ['false', 'true']);

    for (const line of [11, 12, 15]) {
      assert.deepEqual(await getItems(line, 'Re'), []);
    }
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

  test('highlights parameter references and typed values without false positives', async () => {
    const lines = [
      'parameters:',
      '- name: configuration',
      '  type: string',
      '  default: Release',
      '  values: [Debug, Release]',
      '- name: enabled',
      '  type: boolean',
      '  values: [true, false]',
      '- name: count',
      '  type: number',
      '  values: [1, 2]',
      'steps:',
      "- script: echo ${{ eq(parameters.configuration, 'Release') }}",
      '- script: echo ${{ eq(parameters.enabled, true) }}',
      '- script: echo ${{ eq(parameters.count, 2) }}',
      "# ${{ eq(parameters.configuration, 'Release') }}",
      "- script: echo $[ eq(parameters.configuration, 'Release') ]",
      "- script: echo ${{ 'parameters.configuration' }}",
      '- script: echo ${{ parameters.unknown }}',
    ];
    const parameterDocument = await vscode.workspace.openTextDocument({
      language: 'azure-pipelines', content: lines.join('\n'),
    });
    const legend = await vscode.commands.executeCommand<vscode.SemanticTokensLegend>(
      'vscode.provideDocumentSemanticTokensLegend', parameterDocument.uri,
    );
    const tokens = await vscode.commands.executeCommand<vscode.SemanticTokens>(
      'vscode.provideDocumentSemanticTokens', parameterDocument.uri,
    );
    assert.ok(legend);
    assert.ok(tokens);
    const decoded: Array<{ line: number; text: string; type: string; readonly: boolean }> = [];
    let line = 0;
    let column = 0;
    for (let index = 0; index < tokens.data.length; index += 5) {
      const deltaLine = tokens.data[index] ?? 0;
      line += deltaLine;
      column = (deltaLine === 0 ? column : 0) + (tokens.data[index + 1] ?? 0);
      decoded.push({
        line,
        text: (lines[line] ?? '').slice(column, column + (tokens.data[index + 2] ?? 0)),
        type: legend.tokenTypes[tokens.data[index + 3] ?? 0] ?? '',
        readonly: ((tokens.data[index + 4] ?? 0) &
          (1 << legend.tokenModifiers.indexOf('readonly'))) !== 0,
      });
    }
    assert.deepEqual(decoded.filter((token) => token.line >= 12), [
      { line: 12, text: 'configuration', type: 'parameter', readonly: true },
      { line: 12, text: "'Release'", type: 'string', readonly: false },
      { line: 13, text: 'enabled', type: 'parameter', readonly: true },
      { line: 13, text: 'true', type: 'keyword', readonly: false },
      { line: 14, text: 'count', type: 'parameter', readonly: true },
      { line: 14, text: '2', type: 'number', readonly: false },
    ]);
    assert.equal(decoded.filter((token) => token.line < 12).length, 7);
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
