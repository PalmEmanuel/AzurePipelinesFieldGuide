import * as assert from 'node:assert/strict';
import { findVariableReferences } from '../../language/variableReferences';

suite('variable references', () => {
  test('finds macro, index, and property references in valid syntax', () => {
    assert.deepEqual(findVariableReferences("echo $(Build.BuildId) ${{ variables['System.TeamProject'] }}"), [
      { name: 'Build.BuildId', start: 7, end: 20 },
      { name: 'System.TeamProject', start: 37, end: 55 },
    ]);
    assert.deepEqual(
      findVariableReferences("condition: eq(variables.buildConfiguration, 'Release')"),
      [{ name: 'buildConfiguration', start: 24, end: 42 }],
    );
  });

  test('ignores bare and incomplete names', () => {
    assert.deepEqual(findVariableReferences('Build. $(Build.'), []);
  });

  test('finds references inside a multiline condition block', () => {
    const text = "condition: |\n  and(\n    eq(variables['Build.BuildId'], 'yyyy')\n  )";
    const line = text.split('\n')[2] ?? '';
    assert.deepEqual(
      findVariableReferences(line, text, text.indexOf(line)),
      [{ name: 'Build.BuildId', start: 18, end: 31 }],
    );
  });

  test('ignores references in YAML comments', () => {
    assert.deepEqual(
      findVariableReferences("# echo $(Build.BuildId) variables['Build.SourceBranch']"),
      [],
    );
  });

  test('ignores index references outside expression syntax', () => {
    assert.deepEqual(
      findVariableReferences('displayName: variables[\'Build.BuildId\']'),
      [],
    );
  });
});
