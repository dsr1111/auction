"use client";

import { SessionProvider } from "next-auth/react";
import { MembershipProvider } from './MembershipProvider';

type AuthProviderProps = {
  children: React.ReactNode;
};

const AuthProvider = ({ children }: AuthProviderProps) => {
  return <SessionProvider><MembershipProvider>{children}</MembershipProvider></SessionProvider>;
};

export default AuthProvider;
