/* eslint-disable @typescript-eslint/no-explicit-any */
import DiscordProvider from 'next-auth/providers/discord';

interface DiscordGuildMember {
  user: {
    id: string;
    username: string;
    global_name?: string;
  };
  nick?: string;
  roles: string[];
}

interface ExtendedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  displayName?: string;
  isAdmin?: boolean;
}

interface DiscordAccount {
  provider: string;
  access_token?: string;
}

export const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify guilds guilds.members.read',
        },
      },
      profile(profile) {
        return {
          id: profile.id,
          name: profile.username,
          email: profile.email,
          image: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.webp` : null,
        };
      },
    }),
  ],
  debug: process.env.NODE_ENV === 'development',
  callbacks: {
    async signIn({ user, account }: { user: ExtendedUser; account: DiscordAccount | null }) {
      if (account?.provider === 'discord') {
        try {
          const guildId = process.env.DISCORD_GUILD_ID;
          if (!guildId || (!account.access_token && !process.env.DISCORD_BOT_TOKEN)) {
            console.error('Discord login configuration is incomplete');
            return false;
          }

          let guildResponse: Response | null = null;

          // 우선 OAuth에서 동의받은 guilds.members.read 권한으로 본인의 멤버 정보를 조회합니다.
          if (account.access_token) {
            const oauthResponse = await fetch(
              `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
              {
                headers: {
                  Authorization: `Bearer ${account.access_token}`,
                },
                cache: 'no-store',
              }
            );

            if (oauthResponse.ok) {
              guildResponse = oauthResponse;
            } else {
              console.error('Discord OAuth member lookup failed:', oauthResponse.status);
            }
          }

          // OAuth 조회가 실패하면 길드에 설치된 봇으로 한 번 더 확인합니다.
          if (!guildResponse && process.env.DISCORD_BOT_TOKEN) {
            const botResponse = await fetch(
              `https://discord.com/api/v10/guilds/${guildId}/members/${user.id}`,
              {
                headers: {
                  Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                },
                cache: 'no-store',
              }
            );

            if (botResponse.ok) {
              guildResponse = botResponse;
            } else {
              console.error('Discord bot member lookup failed:', botResponse.status);
            }
          }

          if (guildResponse) {
            const member: DiscordGuildMember = await guildResponse.json();
            
            // 관리자 역할 확인 (길드1과 길드2 모두 동일한 관리자 역할 사용)
            const isAdminGuild1 = member.roles.includes(process.env.DISCORD_ADMIN_ROLE_ID!) || 
                                 (process.env.DISCORD_ADMIN_ROLE_ID_2 ? member.roles.includes(process.env.DISCORD_ADMIN_ROLE_ID_2) : false);
            const isAdminGuild2 = isAdminGuild1;
            
            // 길드별 일반 멤버 역할 확인
            const isGuild1Role = process.env.DISCORD_GUILD1_ROLE_ID ? member.roles.includes(process.env.DISCORD_GUILD1_ROLE_ID) : false;
            const isGuild2Role = process.env.DISCORD_GUILD2_ROLE_ID ? member.roles.includes(process.env.DISCORD_GUILD2_ROLE_ID) : false;
            
            // 서버 닉네임 또는 글로벌 유저네임 설정
            (user as ExtendedUser).displayName = member.nick || member.user.global_name || member.user.username;
            (user as ExtendedUser).isAdmin = isAdminGuild1 || isAdminGuild2;
            
            // 길드별 멤버십 정보 저장
            (user as any).isGuild1Member = isAdminGuild1 || isGuild1Role;
            (user as any).isGuild2Member = isAdminGuild2 || isGuild2Role;
            (user as any).guild1Member = isAdminGuild1 || isGuild1Role;
            (user as any).guild2Member = isAdminGuild2 || isGuild2Role;
            (user as any).isAdminGuild1 = isAdminGuild1; // 세계수 관리자 여부
            (user as any).isAdminGuild2 = isAdminGuild2; // 크랙 관리자 여부
            
            console.log('역할 확인:', {
              isAdminGuild1,
              isAdminGuild2,
              isGuild1Role,
              isGuild2Role,
              isGuild1Member: (user as any).isGuild1Member,
              isGuild2Member: (user as any).isGuild2Member,
              roles: member.roles
            });
            
            // Discord 로그인 성공
            return true; // 모든 Discord 사용자 로그인 허용 (테스트용)
          } else {
            return false; // API 호출 실패 시 로그인 거부
          }
        } catch (error) {
          console.error('Discord sign-in callback failed:', error);
          return false; // 오류 발생 시 로그인 거부
        }
      }
      return false; // Discord가 아닌 경우 로그인 거부
    },
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
        token.displayName = (user as ExtendedUser).displayName;
        token.isAdmin = (user as ExtendedUser).isAdmin;
        token.guild1Member = (user as any).guild1Member;
        token.guild2Member = (user as any).guild2Member;
        token.isGuild1Member = (user as any).isGuild1Member;
        token.isGuild2Member = (user as any).isGuild2Member;
        token.isAdminGuild1 = (user as any).isAdminGuild1;
        token.isAdminGuild2 = (user as any).isAdminGuild2;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        (session.user as ExtendedUser).id = token.id as string;
        (session.user as ExtendedUser).displayName = token.displayName as string;
        (session.user as ExtendedUser).isAdmin = token.isAdmin as boolean;
        (session.user as any).guild1Member = token.guild1Member;
        (session.user as any).guild2Member = token.guild2Member;
        (session.user as any).isGuild1Member = token.isGuild1Member;
        (session.user as any).isGuild2Member = token.isGuild2Member;
        (session.user as any).isAdminGuild1 = token.isAdminGuild1;
        (session.user as any).isAdminGuild2 = token.isAdminGuild2;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};
