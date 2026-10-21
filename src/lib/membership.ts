export type GuildType = 'guild1' | 'guild2';
export const GUILD_NAMES: Record<GuildType, string> = { guild1: '세계수', guild2: '크랙' };
export type Membership = {
  user_id: string;
  guild_type: GuildType;
  game_nickname: string;
  status: 'active' | 'suspended';
  version: number;
  updated_at: string;
};
export type MembershipRequest = {
  id: number;
  user_id: string;
  requester_name: string;
  guild_type: GuildType;
  game_nickname: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  review_reason: string | null;
  created_at: string;
};
export type MembershipSettings = { enforcement_enabled: boolean; bidding_paused: boolean };
export type MembershipSnapshot = {
  membership: Membership | null;
  request: MembershipRequest | null;
  settings: MembershipSettings;
  pendingCount: number;
};

/** Legacy signed claims describe site eligibility, never an approved guild. */
export function hasAuctionAccess(user: {
  canUseAuction?: boolean; isAdmin?: boolean; guild1Member?: boolean; isGuild1Member?: boolean;
} | null | undefined): boolean {
  if (!user) return false;
  if (typeof user.canUseAuction === 'boolean') return user.canUseAuction || user.isAdmin === true;
  return user.isAdmin === true || user.guild1Member === true || user.isGuild1Member === true;
}

export function membershipBlockReason(
  settings: MembershipSettings, member: Membership | null, guild: GuildType, forCorrection = false,
): string | null {
  if (!forCorrection && settings.bidding_paused) return '신규 입찰이 일시 중지되었습니다.';
  if (member?.status === 'suspended') return '입찰 이용이 정지되었습니다. 관리자에게 문의해주세요.';
  if (!member) return '길드 가입 승인 후 입찰할 수 있습니다.';
  if (member.guild_type !== guild) return `${GUILD_NAMES[member.guild_type]} 소속입니다. 소속 길드 경매에서 입찰해주세요.`;
  return null;
}

/** Route once on entry (or guild change), not every time someone views results
 * from the other guild. This also keeps both administration pages reachable. */
export function membershipEntryTarget(member: Membership | null, pathname: string, lastEntryKey: string | null) {
  if (!member || (pathname !== '/' && pathname !== '/crack')) return null;
  const key = `${member.user_id}:${member.guild_type}`;
  if (key === lastEntryKey) return null;
  return { key, path: member.guild_type === 'guild1' ? '/' : '/crack' };
}
