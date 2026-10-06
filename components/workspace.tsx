'use client';
import { useEffect, useRef, useState } from 'react';
import { updateTask } from '@/app/actions';
import { statuses, type Status, type Task } from '@/lib/types';
const lessons = [
  ['Read the boundary', 'The Server Component verifies your session and loads only your tasks. Follow app/page.tsx → lib/auth.ts → lib/store.ts.'],
  ['Connect the interface', 'Filter tasks, select a card, and copy the URL. Open it in another tab: the filter and selection return.'],
  ['Preview a successful write', 'Drag a card to a column, or use the status buttons. Watch “Confirming…” before the version increases.'],
  ['Recover from rejection', 'Enable “Reject next move” and move a task. Watch the provisional move unwind without losing the task.'],
  ['Meet a real conflict', 'Open the same task in two tabs. Move it in tab A; without refreshing tab B, move its stale copy. Tab B loads the server version.'],
  ['Choose what survives', 'Write a draft and refresh. It survives on this browser. Copy a URL elsewhere: the view travels; the local draft does not.'],
];
export default function Workspace({initialTasks,user}:{initialTasks:Task[];user:string}) {
  const [tasks,setTasks] = useState(initialTasks);
  const [pending,setPending] = useState<{id:string;status:Status}|null>(null);
  const lock = useRef(false);
  const [filter,setFilter] = useState('all');
  const [selected,setSelected] = useState<string|null>(null);
  const [reject,setReject] = useState(false);
  const [message,setMessage] = useState('Ready. Choose a task and try a move.');
  const [outcome,setOutcome] = useState('ready');
  const [step,setStep] = useState(0);
  const [draft,setDraft] = useState('');
  const [draftReady,setDraftReady] = useState(false);
  const [draftError,setDraftError] = useState('');
  useEffect(()=>{
    // Revalidation may arrive during a write. Monotonic versions prevent old props
    // from replacing the newer canonical response or erasing an optimistic move.
    setTasks(old=>initialTasks.map(t=> { const prior=old.find(p=>p.id===t.id); return prior && prior.version>t.version ? prior : t; }));
  },[initialTasks]);
  useEffect(()=>{
    const read=()=>{ const p=new URLSearchParams(location.search); const status=p.get('status');setFilter(status && statuses.includes(status as Status)?status:'all');setSelected(p.get('task')); };
    read();window.addEventListener('popstate',read);return ()=>window.removeEventListener('popstate',read);
  },[]);
  useEffect(()=>{
    setDraftReady(false);setDraftError('');
    try {setDraft(selected?localStorage.getItem(`boundary:${user}:${selected}`)??'':'');}
    catch {setDraft('');setDraftError('This browser blocked draft storage.');}
    setDraftReady(true);
  },[selected,user]);
  function editDraft(value:string) {
    setDraft(value);
    try {localStorage.setItem(`boundary:${user}:${selected}`,value);setDraftError('');}
    catch {setDraftError('Draft could not be saved on this browser.');}
  }
  function navigate(nextFilter:string,nextSelected:string|null) {
    setFilter(nextFilter);setSelected(nextSelected);
    const params=new URLSearchParams();if(nextFilter!=='all')params.set('status',nextFilter);if(nextSelected)params.set('task',nextSelected);
    const query=params.toString();history.pushState(null,'',query?`/?${query}`:'/');
  }
  async function move(task:Task,status:Status) {
    if(lock.current || task.status===status) return;
    lock.current=true;setPending({id:task.id,status});setMessage('Previewing your move while the server checks it…');setOutcome('pending');
    const shouldReject=reject;setReject(false);
    try {
      const result=await updateTask({id:task.id,status,version:task.version,reject:shouldReject});
      if(result.task) setTasks(old=>old.map(t=>t.id===result.task!.id?result.task!:t));
      setOutcome(result.ok?'success':'error');
      setMessage(result.ok?`Confirmed. “${result.task.title}” is ${result.task.status}, version ${result.task.version}.`:result.message);
    } catch {
      setOutcome('error');setMessage('The response was interrupted. Reload before retrying: the server may have committed the move.');
    } finally {setPending(null);lock.current=false;}
  }
  const visible=tasks.map(t=>pending?.id===t.id?{...t,status:pending.status}:t);
  const detail=visible.find(t=>t.id===selected);
  return <main className="shell"><section className="intro"><div><span className="eyebrow">LEARN BY CHANGING SOMETHING</span><h1>One workspace.<br/><em>Two sides of the boundary.</em></h1><p>The browser previews your intent. The server checks access, resolves versions, and confirms the result.</p></div><div className="badge"><span className="dot"/> Live server + SQLite<br/><small>Signed in as {user}</small></div></section>
    <div className="grid"><aside className="lesson"><span className="eyebrow">YOUR WALKTHROUGH</span><h2>Make the boundary visible</h2><nav aria-label="Learning steps">{lessons.map(([title],i)=><button key={title} aria-current={step===i?'step':undefined} onClick={()=>setStep(i)}><span>{String(i+1).padStart(2,'0')}</span>{title}</button>)}</nav><div className="lesson-note"><strong>{lessons[step][0]}</strong><p>{lessons[step][1]}</p></div><a href="https://nextjs.org/docs/app/guides/authentication" target="_blank" rel="noreferrer">Read the boundary guidance ↗</a></aside>
    <section className="workspace" aria-label="Task workspace"><div className="toolbar"><div><span className="eyebrow">ENGINEERING / PRACTICE</span><h2>Your task board <span className="count">{tasks.length}</span></h2></div><label>Show<select value={filter} onChange={e=>navigate(e.target.value,selected)}><option value="all">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></label></div>
      <div className="board">{statuses.map(status=><section key={status} className="column" onDragOver={e=>{if(!pending)e.preventDefault();}} onDrop={e=>{e.preventDefault();const task=tasks.find(t=>t.id===e.dataTransfer.getData('text/plain'));if(task)void move(task,status);}} aria-label={`${status} column`}><h3><span className={`status-dot ${status.toLowerCase()}`}/>{status}<small>{visible.filter(t=>t.status===status && (filter==='all'||filter===status)).length}</small></h3>{visible.filter(t=>t.status===status && (filter==='all'||filter===status)).map(task=><button className={`card ${selected===task.id?'selected':''}`} key={task.id} draggable={!pending} onDragStart={e=>e.dataTransfer.setData('text/plain',task.id)} onClick={()=>navigate(filter,task.id)} aria-pressed={selected===task.id}><span className="task-id">{task.id.toUpperCase()} <span>↗</span></span><strong>{task.title}</strong><span className="card-footer">{pending?.id===task.id?'Confirming…':`Server version ${task.version}`}<span>⋮⋮</span></span></button>)}</section>)}</div>
      <div className="feedback" data-outcome={outcome} role="status" aria-live="polite"><span>{outcome==='success'?'✓':outcome==='error'?'!':'◈'}</span>{message}</div>
      <label className="failure"><input type="checkbox" checked={reject} disabled={!!pending} onChange={e=>setReject(e.target.checked)}/>Reject next move <small>Exercise the recovery path</small></label>
    </section>
    <aside className="details"><span className="eyebrow">RECORD DETAILS</span>{detail?<><h2>{detail.title}</h2><p>{detail.description}</p><dl><dt>Status</dt><dd>{detail.status}</dd><dt>Version</dt><dd>{detail.version}{pending?.id===detail.id?' · provisional move':''}</dd><dt>Owner</dt><dd>{detail.owner}</dd></dl><label className="label">Move this task</label><div className="moves">{statuses.map(s=><button key={s} disabled={!!pending||s===detail.status} onClick={()=>void move(tasks.find(t=>t.id===detail.id)!,s)}>{s}</button>)}</div><label htmlFor="draft" className="label">Your working draft</label><textarea id="draft" value={draft} disabled={!draftReady} onChange={e=>editDraft(e.target.value)} placeholder="What did you notice?"/><small>{draftError||'Saved on this browser, scoped to your demo account. This is not shared task data.'}</small><button className="share" onClick={async()=>{try{await navigator.clipboard.writeText(location.href);setMessage('View link copied. The recipient signs in with their own access.');setOutcome('success');}catch{setMessage('Copy the URL from your address bar to share this view.');setOutcome('ready');}}}>Copy view link ↗</button></>:<><h2>Follow a task<br/>through the system.</h2><p>Select any card to inspect its state, move it with keyboard-friendly controls, or write a draft.</p>{selected&&<p className="warning">The linked task is unavailable in this account.</p>}<div className="boundary-note"><span>SERVER</span><p>Session · access · version · durable task</p><span>CLIENT</span><p>Selection · filter · preview · local draft</p></div></>}</aside></div>
    <footer>Boundary Lab / 01 <span>Public demo accounts · local Node runtime · no external services</span></footer></main>;
}
