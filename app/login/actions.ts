"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";

function isRedirectError(err: any): boolean {
  return (
    err &&
    (err.message === "NEXT_REDIRECT" ||
      err.digest?.startsWith("NEXT_REDIRECT") ||
      (typeof err.name === "string" && err.name === "Redirect"))
  );
}

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  try {
    await signIn("credentials", {
      email: String(email),
      password: String(password),
      redirect: true,
      redirectTo: "/dashboard",
    });
    return { success: true };
  } catch (error: any) {
    if (isRedirectError(error)) {
      throw error; // Propagate redirect to /dashboard
    }

    if (error instanceof AuthError) {
      if (error.cause?.err?.message === "RateLimitExceeded") {
        return { error: "Too many failed attempts. Account locked for 15 minutes." };
      }
      return { error: "Invalid email or password." };
    }

    // Check message just in case
    if (error.message?.includes("RateLimitExceeded") || error.stack?.includes("RateLimitExceeded")) {
      return { error: "Too many failed attempts. Account locked for 15 minutes." };
    }

    console.error("Login Server Action error:", error);
    return { error: "Invalid email or password." };
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

