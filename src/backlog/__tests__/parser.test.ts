import { describe, expect, it } from 'vitest';
import {
  parseMilestone,
  parseWave,
  parseSlice,
  deriveIdFromPath,
  classifyFile,
} from '../parser.js';

describe('classifyFile', () => {
  it('classifies milestone.md', () => {
    // SCENARIO: file named milestone.md inside a milestone directory
    // INPUT: path = 'backlog/M001-auth/milestone.md'
    // EXPECTED: 'milestone'
    const result = classifyFile('backlog/M001-auth/milestone.md');
    expect(result).toBe('milestone');
  });

  it('classifies wave.md', () => {
    // SCENARIO: file named wave.md inside a wave directory
    // INPUT: path = 'backlog/M001-auth/waves/W001-providers/wave.md'
    // EXPECTED: 'wave'
    const result = classifyFile('backlog/M001-auth/waves/W001-providers/wave.md');
    expect(result).toBe('wave');
  });

  it('classifies slice files', () => {
    // SCENARIO: file matching S*.md pattern inside slices directory
    // INPUT: path = 'backlog/M001-auth/waves/W001-providers/slices/S001-extract.md'
    // EXPECTED: 'slice'
    const result = classifyFile('backlog/M001-auth/waves/W001-providers/slices/S001-extract.md');
    expect(result).toBe('slice');
  });

  it('returns null for unrecognized files', () => {
    // SCENARIO: a README or other file in backlog
    // INPUT: path = 'backlog/README.md'
    // EXPECTED: null
    const result = classifyFile('backlog/README.md');
    expect(result).toBeNull();
  });
});

describe('deriveIdFromPath', () => {
  it('derives milestone ID', () => {
    // SCENARIO: milestone directory name contains M-prefix and slug
    // INPUT: path = 'backlog/M001-redesign-auth/milestone.md'
    // EXPECTED: 'M001'
    const result = deriveIdFromPath('backlog/M001-redesign-auth/milestone.md', 'milestone');
    expect(result).toBe('M001');
  });

  it('derives wave composite ID', () => {
    // SCENARIO: wave nested inside milestone
    // INPUT: path = 'backlog/M001-redesign-auth/waves/W001-refactor/wave.md'
    // EXPECTED: 'M001/W001'
    const result = deriveIdFromPath(
      'backlog/M001-redesign-auth/waves/W001-refactor/wave.md',
      'wave',
    );
    expect(result).toBe('M001/W001');
  });

  it('derives slice composite ID', () => {
    // SCENARIO: slice nested inside wave inside milestone
    // INPUT: path = 'backlog/M001-redesign-auth/waves/W001-refactor/slices/S001-extract.md'
    // EXPECTED: 'M001/W001/S001'
    const result = deriveIdFromPath(
      'backlog/M001-redesign-auth/waves/W001-refactor/slices/S001-extract.md',
      'slice',
    );
    expect(result).toBe('M001/W001/S001');
  });
});

describe('parseMilestone', () => {
  it('parses valid milestone frontmatter', () => {
    // SCENARIO: well-formed milestone file
    // INPUT: markdown with title and created in frontmatter
    // EXPECTED: parsed object with title, created, derived id, path
    const content = `---
title: Redesign authentication flow
created: 2026-04-10
---

## Goal
Strategic goal here.
`;
    const result = parseMilestone(content, 'backlog/M001-redesign-auth/milestone.md');
    expect(result).toEqual({
      id: 'M001',
      title: 'Redesign authentication flow',
      path: 'backlog/M001-redesign-auth/milestone.md',
      created: '2026-04-10',
      status: 'empty',
    });
  });

  it('parses status field from frontmatter', () => {
    // SCENARIO: milestone with explicit status in frontmatter
    // INPUT: markdown with title, created, and status: milestone_defined
    // EXPECTED: parsed.status === 'milestone_defined'
    const content = `---
title: Redesign authentication flow
created: 2026-04-10
status: milestone_defined
---

## Goal
Strategic goal here.
`;
    const result = parseMilestone(content, 'backlog/M001-redesign-auth/milestone.md');
    expect(result).toEqual({
      id: 'M001',
      title: 'Redesign authentication flow',
      path: 'backlog/M001-redesign-auth/milestone.md',
      created: '2026-04-10',
      status: 'milestone_defined',
    });
  });

  it('defaults status to empty when not present', () => {
    // SCENARIO: legacy milestone without status field
    // INPUT: markdown with title and created only (no status)
    // EXPECTED: parsed.status === 'empty'
    const content = `---
title: Legacy milestone
created: 2026-01-01
---
`;
    const result = parseMilestone(content, 'backlog/M002-legacy/milestone.md');
    expect(result).toEqual({
      id: 'M002',
      title: 'Legacy milestone',
      path: 'backlog/M002-legacy/milestone.md',
      created: '2026-01-01',
      status: 'empty',
    });
  });

  it('returns null for invalid frontmatter', () => {
    // SCENARIO: milestone missing required title field
    // INPUT: markdown with only created field
    // EXPECTED: null (validation failure)
    const content = `---
created: 2026-04-10
---
`;
    const result = parseMilestone(content, 'backlog/M001-auth/milestone.md');
    expect(result).toBeNull();
  });
});

describe('parseWave', () => {
  it('parses valid wave frontmatter', () => {
    // SCENARIO: well-formed wave file
    // INPUT: markdown with title and created
    // EXPECTED: parsed object with composite ID, milestoneId, title, path, created
    const content = `---
title: Refactor platform providers
created: 2026-04-10
---

## Context
Wave context here.
`;
    const result = parseWave(content, 'backlog/M001-auth/waves/W001-refactor/wave.md');
    expect(result).toEqual({
      id: 'M001/W001',
      milestoneId: 'M001',
      title: 'Refactor platform providers',
      path: 'backlog/M001-auth/waves/W001-refactor/wave.md',
      created: '2026-04-10',
      status: 'empty',
    });
  });

  it('parses status field from frontmatter', () => {
    // SCENARIO: wave with explicit status in frontmatter
    // INPUT: markdown with title, created, and status: wave_defined
    // EXPECTED: parsed.status === 'wave_defined'
    const content = `---
title: Refactor platform providers
created: 2026-04-10
status: wave_defined
---

## Context
Wave context here.
`;
    const result = parseWave(content, 'backlog/M001-auth/waves/W001-refactor/wave.md');
    expect(result).toEqual({
      id: 'M001/W001',
      milestoneId: 'M001',
      title: 'Refactor platform providers',
      path: 'backlog/M001-auth/waves/W001-refactor/wave.md',
      created: '2026-04-10',
      status: 'wave_defined',
    });
  });
});

describe('parseSlice', () => {
  it('parses valid slice frontmatter', () => {
    // SCENARIO: well-formed slice file
    // INPUT: markdown with title only
    // EXPECTED: parsed object with composite ID, waveId, title, path
    const content = `---
title: Extract platform adapter interface
---

## Context
Slice context.
`;
    const result = parseSlice(
      content,
      'backlog/M001-auth/waves/W001-refactor/slices/S001-extract.md',
    );
    expect(result).toEqual({
      id: 'M001/W001/S001',
      waveId: 'M001/W001',
      title: 'Extract platform adapter interface',
      path: 'backlog/M001-auth/waves/W001-refactor/slices/S001-extract.md',
      created: '',
      status: 'empty',
    });
  });

  it('parses status and created fields', () => {
    // SCENARIO: slice with all frontmatter fields populated
    // INPUT: markdown with title, created, and status
    // EXPECTED: parsed includes created date and status value
    const content = `---
title: Extract platform adapter interface
created: 2026-04-10
status: slice_defined
---

## Context
Slice context.
`;
    const result = parseSlice(
      content,
      'backlog/M001-auth/waves/W001-refactor/slices/S001-extract.md',
    );
    expect(result).toEqual({
      id: 'M001/W001/S001',
      waveId: 'M001/W001',
      title: 'Extract platform adapter interface',
      path: 'backlog/M001-auth/waves/W001-refactor/slices/S001-extract.md',
      created: '2026-04-10',
      status: 'slice_defined',
    });
  });

  it('defaults created and status for legacy slices', () => {
    // SCENARIO: legacy slice with only title in frontmatter
    // INPUT: markdown with title only (no created, no status)
    // EXPECTED: created defaults to '', status defaults to 'empty'
    const content = `---
title: Legacy slice
---
`;
    const result = parseSlice(
      content,
      'backlog/M001-auth/waves/W001-refactor/slices/S002-legacy.md',
    );
    expect(result).toEqual({
      id: 'M001/W001/S002',
      waveId: 'M001/W001',
      title: 'Legacy slice',
      path: 'backlog/M001-auth/waves/W001-refactor/slices/S002-legacy.md',
      created: '',
      status: 'empty',
    });
  });
});
