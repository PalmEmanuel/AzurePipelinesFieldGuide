# Architecture

## Design goals

Field Guide is a small companion language feature provider. It should enhance Azure Pipelines editing without duplicating or interfering with Microsoft's parser, schema service, syntax grammar, authentication, or organization selection.

The dependency direction is deliberately simple:

```text
extension activation
  ├─ completion provider ─┬─ completion-context parser
  │                       ├─ document-variable collector
  │                       └─ predefined-variable catalog
  ├─ hover provider ──────┴─ shared variable model
  ├─ semantic-token provider ─ variable-reference parser
  ├─ variable catalog tree view ─ predefined-variable catalog
  ├─ shared case-insensitive variable lookup
  └─ invalid-syntax diagnostics + Quick Fix ─ expression-context parser
```

## Components

- `src/catalog/` contains static, reviewable Azure Pipelines reference data. It has no VS Code dependency.
- `src/language/` contains pure functions for recognizing supported expression syntax and discovering local declarations. Pure functions keep edge cases inexpensive to unit test.
- `src/language/sourceText.ts` provides offset-preserving YAML comment masking and document-aware multiline expression context detection.
- `src/providers/` adapts the language model to VS Code's completion, hover, semantic token, diagnostics, code action, and tree view APIs.
- `src/extension.ts` is the composition root. It registers providers only against `{ language: 'azure-pipelines' }`.
- `src/test/unit/` verifies pure language behavior.
- `src/test/integration/` verifies activation, official language ownership, and completion results inside an Extension Host.

## Why no YAML language contribution

The manifest declares `ms-azure-devops.azure-pipelines` in `extensionDependencies`. That extension contributes the `azure-pipelines` language and associates conventional pipeline filenames with it. Field Guide contributes no language, grammar, schema, or filename pattern of its own. This keeps ownership unambiguous and prevents generic YAML files from receiving pipeline-specific suggestions.

## Activation and registration

`src/extension.ts` is the composition root. On activation it creates the diagnostics collection and variable-catalog tree provider, then registers all language features against the selector `{ language: 'azure-pipelines', scheme: '*' }`:

- Completion provider, triggered after `.`, `(`, `'`, and `"`.
- Hover provider.
- Semantic-token provider using the `variable` legend with readonly/default-library modifiers for predefined variables.
- Code-action provider for syntax diagnostics and Quick Fixes.
- Explorer tree view provider for the predefined-variable catalog.

The extension also contributes browse, refresh, and variable-syntax copy commands. Copy commands are exposed through the variable item's context menu; property syntax is offered only for simple variable names. All registrations are added to the extension context for disposal.

## Completion model

The provider recognizes a variable reference immediately before the cursor in these forms:

```yaml
$(Build.)
variables['Build.']
variables["Build."]
variables.build
```

Only the typed variable-name range is replaced. Existing delimiters remain untouched, which makes the provider cooperate with bracket and quote auto-closing.

Property dereference completion is limited to simple names such as `variables.buildConfiguration`. Dotted predefined names such as `Build.BuildId` must use quoted index syntax.

Expression context is document-aware. It includes inline `condition:` values, `${{ ... }}` and `$[ ... ]` expressions, and indented content under `condition: |` or `condition: >` block scalars. YAML comments are masked before matching while preserving source offsets, so comments cannot create completion, hover, highlighting, or diagnostic false positives.

Expression diagnostics warn when a property dereference violates that rule and offer an index-syntax Quick Fix.

The catalog and document variables are merged case-insensitively because Azure Pipelines variable names are case-insensitive. A document declaration wins on collision and is sorted above predefined entries.

Complete predefined-variable references are also matched case-insensitively, matching Azure Pipelines runtime behavior. Completion items always insert the canonical catalog spelling for consistency with Microsoft documentation.

Predefined-variable presentations include the conventional environment-variable equivalent: names are uppercased and periods are mapped to underscores, such as `Build.BuildId` → `BUILD_BUILDID`.

The syntax diagnostics provider only warns for clear malformed index references in expression contexts, such as `variables[Build.SourceBranch]`. It also checks casing inside expression references, where the expression engine may require the documented spelling. Macro references remain case-insensitive and do not receive casing warnings. Bare text like `Build.` is ignored.

The variable catalog is exposed through an Explorer tree view grouped by namespace. Each variable expands once into a single read-only Markdown details item containing the official Microsoft Learn link, environment-variable equivalent, template availability, syntax examples, and full description. The view is backed entirely by the bundled catalog and never performs network retrieval at runtime.

There are three diagnostic codes:

- `invalid-variable-index-syntax` warns about missing quotes and offers `variables['...']`.
- `incorrect-expression-variable-casing` warns about noncanonical predefined-variable casing and offers the canonical name.
- `invalid-variable-property` warns about dotted property dereferences and offers quoted index syntax, replacing the full invalid property suffix.

Invalid syntax and expression-casing diagnostics can be independently disabled through the two diagnostic settings in `package.json`.

## Hover and documentation presentation

The shared `PipelineVariable` model carries the canonical name, normalized description, source, template availability, documentation URL, and—for predefined variables—the derived environment-variable name. Hover and completion providers render the same core facts with syntax examples. Document-defined variables intentionally have no external documentation link and are labeled as current-document variables.

The environment-variable equivalent is derived locally by uppercasing the Azure Pipelines name and replacing periods with underscores. It is presentation metadata; it is not part of the generated source catalog.

## Document-variable discovery

The collector recognizes both supported declaration forms at root, stage, and job scope:

```yaml
variables:
  configuration: Release

variables:
- name: configuration
  value: Release
```

It does not evaluate YAML templates. The collector is intentionally a small indentation-aware scanner instead of a general YAML parser: Azure Pipelines template expressions are not plain YAML values in every position, and the feature needs only declaration names. If cross-file analysis is introduced, this component should become a workspace index with cancellation, caching, and explicit scope rules.

## Data generation and maintenance

`scripts/update-predefined-variables.mjs` fetches Microsoft's canonical `variables.md` from GitHub, recursively resolves its Markdown include directives, parses variable tables and special variable sections, normalizes their descriptions, and writes `src/catalog/generatedPredefinedVariables.ts`. Each generated record contains:

- The canonical variable name and complete normalized description.
- An explicit template-availability flag. Values marked `Yes` upstream are `true`; variables not marked as available are `false`, matching Microsoft's documented template-scope behavior.
- A Microsoft Learn URL anchored to the variable's section.

The generated file header records the GitHub source used for provenance, but source-repository links are not included in completion or hover content.

Run `npm run update:variables` to update the checked-in catalog. `npm run check:variables` fetches the source and fails if regeneration would produce a diff. The parser itself has offline fixture tests under `scripts/test/`, so ordinary builds do not require network access.

Catalog changes should include:

1. A link to the upstream documentation or release note in the pull request.
2. Unit or integration coverage when syntax or behavior changes.
3. README coverage for user-visible behavior and a corresponding `CHANGELOG.md` entry for each released version.

The generated catalog remains static at runtime. The extension never scrapes documentation or contacts Azure DevOps while the user types.

## Configuration

All settings are resource-scoped under `azurePipelinesFieldGuide`:

- `completions.enabled` controls completion output.
- `hovers.enabled` controls hover output.
- `completions.includeDocumentVariables` controls local declaration discovery in completion and hover lookup.
- `diagnostics.invalidVariableSyntax.enabled` controls missing-quote and invalid-property diagnostics.
- `diagnostics.expressionVariableCasing.enabled` controls expression casing diagnostics.

The catalog tree view is always local and does not have a network or authentication setting.

## Tests and release automation

Pure language behavior is covered in `src/test/unit/`, including multiline expression context, comment masking, variable references, invalid syntax, and document-variable discovery. `src/test/integration/extension.test.ts` runs in a real Extension Host with Microsoft's language extension and verifies language ownership, completion, hover, highlighting, diagnostics, and Quick Fix edits.

The catalog parser has offline Node tests under `scripts/test/`. The CI workflow runs build, lint, type checking, generator tests, and Extension Host integration tests. The release workflow runs on `v*` tags, verifies the tag matches `package.json`, packages a VSIX, uploads it as an artifact, and attaches it to a GitHub Release. Marketplace publishing is intentionally not configured until repository identities and secrets are available.

## Security and performance

The extension performs local, read-only document analysis and does not execute pipeline content. Providers are activated only for Azure Pipelines documents. Completion, hover, semantic-token, and diagnostic operations currently rescan the open document or its lines as needed; workspace-wide analysis should add document-version caching and cancellation before expanding scope. This planned optimization is tracked in [issue #2](https://github.com/PalmEmanuel/AzurePipelinesFieldGuide/issues/2).
