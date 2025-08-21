import NextAuth from "next-auth"

declare module "next-auth" {
  interface User {
    displayName?: string
    isAdmin?: boolean
  }
  
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      displayName?: string
      isAdmin?: boolean
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    displayName?: string
    isAdmin?: boolean
  }
}
