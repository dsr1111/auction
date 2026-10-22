// Offline UI lifecycle checks: no production accounts or database calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (!tree || typeof tree !== 'object') return '';
  return [tree.props?.children].flat(Infinity).map(text).join('');
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  const slots=[], effects=[], requests=[], timers=[], listeners={};
  let cursor=0;
  const same=(a,b)=>a && b && a.length===b.length && a.every((v,i)=>Object.is(v,b[i]));
  const jsx=(type,props,key)=>({type,props,key});
  const deps={
    'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    react:{
      useState(initial) { const i=cursor++; if(!(i in slots))slots[i]=initial; return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}]; },
      useRef(initial) {const i=cursor++;return slots[i]??(slots[i]={current:initial});},
      useCallback(fn,dependencies) {const i=cursor++;if(!same(slots[i]?.dependencies,dependencies))slots[i]={fn,dependencies};return slots[i].fn;},
      useEffect(fn,dependencies) {const i=cursor++;if(!same(slots[i]?.dependencies,dependencies))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={dependencies,cleanup:fn()};});},
    },
    'next-auth/react':{useSession:()=>({status:'authenticated',data:{user:{id:'123',isAdmin:true}}})},
    '@/components/Modal':{default:'Modal'},
    '@/components/MembershipProvider':{useMembership:()=>({data:{settings:{enforcement_enabled:true,bidding_paused:false},pendingCount:1},refresh:async()=>{}})},
    '@/lib/membership':{GUILD_NAMES:{guild1:'세계수',guild2:'크랙'}},
  };
  const exports={};
  const source=fs.readFileSync(path.join(__dirname,'../src/app/admin/members/page.tsx'),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{
    exports,require:name=>{assert.ok(name in deps,name);return deps[name];},URLSearchParams,AbortController,
    window:{setInterval:fn=>{timers.push(fn);return timers.length;},addEventListener:(event,fn)=>{listeners[event]=fn;},removeEventListener:()=>{}},
    clearInterval:()=>{},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),
  });
  return {
    requests,timers,listeners,
    render(){cursor=0;const tree=exports.default();effects.splice(0).forEach(fn=>fn());return tree;},
    async respond(index,rows,ok=true){requests[index].resolve({ok,json:async()=>ok?{rows,total:rows.length}:{error:'Network error'}});await flush();},
    async respondData(index,data){requests[index].resolve({ok:true,json:async()=>data});await flush();},
  };
}
const row={id:1,user_id:'100000000000000001',guild_type:'guild1',game_nickname:'테스트회원',status:'pending'};

test('automatic and focus refresh preserve visible rows; updates and errors do not replace the list',async()=>{
  const h=harness(); h.render();
  assert.ok(text(h.render()).includes('불러오는 중'));
  await h.respond(0,[row]); const first=h.render();
  assert.ok(text(first).includes('테스트회원'));
  assert.ok(!text(first).includes('공통 Discord 역할을 바꾸지 않고'));
  assert.ok(!text(first).includes('운영 상태:'));
  assert.ok(!text(first).includes('소속 확인'));
  assert.ok(text(first).includes('신규 입찰 일시 중지'));
  const originalList=nodes(first).find(node=>node.type==='ul');
  h.timers[0](); let next=h.render();
  assert.ok(text(next).includes('테스트회원')); assert.ok(!text(next).includes('불러오는 중'));
  await h.respond(1,[row]); next=h.render();
  assert.equal(nodes(next).find(node=>node.type==='ul').props.children[0].key,originalList.props.children[0].key);
  h.listeners.focus(); assert.ok(!text(h.render()).includes('불러오는 중'));
  await h.respond(2,[{...row,game_nickname:'변경된회원'}]);
  assert.ok(text(h.render()).includes('변경된회원'));
  h.timers[0](); await h.respond(3,[],false); next=h.render();
  assert.ok(text(next).includes('변경된회원')); assert.ok(text(next).includes('목록 갱신에 실패'));
  h.timers[0](); assert.ok(text(h.render()).includes('목록 갱신에 실패'));
  await h.respond(4,[]); next=h.render();
  assert.ok(text(next).includes('표시할 내역이 없습니다')); assert.ok(!text(next).includes('목록 갱신에 실패'));
});

test('membership removal requires confirmation and sends the inspected identity and version',async()=>{
  const h=harness(); h.render(); await h.respond(0,[]); h.render();
  const input=nodes(h.render()).find(node=>node.props?.id==='manual-discord-id');
  input.props.onChange({target:{value:row.user_id}});
  const lookup=nodes(h.render()).find(node=>node.type==='form' && nodes(node).some(child=>child.props?.id==='manual-discord-id'));
  lookup.props.onSubmit({preventDefault(){}});
  await h.respondData(1,{membership:{user_id:row.user_id,guild_type:'guild1',game_nickname:row.game_nickname,status:'active',version:7},activeBids:{guild1:2,guild2:0},events:[],total:0});
  let view=h.render();
  assert.ok(!nodes(view).some(node=>node.type==='button' && text(node)==='이용 정지'));
  nodes(view).find(node=>node.type==='button' && text(node)==='소속 삭제').props.onClick();
  view=h.render();
  let modal=nodes(view).find(node=>node.type==='Modal');
  assert.equal(modal.props.appearance,'membership');
  assert.ok(text(modal).includes('기존 입찰·낙찰·처리 내역은 삭제되지 않습니다'));
  assert.ok(text(modal).includes('대기 중인 소속 신청은 취소'));
  assert.equal(nodes(modal).find(node=>node.type==='textarea').props.required,true);
  assert.equal(nodes(modal).find(node=>node.type==='button' && text(node)==='소속 삭제').props.disabled,true);
  await nodes(modal).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(h.requests.length,2);
  nodes(modal).find(node=>node.type==='textarea').props.onChange({target:{value:'탈퇴 요청'}});
  nodes(modal).find(node=>node.type==='input' && node.props.type==='checkbox').props.onChange({target:{checked:true}});
  modal=nodes(h.render()).find(node=>node.type==='Modal');
  void nodes(modal).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
  const payload=JSON.parse(h.requests[2].options.body);
  assert.equal(payload.action,'remove'); assert.equal(payload.userId,row.user_id);
  assert.equal(payload.version,7); assert.equal(payload.reason,'탈퇴 요청');
  assert.equal(nodes(h.render()).find(node=>node.type==='Modal').props.dismissible,false);
});

test('slow first loads are not interrupted by polling; filter changes reject stale responses',async()=>{
  const h=harness(); h.render();
  h.timers[0](); assert.equal(h.requests.length,1);
  assert.ok(text(h.render()).includes('불러오는 중'));
  await h.respond(0,[row]); h.render();
  h.timers[0]();
  const select=nodes(h.render()).find(node=>node.props?.['aria-label']==='길드 필터');
  select.props.onChange({target:{value:'guild2'}}); h.render();
  assert.equal(h.requests[1].options.signal.aborted,true);
  assert.ok(h.requests[2].url.includes('guild=guild2'));
  assert.ok(text(h.render()).includes('불러오는 중'));
  await h.respond(1,[row]); assert.ok(text(h.render()).includes('불러오는 중'));
  await h.respond(2,[{...row,guild_type:'guild2',game_nickname:'크랙회원'}]);
  const view=h.render(); assert.ok(text(view).includes('크랙회원')); assert.ok(!text(view).includes('테스트회원'));
});
