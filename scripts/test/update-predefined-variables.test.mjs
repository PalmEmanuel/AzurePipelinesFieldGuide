import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeDescription,
  parsePredefinedVariables,
  parseVariableTables,
  renderCatalog,
} from '../update-predefined-variables.mjs';

const hostedFixture = `
<a id="agent-variables"></a>
## Agent variables (DevOps Services)

| Variable | Description |
|:---------|:------------|
| Agent.Id | The **ID** of the [agent](../../agents/agents.md). |

## Build variables (DevOps Services)
<a id="build-variables"></a>

| Variable | Description | Available in templates? |
|:---------|:------------|:------------------------|
| Build.BuildId | The ID of the build.<br><br>Read-only. | No |

## Pipeline variables

| Variable | Description |
|:---------|:------------|
| Pipeline.Workspace | Workspace for this pipeline. |

## System variables

| Variable | Description | Available in templates? |
|:---------|:------------|:------------------------|
| System.CollectionId | Collection GUID. | Yes |
`;

describe('predefined variable generator', () => {
  it('parses table descriptions, template availability, and section anchors', () => {
    const variables = parseVariableTables(hostedFixture);
    assert.equal(
      variables.find(({ name }) => name === 'Agent.Id')?.availableInTemplates,
      false,
      'Variables in tables without an availability column default to No',
    );
    assert.deepEqual(variables[1], {
      name: 'Build.BuildId',
      description: 'The ID of the build. Read-only.',
      availableInTemplates: false,
      documentationUrl:
        'https://learn.microsoft.com/en-gb/azure/devops/pipelines/build/variables?view=azure-devops&tabs=yaml&wt.mc_id=DT-MVP-5005372#build-variables',
    });
  });

  it('normalizes HTML and keeps useful Markdown formatting', () => {
    assert.equal(
      normalizeDescription(
        'Use <code>this</code><br><ul><li>one</li><li>`s/<RepoName>`</li></ul>',
      ),
      'Use this • one • `s/<RepoName>`',
    );
  });

  it('renders a deterministic TypeScript catalog', () => {
    const rendered = renderCatalog([
      {
        name: 'Build.BuildId',
        description: 'Build ID.',
        availableInTemplates: false,
        documentationUrl: 'https://example.test/#build-variables',
      },
    ]);
    assert.match(rendered, /export const generatedPredefinedVariables/);
    assert.match(rendered, /"Build.BuildId"/);
  });

  it('validates a complete merged catalog', () => {
    const rows = [];
    for (let index = 0; index < 80; index += 1) {
      const prefix = ['Agent', 'Build', 'Pipeline', 'System'][index % 4];
      rows.push(`| ${prefix}.Value${index} | Description ${index}. |`);
    }
    const fixture = `## Variables\n<a id="variables"></a>\n\n| Variable | Description |\n|---|---|\n${rows.join('\n')}`;
    const variables = parsePredefinedVariables(fixture);
    assert.equal(variables.length, 80);
  });
});
