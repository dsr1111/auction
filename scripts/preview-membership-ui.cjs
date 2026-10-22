// Local-only visual fixture using the real components and synthetic member data.
// No authentication bypass, production API requests, or data writes.
// Run: node scripts/preview-membership-ui.cjs (http://127.0.0.1:3037)
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const ts = require('typescript');
const React = require('react');
const jsxRuntime = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const root = path.join(__dirname,'..');
const member={user_id:'100000000000000021',guild_type:'guild2',game_nickname:'크랙길드원',status:'active',version:4};
const rows=[
  {id:12,user_id:'100000000000000021',guild_type:'guild2',game_nickname:'크랙길드원',requester_name:'crack-member',status:'pending'},
  {id:13,user_id:'100000000000000022',guild_type:'guild1',game_nickname:'세계수길드원',requester_name:'tree-member',status:'pending'},
  {id:14,user_id:'100000000000000023',guild_type:'guild2',game_nickname:'긴닉네임확인용길드원',requester_name:'guild-member',status:'pending'},
];
const event={id:31,action:'assign',actor_id:'100000000000000001',reason:'가입 정보 확인 후 등록',created_at:'2026-10-22T09:20:00Z',before_state:null,after_state:{guild_type:'guild2'}};
function render(route) {
  const mode=route.replace('/','')||'admin';
  const isAdmin=!['onboarding','pending'].includes(mode);
  const snapshot={membership:isAdmin?member:null,request:mode==='pending'?{...rows[0],note:''}:null,settings:{enforcement_enabled:true,bidding_paused:false},pendingCount:3};
  let adminIndex=0;
  const detail={membership:member,activeBids:{guild1:0,guild2:2},events:[event],total:1};
  const adminOverrides={5:mode==='empty'?[]:rows,6:mode==='empty'?0:3,7:mode==='loading',12:detail,13:member.user_id,
    15:mode==='remove'?{action:'remove',userId:member.user_id,version:4,title:'크랙길드원 소속 삭제'}:null,17:'guild2'};
  const base={
    'react/jsx-runtime':jsxRuntime,
    'next-auth/react':{useSession:()=>({status:'authenticated',data:{user:{id:member.user_id,name:'크랙길드원',canUseAuction:true,isAdmin}}}),signOut:()=>{}},
    'next/navigation':{usePathname:()=> '/',useRouter:()=>({replace:()=>{}})},
    'next/link':{default:({href,children,...props})=>React.createElement('a',{href,...props},children)},
    'react-dom':{createPortal:children=>children},
  };
  function load(file) {
    const exports={};
    const isPage=file.endsWith('admin/members/page.tsx');
    const hooks={...React,useEffect:()=>{},useCallback:fn=>fn,useRef:value=>({current:value}),useId:()=> 'preview-modal-title',useState:value=>{
      if(file.endsWith('/Modal.tsx'))return [true,()=>{}];
      if(isPage){const i=adminIndex++;return [Object.hasOwn(adminOverrides,i)?adminOverrides[i]:value,()=>{}];}
      return [value,()=>{}];
    }};
    const deps={...base,react:hooks};
    const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
    vm.runInNewContext(code,{exports,document:{body:{}},require:name=>{
      if(name in deps)return deps[name];
      if(name.endsWith('MembershipProvider'))return {useMembership:()=>({data:snapshot,error:null,loading:false,refresh:async()=>{},blockReason:()=>null})};
      if(name==='@/lib/membership')return load('src/lib/membership.ts');
      if(name.endsWith('/Modal'))return load('src/components/Modal.tsx');
      if(name.endsWith('/MembershipPanel'))return load('src/components/MembershipPanel.tsx');
      throw new Error(`Unexpected fixture dependency: ${name}`);
    }});
    return exports;
  }
  const component=load(isAdmin?'src/app/admin/members/page.tsx':'src/components/MembershipOnboarding.tsx').default;
  return renderToStaticMarkup(React.createElement(component,{children:null}));
}
async function main(){
  const css=(await postcss([tailwind({content:['./src/**/*.{ts,tsx}']})]).process(fs.readFileSync(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')})).css;
  http.createServer((req,res)=>{
    try {
      if(req.url==='/style.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(css);return;}
      const body=render(new URL(req.url,'http://localhost').pathname);
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>길드원 관리 디자인 검증 (예시 데이터)</title><link rel="stylesheet" href="/style.css"></head><body class="bg-white"><main class="mx-auto max-w-7xl p-4">${body}</main></body></html>`);
    }catch(error){res.writeHead(500);res.end(String(error));}
  }).listen(3037,'127.0.0.1',()=>console.log('Visual fixture: http://127.0.0.1:3037/admin /onboarding /pending /remove /empty /loading'));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
