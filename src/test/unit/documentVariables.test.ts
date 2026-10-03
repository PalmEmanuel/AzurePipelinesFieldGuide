import * as assert from 'node:assert/strict';
import { collectDocumentVariables } from '../../language/documentVariables';

suite('document variables', () => {
  test('collects mapping and list syntax at multiple scopes', () => {
    const result = collectDocumentVariables(`
variables:
  configuration: Release
  'dotted.name': value
  group: shared
jobs:
- job: build
  variables:
  - name: jobVariable
    value: yes
  - group: another-group
`);

    assert.deepEqual(
      result.map(({ name }) => name),
      ['configuration', 'dotted.name', 'jobVariable'],
    );
  });

  test('deduplicates names without changing the first casing', () => {
    const result = collectDocumentVariables('variables:\n  MyValue: one\n  myvalue: two');
    assert.deepEqual(result.map(({ name }) => name), ['myvalue']);
  });

  test('ignores template-generated names', () => {
    const result = collectDocumentVariables(
      "variables:\n- name: ${{ parameters.variableName }}\n  value: generated",
    );
    assert.equal(result.length, 0);
  });
});
