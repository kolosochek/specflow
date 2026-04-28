import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';

const WORKFLOW_PATH = resolve(process.cwd(), '.github/workflows/docs.yml');

interface WorkflowJob {
  needs?: string | string[];
  permissions?: Record<string, string>;
  steps?: Array<{
    name?: string;
    uses?: string;
    run?: string;
    with?: Record<string, unknown>;
  }>;
}

interface WorkflowDef {
  on?: {
    push?: { branches?: string[] };
    pull_request?: unknown;
  };
  jobs?: Record<string, WorkflowJob>;
}

let workflow: WorkflowDef | null = null;

beforeAll(() => {
  if (!existsSync(WORKFLOW_PATH)) return;
  const raw = readFileSync(WORKFLOW_PATH, 'utf-8');
  workflow = parseYaml(raw) as WorkflowDef;
});

describe('docs.yml workflow', () => {
  it('triggers on push to main only', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: workflow triggers on push to main only
    // INPUT: parse .github/workflows/docs.yml
    // EXPECTED: on.push.branches equals ['main'] and there is no pull_request trigger
    expect(workflow).not.toBeNull();
    expect(workflow?.on?.push?.branches).toEqual(['main']);
    expect(workflow?.on?.pull_request).toBeUndefined();
  });

  it('has build and deploy jobs', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: workflow has build and deploy jobs
    // INPUT: same parse
    // EXPECTED: jobs.build and jobs.deploy both exist
    expect(workflow?.jobs?.build).toBeDefined();
    expect(workflow?.jobs?.deploy).toBeDefined();
  });

  it('deploy depends on build', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: deploy depends on build
    // INPUT: same parse
    // EXPECTED: jobs.deploy.needs includes 'build'
    const needs = workflow?.jobs?.deploy?.needs;
    if (Array.isArray(needs)) {
      expect(needs).toContain('build');
    } else {
      expect(needs).toBe('build');
    }
  });

  it('deploy job has the required permissions', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: deploy job has the required permissions
    // INPUT: same parse
    // EXPECTED: jobs.deploy.permissions['pages'] === 'write' AND jobs.deploy.permissions['id-token'] === 'write'
    expect(workflow?.jobs?.deploy?.permissions?.['pages']).toBe('write');
    expect(workflow?.jobs?.deploy?.permissions?.['id-token']).toBe('write');
  });

  it('build job invokes the documented npm scripts in order', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: build job invokes npm ci then npm run docs:build
    // INPUT: same parse
    // EXPECTED: build job's steps include both `npm ci` and `npm run docs:build` (in that order)
    const runs = (workflow?.jobs?.build?.steps ?? [])
      .map((s) => s.run ?? '')
      .filter((r) => r.length > 0);
    const ciIdx = runs.findIndex((r) => r.includes('npm ci'));
    const buildIdx = runs.findIndex((r) => r.includes('npm run docs:build'));
    expect(ciIdx).toBeGreaterThanOrEqual(0);
    expect(buildIdx).toBeGreaterThanOrEqual(0);
    expect(ciIdx).toBeLessThan(buildIdx);
  });

  it('build job uses Node 22', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: build job uses Node 22
    // INPUT: same parse
    // EXPECTED: setup-node step's with.node-version equals '22' or 22
    const setupNode = (workflow?.jobs?.build?.steps ?? []).find((s) =>
      (s.uses ?? '').startsWith('actions/setup-node@'),
    );
    const ver = setupNode?.with?.['node-version'];
    expect(String(ver)).toBe('22');
  });

  it('artifact upload uses the official Pages action', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: artifact upload uses the official Pages action
    // INPUT: same parse
    // EXPECTED: build job's last step uses actions/upload-pages-artifact@v3
    const steps = workflow?.jobs?.build?.steps ?? [];
    const last = steps[steps.length - 1];
    expect(last?.uses ?? '').toMatch(/^actions\/upload-pages-artifact@v3/);
  });
});
