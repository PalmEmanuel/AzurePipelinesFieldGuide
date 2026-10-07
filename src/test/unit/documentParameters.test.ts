import * as assert from 'node:assert/strict';
import { collectDocumentParameters } from '../../language/documentParameters';

suite('document parameters', () => {
  test('collects valid names from root parameter list declarations', () => {
    const result = collectDocumentParameters(`parameters:
- name: image
  type: string
  default: linux
- name: _configuration2
  type: string`);

    assert.deepEqual(result, ['image', '_configuration2']);
  });

  test('supports indented lists, quoted names, and duplicate declarations', () => {
    const result = collectDocumentParameters(`parameters:
  - name: 'buildConfig'
    type: string
  - name: "buildConfig"
    type: string
  - name: stage_name
    type: string`);

    assert.deepEqual(result, ['buildConfig', 'stage_name']);
  });

  test('ignores nested declarations, block scalar content, and comments', () => {
    const result = collectDocumentParameters(`# parameters:
# - name: commentedOut
steps:
- script: |
    parameters:
    - name: scriptText
parameters:
- name: realParameter
  type: object
  default:
    nested:
    - name: nestedProperty`);

    assert.deepEqual(result, ['realParameter']);
  });

  test('ignores invalid and dynamically generated parameter names', () => {
    const result = collectDocumentParameters(`parameters:
- name: invalid.name
- name: 2invalid
- name: \${{ parameters.generatedName }}
- name: ""
- name: valid_name`);

    assert.deepEqual(result, ['valid_name']);
  });
});
