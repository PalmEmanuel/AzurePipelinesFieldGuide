# Contributing

Thanks for helping improve Azure Pipelines Field Guide!

## Set up

1. Install Node.js and Visual Studio Code.
2. Run `npm install`.
3. Run `npm run build`.
4. Press `F5` to open an Extension Development Host.

The workspace recommends Microsoft's Azure Pipelines extension because it owns the language that Field Guide extends.

## Validate a change

Run the full local gate before opening a pull request:

```console
npm test
```

This performs strict TypeScript checks, ESLint, a production-compatible bundle, pure unit tests, and Extension Host integration tests. Integration tests may download VS Code and install the official Azure Pipelines extension on their first run. If a display server is unavailable on Linux CI, run the integration suite with `xvfb-run -a npm run test:integration`.

For a faster local loop, use:

```console
npm run check
npm run test:unit
npm run test:integration
npm run vsix
```

The extension must continue to register only against the `azure-pipelines` language contributed by Microsoft's official extension. Do not broaden providers to generic `yaml` documents.

Add unit tests for parsing and catalog logic. Add integration tests when behavior depends on activation, language selection, VS Code ranges, provider registration, or interaction with the official extension.

## Project conventions

- Keep VS Code-specific code at the provider/composition boundary.
- Do not register providers for generic `yaml` files.
- Prefer pure language functions that can be tested without an Extension Host.
- Preserve user-authored files and never execute content from a pipeline.
- Source predefined-variable changes from official Microsoft documentation.
- Regenerate source-backed variables with `npm run update:variables`; never hand-edit the generated catalog.
- Keep user-facing behavior documented in `README.md`.
- Add release notes to `CHANGELOG.md` for every released version.
- Keep the variable catalog webview read-only and local; it must not fetch documentation at runtime. Validate all webview messages against the bundled catalog before copying syntax or opening documentation.

## Catalog changes

Use `npm run update:variables` when the Microsoft documentation source changes. The generated catalog contains descriptions, template availability, and anchored Microsoft Learn links. Review the generated diff and run `npm run check:variables` before committing.

The generator's offline parser tests live under `scripts/test/`. Add or update a fixture test when the upstream Markdown shape changes.

## Release preparation

Releases should update the version in `package.json`, review the README, add release notes, and push a matching `v<version>` tag. The release workflow runs the build and test jobs, publishes the extension to the Visual Studio Marketplace through Azure Workload Identity Federation, attaches the VSIX to a GitHub Release, and opens a pull request for generated release-file changes.

The release workflow requires the repository secrets `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`. The Azure identity must be configured for the Marketplace publishing flow used by `vsce --azure-credential`, and the GitHub Actions workflow must be allowed to request an OIDC token.

For the first release, there is no previous tag for the changelog action to compare against. The workflow automatically uses the current `Unreleased` section as the release notes and promotes it to the tagged release entry. Later releases use the normal previous-tag comparison.

## Reporting issues

Include the VS Code version, Field Guide version, official Azure Pipelines extension version, language mode shown in the status bar, a minimal YAML example, and the expected completion or hover behavior. For diagnostics, include whether the expression is inline or multiline and whether it is a `condition`, `${{ }}`, or `$[ ]` expression. Remove secrets and organization-specific values first.
