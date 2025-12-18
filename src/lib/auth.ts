import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username ?? "";
        const password = credentials?.password ?? "";
        const expectedUsername = process.env.AUTH_USERNAME;
        const expectedPassword = process.env.AUTH_PASSWORD;

        if (!expectedUsername || !expectedPassword) {
          throw new Error("Missing AUTH_USERNAME or AUTH_PASSWORD");
        }

        if (username === expectedUsername && password === expectedPassword) {
          return { id: "admin", name: "Admin" };
        }

        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
};
