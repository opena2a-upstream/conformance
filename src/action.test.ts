import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const actionPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'action.yml'
);

interface ActionStep {
  name?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
}

interface ActionFile {
  inputs?: Record<string, unknown>;
  runs?: { steps?: ActionStep[] };
}

async function loadAction(): Promise<ActionFile> {
  const raw = await fs.readFile(actionPath, 'utf-8');
  return parseYaml(raw) as ActionFile;
}

describe('action.yml', () => {
  it('has run steps', async () => {
    const steps = (await loadAction()).runs?.steps ?? [];
    expect(steps.filter((s) => s.run).length).toBeGreaterThan(0);
  });

  it('keeps expressions out of run scripts', async () => {
    const steps = (await loadAction()).runs?.steps ?? [];
    const offenders = steps
      .filter((s) => s.run && s.run.includes('${{'))
      .map((s) => s.name ?? '<unnamed step>');
    expect(offenders).toEqual([]);
  });

  it('passes every action input to a step through env or with', async () => {
    const action = await loadAction();
    const steps = action.runs?.steps ?? [];
    const used = steps.flatMap((s) => [
      ...Object.values(s.env ?? {}),
      ...Object.values(s.with ?? {})
    ]);
    for (const input of Object.keys(action.inputs ?? {})) {
      const expr = `\${{ inputs.${input} }}`;
      expect(used.includes(expr), `input '${input}' is never used`).toBe(true);
    }
  });
});
