import * as assert from 'node:assert/strict';
import {
  findIncorrectExpressionVariableCasing,
  findInvalidVariableProperties,
  findInvalidVariableIndexes,
} from '../../language/invalidVariableSyntax';

suite('invalid variable syntax', () => {
  test('finds unquoted variable indexes in conditions and suggests canonical names', () => {
    assert.deepEqual(findInvalidVariableIndexes('condition: eq(variables[build.BuildId], \'yyyy\')'), [
      {
        kind: 'missing-quotes',
        name: 'build.BuildId',
        start: 24,
        end: 37,
        canonicalName: 'Build.BuildId',
      },
    ]);
  });

  test('finds unquoted indexes in template and runtime expressions', () => {
    assert.equal(findInvalidVariableIndexes("value: ${{ variables[Build.SourceBranch] }}").length, 1);
    assert.equal(findInvalidVariableIndexes("value: $[ variables[Build.SourceBranch] ]").length, 1);
  });

  test('does not warn for quoted syntax or bare text', () => {
    assert.deepEqual(
      findInvalidVariableIndexes("condition: eq(variables['Build.BuildId'], 'yyyy')"),
      [],
    );
    assert.deepEqual(findInvalidVariableIndexes('displayName: Build.'), []);
  });

  test('warns about casing only inside expressions', () => {
    assert.deepEqual(
      findIncorrectExpressionVariableCasing(
        "condition: eq(variables['build.BuildId'], 'yyyy')",
      ),
      [
        {
          kind: 'incorrect-casing',
          name: 'build.BuildId',
          start: 25,
          end: 38,
          canonicalName: 'Build.BuildId',
        },
      ],
    );
    assert.deepEqual(findIncorrectExpressionVariableCasing('echo $(build.BuildId)'), []);
  });

  test('finds invalid property dereference names', () => {
    assert.deepEqual(
      findInvalidVariableProperties("condition: eq(variables.Build.BuildId, 'yyyy')"),
      [
        {
          kind: 'invalid-property',
          name: 'Build.BuildId',
          start: 24,
          end: 37,
          canonicalName: 'Build.BuildId',
        },
      ],
    );
    assert.deepEqual(
      findInvalidVariableProperties("condition: eq(variables.buildConfiguration, 'Release')"),
      [],
    );
  });

  test('handles invalid syntax and casing inside multiline conditions', () => {
    const text = "condition: |\n  and(\n    eq(variables[build.BuildId], 'yyyy'),\n    eq(variables['build.BuildId'], 'yyyy')\n  )";
    const invalidLine = text.split('\n')[2] ?? '';
    const casingLine = text.split('\n')[3] ?? '';

    assert.equal(
      findInvalidVariableIndexes(invalidLine, text, text.indexOf(invalidLine)).length,
      1,
    );
    assert.equal(
      findIncorrectExpressionVariableCasing(
        casingLine,
        text,
        text.indexOf(casingLine),
      ).length,
      1,
    );
  });

  test('ignores variable-like text in comments', () => {
    const line = "# condition: eq(variables[Build.BuildId], 'yyyy') $(Build.BuildId)";
    assert.deepEqual(findInvalidVariableIndexes(line), []);
    assert.deepEqual(findIncorrectExpressionVariableCasing(line), []);
    assert.deepEqual(findInvalidVariableProperties(line), []);
  });
});
