# Changelog

All notable changes to Azure Pipelines Field Guide are documented here.

## [Unreleased]

### Added

- Context-aware IntelliSense for Azure Pipelines predefined variables in macro syntax such as `$(Build.)`.
- IntelliSense for quoted index expressions using single or double quotes, including `variables['Build.']` and `variables["Build."]`.
- IntelliSense for simple property dereference syntax such as `variables.buildConfiguration` in expression contexts.
- Discovery of variables declared in the current YAML document using mapping and list declaration forms.
- Multiline expression support for `${{ ... }}`, `$[ ... ]`, and `condition: |` / `condition: >` block scalars.
- Hover documentation with Microsoft-provided descriptions, syntax examples, template availability, environment-variable equivalents, and anchored official Microsoft Learn links.
- Semantic highlighting for recognized predefined and document-defined variables in valid Azure Pipelines syntax.
- Compact alphabetical custom Explorer webview catalog with wrapped descriptions, filtering, environment-variable equivalents, template availability, and clickable official documentation links.
- Expandable variable entries with macro, expression, property, and environment-variable syntax rows, copy buttons, and a dynamic right-click menu containing the exact syntax for the selected variable.
- Command Palette command to browse predefined variables.
- Source-backed predefined-variable retrieval script with recursive Markdown include parsing.
- Generated descriptions, explicit template-availability metadata, and section-anchored documentation URLs.
- Unit tests, catalog parser tests, Extension Host integration tests, CI validation, and tag-based VSIX release packaging.

### Diagnostics

- Warnings for unquoted variable index syntax such as `variables[Build.BuildId]`.
- Quick Fixes that convert unquoted indexes to `variables['Build.BuildId']`.
- Warnings and Quick Fixes for noncanonical predefined-variable casing in expression syntax.
- Warnings and Quick Fixes for invalid dotted property dereferences such as `variables.Build.BuildId`.
- Case-insensitive variable recognition with canonical-cased completion insertion.
- YAML comment masking to prevent false-positive completion, hover, highlighting, and diagnostics.
- Macro casing remains case-insensitive and does not receive expression-casing warnings.

### Changed

- The extension is scoped exclusively to the `azure-pipelines` language contributed by Microsoft's official Azure Pipelines extension.
- Runtime editor features use only official Microsoft Learn links; GitHub documentation-source links remain generator provenance and are not shown in editor UI.
- The extension artwork was optimized for package size.

### Fixed

- Bare text such as `Build.` no longer triggers variable completion.
- Invalid property Quick Fixes replace the complete dotted property suffix with valid quoted index syntax.
- Variable analysis ignores YAML comments while preserving source ranges.
