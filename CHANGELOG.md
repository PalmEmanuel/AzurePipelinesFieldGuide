# Changelog

All notable changes to Azure Pipelines Field Guide are documented here.

Check [Keep a Changelog](http://keepachangelog.com/) for how to structure this file.

## [v1.1.0] - 2026-10-07
### New Features
- [`327df8f`](https://github.com/PalmEmanuel/AzurePipelinesFieldGuide/commit/327df8f907243f355bcafda39363601285f9dcfe) - Added support for parameters *(PR [#12](https://github.com/PalmEmanuel/AzurePipelinesFieldGuide/pull/12) by [@PalmEmanuel](https://github.com/PalmEmanuel))*

### Bug Fixes
- [`1f896b8`](https://github.com/PalmEmanuel/AzurePipelinesFieldGuide/commit/1f896b82a8501baab080d179c5c03e5f8038938a) - update release workflow to use tag version for packaging and improve release preparation instructions *(commit by [@PalmEmanuel](https://github.com/PalmEmanuel))*
- [`5ed254b`](https://github.com/PalmEmanuel/AzurePipelinesFieldGuide/commit/5ed254b2dcb6717b0e4de40400eff82cce38e4f3) - revert version number to 1.0.0 in package.json *(commit by [@PalmEmanuel](https://github.com/PalmEmanuel))*
- [`d70064f`](https://github.com/PalmEmanuel/AzurePipelinesFieldGuide/commit/d70064f43d4d9cbb65f755beb6e3dddcd709809c) - update version to 1.1.0 in package.json *(commit by [@PalmEmanuel](https://github.com/PalmEmanuel))*
- [`6838cb0`](https://github.com/PalmEmanuel/AzurePipelinesFieldGuide/commit/6838cb06fa18ddc69e919e53cc2ec12725735fe0) - remove outdated version entry from changelog *(commit by [@PalmEmanuel](https://github.com/PalmEmanuel))*


## [Unreleased]

### Added

- IntelliSense for parameters declared in the current YAML document inside valid `${{ parameters.name }}` template expressions.
- Allowed-value IntelliSense from current-document parameter `values:` lists in defaults and compile-time comparisons, with type-aware YAML and expression literal insertion.
- Semantic highlighting for declared parameter references and typed allowed values in declarations, defaults, and compile-time comparisons.

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
[v1.1.0]: https://github.com/PalmEmanuel/AzurePipelinesFieldGuide/compare/v1.0.0...v1.1.0
