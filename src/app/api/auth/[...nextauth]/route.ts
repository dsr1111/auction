import NextAuth from 'next-auth';
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
          scope: 'identify guilds guilds.members.read', // 필요한 스코프 모두 포함
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'discord') {
        try {
          // Discord Guild API로 사용자의 서버 멤버 정보 가져오기
          const guildResponse = await fetch(
            `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${user.id}`,
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
            
            return isAdmin; // 관리자 역할이 있는 사용자만 로그인 허용
          } else {
            console.error('Discord Guild API 오류:', guildResponse.status, await guildResponse.text());
            return false; // API 호출 실패 시 로그인 거부
          }
        } catch (error) {
          console.error('Discord API 호출 중 오류:', error);
          return false; // 오류 발생 시 로그인 거부
        }
      }
      return false; // Discord가 아닌 경우 로그인 거부
    },
    async jwt({ token, user }) {
      if (user) {
        token.displayName = (user as ExtendedUser).displayName;
        token.isAdmin = (user as ExtendedUser).isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as ExtendedUser).displayName = token.displayName as string;
        (session.user as ExtendedUser).isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/admin/login',
  },
});

export { handler as GET, handler as POST };
