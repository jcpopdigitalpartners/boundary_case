// Node-only storage. Keep this module behind lib/data.ts in application code.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { statuses, type Task, type Result } from './types';
const location = process.env.LAB_DB_PATH ?? path.join(process.cwd(), '.data', 'lab.sqlite');
if (location !== ':memory:') mkdirSync(path.dirname(location), { recursive: true });
const db = new DatabaseSync(location);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, owner TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user TEXT NOT NULL, expires INTEGER NOT NULL);`);
const insert = db.prepare('INSERT OR IGNORE INTO tasks VALUES(?,?,?,?,1,?)');
for (const user of ['alice','bob']) {
  insert.run(`${user}-1`, 'Map the server boundary', 'Trace how the viewer is identified before tasks reach the browser.', 'Todo', user);
  insert.run(`${user}-2`, 'Make a write trustworthy', 'Validate input, verify access, then compare versions before committing.', 'Doing', user);
  insert.run(`${user}-3`, 'Keep a draft after refresh', 'Write a note in the details panel. Refresh and check that it survives.', 'Todo', user);
  insert.run(`${user}-4`, 'Recover from a conflict', 'Open this task in two tabs. Update one, then move the stale copy.', 'Todo', user);
}
export function listTasks(user: string): Task[] { return (db.prepare('SELECT * FROM tasks WHERE owner=? ORDER BY id').all(user) as Task[]).map(row => ({...row})); }
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export function createSession(user: string) {
  const token = randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token), user, Date.now()+86400000);
  return token;
}
export function sessionUser(token: string | undefined): string | null {
  if (!token) return null;
  const row = db.prepare('SELECT user FROM sessions WHERE token_hash=? AND expires>?').get(hash(token), Date.now()) as {user:string}|undefined;
  return row?.user ?? null;
}
export function deleteSession(token: string) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)); }
export function moveTask(user: string | null, input: unknown): Result {
  if (!user) return {ok:false, code:'AUTH', message:'Your session expired. Sign in again.'};
  const value = input as {id?:unknown; status?:unknown; version?:unknown; reject?:unknown}|null;
  if (!value || typeof value.id !== 'string' || !statuses.includes(value.status as never) || !Number.isInteger(value.version) || Number(value.version)<1 || typeof value.reject !== 'boolean')
    return {ok:false,code:'VALIDATION',message:'Provide a task ID, a valid status, and a positive integer version.'};
  // Ownership participates in the UPDATE itself. Never accept an owner from the browser.
  const task = db.prepare('SELECT * FROM tasks WHERE id=? AND owner=?').get(value.id, user) as Task|undefined;
  if (!task) return {ok:false,code:'ACCESS',message:'This task is unavailable to your account.'};
  if (value.reject) return {ok:false,code:'RULE',message:'Lab rule rejected this move. Your task has been restored.',task:{...task}};
  const updated = db.prepare('UPDATE tasks SET status=?,version=version+1 WHERE id=? AND owner=? AND version=? RETURNING *').get(value.status as string,value.id,user,Number(value.version)) as Task|undefined;
  if (updated) return {ok:true,task:{...updated}};
  const current = db.prepare('SELECT * FROM tasks WHERE id=? AND owner=?').get(value.id,user) as Task|undefined;
  return {ok:false,code:'CONFLICT',message:'Another tab changed this task. Loaded the latest version; review it before trying again.',task:current ? {...current} : undefined};
}
