# Changelog

All notable changes to Azure Pipelines Field Guide are documented here.

Check [Keep a Changelog](http://keepachangelog.com/) for how to structure this file.

## [v1.0.0] - 2026-10-04

### Added

- Context-aware IntelliSense for Azure Pipelines predefined variables in macro syntax such as `$(Build.)`.
- IntelliSense for quoted index expressions using single or double quotes, including `variables['Build.']` and `variables["Build."]`.
- IntelliSense for simple property dereference syntax such as `variables.buildConfiguration` in expression contexts.
- Discovery of variables declared in the current YAML document using mapping and list declaration forms.
- Multiline expression support for `${{ ... }}`, `$[ ... ]`, and `condition: |` / `condition: >` block scalars.
- Hover documentation with Microsoft-provided descriptions, syntax examples, template availability, environment-variable equivalents, and anchored official Microsoft Learn links.
- Semantic highlighting for recognized predefined and document-defined variables in valid Azure Pipelines syntax.
- Dedicated Azure Pipelines Field Guide Activity Bar container with a compact alphabetical webview catalog, wrapped descriptions, filtering, environment-variable equivalents, template availability, and clickable official documentation links.
- Expandable variable entries with macro, expression, property, and environment-variable syntax rows, copy buttons, and a dynamic right-click menu containing the exact syntax for the selected variable.
- Command Palette command to browse predefined variables.
- Generated descriptions, explicit template-availability metadata, and section-anchored documentation URLs.

## [v0.1.0] - 2026-10-04

Project initialized.
