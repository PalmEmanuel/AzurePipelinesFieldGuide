import * as assert from 'node:assert/strict';
import { findParameterReferences } from '../../language/parameterReferences';
import { findParameterValueReferences } from '../../language/parameterValues';

const declarations = `parameters:
- name: configuration
  type: string
  default: Release
  values: [Debug, Release, "O'Brien"]
- name: enabled
  type: boolean
  default: false
  values: [true, false]
- name: count
  type: number
  default: 2
  values: [1, 2]
steps:
`;

suite('parameter semantic references', () => {
  test('finds declared parameter references in multiline compile-time expressions', () => {
    const text = declarations + "- script: |\n    ${{ and(\n      eq(parameters.configuration, 'Release'),\n      parameters.enabled) }}";
    assert.deepEqual(
      findParameterReferences(text).map((reference) => ({
        name: reference.name,
        text: text.slice(reference.start, reference.end),
      })),
      [
        { name: 'configuration', text: 'configuration' },
        { name: 'enabled', text: 'enabled' },
      ],
    );
  });

  test('ignores comments, unknown names, incomplete names, strings and invalid contexts', () => {
    const text = declarations + [
      '# ${{ parameters.configuration }}',
      "- script: echo ${{ 'parameters.configuration' }}",
      '- script: echo $[ parameters.configuration ]',
      '- script: echo $(parameters.configuration)',
      '- script: echo parameters.configuration',
      '- script: echo ${{ variables.parameters.configuration }}',
      '- script: echo ${{ parameters.configuration.other }}',
      '- script: echo ${{ parameters.unknown }}',
      '- script: echo ${{ parameters.Configuration }}',
      '- script: echo ${{ parameters.config }}',
    ].join('\n');
    assert.deepEqual(findParameterReferences(text), []);
  });

  test('finds typed allowed-value declarations, defaults and comparison literals', () => {
    const text = declarations + [
      "- script: echo ${{ eq(parameters.configuration, 'Release') }}",
      '- script: echo ${{ eq(parameters.enabled, true) }}',
      '- script: echo ${{ ge(parameters.count, 2) }}',
      "- script: echo ${{ in(parameters.configuration, 'Debug', 'O''Brien') }}",
    ].join('\n');
    assert.deepEqual(
      findParameterValueReferences(text).map((reference) => ({
        type: reference.type,
        text: text.slice(reference.start, reference.end),
      })),
      [
        { type: 'string', text: 'Release' },
        { type: 'string', text: 'Debug' },
        { type: 'string', text: 'Release' },
        { type: 'string', text: '"O\'Brien"' },
        { type: 'boolean', text: 'false' },
        { type: 'boolean', text: 'true' },
        { type: 'boolean', text: 'false' },
        { type: 'number', text: '2' },
        { type: 'number', text: '1' },
        { type: 'number', text: '2' },
        { type: 'string', text: "'Release'" },
        { type: 'boolean', text: 'true' },
        { type: 'number', text: '2' },
        { type: 'string', text: "'Debug'" },
        { type: 'string', text: "'O''Brien'" },
      ],
    );
  });

  test('ignores unsupported value references without changing declaration tokens', () => {
    const baseline = findParameterValueReferences(declarations);
    const text = declarations + [
      "# ${{ eq(parameters.configuration, 'Release') }}",
      "- script: echo $[ eq(parameters.configuration, 'Release') ]",
      "- script: echo ${{ contains(parameters.configuration, 'Release') }}",
      "- script: echo ${{ eq(parameters.unknown, 'Release') }}",
      "- script: echo ${{ eq(parameters.configuration, 'Other') }}",
      "- script: echo ${{ eq(parameters.enabled, 'true') }}",
      "- script: echo ${{ eq(parameters.configuration, 'Release'.other) }}",
      "- script: echo ${{ eq(parameters.configuration, variables.Release) }}",
      "- script: echo ${{ format('eq(parameters.configuration, Release)') }}",
      '- template: other.yml',
      '  parameters:',
      '    configuration: Release',
    ].join('\n');
    assert.deepEqual(findParameterValueReferences(text), baseline);
  });

  test('handles CRLF offsets and quoted YAML around template expressions', () => {
    const text = (declarations + '- script: "echo ${{ eq(parameters.configuration, \'Release\') }}"')
      .replace(/\n/gu, '\r\n');
    const references = findParameterReferences(text);
    assert.equal(references.length, 1);
    const reference = references[0];
    assert.ok(reference);
    assert.equal(text.slice(reference.start, reference.end), 'configuration');
    const values = findParameterValueReferences(text);
    const last = values.at(-1);
    assert.ok(last);
    assert.equal(text.slice(last.start, last.end), "'Release'");
  });
});
