// Component lifecycle regression checks without network access or real accounts.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function load(file,deps) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{ assert.ok(name in deps,name); return deps[name]; }});
  return exports;
}
const membership=load('src/lib/membership.ts',{});
function harness() {
  const user={id:'100000000000000001',canUseAuction:true};
  const context={session:{data:{user},status:'authenticated'},path:'/',data:{membership:null,request:null},loading:false,error:null};
  const hooks=[], effects=[], redirects=[];
  let cursor=0;
  const jsx=(type,props)=>({type,props});
  const component=load('src/components/MembershipOnboarding.tsx',{
    'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    react:{useRef(initial){const index=cursor++; return hooks[index]??(hooks[index]={current:initial});},useState(initial){const index=cursor++; if(!(index in hooks)) hooks[index]=initial; return [hooks[index],value=>{hooks[index]=value;}];},useEffect(fn){effects.push(fn);}},
    'next-auth/react':{useSession:()=>context.session},
    'next/navigation':{usePathname:()=>context.path,useRouter:()=>({replace:p=>redirects.push(p)})},
    '@/lib/membership':membership,
    './MembershipProvider':{useMembership:()=>({...context,refresh:async()=>{}})},
    './MembershipPanel':{default:'MembershipPanel'},'./Modal':{default:'Modal'},
  }).default;
  function render(){cursor=0; effects.length=0; const tree=component({children:'PAGE'}); const modal=tree.props.children.find(node=>node?.type==='Modal'); return {tree,modal,flush(){effects.splice(0).forEach(fn=>fn());}};}
  const member=guild=>({user_id:user.id,guild_type:guild,status:'active',version:1});
  return {context,redirects,render,member};
}
test('unregistered entry opens application; dismissal grants no membership',()=>{
  const h=harness(); const first=h.render(); assert.equal(first.modal.props.isOpen,true);
  first.modal.props.onClose(); assert.equal(h.render().modal.props.isOpen,false);
  assert.equal(h.context.data.membership,null); assert.equal(h.redirects.length,0);
});
test('pending entry shows approval waiting; approval closes modal and routes to crack',()=>{
  const h=harness(); h.context.data.request={status:'pending'};
  assert.equal(h.render().modal.props.title,'소속 승인 대기');
  h.context.data.membership=h.member('guild2');
  const approved=h.render(); assert.equal(approved.modal.props.isOpen,false); approved.flush();
  assert.deepEqual(h.redirects,['/crack']);
  h.context.path='/crack'; h.render().flush(); assert.equal(h.redirects.length,1);
});
test('registered entry routes once; guild change routes again; management stays accessible',()=>{
  const h=harness(); h.context.data.membership=h.member('guild2'); h.render().flush();
  h.context.path='/crack'; h.render().flush();
  h.context.path='/'; h.render().flush(); assert.equal(h.redirects.length,1);
  h.context.data.membership=h.member('guild1'); h.context.path='/crack'; h.render().flush();
  assert.deepEqual(h.redirects,['/crack','/']);
  h.context.path='/admin/members'; h.render().flush(); assert.equal(h.redirects.length,2);
});
test('loading, failed lookup, anonymous and roleless accounts never prompt or redirect',()=>{
  for(const kind of ['loading','error','anonymous','roleless']) {
    const h=harness();
    if(kind==='loading')h.context.loading=true;
    if(kind==='error')h.context.error='DB unavailable';
    if(kind==='anonymous')h.context.session={data:null,status:'unauthenticated'};
    if(kind==='roleless')h.context.session.data.user.canUseAuction=false;
    const view=h.render(); assert.ok(!view.modal.props.isOpen); view.flush(); assert.equal(h.redirects.length,0);
  }
});
test('dedicated application and admin screens do not get a duplicate dialog',()=>{
  const h=harness();
  for(const target of ['/membership','/admin/members','/auth/signin']){h.context.path=target;assert.ok(!h.render().modal.props.isOpen);}
});
