/**
 * @param {Array<{ id: string, run: (ctx: object) => Promise<void> }>} steps
 * @param {object} ctx
 */
export async function runBootSteps(steps, ctx) {
  for (const step of steps) {
    try {
      await step.run(ctx);
    } catch (err) {
      console.error('[boot]', step.id, err);
      throw err;
    }
  }
}
