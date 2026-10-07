import * as assert from 'node:assert/strict';
import { findParameterCompletionContext } from '../../language/parameterCompletionContext';

suite('parameter completion context', () => {
  test('finds a parameter prefix only inside a template expression', () => {
    assert.deepEqual(findParameterCompletionContext('${{ parameters.buildC'), {
      typedName: 'buildC',
      replaceStart: 15,
      replaceEnd: 21,
    });
  });

  test('supports an empty parameter name after the namespace dot', () => {
    const context = findParameterCompletionContext('${{ parameters.');
    assert.equal(context?.typedName, '');
    assert.equal(context?.replaceStart, 15);
    assert.equal(context?.replaceEnd, 15);
  });

  test('recognizes multiline template expressions and ignores YAML comments', () => {
    const text = "steps:\n- script: ${{ format(\n    'image: {0}', parameters.ima\n  ) }}";
    const line = text.split('\n')[2] ?? '';
    const lineOffset = text.indexOf(line);

    assert.equal(
      findParameterCompletionContext(line, text, lineOffset)?.typedName,
      'ima',
    );
    assert.equal(
      findParameterCompletionContext(
        '# ${{ parameters.fake',
        '# ${{ parameters.fake',
      ),
      undefined,
    );
  });

  test('does not match runtime expressions, conditions without template syntax, or macros', () => {
    assert.equal(findParameterCompletionContext('$[ parameters.buildC ]'), undefined);
    assert.equal(findParameterCompletionContext('condition: eq(parameters.buildC'), undefined);
    assert.equal(findParameterCompletionContext('$(parameters.buildC'), undefined);
  });

  test('does not match variables, nested properties, or expression string literals', () => {
    assert.equal(
      findParameterCompletionContext('${{ variables.parameters.buildC'),
      undefined,
    );
    assert.equal(findParameterCompletionContext('${{ parameters.buildC.other'), undefined);
    assert.equal(findParameterCompletionContext("${{ eq('parameters.buildC'"), undefined);
  });

  test('does not match after the template expression has closed', () => {
    assert.equal(findParameterCompletionContext('${{ parameters.buildC }}'), undefined);
  });

  test('does not carry an earlier open expression across a completed expression', () => {
    const text = '${{ parameters.first }}\nparameters.second';
    const line = 'parameters.second';
    assert.equal(
      findParameterCompletionContext(line, text, text.indexOf(line)),
      undefined,
    );
  });

  test('does not treat closing delimiters inside expression strings as the end', () => {
    const text = "${{ format('}}', parameters.buildC";
    assert.equal(findParameterCompletionContext(text)?.typedName, 'buildC');
  });

  test('ignores standalone YAML comments after earlier document content', () => {
    const text = "steps:\n# ${{ parameters.buildC";
    const line = text.split('\n')[1] ?? '';
    assert.equal(findParameterCompletionContext(line, text, text.indexOf(line)), undefined);
  });
});
