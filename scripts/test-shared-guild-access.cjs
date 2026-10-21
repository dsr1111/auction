// Run with: node --test scripts/test-shared-guild-access.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

function authForRoles(roles) {
  const filename = path.join(__dirname, '..', 'src/lib/auth.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    console: { log() {}, error() {} },
    process: { env: {
      DISCORD_GUILD_ID: 'server',
      DISCORD_GUILD1_ROLE_ID: 'shared-member-role',
      // Deliberately different: access must use the shared role, not this value.
      DISCORD_GUILD2_ROLE_ID: 'obsolete-role',
      DISCORD_ADMIN_ROLE_ID: 'admin-role',
    } },
    fetch: async () => ({ ok: true, json: async () => ({ roles, user: { id: 'user', username: 'member' } }) }),
    require(name) {
      assert.equal(name, 'next-auth/providers/discord');
      return { default: (options) => options };
    },
  }, { filename });
  return exports.authOptions.callbacks;
}

function assertMembership(user, expected) {
  assert.equal(user.canUseAuction, expected);
  // Shared Discord eligibility must never become an actual guild assignment.
  for (const name of ['guild1Member', 'guild2Member', 'isGuild1Member', 'isGuild2Member']) {
    assert.equal(user[name], undefined, name);
  }
}

for (const [label, roles, allowed, admin] of [
  ['shared role', ['shared-member-role'], true, false],
  ['admin', ['admin-role'], true, true],
  ['unrelated role', ['unrelated-role'], false, false],
  ['obsolete crack-only role', ['obsolete-role'], false, false],
]) {
  test(`fresh login: ${label}`, async () => {
    const callbacks = authForRoles(roles);
    const user = { id: 'user' };
    assert.equal(await callbacks.signIn({ user, account: { provider: 'discord', access_token: 'test-token' } }), true);
    const token = await callbacks.jwt({ token: {}, user });
    const session = await callbacks.session({ session: { user: {} }, token });
    assertMembership(session.user, allowed);
    assert.equal(session.user.isAdmin, admin);
  });
}

test('existing signed session keeps site eligibility without a guild assignment', async () => {
  const callbacks = authForRoles([]);
  const token = await callbacks.jwt({ token: {
    id: 'existing-user', guild1Member: true, isGuild1Member: true,
    guild2Member: false, isGuild2Member: false, isAdmin: false,
  } });
  const session = await callbacks.session({ session: { user: {} }, token });
  assertMembership(session.user, true);
  assert.equal(session.user.isAdmin, false);
  assert.equal(session.user.id, 'existing-user');
});

test('legacy membership alias is supported by both session and JWT callbacks', async () => {
  const callbacks = authForRoles([]);
  for (const token of [{ guild1Member: true }, { isGuild1Member: true }]) {
    const session = await callbacks.session({ session: { user: {} }, token });
    assertMembership(session.user, true);
    assertMembership(await callbacks.jwt({ token }), true);
  }
});

test('missing or crack-only old membership never grants shared access', async () => {
  const callbacks = authForRoles([]);
  for (const token of [{}, { guild2Member: true, isGuild2Member: true }, { guild1Member: false }]) {
    const session = await callbacks.session({ session: { user: {} }, token });
    assertMembership(session.user, false);
    assertMembership(await callbacks.jwt({ token }), false);
  }
});
