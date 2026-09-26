import { spawn } from 'child_process';
import { ValidationResult } from './ValidationResult';

export function runTypeCheck(workspaceRoot: string): Promise<ValidationResult> {
  return runCommand('npm', ['run', 'check-types'], workspaceRoot);
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, shell: true });
    let output = '';
    child.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { output += d.toString(); });
    child.on('close', (code) => {
      resolve({
        passed: code === 0,
        command: `${cmd} ${args.join(' ')}`,
        exitCode: code ?? 1,
        output: output.slice(0, 4000),
      });
    });
    child.on('error', (err) => {
      resolve({
        passed: false,
        command: `${cmd} ${args.join(' ')}`,
        exitCode: 1,
        output: err.message,
      });
    });
  });
}
