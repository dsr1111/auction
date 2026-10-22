// Component lifecycle regression checks without network access or real accounts.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function load(file,deps,globals={}) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{...globals,exports,require:name=>{ assert.ok(name in deps,name); return deps[name]; }});
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
test('unregistered entry opens mandatory application; dismissal cannot hide it',()=>{
  const h=harness(); const first=h.render(); assert.equal(first.modal.props.isOpen,true);
  assert.equal(first.modal.props.dismissible,false);
  first.modal.props.onClose(); assert.equal(h.render().modal.props.isOpen,true);
  assert.ok(!JSON.stringify(first.tree).includes('닫고 둘러보기'));
  assert.equal(h.context.data.membership,null); assert.equal(h.redirects.length,0);
});
test('pending entry shows approval waiting; approval closes modal and routes to crack',()=>{
  const h=harness(); h.context.data.request={status:'pending'};
  assert.equal(h.render().modal.props.title,'소속 승인 대기');
  h.render().modal.props.onClose(); assert.equal(h.render().modal.props.isOpen,true);
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

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];
}

test('mandatory modal blocks Escape and backdrop; ordinary modals still close',()=>{
  for (const dismissible of [false,true]) {
    const effects=[], handlers={}; let closed=0;
    const jsx=(type,props)=>({type,props});
    const document={activeElement:null,body:{style:{overflow:''}},
      addEventListener:(name,fn)=>{handlers[name]=fn;},removeEventListener:()=>{}};
    const Modal=load('src/components/Modal.tsx',{
      'react/jsx-runtime':{jsx,jsxs:jsx},
      react:{useState:()=>[true,()=>{}],useRef:initial=>({current:initial}),useId:()=> 'dialog-title',useEffect:fn=>effects.push(fn)},
      'react-dom':{createPortal:tree=>tree},
    },{document}).default;
    const tree=Modal({isOpen:true,onClose:()=>closed++,children:'FORM',...(dismissible?{}:{dismissible:false})});
    const cleanup=effects.map(fn=>fn());
    handlers.keydown({key:'Escape',preventDefault(){}});
    assert.equal(closed,dismissible?1:0);
    const backdrop={}; tree.props.onMouseDown({target:backdrop,currentTarget:backdrop});
    assert.equal(closed,dismissible?2:0);
    const closeButton=nodes(tree).find(node=>node.props?.['aria-label']==='닫기');
    assert.equal(!!closeButton,dismissible);
    if(closeButton) {closeButton.props.onClick(); assert.equal(closed,3);}
    cleanup.forEach(fn=>fn?.());
    assert.equal(document.body.style.overflow,'');
  }
});

test('application form asks only for guild and nickname, and sends no note',async()=>{
  const jsx=(type,props)=>({type,props}); const requests=[];
  const Panel=load('src/components/MembershipPanel.tsx',{
    'react/jsx-runtime':{jsx,jsxs:jsx},react:{useState:initial=>[initial,()=>{}]},
    'next-auth/react':{useSession:()=>({data:{user:{id:'123',canUseAuction:true}},status:'authenticated'})},
    'next/link':{default:'Link'},'@/lib/membership':membership,
    '@/components/MembershipProvider':{useMembership:()=>({data:{membership:null,request:null,settings:{}},refresh:async()=>{}})},
  },{fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({})};}}).default;
  const tree=Panel({embedded:true}); const elements=nodes(tree);
  assert.equal(elements.filter(node=>node.type==='textarea').length,0);
  assert.equal(elements.filter(node=>node.type==='select').length,1);
  assert.equal(elements.filter(node=>node.type==='input').length,1);
  assert.ok(!JSON.stringify(tree).includes('Discord 역할은 그대로'));
  assert.ok(!JSON.stringify(tree).includes('한 계정은 한 길드에만'));
  elements.find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(requests.length,1); assert.equal(requests[0].reason,undefined);
});

test('unregistered auction pages show neither a duplicate banner nor auction contents',()=>{
  const jsx=(type,props)=>({type,props});
  const context={data:{membership:null},loading:false,blockReason:()=> '미등록'};
  const Gate=load('src/components/GuildAccessGate.tsx',{
    'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    'next-auth/react':{useSession:()=>({data:{user:{canUseAuction:true}},status:'authenticated'})},
    'next/link':{default:'Link'},'@/lib/membership':membership,
    './MembershipProvider':{useMembership:()=>context},
  }).default;
  assert.equal(Gate({children:'AUCTION',allowedGuild:'guild1'}),null);
  context.data.membership={guild_type:'guild1'}; context.blockReason=()=> null;
  assert.ok(JSON.stringify(Gate({children:'AUCTION',allowedGuild:'guild1'})).includes('AUCTION'));
});

test('other guild pages deny members but preserve admin management access',()=>{
  const jsx=(type,props)=>({type,props});
  const user={canUseAuction:true,isAdmin:false};
  const context={data:{membership:{guild_type:'guild1'}},loading:false,error:null,blockReason:()=> '세계수 소속입니다. 소속 길드 경매에서 입찰해주세요.'};
  const Gate=load('src/components/GuildAccessGate.tsx',{
    'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    'next-auth/react':{useSession:()=>({data:{user},status:'authenticated'})},
    'next/link':{default:'Link'},'@/lib/membership':membership,
    './MembershipProvider':{useMembership:()=>context},
  }).default;
  for (const ownGuild of ['guild1','guild2']) {
    context.data.membership.guild_type=ownGuild;
    const denied=Gate({children:'AUCTION_CONTENT',allowedGuild:ownGuild==='guild1'?'guild2':'guild1'});
    assert.ok(JSON.stringify(denied).includes('접근 권한이 없습니다'));
    assert.ok(!JSON.stringify(denied).includes('AUCTION_CONTENT'));
    assert.ok(!JSON.stringify(denied).includes('소속 길드 경매에서 입찰해주세요'));
    assert.equal(nodes(denied).find(node=>node.type==='Link').props.href,ownGuild==='guild1'?'/':'/crack');
    user.isAdmin=true;
    const admin=Gate({children:'AUCTION_CONTENT',allowedGuild:ownGuild==='guild1'?'guild2':'guild1'});
    assert.ok(JSON.stringify(admin).includes('AUCTION_CONTENT'));
    assert.ok(!JSON.stringify(admin).includes('소속 길드 경매에서 입찰해주세요'));
    user.isAdmin=false;
  }
  context.error='Lookup failed'; context.data=null;
  assert.ok(!JSON.stringify(Gate({children:'AUCTION_CONTENT',allowedGuild:'guild1'})).includes('AUCTION_CONTENT'));
});
