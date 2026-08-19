Run the post-implementation quality gate. Stop and report if any step fails.

## Steps

1. **Format code**
   ```bash
   ./scripts/convert-format-code.sh
   ```

2. **TypeScript type check**
   ```bash
   npx tsc --noEmit
   ```
   If errors exist, list them and stop.

3. **Library build**
   ```bash
   npm run build:lib
   ```
   If build fails, list errors and stop.

## Output

Report results as:
- [PASS] or [FAIL] for each step
- On failure: show errors and stop
