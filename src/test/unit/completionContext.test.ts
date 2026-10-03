import * as assert from 'node:assert/strict';
import { findCompletionContext } from '../../language/completionContext';

suite('completion context', () => {
  test('finds a partially typed macro variable', () => {
    assert.deepEqual(findCompletionContext('  script: echo $(Build.'), {
      syntax: 'macro',
      typedName: 'Build.',
      replaceStart: 17,
      replaceEnd: 23,
    });
  });

  test('finds an index expression', () => {
    const context = findCompletionContext("condition: eq(variables['System.Pull");
    assert.equal(context?.syntax, 'index');
    assert.equal(context?.typedName, 'System.Pull');
  });

  test('finds a simple property expression', () => {
    const context = findCompletionContext('condition: eq(variables.buildC');
    assert.equal(context?.syntax, 'property');
    assert.equal(context?.typedName, 'buildC');
  });

  test('does not offer property syntax outside an expression', () => {
    assert.equal(findCompletionContext('script: echo variables.buildC'), undefined);
  });

  test('does not offer variables outside valid variable syntax', () => {
    assert.equal(findCompletionContext('displayName: Build.'), undefined);
  });

  test('does not offer index completion outside an expression', () => {
    assert.equal(findCompletionContext("displayName: variables['Build."), undefined);
  });

  test('recognizes property completion inside a multiline condition block', () => {
    const text = "condition: |\n  and(\n    eq(variables.buildC, 'Release')\n  )";
    const line = text.split('\n')[2] ?? '';
    const lineOffset = text.indexOf(line);
    const prefix = line.slice(0, line.indexOf(','));

    assert.equal(
      findCompletionContext(prefix, text, lineOffset)?.syntax,
      'property',
    );
  });

  test('does not offer completion from a YAML comment', () => {
    assert.equal(findCompletionContext('# echo $(Build.'), undefined);
  });
});
