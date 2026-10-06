'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSession, deleteSession, moveTask } from '@/lib/data';
import { viewer } from '@/lib/auth';
// Public demo identities, not production credentials. See README before deployment.
export async function signIn(form: FormData) {
  const user = form.get('user');
  if (user !== 'alice' && user !== 'bob') throw new Error('Invalid demo identity');
  const jar = await cookies();
  const old = jar.get('lab-session')?.value;
  if(old) deleteSession(old);
  jar.set('lab-session', createSession(user), { httpOnly:true, sameSite:'lax', secure:process.env.NODE_ENV==='production', path:'/', maxAge:86400 });
  redirect('/');
}
export async function signOut() {
  const jar = await cookies(); const token = jar.get('lab-session')?.value;
  if (token) deleteSession(token); jar.delete('lab-session'); redirect('/');
}
export async function updateTask(input: unknown) {
  const user = await viewer();
  // Deliberate lab delay makes the provisional UI observable.
  await new Promise(resolve => setTimeout(resolve, 750));
  const result = moveTask(user, input);
  if (result.ok) revalidatePath('/');
  return result;
}
