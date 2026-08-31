import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/db";
import type { AccountType } from "@/lib/constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountType: AccountType;
      onboarded: boolean;
      profileId: string | null;
      profileSlug: string | null;
    } & DefaultSession["user"];
  }
}

/**
 * The credentials provider exists purely so end-to-end tests can sign in
 * without hitting Google. It is hard-disabled in production builds regardless
 * of environment configuration.
 */
export function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_LOGIN === "true";
}

export function googleConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

const providers = [];

if (googleConfigured()) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: false,
      authorization: {
        params: { prompt: "consent", access_type: "offline", response_type: "code" },
      },
    }),
  );
}

if (devLoginEnabled()) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Development login",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        if (!devLoginEnabled()) return null;
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
        const name = String(credentials?.name ?? "").trim() || email.split("@")[0];

        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name },
        });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions keep the credentials-based test login working alongside OAuth.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: { signIn: "/signin" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      const userId = token.sub;
      if (!userId) return session;

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          accountType: true,
          onboardedAt: true,
          profile: { select: { id: true, slug: true } },
        },
      });

      if (!dbUser) return session;

      session.user = {
        ...session.user,
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email ?? "",
        image: dbUser.image,
        accountType: dbUser.accountType as AccountType,
        onboarded: Boolean(dbUser.onboardedAt),
        profileId: dbUser.profile?.id ?? null,
        profileSlug: dbUser.profile?.slug ?? null,
      };
      return session;
    },
  },
});

/** Returns the signed-in user's id, or null when anonymous. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
