# Boundary Lab: build the Next.js task workspace with your learner

A runnable Next.js App Router + TypeScript learning project. Learners filter tasks, select records, drag cards, preview writes, recover from rejection, and reproduce a real stale-version conflict. Server Actions perform actual database writes; SQLite preserves tasks after a process restart.

## Run in VS Code / WSL

Install **Node.js 24 LTS**. Extract the ZIP, then run these commands inside the `next-task-lab` folder:

```bash
node --version
npm ci
code .
npm run dev
```

Visit http://localhost:3000. Choose Alice. These are public demo accounts, deliberately accessible without passwords. Bob has a separate seeded workspace. Do not put private information in this app.

```bash
npm test
npm run typecheck
npm run build
npm start
```

`npm start` runs the built application. The project includes a lockfile for repeatable installation. SQLite uses `.data/lab.sqlite`; stop the server and delete `.data` to reset the demo. Node may print an experimental SQLite warning.

## Teach it as a guided build

Allow 35–50 minutes. Keep the app and editor side by side. Have the learner predict the outcome before each experiment, perform it, then point to the code responsible. The supplied project is the working reference; make changes on a branch and use git diff to discuss them.

### 1. Identify the viewer before loading data — 5 minutes

Open `app/page.tsx`, `lib/auth.ts`, and `lib/store.ts`.

Ask: “Where does this request get its identity, and when are the task rows filtered?”

Trace the random HttpOnly session cookie to the stored session hash. Then find `SELECT * FROM tasks WHERE owner=?`. Sign in as Bob and observe the separate records. Hiding Alice's cards in the client would not be an access check.

**Learner change:** Add a fifth seeded task for each user. Reload and verify each account sees only its own task. Describe which fields are safe to return to the browser.

### 2. Connect filters, selection, and details — 5 minutes

Open `components/workspace.tsx`. Find `navigate`, the derived `visible` array, and `detail`.

Select a card and change the status filter. Copy the URL into a new tab. Use Back and Forward. The URL owns shareable filter and record selection; `popstate` restores them. The details panel can show a selected record even when the filter hides its card.

**Learner change:** Add a URL search parameter for a title search. Preserve the selected record when searching, and make Back restore the previous search.

### 3. Follow the complete write — 7 minutes

Trace `move` → `updateTask` → `moveTask`. The server derives the caller from the cookie; the client never chooses the owner. The storage function validates the input, verifies ownership, and uses a version-conditioned update. A successful Server Action revalidates the page.

Move a card and read its version in the details panel. The 750 ms delay in `app/actions.ts` is an intentional teaching aid, not a production recommendation.

**Learner change:** Add a rule in `lib/store.ts` that prevents moving the “Map the server boundary” task directly from Todo to Done. Return a useful message and the current task. Add a test proving that the rejected move leaves the version unchanged.

### 4. Make provisional state visible — 5 minutes

Enable “Reject next move”, then drag a card or use the status buttons. The card moves immediately and shows “Confirming…”, then returns to the canonical server state with an explanation.

This reference uses explicit pending state rather than `useOptimistic` so the transition is easy to trace. `tasks` holds confirmed rows; `pending` overlays the provisional status. A ref prevents overlapping writes, and controls disable while a request is pending. Revalidated rows merge by monotonic version.

**Learner change:** Replace the overlay with React `useOptimistic` inside a transition. Preserve both the keyboard controls and failure recovery. Verify there are no optimistic-update-outside-transition warnings.

If transport fails, the app explains that the commit may still have happened and asks for a reload before retrying. A transport failure cannot prove that a database write was rolled back.

### 5. Reproduce a real stale write — 7 minutes

Open the same selected task URL in two tabs signed in as Alice. Both start with the same version. Move the task in tab A. Without reloading tab B, move it there to a different status.

Tab B's version is stale. The SQL `UPDATE ... WHERE id=? AND owner=? AND version=? RETURNING *` changes no rows. The server returns the current authorized task and a conflict result. Tab B reconciles with that task and explains the outcome. Its next move uses the refreshed version.

**Learner change:** Show the attempted status and the current server status in the conflict message. Keep the current row visible without automatically retrying the user's decision.

### 6. Decide which state survives — 5 minutes

Write a working draft. Refresh. Sign out and sign back in to the same account. The draft survives in localStorage, under an account-and-task key. Another browser will not have it. Task statuses are stored in server-side SQLite and survive a server restart; selected records and filters travel in the URL.

**Learner change:** Add a server-side saved-view table scoped to the viewer, with an authenticated Server Action. Store named filters there. Show the distinction between a browser-local draft and an account-level saved view.

## Read the boundary in code

| File | Responsibility |
| --- | --- |
| `app/page.tsx` | Server Component: identify viewer and load authorized tasks |
| `lib/auth.ts` | Read the session cookie and verify it server-side |
| `lib/data.ts` | `server-only` guard around storage imports |
| `lib/store.ts` | SQLite sessions, scoped reads, validation, ownership, atomic version checks |
| `app/actions.ts` | Server Actions: demo sign-in/out and authenticated mutation/revalidation |
| `components/workspace.tsx` | Connected board, URL state, optimistic preview, feedback, local drafts |
| `app/globals.css` | Responsive desktop and mobile layout; visible keyboard focus |
| `tests/store.test.ts` | Session, ownership, rejection, validation, and stale-version checks |

## Share the code

The ZIP includes source, the lockfile, and the guided lab. Share the ZIP directly, or initialize a repository inside the extracted folder:

```bash
git init
git add .
git commit -m "Add Next.js task boundary learning lab"
git branch -M main
```

Create an empty GitHub repository, then use the remote URL it gives you:

```bash
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

This is a server application. GitHub Pages cannot run its Server Actions or SQLite database. To share a running instance, use a Node.js 24 server/container with one application instance and a persistent writable disk. Map `.data` to that disk. Do not deploy this file-based database on ephemeral serverless storage or scale it across independent instances. A hosted SQL database is the next extension for that deployment model.

## Deliberate lab boundaries

- Sign-in is a public demo account selector, not proof of identity. Use an authentication provider/library before adding real users or sensitive data. The server-issued random session still demonstrates how subsequent requests derive an identity rather than trusting a client-submitted owner.
- Alice and Bob's demo datasets are shared by everyone using the same server. Run separate project copies for isolated learner labs.
- “Reject next move” is a public lab control that only rejects the caller's write. It is not an authorization mechanism.
- Drafts are browser-local, not cross-device storage. Working drafts are notes and do not edit the task description.
- There is no realtime broadcast or automatic conflict retry. Reload to fetch changes from another tab; stale writes demonstrate reconciliation.
- Server-side ownership and atomic version comparison are implemented; billing, job queues, invitations, audit logs, and collaborative editing are extension work.

## Primary references

- [Next.js authentication and authorization](https://nextjs.org/docs/app/guides/authentication)
- [Next.js mutating data](https://nextjs.org/docs/app/getting-started/mutating-data)
- [React useOptimistic](https://react.dev/reference/react/useOptimistic)
- [Node.js SQLite](https://nodejs.org/api/sqlite.html)

## Verification

Run the four commands above. The automated storage tests check unauthenticated writes, fabricated session tokens, cross-account access, invalid input, simulated rejection, and stale-version conflicts. The production build also checks TypeScript. A production HTTP smoke check verifies the real sign-in action, session issuance, and authorized workspace rendering. A regression test verifies that task DTOs are plain objects suitable for React serialization. The six guided exercises cover browser behavior; run them locally before adapting the lab for an audience.
