import * as assert from 'node:assert/strict';
import { parse } from 'yaml';
import { findParameterValueCompletions } from '../../language/parameterValues';
import type { ParameterValueCompletion } from '../../language/parameterValues';

const declarations = `parameters:
- name: configuration
  type: string
  default: Release
  values: [Debug, Release, "O'Brien", "true", "a: b", "with # hash"]
- name: retries
  type: number
  values:
  - 1
  - 12
  - -2
- name: enabled
  type: boolean
  values: [true, false]
steps:
`;

function complete(expression: string): readonly ParameterValueCompletion[] {
  const cursor = expression.lastIndexOf('|');
  assert.notEqual(cursor, -1);
  const text = declarations + expression.slice(0, cursor) + expression.slice(cursor + 1);
  return findParameterValueCompletions(text, declarations.length + cursor);
}

suite('parameter allowed values', () => {
  test('offers values in template comparisons and replaces the whole literal', () => {
    const expression = "- script: echo ${{ eq(parameters.configuration, 'Re|lease') }}";
    const items = complete(expression);
    assert.deepEqual(items.map((item) => item.insertText), ["'Release'"]);
    const text = declarations + expression.replace('|', '');
    const item = items[0];
    assert.ok(item);
    assert.equal(text.slice(item.replaceStart, item.replaceEnd), "'Release'");
  });

  test('escapes Azure expression apostrophes and keeps ambiguous strings quoted', () => {
    assert.equal(
      complete("- script: echo ${{ ne(parameters.configuration, 'O|') }}")[0]?.insertText,
      "'O''Brien'",
    );
    assert.equal(
      complete("- script: echo ${{ eq(parameters.configuration, tru|) }}")[0]?.insertText,
      "'true'",
    );
  });

  test('supports numeric and boolean values without quotes', () => {
    assert.deepEqual(
      complete('- script: echo ${{ gt(parameters.retries, 1|) }}')
        .map((item) => item.insertText),
      ['1', '12'],
    );
    assert.deepEqual(
      complete('- script: echo ${{ eq(parameters.enabled, |) }}')
        .map((item) => item.insertText),
      ['true', 'false'],
    );
    assert.deepEqual(complete("- script: echo ${{ eq(parameters.enabled, '|') }}"), []);
  });

  test('supports multiline calls and variadic membership comparisons', () => {
    assert.deepEqual(
      complete("- script: |\n    ${{ in(\n      parameters.configuration,\n      'Release',\n      'D|') }}").map((item) => item.label),
      ['Debug'],
    );
    assert.deepEqual(
      complete("- script: echo ${{ and(eq(parameters.enabled, true), ne(parameters.configuration, 'D|')) }}")
        .map((item) => item.label),
      ['Debug'],
    );
  });

  test('supports each comparison function and returns only declared values', () => {
    for (const functionName of ['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'in', 'notIn']) {
      assert.deepEqual(
        complete(`- script: echo \${{ ${functionName}(parameters.configuration, 'D|') }}`)
          .map((item) => item.label),
        ['Debug'],
      );
    }
  });

  test('rejects comments, runtime expressions, unrelated functions, and nonliteral arguments', () => {
    for (const expression of [
      "# ${{ eq(parameters.configuration, 'D|') }}",
      "- script: echo $[ eq(parameters.configuration, 'D|') ]",
      "  condition: eq(parameters.configuration, 'D|')",
      "- script: echo ${{ contains(parameters.configuration, 'D|') }}",
      "- script: echo ${{ variables.eq(parameters.configuration, 'D|') }}",
      "- script: echo ${{ eq(variables.configuration, 'D|') }}",
      "- script: echo ${{ eq(parameters.unknown, 'D|') }}",
      "- script: echo ${{ eq(parameters.configuration, variables.D|) }}",
      "- script: echo ${{ format('eq(parameters.configuration, D|)') }}",
      "- script: echo ${{ eq(parameters.configuration, 'Debug', 'D|') }}",
      "- script: echo ${{ eq(parameters.configuration, 'Debug') }} 'D|",
      "- script: echo ${{ eq(parameters.configuration, \"D|\") }}",
    ]) {
      assert.deepEqual(complete(expression), [], expression);
    }
  });

  test('offers YAML defaults even with unfinished quotes and preserves comments', () => {
    const text = declarations.replace('default: Release', 'default: "Re');
    const offset = text.indexOf('default: "Re') + 'default: "Re'.length;
    const items = findParameterValueCompletions(text, offset);
    assert.deepEqual(items.map((item) => item.insertText), ['"Release"']);
    const item = items[0];
    assert.ok(item);
    const completed = text.slice(0, item.replaceStart) + item.insertText + text.slice(item.replaceEnd);
    const yaml: unknown = parse(completed);
    assert.ok(yaml);
  });

  test('serializes every string default as a valid YAML string', () => {
    const text = declarations.replace('default: Release', 'default: ');
    const offset = text.indexOf('default: ') + 'default: '.length;
    const items = findParameterValueCompletions(text, offset);
    assert.equal(items.length, 6);
    for (const item of items) {
      assert.equal(parse(item.insertText), item.label);
    }
  });

  test('does not confuse nested defaults or template input parameters with declarations', () => {
    for (const suffix of [
      "- template: build.yml\n  parameters:\n    default: |",
      "- script: |\n    default: |",
    ]) {
      assert.deepEqual(complete(suffix), []);
    }
    const text = `parameters:
- name: nested
  type: object
  default:
    default:
  values: [Debug]
`;
    assert.deepEqual(findParameterValueCompletions(text, text.indexOf('    default:') + 12), []);
  });

  test('ignores dynamic, complex, type-mismatched, and non-finite values', () => {
    const text = `parameters:
- name: choice
  type: string
  default:
  values: [Valid, true, 12, null, {key: value}, "\${{ variables.dynamic }}"]
`;
    const offset = text.indexOf('default:') + 'default:'.length;
    assert.deepEqual(
      findParameterValueCompletions(text, offset).map((item) => item.label),
      ['Valid'],
    );
  });

  test('does not offer defaults for parameters with no allowed values', () => {
    const text = 'parameters:\n- name: freeText\n  type: string\n  default: ';
    assert.deepEqual(findParameterValueCompletions(text, text.length), []);
  });

  test('ignores non-finite numbers and preserves negative and fractional numbers', () => {
    const text = `parameters:
- name: numberChoice
  type: number
  default:
  values: [-2, 0.5, .inf, .nan]
`;
    const offset = text.indexOf('default:') + 'default:'.length;
    assert.deepEqual(
      findParameterValueCompletions(text, offset).map((item) => item.insertText),
      ['-2', '0.5'],
    );
  });

  test('keeps default trailing comments and quoted scalar replacements intact', () => {
    const text = declarations.replace('default: Release', "default: 'Release' # explanation");
    const offset = text.indexOf("default: 'Re") + "default: 'Re".length;
    const item = findParameterValueCompletions(text, offset)[0];
    assert.ok(item);
    assert.equal(text.slice(item.replaceStart, item.replaceEnd), "'Release'");
    assert.ok(text.slice(item.replaceEnd).startsWith(' # explanation'));
  });
});
