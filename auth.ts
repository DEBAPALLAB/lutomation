import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { db } from "./lib/db";
import bcrypt from "bcryptjs";


export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials) return null;
        const email = (credentials.email as string)?.toLowerCase().trim();
        const password = credentials.password as string;

        if (!email || !password) {
          return null;
        }

        // Get Client IP address for rate-limiting
        let ip = "127.0.0.1";
        if (req && req.headers) {
          try {
            const forwardedFor = typeof req.headers.get === "function" 
              ? req.headers.get("x-forwarded-for") 
              : (req.headers as any)["x-forwarded-for"];
            
            const realIp = typeof req.headers.get === "function" 
              ? req.headers.get("x-real-ip") 
              : (req.headers as any)["x-real-ip"];

            ip = forwardedFor?.split(",")[0].trim() || realIp?.trim() || "127.0.0.1";
          } catch (e) {
            console.error("Failed to get headers/IP from request:", e);
          }
        }

        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

        try {
          // Check login attempts in the last 10 minutes
          const attemptsRes = await db.execute({
            sql: `SELECT COUNT(*) as count, MAX(timestamp) as last_attempt 
                  FROM login_attempts 
                  WHERE email = ? AND ip = ? AND success = 0 AND timestamp > ?`,
            args: [email, ip, tenMinutesAgo],
          });

          const attemptCount = Number(attemptsRes.rows[0].count || 0);
          const lastAttempt = attemptsRes.rows[0].last_attempt as string | null;

          if (attemptCount >= 5 && lastAttempt && lastAttempt > fifteenMinutesAgo) {
            console.warn(`Rate limit triggered for ${email} from ${ip}`);
            throw new Error("RateLimitExceeded");
          }

          // Fetch user from db
          const userRes = await db.execute({
            sql: "SELECT * FROM users WHERE email = ? LIMIT 1",
            args: [email],
          });

          if (userRes.rows.length === 0) {
            // Log failed attempt
            await db.execute({
              sql: "INSERT INTO login_attempts (email, ip, success, timestamp) VALUES (?, ?, 0, ?)",
              args: [email, ip, now.toISOString()],
            });
            return null;
          }

          const dbUser = userRes.rows[0];
          const isValid = await bcrypt.compare(password, dbUser.password_hash as string);

          if (!isValid) {
            // Log failed attempt
            await db.execute({
              sql: "INSERT INTO login_attempts (email, ip, success, timestamp) VALUES (?, ?, 0, ?)",
              args: [email, ip, now.toISOString()],
            });
            return null;
          }

          // Log successful attempt
          await db.execute({
            sql: "INSERT INTO login_attempts (email, ip, success, timestamp) VALUES (?, ?, 1, ?)",
            args: [email, ip, now.toISOString()],
          });

          return {
            id: dbUser.id as string,
            email: dbUser.email as string,
            name: dbUser.name as string,
          };
        } catch (error: any) {
          if (error.message === "RateLimitExceeded") {
            throw error;
          }
          console.error("Auth DB Error:", error);
          return null;
        }
      },
    }),
  ],
});
