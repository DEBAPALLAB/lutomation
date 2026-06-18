import { db } from "../lib/db";
import bcrypt from "bcryptjs";

const teamMembers = [
  { email: "alex@company.com", name: "Alex" },
  { email: "blake@company.com", name: "Blake" },
  { email: "casey@company.com", name: "Casey" },
  { email: "drew@company.com", name: "Drew" },
  { email: "jamie@company.com", name: "Jamie" },
  { email: "taylor@company.com", name: "Taylor" }
];

async function main() {
  console.log("Generating 6 team member accounts...");
  
  for (const member of teamMembers) {
    // Generate a simple, random, readable temporary password
    const tempPass = Math.random().toString(36).substring(2, 10);
    const passwordHash = await bcrypt.hash(tempPass, 12);
    const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    try {
      await db.execute({
        sql: "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [id, member.email, member.name, passwordHash, new Date().toISOString()],
      });
      console.log(`[Success] User: ${member.name} (${member.email}) | Temp Password: ${tempPass}`);
    } catch (err: any) {
      console.error(`[Error] Failed to create user ${member.email}:`, err.message || err);
    }
  }
}

main().catch(console.error);
