import * as fs from 'fs';
import * as path from 'path';

/**
 * Regex-based source transformer that strips out @bugbouncer/physics imports and components.
 */
export function eject_content(content: string): string {
  let result = content;

  // 1. Remove the physics library imports (both single/multi line syntax)
  // Uses a negative lookahead to avoid greedy matching across multiple import statements
  const import_regex = /import\s+(?:(?!import)[\s\S])*?from\s+['"]@bugbouncer\/physics['"];?\n?/g;
  result = result.replace(import_regex, '');

  // 2. Replace hook calls with false literal (to keep declared variables defined and prevent typescript errors)
  const kill_hook_regex = /useKillSwitch\([^)]*\)/g;
  const lock_hook_regex = /usePhaseLockedRendering\([^)]*\)/g;
  result = result.replace(kill_hook_regex, 'false');
  result = result.replace(lock_hook_regex, 'false');

  // 3. Unwrap <KillSwitch>...</KillSwitch> JSX tags
  // Uses a precise JSX tag parser that respects double/single quotes and curly braced fallback expressions
  const kill_tag_regex = /<KillSwitch\b(?:[^>"{}]|"[^"]*"|'[^']*'|{[^}]*})*>([\s\S]*?)<\/KillSwitch>/g;
  let previous = '';
  while (result !== previous) {
    previous = result;
    result = result.replace(kill_tag_regex, '$1');
  }

  // 4. Unwrap <PhaseLockedRendering>...</PhaseLockedRendering> JSX tags
  const lock_tag_regex = /<PhaseLockedRendering\b(?:[^>"{}]|"[^"]*"|'[^']*'|{[^}]*})*>([\s\S]*?)<\/PhaseLockedRendering>/g;
  previous = '';
  while (result !== previous) {
    previous = result;
    result = result.replace(lock_tag_regex, '$1');
  }

  return result;
}

/**
 * Main execution handler to process files via CLI.  
 */
export function run_eject(file_paths: string[]): void {
  for (const file_path of file_paths) {
    const absolute = path.resolve(file_path);
    if (!fs.existsSync(absolute)) {
      console.warn(`[eject] File does not exist: ${file_path}`);
      continue;
    }
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      // Process directory recursively
      const files = fs.readdirSync(absolute);
      run_eject(files.map(f => path.join(file_path, f)));
      continue;
    }

    if (absolute.endsWith('.ts') || absolute.endsWith('.tsx') || absolute.endsWith('.js') || absolute.endsWith('.jsx')) {
      const content = fs.readFileSync(absolute, 'utf8');
      const transformed = eject_content(content);
      if (transformed !== content) {
        fs.writeFileSync(absolute, transformed, 'utf8');
        console.log(`[eject] Successfully processed: ${file_path}`);
      }
    }
  }
}

// Self-execute if run directly
if (typeof require !== 'undefined' && require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npx ts-node scripts/eject-physics.ts <file_or_directory_paths>');
    process.exit(1);
  }
  run_eject(args);
}
