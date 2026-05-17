import { FuzzerAnomaly } from '../fuzzer/types';
import { validate_syntax } from './validator';
import * as templates from '../../hooks/stability/templates';
import { ZERO_EDIT_RULESET } from './rules';

export interface PromptGenerationResult {
  markdown: string;
  is_valid: boolean;
  generation_time_ms: number;
}

export function generate_ghost_hook_prompt(anomaly: FuzzerAnomaly): PromptGenerationResult {
  const start_time = performance.now();
  
  let hook_code = '';
  let description = '';

  switch (anomaly.anomaly_type) {
    case 'hydration_mismatch':
      description = `A hydration mismatch was detected on component **${anomaly.component_name}**.`;
      hook_code = templates.get_hydration_template(anomaly.component_name);
      break;
    case 'orphaned_action':
      description = `An orphaned action was detected for URL **${anomaly.request_url}** due to **${anomaly.simulated_failure}**.`;
      hook_code = templates.get_orphaned_action_template();
      break;
    case 'coherence_failure':
      description = `A coherence failure (race condition) occurred for dependency **${anomaly.dependency_id}**.`;
      hook_code = templates.get_coherence_template();
      break;
    case 'void_payload':
      description = `A void payload crashed the system at field **${anomaly.target_field}**.`;
      hook_code = templates.get_void_payload_template(anomaly.target_field);
      break;
    case 'url_state_rot':
      description = `URL state rot detected on **${anomaly.original_url}**.`;
      hook_code = templates.get_url_state_template();
      break;
    default:
      throw new Error('Unknown anomaly type');
  }

  const is_valid = validate_syntax(hook_code);

  const markdown = `
# BugBouncer Ghost Hook Fix

${description}

Apply the following pure, dependency-free wrapper to stabilize the component:

\`\`\`typescript
${hook_code}
\`\`\`

${ZERO_EDIT_RULESET}
`.trim();

  const end_time = performance.now();

  return {
    markdown,
    is_valid,
    generation_time_ms: end_time - start_time
  };
}
