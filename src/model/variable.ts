export type VariableSource = 'predefined' | 'document';

export interface PipelineVariable {
  readonly name: string;
  readonly description: string;
  readonly source: VariableSource;
  readonly availableInTemplates?: boolean;
  readonly documentationUrl?: string;
  readonly environmentVariableName?: string;
}
