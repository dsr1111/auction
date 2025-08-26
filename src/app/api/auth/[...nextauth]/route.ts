/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth from 'next-auth/next';
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

const handler = NextAuth({
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
    async signIn({ user, account }: { user: ExtendedUser; account: { provider: string } | null }) {
      if (account?.provider === 'discord') {
        try {
          // 환경 변수 디버깅

          // 필수 환경 변수 확인
          if (!process.env.DISCORD_GUILD_ID || !process.env.DISCORD_BOT_TOKEN) {
            return false;
          }

          // Discord Guild API로 사용자의 서버 멤버 정보 가져오기
          const guildResponse = await fetch(
            `https://discord.com/api/v9/guilds/${process.env.DISCORD_GUILD_ID}/members/${user.id}`,
            {
              headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              },
            }
          );

          if (guildResponse.ok) {
            const member: DiscordGuildMember = await guildResponse.json();
            
            // 관리자 역할 확인
            const isAdmin = member.roles.includes(process.env.DISCORD_ADMIN_ROLE_ID!);
            
            // 서버 닉네임 또는 글로벌 유저네임 설정
            (user as ExtendedUser).displayName = member.nick || member.user.global_name || member.user.username;
            (user as ExtendedUser).isAdmin = isAdmin;
            
            // Discord 로그인 성공
            return true; // 모든 Discord 사용자 로그인 허용 (테스트용)
          } else {
            const errorText = await guildResponse.text();
            // Discord Guild API 오류
            return false; // API 호출 실패 시 로그인 거부
          }
        } catch (error) {
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
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (token) {
        (session.user as ExtendedUser).id = token.id as string;
        (session.user as ExtendedUser).displayName = token.displayName as string;
        (session.user as ExtendedUser).isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});

export { handler as GET, handler as POST };
