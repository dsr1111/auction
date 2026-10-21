// node --test scripts/test-membership-api.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function load(source, dependencies = {}) {
  const filename = path.join(__dirname,'..',source);
  const code = ts.transpileModule(fs.readFileSync(filename,'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, URL, SyntaxError, console: { error() {} }, require(name) {
    assert.ok(name in dependencies,`Unexpected import: ${name}`); return dependencies[name];
  } }, { filename });
  return exports;
}
const membership = load('src/lib/membership.ts');
const ownRoute = 'src/app/api/membership/route.ts';
const adminRoute = 'src/app/api/admin/memberships/route.ts';
const bidRoute = 'src/app/api/auction/bids/route.ts';
const user = { id: '100000000000000001', canUseAuction: true, name: '실제 사용자' };
const admin = { ...user, isAdmin: true };
const settings = { enforcement_enabled: true, bidding_paused: false };
const member = { user_id:user.id, guild_type:'guild1',game_nickname:'사용자',status:'active',version:1 };
const json = (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers });
const request = (body, origin = 'https://example.test') => new Request('https://example.test/api/membership', { method:'POST', headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body) });

function setup(source, sessionUser, { state = { settings, membership: member }, responses = [], failRead = false, rpcError = null } = {}) {
  const queries = [], calls = [];
  const db = {
    rpc(name, args) { calls.push({name,args}); return Promise.resolve({data:{id:9},error:rpcError}); },
    from(table) {
      const query = { table, filters:[], action:'select' }; queries.push(query);
      const chain = {
        select(columns) { query.columns=columns; return chain; },
        eq(key,value) { query.filters.push([key,value]); return chain; },
        order() { return chain; }, range() { return chain; }, limit() { return chain; },
        maybeSingle() { return chain; }, single() { return chain; },
        insert(values) { query.action='insert'; query.values=values; return chain; },
        then(resolve,reject) { assert.ok(responses.length,`Unexpected query ${table}`); return Promise.resolve(responses.shift()).then(resolve,reject); },
      }; return chain;
    },
  };
  const shared = {
    'server-only': {},
    'next/server':{NextResponse:{json}},
    '@/lib/supabase/admin':{createAdminClient:()=>db},
    '@/lib/membership':membership,
  };
  const server = load('src/lib/membership-server.ts',shared);
  const dependencies = { ...shared,
    'next-auth/next':{getServerSession:async()=>sessionUser ? {user:sessionUser}:null},
    '@/lib/auth':{authOptions:{}},
    '@/lib/membership-server':{...server,readMembership:async()=>{ if(failRead) throw new Error('DB unavailable'); return state; }},
  };
  return { api:load(source,dependencies),queries,calls,server,db };
}

test('eligibility is not guild assignment; explicit false cannot inherit an obsolete claim',()=>{
  assert.equal(membership.hasAuctionAccess({canUseAuction:false,guild1Member:true}),false);
  assert.equal(membership.hasAuctionAccess({guild1Member:true}),true);
  assert.equal(membership.hasAuctionAccess({guild2Member:true}),false);
  for(const guild of ['guild1','guild2']) assert.ok(membership.membershipBlockReason(settings,null,guild));
  assert.equal(membership.membershipBlockReason(settings,member,'guild1'),null);
  assert.ok(membership.membershipBlockReason(settings,member,'guild2'));
  assert.ok(membership.membershipBlockReason(settings,{...member,status:'suspended'},'guild1'));
  assert.ok(membership.membershipBlockReason({...settings,enforcement_enabled:false},null,'guild2'));
  assert.ok(membership.membershipBlockReason({...settings,enforcement_enabled:false},{...member,status:'suspended'},'guild1'));
});
test('entry defaults to the approved guild without redirect loops or blocking management/results',()=>{
  assert.equal(membership.membershipEntryTarget(null,'/',null),null);
  const crack={...member,guild_type:'guild2'};
  assert.equal(membership.membershipEntryTarget(crack,'/',null).path,'/crack');
  assert.equal(membership.membershipEntryTarget(member,'/crack',null).path,'/');
  assert.equal(membership.membershipEntryTarget(crack,'/',`${user.id}:guild2`),null);
  assert.equal(membership.membershipEntryTarget(crack,'/admin/members',null),null);
  assert.equal(membership.membershipEntryTarget(crack,'/membership',null),null);
  assert.equal(membership.membershipEntryTarget(crack,'/',`${user.id}:guild1`).path,'/crack');
});
test('pausing new bids preserves corrections for eligible guild members',()=>{
  assert.ok(membership.membershipBlockReason({...settings,bidding_paused:true},member,'guild1'));
  assert.equal(membership.membershipBlockReason({...settings,bidding_paused:true},member,'guild1',true),null);
});
test('own membership requires login and common Discord role',async()=>{
  for(const actor of [null,{id:user.id,canUseAuction:false}]) {
    const {api,queries,calls}=setup(ownRoute,actor);
    assert.ok([401,403].includes((await api.GET()).status));
    assert.ok([401,403].includes((await api.POST(request({action:'apply',guildType:'guild1',nickname:'닉'}))).status));
    assert.equal(queries.length,0); assert.equal(calls.length,0);
  }
});
test('applicant cannot spoof identity, requester name, admin action or version',async()=>{
  const {api,calls}=setup(ownRoute,user);
  const response=await api.POST(request({action:'apply',guildType:'guild1',nickname:'닉',reason:'내용',userId:'victim',requesterName:'fake',isAdmin:true,version:999}));
  assert.equal(response.status,200);
  assert.equal(calls[0].args.p_actor,user.id);
  assert.equal(calls[0].args.p_data.requesterName,user.name);
  assert.equal(calls[0].args.p_data.userId,undefined);
  assert.equal(calls[0].args.p_data.version,undefined);
  assert.equal((await api.POST(request({action:'approve',requestId:9}))).status,400);
  assert.equal(calls.length,1);
});
test('membership reads are private and own request queries always filter session user',async()=>{
  const {api,queries}=setup(ownRoute,user,{responses:[{data:null,error:null}]});
  const response=await api.GET();
  assert.equal(response.status,200); assert.equal(response.headers['Cache-Control'],'private, no-store');
  assert.equal(response.body.pendingCount,0);
  assert.ok(queries[0].filters.some(([key,value])=>key==='user_id'&&value===user.id));
  assert.equal(queries.length,1);
});
test('non-admin cannot list or mutate members, even with forged body',async()=>{
  const {api,queries,calls}=setup(adminRoute,user);
  assert.equal((await api.GET(new Request('https://example.test/api/admin/memberships'))).status,403);
  assert.equal((await api.POST(request({action:'assign',isAdmin:true,reason:'fake'}))).status,403);
  assert.equal(queries.length,0); assert.equal(calls.length,0);
});
test('admin action uses signed actor, validates stale version input and prohibits disabling enforcement',async()=>{
  const {api,calls}=setup(adminRoute,admin);
  assert.equal((await api.POST(request({action:'assign',userId:user.id,guildType:'guild2',nickname:'닉',reason:'관리자 변경',version:0,p_actor:'fake'}))).status,200);
  assert.equal(calls[0].args.p_actor,admin.id);
  for(const body of [{action:'disable',reason:'되돌리기'},{action:'assign',userId:user.id,guildType:'guild1',nickname:'닉',reason:'버전 누락'},{action:'suspend',userId:'not-a-snowflake',version:0,reason:'정지'}]) {
    assert.equal((await api.POST(request(body))).status,400);
  }
  assert.equal(calls.length,1);
});
test('cross-site writes rejected for own and admin API',async()=>{
  for(const source of [ownRoute,adminRoute]) {
    const {api,calls}=setup(source,admin);
    assert.equal((await api.POST(request({action:'pause',reason:'fake'},'https://evil.test'))).status,403);
    assert.equal(calls.length,0);
  }
});
test('database business conflicts return actionable messages without falling open',async()=>{
  const {api}=setup(adminRoute,admin,{rpcError:{code:'P0001',message:'이미 처리된 신청'}});
  const response=await api.POST(request({action:'approve',requestId:1,reason:''}));
  assert.equal(response.status,409); assert.equal(response.body.error,'이미 처리된 신청');
});
test('real membership reader rejects missing settings, member query failures and DB failures',async()=>{
  for(const responses of [
    [{data:null,error:null},{data:null,error:null}],
    [{data:settings,error:null},{data:null,error:{message:'DB failure'}}],
    [{data:null,error:{message:'DB failure'}},{data:member,error:null}],
  ]) {
    const {server,db}=setup(ownRoute,user,{responses});
    await assert.rejects(()=>server.readMembership(user.id,db));
  }
});
const bidBody={guildType:'guild1',itemId:1,bidAmount:20000,bidQuantity:1,bidderName:'닉'};
test('fresh DB membership blocks cross-guild, unassigned admin, suspended and paused bids',async()=>{
  for(const [actor,state] of [
    [user,{settings,membership:{...member,guild_type:'guild2'}}],
    [admin,{settings,membership:null}],
    [user,{settings,membership:{...member,status:'suspended'}}],
    [user,{settings:{...settings,bidding_paused:true},membership:member}],
  ]) {
    const {api,queries}=setup(bidRoute,actor,{state});
    assert.equal((await api.POST(request(bidBody))).status,403);
    assert.equal(queries.length,0);
  }
});
test('membership lookup failure never stores a bid',async()=>{
  const {api,queries}=setup(bidRoute,user,{failRead:true});
  assert.equal((await api.POST(request(bidBody))).status,500); assert.equal(queries.length,0);
});
test('permitted bid uses session identity, and final DB guard can still reject a concurrent change',async()=>{
  const item={id:1,price:10000,quantity:3,end_time:null};
  for(const finalError of [null,{code:'P0001',message:'소속이 변경되었습니다.'}]) {
    const {api,queries}=setup(bidRoute,user,{responses:[{data:item,error:null},{data:null,error:finalError}]});
    const response=await api.POST(request({...bidBody,bidder_discord_id:'fake'}));
    assert.equal(response.status,finalError?409:201);
    assert.equal(queries[1].values.bidder_discord_id,user.id);
  }
});
