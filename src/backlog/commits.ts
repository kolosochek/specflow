export type CompositeType = 'epic' | 'milestone' | 'wave' | 'slice';

export interface CommitMessageInput {
  id: string;
  title: string;
  type: CompositeType;
}

const DEFAULT_TEMPLATE = '[backlog] create {{id}}: {{title}}';

export function commitMessageFor(
  input: CommitMessageInput,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw = env.SPECFLOW_COMMIT_TEMPLATE;
  const template = raw && raw.length > 0 ? raw : DEFAULT_TEMPLATE;
  return template
    .replace(/\{\{id\}\}/g, input.id)
    .replace(/\{\{title\}\}/g, input.title)
    .replace(/\{\{type\}\}/g, input.type);
}
