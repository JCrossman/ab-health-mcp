/**
 * NextAuth.js v5 configuration for the Alberta Health Portal.
 *
 * MVP auth: Credentials provider with JWT sessions (no external DB required).
 * Phase 2: Add Cosmos DB adapter for persistent user storage.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // MVP: Simple validation. In production, validate against Cosmos DB.
        // For now, accept any non-empty credentials for development.
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // TODO: Phase 1.2 production — validate against Cosmos DB user store
        // For MVP development, create a user from the credentials
        return {
          id: String(credentials.email),
          email: String(credentials.email),
          name: String(credentials.email).split("@")[0],
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
