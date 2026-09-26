export interface ValidationResult {
  passed: boolean;
  command: string;
  exitCode: number;
  output: string;
}
