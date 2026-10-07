


declare module "next-auth" {
  interface User {
    displayName?: string
    isAdmin?: boolean
    guild1Member?: boolean
    guild2Member?: boolean
    isGuild1Member?: boolean
    isGuild2Member?: boolean
  }
  
  interface Session {
    user: {
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
    displayName?: string
    isAdmin?: boolean
    guild1Member?: boolean
    guild2Member?: boolean
    isGuild1Member?: boolean
    isGuild2Member?: boolean
  }
}
