import { db } from "../lib/db";
import bcrypt from "bcryptjs";

const teamMembers = [
  { email: "dev@company.com", name: "Dev" },
  { email: "dhruv@company.com", name: "Dhruv" },
  { email: "soham@company.com", name: "Soham" },
  { email: "shivam@company.com", name: "Shivam" },
  { email: "priya@company.com", name: "Priya" },
  { email: "tanvi@company.com", name: "Tanvi" }
];

async function main() {
  console.log("Cleaning up old placeholder accounts (Alex, Blake, etc.) if any...");
  try {
    await db.execute({
      sql: `DELETE FROM users WHERE email IN (
        'alex@company.com', 'blake@company.com', 'casey@company.com', 
        'drew@company.com', 'jamie@company.com', 'taylor@company.com'
      )`,
      args: []
    });
  } catch (err) {
    console.error("Cleanup error (safe to ignore if first run):", err);
  }

  console.log("Generating 6 new team member accounts...");
  
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
