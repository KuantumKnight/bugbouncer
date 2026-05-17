export const ZERO_EDIT_RULESET = `
### Zero-Edit Refactor Ruleset
To ensure this fix requires zero manual modification by the developer, you MUST adhere to the following constraints when applying the code:

1. **Framework Native Prioritization**:
   - Prefer React Server Components (RSC) over Client Components where possible.
   - Use Next.js 14/15 native \`fetch\` with caching options instead of external libraries like Axios unless the project already heavily depends on them.
   - Utilize React 19's \`useActionState\` or \`useFormStatus\` instead of raw \`useState\` or \`useEffect\` for form mutations and pending states.

2. **Zero-Copy & Native Types**:
   - Do not mutate the developer's existing types. Use the provided Ghost Hook to transparently wrap and return the same data structures.

3. **Ejectability**:
   - The provided Ghost Hook is a pure, dependency-free wrapper. Ensure it does not introduce new external dependencies (e.g., Lodash, Zod) to the target file.
   - Maintain idiomatic code style that matches the existing file.
`.trim();
