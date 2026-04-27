import { describe, expect, it } from 'vitest';
import { GitAdapter, NullAdapter } from '../vcs.js';
import { selectVcs } from '../vcs-select.js';

describe('selectVcs', () => {
  it('default selection returns GitAdapter', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: default selection returns GitAdapter
    // INPUT: args=[], env={}
    // EXPECTED: instanceof GitAdapter
    const vcs = selectVcs([], {});
    expect(vcs).toBeInstanceOf(GitAdapter);
  });

  it('--no-commit flag selects NullAdapter', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: --no-commit flag selects NullAdapter
    // INPUT: args=['--no-commit'], env={}
    // EXPECTED: instanceof NullAdapter
    const vcs = selectVcs(['--no-commit'], {});
    expect(vcs).toBeInstanceOf(NullAdapter);
  });

  it('SPECFLOW_VCS=none selects NullAdapter', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: SPECFLOW_VCS=none selects NullAdapter
    // INPUT: args=[], env={SPECFLOW_VCS:'none'}
    // EXPECTED: instanceof NullAdapter
    const vcs = selectVcs([], { SPECFLOW_VCS: 'none' });
    expect(vcs).toBeInstanceOf(NullAdapter);
  });

  it('--no-commit overrides conflicting env', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: --no-commit overrides conflicting env
    // INPUT: args=['--no-commit'], env={SPECFLOW_VCS:'git'}
    // EXPECTED: instanceof NullAdapter
    const vcs = selectVcs(['--no-commit'], { SPECFLOW_VCS: 'git' });
    expect(vcs).toBeInstanceOf(NullAdapter);
  });

  it('--no-commit flag is position-independent', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: --no-commit flag is position-independent
    // INPUT: args=['create','epic','Test','--no-commit'], env={}
    // EXPECTED: instanceof NullAdapter
    const vcs = selectVcs(['create', 'epic', 'Test', '--no-commit'], {});
    expect(vcs).toBeInstanceOf(NullAdapter);
  });

  it('SPECFLOW_VCS with a non-none value falls through to default', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: SPECFLOW_VCS with a non-'none' value falls through to default
    // INPUT: args=[], env={SPECFLOW_VCS:'git'}
    // EXPECTED: instanceof GitAdapter
    const vcs = selectVcs([], { SPECFLOW_VCS: 'git' });
    expect(vcs).toBeInstanceOf(GitAdapter);
  });

  it('empty-string env value falls through to default', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: empty-string env value falls through to default
    // INPUT: args=[], env={SPECFLOW_VCS:''}
    // EXPECTED: instanceof GitAdapter
    const vcs = selectVcs([], { SPECFLOW_VCS: '' });
    expect(vcs).toBeInstanceOf(GitAdapter);
  });

  it('cwd override propagates to GitAdapter constructor', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: cwd override propagates to the GitAdapter constructor
    // INPUT: args=[], env={}, { cwd: '/tmp/probe' }
    // EXPECTED: instanceof GitAdapter AND adapter's internal cwd reflects '/tmp/probe'
    const vcs = selectVcs([], {}, { cwd: '/tmp/probe' });
    expect(vcs).toBeInstanceOf(GitAdapter);
    const internal = vcs as unknown as { cwd: string };
    expect(internal.cwd).toBe('/tmp/probe');
  });
});
