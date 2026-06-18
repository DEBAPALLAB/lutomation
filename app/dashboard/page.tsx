import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const runtime = "nodejs";

export default async function DashboardPage() {
  // Server-side session verification (Defense in depth)
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  // Pass user info (id, name, email) to the client component
  const currentUser = {
    id: session.user.id || "",
    name: session.user.name || "",
    email: session.user.email || "",
  };

  return <DashboardClient currentUser={currentUser} />;
}
