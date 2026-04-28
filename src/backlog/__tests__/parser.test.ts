import { describe, expect, it } from 'vitest';
import {
  parseEpic,
  parseMilestone,
  parseWave,
  parseSlice,
  deriveIdFromPath,
  classifyFile,
} from '../parser.js';

// Reusable example paths for the 4-level hierarchy
const EPIC_PATH = 'backlog/E001-foundation/epic.md';
const MILESTONE_PATH = 'backlog/E001-foundation/milestones/M001-redesign-auth/milestone.md';
const WAVE_PATH =
  'backlog/E001-foundation/milestones/M001-redesign-auth/waves/W001-refactor/wave.md';
const SLICE_PATH =
  'backlog/E001-foundation/milestones/M001-redesign-auth/waves/W001-refactor/slices/S001-extract.md';

describe('classifyFile', () => {
  it('classifies epic.md', () => {
    // SCENARIO: file named epic.md inside an epic directory
    // INPUT: path = 'backlog/E001-foundation/epic.md'
    // EXPECTED: 'epic'
    const result = classifyFile(EPIC_PATH);
    expect(result).toBe('epic');
  });

  it('classifies milestone.md', () => {
    // SCENARIO: file named milestone.md inside an epic/milestones directory
    // INPUT: 4-level path ending in milestone.md
    // EXPECTED: 'milestone'
    const result = classifyFile(MILESTONE_PATH);
    expect(result).toBe('milestone');
  });

  it('classifies wave.md', () => {
    // SCENARIO: file named wave.md nested inside a milestone
    // INPUT: 4-level path ending in wave.md
    // EXPECTED: 'wave'
    const result = classifyFile(WAVE_PATH);
    expect(result).toBe('wave');
  });

  it('classifies slice files', () => {
    // SCENARIO: file matching S*.md pattern inside slices directory
    // INPUT: 4-level path ending in S001-extract.md
    // EXPECTED: 'slice'
    const result = classifyFile(SLICE_PATH);
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
  it('derives epic ID', () => {
    // SCENARIO: epic directory name contains E-prefix and slug
    // INPUT: path = 'backlog/E001-foundation/epic.md'
    // EXPECTED: 'E001'
    const result = deriveIdFromPath(EPIC_PATH, 'epic');
    expect(result).toBe('E001');
  });

  it('derives milestone composite ID with epic prefix', () => {
    // SCENARIO: milestone nested inside an epic
    // INPUT: 4-level milestone path
    // EXPECTED: 'E001/M001'
    const result = deriveIdFromPath(MILESTONE_PATH, 'milestone');
    expect(result).toBe('E001/M001');
  });

  it('derives wave composite ID with full ancestry', () => {
    // SCENARIO: wave nested inside milestone inside epic
    // INPUT: 4-level wave path
    // EXPECTED: 'E001/M001/W001'
    const result = deriveIdFromPath(WAVE_PATH, 'wave');
    expect(result).toBe('E001/M001/W001');
  });

  it('derives slice composite ID with full ancestry', () => {
    // SCENARIO: slice nested all the way down to slices folder
    // INPUT: 4-level slice path
    // EXPECTED: 'E001/M001/W001/S001'
    const result = deriveIdFromPath(SLICE_PATH, 'slice');
    expect(result).toBe('E001/M001/W001/S001');
  });

  it('returns null when an ancestor segment is malformed', () => {
    // SCENARIO: milestone path missing the epic prefix
    // INPUT: legacy v0.1-style path without epic ancestor
    // EXPECTED: null (validation failure)
    const result = deriveIdFromPath('backlog/M001-redesign-auth/milestone.md', 'milestone');
    expect(result).toBeNull();
  });
});

describe('parseEpic', () => {
  it('parses valid epic frontmatter', () => {
    // SCENARIO: well-formed epic file
    // INPUT: markdown with title and created in frontmatter
    // EXPECTED: parsed object with title, created, derived id, path, default status
    const content = `---
title: Foundation hardening
created: 2026-04-27
---

## Goal
Strategic theme here.
`;
    const result = parseEpic(content, EPIC_PATH);
    expect(result).toEqual({
      id: 'E001',
      title: 'Foundation hardening',
      path: EPIC_PATH,
      created: '2026-04-27',
      status: 'empty',
      manualStatus: null,
      manualDoneReason: null,
    });
  });

  it('parses status field from frontmatter', () => {
    // SCENARIO: epic with explicit status in frontmatter
    // INPUT: markdown with title, created, and status: epic_defined
    // EXPECTED: parsed.status === 'epic_defined'
    const content = `---
title: Foundation hardening
created: 2026-04-27
status: epic_defined
---

## Goal
Strategic theme here.
`;
    const result = parseEpic(content, EPIC_PATH);
    expect(result?.status).toBe('epic_defined');
  });

  it('returns null when frontmatter title missing', () => {
    // SCENARIO: epic file missing required title
    // INPUT: markdown with only created field
    // EXPECTED: null (validation failure)
    const content = `---
created: 2026-04-27
---
`;
    const result = parseEpic(content, EPIC_PATH);
    expect(result).toBeNull();
  });
});

describe('parseMilestone', () => {
  it('parses valid milestone frontmatter and derives epicId', () => {
    // SCENARIO: well-formed milestone file inside an epic
    // INPUT: 4-level milestone path with frontmatter
    // EXPECTED: parsed object includes epicId from path
    const content = `---
title: Redesign authentication flow
created: 2026-04-10
---

## Goal
Strategic goal here.
`;
    const result = parseMilestone(content, MILESTONE_PATH);
    expect(result).toEqual({
      id: 'E001/M001',
      epicId: 'E001',
      title: 'Redesign authentication flow',
      path: MILESTONE_PATH,
      created: '2026-04-10',
      status: 'empty',
      manualStatus: null,
      manualDoneReason: null,
    });
  });

  it('parses status field from frontmatter', () => {
    // SCENARIO: milestone with explicit status
    // INPUT: markdown with status: milestone_defined
    // EXPECTED: parsed.status === 'milestone_defined'
    const content = `---
title: Redesign authentication flow
created: 2026-04-10
status: milestone_defined
---

## Goal
Strategic goal here.
`;
    const result = parseMilestone(content, MILESTONE_PATH);
    expect(result?.status).toBe('milestone_defined');
  });

  it('returns null when path is missing the epic ancestor', () => {
    // SCENARIO: legacy v0.1-style milestone path without epic
    // INPUT: 'backlog/M001-redesign-auth/milestone.md'
    // EXPECTED: null (path malformed under v0.2 grammar)
    const content = `---
title: Legacy milestone
created: 2026-01-01
---
`;
    const result = parseMilestone(content, 'backlog/M001-redesign-auth/milestone.md');
    expect(result).toBeNull();
  });
});

describe('parseWave', () => {
  it('parses valid wave frontmatter and derives milestoneId', () => {
    // SCENARIO: well-formed wave file inside epic/milestones/.../waves/...
    // INPUT: 4-level wave path
    // EXPECTED: parsed object with full composite IDs
    const content = `---
title: Refactor platform providers
created: 2026-04-10
---

## Context
Wave context here.
`;
    const result = parseWave(content, WAVE_PATH);
    expect(result).toEqual({
      id: 'E001/M001/W001',
      milestoneId: 'E001/M001',
      title: 'Refactor platform providers',
      path: WAVE_PATH,
      created: '2026-04-10',
      status: 'empty',
    });
  });

  it('parses status field from frontmatter', () => {
    // SCENARIO: wave with explicit status
    // INPUT: markdown with status: wave_defined
    // EXPECTED: parsed.status === 'wave_defined'
    const content = `---
title: Refactor platform providers
created: 2026-04-10
status: wave_defined
---

## Context
Wave context here.
`;
    const result = parseWave(content, WAVE_PATH);
    expect(result?.status).toBe('wave_defined');
  });
});

describe('parseSlice', () => {
  it('parses valid slice frontmatter and derives waveId', () => {
    // SCENARIO: well-formed slice file inside .../waves/.../slices/...
    // INPUT: 4-level slice path with title only
    // EXPECTED: parsed object with full composite IDs and default created/status
    const content = `---
title: Extract platform adapter interface
---

## Context
Slice context.
`;
    const result = parseSlice(content, SLICE_PATH);
    expect(result).toEqual({
      id: 'E001/M001/W001/S001',
      waveId: 'E001/M001/W001',
      title: 'Extract platform adapter interface',
      path: SLICE_PATH,
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
    const result = parseSlice(content, SLICE_PATH);
    expect(result).toEqual({
      id: 'E001/M001/W001/S001',
      waveId: 'E001/M001/W001',
      title: 'Extract platform adapter interface',
      path: SLICE_PATH,
      created: '2026-04-10',
      status: 'slice_defined',
    });
  });

  it('defaults created and status for legacy slices', () => {
    // SCENARIO: legacy slice with only title in frontmatter
    // INPUT: markdown with title only (no created, no status)
    // EXPECTED: created defaults to '', status defaults to 'empty'
    const path =
      'backlog/E001-foundation/milestones/M001-redesign-auth/waves/W001-refactor/slices/S002-legacy.md';
    const content = `---
title: Legacy slice
---
`;
    const result = parseSlice(content, path);
    expect(result).toEqual({
      id: 'E001/M001/W001/S002',
      waveId: 'E001/M001/W001',
      title: 'Legacy slice',
      path,
      created: '',
      status: 'empty',
    });
  });
});
