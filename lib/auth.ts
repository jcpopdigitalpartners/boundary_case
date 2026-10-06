import 'server-only';
import { cookies } from 'next/headers';
import { sessionUser } from './data';
export async function viewer() { return sessionUser((await cookies()).get('lab-session')?.value); }
