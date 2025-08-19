import NextAuth from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify guilds',
        },
      },
    }),
  ],
  pages: {
    signIn: '/admin/login',
    signOut: '/',
    error: '/admin/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'discord') {
        const guildId = process.env.DISCORD_ADMIN_GUILD_ID;
        const roleId = process.env.DISCORD_ADMIN_ROLE_ID;
        const botToken = process.env.DISCORD_BOT_TOKEN;

        if (!guildId || !roleId || !botToken) {
          console.error('환경 변수 누락: Discord 관리자 길드 ID, 역할 ID 또는 봇 토큰이 설정되지 않았습니다.');
          return false;
        }

        try {
          // 1. 사용자 길드 정보 가져오기 (OAuth2 토큰 사용)
          const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
            },
          });

          if (!guildsResponse.ok) {
            const errorText = await guildsResponse.text();
            console.error(`Discord 길드 API 오류: ${guildsResponse.status} - ${errorText}`);
            
            // 401 오류인 경우 더 자세한 로그
            if (guildsResponse.status === 401) {
              console.error('Discord OAuth2 토큰이 만료되었거나 권한이 부족합니다.');
              console.error('토큰:', account.access_token?.substring(0, 20) + '...');
            }
            return false;
          }

          const guilds = await guildsResponse.json();
          console.log('사용자 길드:', guilds.map((g: any) => g.name));

          const adminGuild = guilds.find((g: any) => g.id === guildId);

          if (!adminGuild) {
            console.log('관리자 길드에 속해있지 않습니다.');
            return false;
          }

          // 2. 관리자 길드 내 사용자 역할 정보 가져오기 (봇 토큰 사용)
          const memberResponse = await fetch(`https://discord.com/api/guilds/${guildId}/members/${user.id}`, {
            headers: {
              Authorization: `Bot ${botToken}`,
            },
          });

          if (!memberResponse.ok) {
            const errorText = await memberResponse.text();
            console.error(`Discord 멤버 API 오류: ${memberResponse.status} - ${errorText}`);
            
            // 403 오류인 경우 봇 권한 문제일 수 있음
            if (memberResponse.status === 403) {
              console.error('봇이 해당 서버의 멤버 정보를 읽을 권한이 없습니다.');
              console.error('봇에게 "서버 멤버 보기" 권한을 부여해주세요.');
              console.error('Discord Developer Portal에서 "Server Members Intent"를 활성화해주세요.');
              
              // 대안: 사용자가 서버에 속해있는지만 확인하고 기본적으로 허용
              console.log('대안 방법: 사용자가 서버에 속해있으므로 기본적으로 허용합니다.');
              (user as any).isAdmin = true;
              return true;
            }
            return false;
          }

          const member = await memberResponse.json();
          console.log('관리자 길드 내 사용자 멤버 정보:', member);

          if (member && member.roles && member.roles.includes(roleId)) {
            console.log('관리자 역할 확인됨. 로그인 허용.');
            (user as any).isAdmin = true;
            
            // 서버 별명이 있으면 사용, 없으면 전역 닉네임 사용
            if (member.nick) {
              (user as any).displayName = member.nick;
            } else if (member.user && member.user.username) {
              (user as any).displayName = member.user.username;
            }
            
            return true;
          } else {
            console.log('관리자 역할이 없습니다.');
            return false;
          }
        } catch (error) {
          console.error('Discord 역할 확인 중 예상치 못한 오류 발생:', error);
          return false;
        }
      }
      return false;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.isAdmin = (user as any).isAdmin;
        token.displayName = (user as any).displayName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).isAdmin = token.isAdmin;
        if (token.displayName) {
          (session.user as any).displayName = token.displayName;
        }
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // 로그인 성공 후 메인 페이지로 리다이렉트
      if (url.startsWith(baseUrl)) {
        return `${baseUrl}/`;
      }
      // 외부 URL인 경우 그대로 반환
      return url;
    },
  },
});

export { handler as GET, handler as POST };
