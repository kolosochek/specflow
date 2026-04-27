import matter from 'gray-matter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Check {
  name: string;
  passed: boolean;
}

export interface CheckResult {
  ok: boolean;
  checks: Check[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract text between `## heading` and the next `##` or end-of-string.
 * Returns the trimmed block, or `null` if the heading is not found.
 */
function sectionContent(body: string, heading: string): string | null {
  const lines = body.split('\n');
  const target = `## ${heading}`;
  let startIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === target) {
      startIndex = i + 1;
      break;
    }
  }

  if (startIndex === -1) return null;

  const collected: string[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) break;
    collected.push(lines[i]);
  }

  return collected.join('\n').trim();
}

/** Count lines that start with `- ` (top-level bullets). */
function countBullets(text: string): number {
  return text.split('\n').filter((line) => line.startsWith('- ')).length;
}

/** Check whether a value is a valid YYYY-MM-DD date with correct calendar day. */
function isValidDate(value: unknown): boolean {
  if (value instanceof Date) return !isNaN(value.getTime());
  if (typeof value !== 'string') return false;
  if (value.length !== 10 || value[4] !== '-' || value[7] !== '-') return false;
  const year = parseInt(value.slice(0, 4), 10);
  const month = parseInt(value.slice(5, 7), 10);
  const day = parseInt(value.slice(8, 10), 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  // Verify the date components round-trip correctly (catches Feb 30, etc.)
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/** Build a CheckResult from a list of checks (derives `ok` automatically). */
function buildResult(checks: Check[]): CheckResult {
  return {
    ok: checks.every((c) => c.passed),
    checks,
  };
}

// ---------------------------------------------------------------------------
// checkEpic
// ---------------------------------------------------------------------------

export function checkEpic(content: string): CheckResult {
  const { data, content: body } = matter(content);

  const titleOk = typeof data.title === 'string' && data.title !== 'Epic title';
  const dateOk = isValidDate(data.created);

  const goalText = sectionContent(body, 'Goal');
  const goalHasContent = goalText !== null && goalText.length > 0;

  const criteriaText = sectionContent(body, 'Success criteria');
  const criteriaExists = criteriaText !== null;
  const criteriaCount = criteriaText ? countBullets(criteriaText) : 0;

  return buildResult([
    { name: 'title is not template default', passed: titleOk },
    { name: 'created is a valid date', passed: dateOk },
    { name: '## Goal has content', passed: goalHasContent },
    { name: '## Success criteria exists', passed: criteriaExists },
    { name: 'Success criteria >= 2 items', passed: criteriaCount >= 2 },
  ]);
}

// ---------------------------------------------------------------------------
// checkMilestone
// ---------------------------------------------------------------------------

export function checkMilestone(content: string): CheckResult {
  const { data, content: body } = matter(content);

  const titleOk = typeof data.title === 'string' && data.title !== 'Milestone title';
  const dateOk = isValidDate(data.created);

  const goalText = sectionContent(body, 'Goal');
  const goalHasContent = goalText !== null && goalText.length > 0;

  const criteriaText = sectionContent(body, 'Success criteria');
  const criteriaExists = criteriaText !== null;
  const criteriaCount = criteriaText ? countBullets(criteriaText) : 0;

  return buildResult([
    { name: 'title is not template default', passed: titleOk },
    { name: 'created is a valid date', passed: dateOk },
    { name: '## Goal has content', passed: goalHasContent },
    { name: '## Success criteria exists', passed: criteriaExists },
    { name: 'Success criteria >= 2 items', passed: criteriaCount >= 2 },
  ]);
}

// ---------------------------------------------------------------------------
// checkWave
// ---------------------------------------------------------------------------

export function checkWave(content: string): CheckResult {
  const { data, content: body } = matter(content);

  const titleOk = typeof data.title === 'string' && data.title !== 'Wave title';
  const dateOk = isValidDate(data.created);

  const contextText = sectionContent(body, 'Context');
  const contextHasContent = contextText !== null && contextText.length > 0;

  const scopeText = sectionContent(body, 'Scope overview');
  const scopeHasContent = scopeText !== null && scopeText.length > 0;

  const slicesText = sectionContent(body, 'Slices summary');
  const slicesExists = slicesText !== null;
  const hasSPrefixed = slicesText
    ? slicesText.split('\n').some((line) => /^- S\d{3}:/.test(line))
    : false;

  return buildResult([
    { name: 'title is not template default', passed: titleOk },
    { name: 'created is a valid date', passed: dateOk },
    { name: '## Context has content', passed: contextHasContent },
    { name: '## Scope overview has content', passed: scopeHasContent },
    { name: '## Slices summary exists', passed: slicesExists },
    { name: 'Slices summary has S-prefixed items', passed: hasSPrefixed },
  ]);
}

// ---------------------------------------------------------------------------
// checkSlice
// ---------------------------------------------------------------------------

export function checkSlice(content: string): CheckResult {
  const { data, content: body } = matter(content);

  const titleOk = typeof data.title === 'string' && data.title !== 'Slice title';
  const dateOk = isValidDate(data.created);

  // ## Context
  const contextText = sectionContent(body, 'Context');
  const contextHasContent = contextText !== null && contextText.length > 0;

  // ## Assumptions
  const assumptionsText = sectionContent(body, 'Assumptions');
  const assumptionsExists = assumptionsText !== null;

  // ## Scope
  const scopeText = sectionContent(body, 'Scope');
  const scopeHasContent = scopeText !== null && scopeText.length > 0;
  const scopeBullets = scopeText
    ? scopeText.split('\n').filter((line) => line.startsWith('- '))
    : [];
  const allScopeHaveEmDash =
    scopeBullets.length > 0 && scopeBullets.every((line) => line.includes(' \u2014 '));

  // ## Requirements
  const reqText = sectionContent(body, 'Requirements');
  const reqHasContent = reqText !== null && countBullets(reqText) >= 1;
  const reqCount = reqText ? countBullets(reqText) : 0;

  // ## Test expectations
  const testText = sectionContent(body, 'Test expectations');
  const testExists = testText !== null;

  // Test file path with annotation
  const hasTestFilePath = testText
    ? testText.split('\n').some((line) => /`[^`]+`\s+\u2014\s+(new file|modify)/.test(line))
    : false;

  // Run command
  const hasRunCommand = testText
    ? testText.split('\n').some((line) => line.startsWith('- Run:'))
    : false;

  // Cases section
  const testLines = testText ? testText.split('\n') : [];
  const casesLineIndex = testLines.findIndex((line) => line.startsWith('- Cases:'));
  const casesExists = casesLineIndex !== -1;

  let casesCount = 0;
  if (casesExists) {
    for (let i = casesLineIndex + 1; i < testLines.length; i++) {
      const line = testLines[i];
      if (/^\s{2,}- /.test(line)) {
        casesCount++;
      } else if (line.trim().length > 0) {
        // non-indented non-empty line ends the sub-items block
        break;
      }
    }
  }

  // ## Acceptance criteria
  const acceptText = sectionContent(body, 'Acceptance criteria');
  const acceptExists = acceptText !== null;
  const acceptCount = acceptText ? countBullets(acceptText) : 0;

  return buildResult([
    { name: 'title is not template default', passed: titleOk },
    { name: 'created is a valid date', passed: dateOk },
    { name: '## Context has content', passed: contextHasContent },
    { name: '## Assumptions exists', passed: assumptionsExists },
    { name: '## Scope has content', passed: scopeHasContent },
    { name: 'Scope items have em-dash annotations', passed: allScopeHaveEmDash },
    { name: '## Requirements exists', passed: reqText !== null },
    { name: 'Requirements >= 1 item', passed: reqHasContent },
    { name: '## Test expectations exists', passed: testExists },
    { name: 'Test file path with annotation', passed: hasTestFilePath },
    { name: 'Run command found', passed: hasRunCommand },
    { name: 'Cases section has items', passed: casesExists && casesCount > 0 },
    { name: 'Cases count >= Requirements count', passed: casesCount >= reqCount },
    { name: '## Acceptance criteria exists', passed: acceptExists },
    { name: 'Acceptance criteria >= 2 items', passed: acceptCount >= 2 },
  ]);
}
