import { db } from "../lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const name = args[1];
  const password = args[2];

  if (!email || !name || !password) {
    console.error("Usage: npx tsx scripts/add-user.ts <email> <name> <password>");
    process.exit(1);
  }

  console.log(`Creating user: ${name} (${email})...`);
  const passwordHash = await bcrypt.hash(password, 12);
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  try {
    await db.execute({
      sql: "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [id, email.toLowerCase().trim(), name, passwordHash, new Date().toISOString()],
    });
    console.log("User created successfully!");
  } catch (err: any) {
    console.error("Failed to create user:", err.message || err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
