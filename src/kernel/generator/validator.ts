import * as ts from 'typescript';

/**
 * Validates TypeScript code syntax integrity.
 * @param code The TypeScript code string to validate
 * @returns true if valid, false if parsing errors exist
 */
export function validate_syntax(code: string): boolean {
  const result = ts.transpileModule(code, {
    compilerOptions: { noEmitOnError: true },
    reportDiagnostics: true
  });

  if (result.diagnostics && result.diagnostics.length > 0) {
    const has_errors = result.diagnostics.some(d => d.category === ts.DiagnosticCategory.Error);
    if (has_errors) return false;
  }
  return true;
}
