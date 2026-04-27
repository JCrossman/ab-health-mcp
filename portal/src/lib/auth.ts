/**
 * NextAuth.js v5 configuration for MyAI Health portal.
 *
 * Auth providers:
 *   - Google OAuth (primary) — users sign in with their Google account
 *   - Credentials (development only) — accepts any email/password for local testing
 *
 * Sessions are JWT-based (no database required for beta).
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const providers = [];

// Google OAuth — primary auth for production and beta
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

// Credentials — development fallback (accepts any email/password)
if (process.env.NODE_ENV === "development" || process.env.ALLOW_CREDENTIALS_LOGIN === "true") {
  providers.push(
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        return {
          id: String(credentials.email),
          email: String(credentials.email),
          name: String(credentials.email).split("@")[0],
        };
      },
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
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
