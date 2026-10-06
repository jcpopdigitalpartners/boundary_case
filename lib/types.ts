export const statuses = ['Todo', 'Doing', 'Done'] as const;
export type Status = typeof statuses[number];
export type Task = { id: string; title: string; description: string; status: Status; version: number; owner: string };
export type Result = { ok: true; task: Task } | { ok: false; code: string; message: string; task?: Task };
