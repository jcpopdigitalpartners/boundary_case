import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.LAB_DB_PATH=':memory:';
const {listTasks,moveTask,createSession,sessionUser,deleteSession}=await import('../lib/store');
test('sessions cannot be manufactured by providing a username',()=>{assert.equal(sessionUser('alice'),null);const token=createSession('alice');assert.equal(sessionUser(token),'alice');deleteSession(token);assert.equal(sessionUser(token),null);});
test('reads and writes are scoped to the authenticated owner',()=>{assert.ok(listTasks('bob').every(t=>t.owner==='bob'));const result=moveTask('bob',{id:'alice-1',status:'Done',version:1,reject:false});assert.equal(result.ok,false);if(!result.ok){assert.equal(result.code,'ACCESS');assert.equal(result.task,undefined);}});
test('invalid, missing-session, and rejected writes do not modify storage',()=>{assert.equal(moveTask(null,{}).ok,false);assert.equal(moveTask('alice',{id:'alice-1',status:'Bogus',version:1,reject:false}).ok,false);assert.equal(moveTask('alice',{id:'alice-1',status:'Done',version:1,reject:true}).ok,false);assert.equal(listTasks('alice')[0].version,1);});
test('atomic version comparison rejects a stale tab and returns the current DTO',()=>{const input={id:'alice-1',status:'Doing',version:1,reject:false};const first=moveTask('alice',input);assert.equal(first.ok,true);assert.equal(first.task?.version,2);const stale=moveTask('alice',{...input,status:'Done'});assert.equal(stale.ok,false);if(!stale.ok){assert.equal(stale.code,'CONFLICT');assert.equal(stale.task?.status,'Doing');assert.equal(stale.task?.version,2);}assert.equal(listTasks('alice')[0].status,'Doing');});

test('task DTOs are plain objects for React serialization',()=>{for(const task of listTasks('alice'))assert.equal(Object.getPrototypeOf(task),Object.prototype);const result=moveTask('alice',{id:'alice-2',status:'Done',version:1,reject:false});assert.equal(result.ok,true);assert.equal(Object.getPrototypeOf(result.task),Object.prototype);});
