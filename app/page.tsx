import { viewer } from '@/lib/auth';
import { listTasks } from '@/lib/data';
import { signIn, signOut } from './actions';
import Workspace from '@/components/workspace';
export const runtime = 'nodejs';
export default async function Page() {
  const user = await viewer();
  if (!user) return <main className="login"><span className="eyebrow">NEXT.JS / PRACTICE LAB 01</span><h1>Where the UI<br/>meets reality.</h1><p>Build a connected task workspace. Move fast in the browser, then let the server confirm what happened.</p><form action={signIn}><label htmlFor="user">Choose a public demo account</label><select id="user" name="user"><option value="alice">Alice · workspace A</option><option value="bob">Bob · workspace B</option></select><button className="primary">Enter the lab →</button></form><small>Public sample identities. Use only the seeded learning data.</small></main>;
  // The browser receives only this viewer's task DTOs, never sessions or all records.
  const tasks = listTasks(user);
  return <><header><a href="/" className="brand">◈ Boundary Lab</a><span>Next.js · connected workflows</span><form action={signOut}><button>Sign out {user}</button></form></header><Workspace key={user} initialTasks={tasks} user={user}/></>;
}
