// Run with: node --test scripts/test-correction-requests.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function load(source, dependencies) {
  const filename = path.join(__dirname, '..', source);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, console, Date,
    require(name) {
      assert.ok(name in dependencies, `Unexpected import: ${name}`);
      return dependencies[name];
    },
  }, { filename });
  return exports;
}

const validation = load('src/lib/correction-validation.ts', {});
const normalUser = { id: 'owner', name: 'Discord name' };
const adminUser = { id: 'admin', isAdmin: true };
const bid = { id: 7, item_id: 12, bid_amount: 20000, bid_quantity: 1, bidder_nickname: '이전닉', bidder_discord_id: 'owner' };
const item = { id: 12, name: '테스트 품목', price: 10000, quantity: 3, end_time: null };
const correction = { id: 8, user_id: 'owner', status: 'open', guild_type: 'guild1', bid_id: 7, item_id: 12 };

function setup(route, user, responses) {
  const queries = [];
  const supabase = {
    from(table) {
      const query = { table, action: 'select', filters: [] };
      queries.push(query);
      const chain = {
        select(columns) { query.columns = columns; return chain; },
        insert(data) { query.action = 'insert'; query.values = data; return chain; },
        update(data) { query.action = 'update'; query.values = data; return chain; },
        delete() { query.action = 'delete'; return chain; },
        eq(key, value) { query.filters.push([key, value]); return chain; },
        order() { return chain; }, limit() { return chain; },
        single() { return chain; }, maybeSingle() { return chain; },
        then(resolve, reject) {
          assert.ok(responses.length, `Unexpected DB query: ${JSON.stringify(query)}`);
          return Promise.resolve({ data: responses.shift(), error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
  };
  const api = load(route, {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    'next-auth/next': { getServerSession: async () => user ? { user } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/supabase/admin': { createAdminClient: () => supabase },
    '@/lib/correction-validation': validation,
  });
  return { api, queries, responses };
}
const postRoute = 'src/app/api/correction-requests/route.ts';
const patchRoute = 'src/app/api/correction-requests/[id]/route.ts';
const bodyRequest = (body) => ({ json: async () => body });
const context = { params: Promise.resolve({ id: '8' }) };
const postBody = { guildType: 'guild1', bidId: 7, details: '입력 실수 정정', requestedBidAmount: 30000, requestedBidQuantity: 2, requestedBidderNickname: ' 새닉 ' };
const patchBody = { action: 'update', bidAmount: 30000, bidQuantity: 2, bidderNickname: ' 새닉 ' };

test('validation rejects invalid prices, quantities and nicknames', () => {
  const valid = { bidAmount: 10000, bidQuantity: 1, bidderNickname: '닉네임' };
  assert.equal(validation.validateCorrectionValues(valid), null);
  for (const bidAmount of [0, -10000, 10001, NaN, Infinity, 2000010000]) {
    assert.ok(validation.validateCorrectionValues({ ...valid, bidAmount }));
  }
  for (const bidQuantity of [0, -1, 1.5, NaN, Infinity, 2147483648]) {
    assert.ok(validation.validateCorrectionValues({ ...valid, bidQuantity }));
  }
  for (const bidderNickname of ['', '   ', '가'.repeat(101)]) {
    assert.ok(validation.validateCorrectionValues({ ...valid, bidderNickname }));
  }
});

for (const guildType of ['guild1', 'guild2']) {
  test(`${guildType}: request saves original and requested values without editing bid`, async () => {
    const { api, queries } = setup(postRoute, normalUser, [bid, item, { id: 8 }]);
    const response = await api.POST(bodyRequest({ ...postBody, guildType }));
    assert.equal(response.status, 201);
    assert.equal(queries[0].table, guildType === 'guild1' ? 'bid_history' : 'bid_history_guild2');
    assert.ok(queries[0].filters.some(([key, value]) => key === 'bidder_discord_id' && value === 'owner'));
    const saved = queries[2].values;
    assert.equal(saved.bidder_nickname, '이전닉');
    assert.equal(saved.bid_amount, 20000);
    assert.equal(saved.bid_quantity, 1);
    assert.equal(saved.requested_bid_amount, 30000);
    assert.equal(saved.requested_bid_quantity, 2);
    assert.equal(saved.requested_bidder_nickname, '새닉');
    assert.equal(queries.filter((q) => q.action !== 'select').length, 1);
  });

  test(`${guildType}: admin updates only linked bid and records all resolved values`, async () => {
    const { api, queries, responses } = setup(patchRoute, adminUser, [
      { ...correction, guild_type: guildType }, bid, item, null,
      { bid_amount: 30000, bidder_nickname: '새닉' }, null, { id: 8, status: 'resolved' },
    ]);
    assert.equal((await api.PATCH(bodyRequest(patchBody), context)).status, 200);
    assert.equal(responses.length, 0);
    const updated = queries[3];
    assert.equal(updated.table, guildType === 'guild1' ? 'bid_history' : 'bid_history_guild2');
    assert.equal(updated.values.bid_amount, 30000);
    assert.equal(updated.values.bid_quantity, 2);
    assert.equal(updated.values.bidder_nickname, '새닉');
    assert.equal('bidder_discord_id' in updated.values, false);
    assert.equal('bidder_discord_name' in updated.values, false);
    assert.ok(updated.filters.some(([key, value]) => key === 'id' && value === 7));
    assert.equal(queries[5].values.last_bidder_nickname, '새닉');
    assert.equal(queries[6].values.resolved_bid_quantity, 2);
    assert.equal(queries[6].values.resolved_bidder_nickname, '새닉');
    assert.equal(queries[6].values.resolved_by, 'admin');
  });
}

test('non-admin cannot modify requests or list submitted bids', async () => {
  for (const user of [normalUser, null]) {
    const { api, queries } = setup(patchRoute, user, []);
    assert.equal((await api.PATCH(bodyRequest(patchBody), context)).status, 401);
    assert.equal(queries.length, 0);
    const listing = setup(postRoute, user, []);
    assert.equal((await listing.api.GET()).status, 401);
    assert.equal(listing.queries.length, 0);
  }
});

test('request rejects another user bid, ended auction, excessive quantity and underpriced bid', async () => {
  for (const [responses, body, expected] of [
    [[null], postBody, 403],
    [[bid, { ...item, end_time: '2000-01-01T00:00:00Z' }], postBody, 409],
    [[bid, item], { ...postBody, requestedBidQuantity: 4 }, 400],
    [[bid, { ...item, price: 40000 }], postBody, 400],
  ]) {
    const { api, queries } = setup(postRoute, normalUser, responses);
    assert.equal((await api.POST(bodyRequest(body))).status, expected);
    assert.ok(queries.every((q) => q.action === 'select'));
  }
});

test('admin rejects resolved requests, ownership mismatch and quantity overflow', async () => {
  for (const [responses, expected] of [
    [[{ ...correction, status: 'resolved' }], 409],
    [[correction, { ...bid, bidder_discord_id: 'someone-else' }], 409],
    [[correction, bid, { ...item, quantity: 1 }], 400],
  ]) {
    const { api, queries } = setup(patchRoute, adminUser, responses);
    assert.equal((await api.PATCH(bodyRequest(patchBody), context)).status, expected);
    assert.ok(queries.every((q) => q.action === 'select'));
  }
});

test('old clients can still submit text-only requests and admins can still edit price only', async () => {
  const submitted = setup(postRoute, normalUser, [bid, item, { id: 8 }]);
  assert.equal((await submitted.api.POST(bodyRequest({ guildType: 'guild1', bidId: 7, details: '삭제 요청' }))).status, 201);
  assert.equal(submitted.queries[2].values.requested_bid_quantity, null);
  const patched = setup(patchRoute, adminUser, [correction, bid, item, null, bid, null, { id: 8 }]);
  assert.equal((await patched.api.PATCH(bodyRequest({ action: 'update', bidAmount: 30000 }), context)).status, 200);
  assert.equal(patched.queries[3].values.bid_quantity, 1);
  assert.equal(patched.queries[3].values.bidder_nickname, '이전닉');
});

test('deletion remains available without price, quantity or nickname input', async () => {
  const { api, queries } = setup(patchRoute, adminUser, [correction, bid, null, null, item, null, { id: 8 }]);
  assert.equal((await api.PATCH(bodyRequest({ action: 'delete' }), context)).status, 200);
  assert.equal(queries[2].action, 'delete');
  assert.equal(queries[5].values.current_bid, 10000);
  assert.equal(queries[6].values.resolution_action, 'delete');
});
