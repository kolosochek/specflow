import { z } from 'zod';

// Zod helper: gray-matter parses YAML dates as Date objects.
// Accept both string and Date, normalizing Date to 'YYYY-MM-DD'.
export const yamlDateString = z.union([
  z.string(),
  z.date().transform((d) => d.toISOString().split('T')[0]),
]);

export const epicFrontmatter = z.object({
  title: z.string(),
  created: yamlDateString,
  status: z.enum(['empty', 'epic_defined']).default('empty'),
});

export const milestoneFrontmatter = z.object({
  title: z.string(),
  created: yamlDateString,
  status: z.enum(['empty', 'milestone_defined']).default('empty'),
});

export const waveFrontmatter = z.object({
  title: z.string(),
  created: yamlDateString,
  status: z.enum(['empty', 'wave_defined']).default('empty'),
});

export const sliceFrontmatter = z.object({
  title: z.string(),
  created: yamlDateString.optional().default(''),
  status: z.enum(['empty', 'slice_defined']).default('empty'),
});
