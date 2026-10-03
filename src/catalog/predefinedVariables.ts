import { generatedPredefinedVariables } from './generatedPredefinedVariables';
import type { PipelineVariable } from '../model/variable';

export const predefinedVariables: readonly PipelineVariable[] =
  generatedPredefinedVariables.map((variable) => ({
    ...variable,
    source: 'predefined',
    environmentVariableName: variable.name.replaceAll('.', '_').toUpperCase(),
  }));

export const predefinedVariablesByName = new Map(
  predefinedVariables.map((variable) => [variable.name.toLowerCase(), variable]),
);
