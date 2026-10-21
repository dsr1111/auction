"use client";

import { SessionProvider } from "next-auth/react";
import { MembershipProvider } from './MembershipProvider';
import MembershipOnboarding from './MembershipOnboarding';

type AuthProviderProps = {
  children: React.ReactNode;
};

const AuthProvider = ({ children }: AuthProviderProps) => {
  return <SessionProvider><MembershipProvider><MembershipOnboarding>{children}</MembershipOnboarding></MembershipProvider></SessionProvider>;
};

export default AuthProvider;
