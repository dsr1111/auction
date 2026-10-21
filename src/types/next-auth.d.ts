


import 'next-auth';
import 'next-auth/jwt';

declare module "next-auth" {
  interface User {
    canUseAuction?: boolean
    displayName?: string
    isAdmin?: boolean
    guild1Member?: boolean
    guild2Member?: boolean
    isGuild1Member?: boolean
    isGuild2Member?: boolean
  }
  
  interface Session {
    user: {
      canUseAuction?: boolean
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      displayName?: string
      isAdmin?: boolean
      guild1Member?: boolean
      guild2Member?: boolean
      isGuild1Member?: boolean
      isGuild2Member?: boolean
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    canUseAuction?: boolean
    displayName?: string
    isAdmin?: boolean
    guild1Member?: boolean
    guild2Member?: boolean
    isGuild1Member?: boolean
    isGuild2Member?: boolean
  }
}
