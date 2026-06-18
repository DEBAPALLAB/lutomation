import { db } from "../lib/db";

const updates = [
  { id: "yg0i3o00s1ivu1sspk9kvc", name: "Dev", email: "dev@company.com" },
  { id: "b2gz5kpdeqokjkgnooml3p", name: "Dhruv", email: "dhruv@company.com" },
  { id: "sy5q8yiwqy83jzjo7h6anx", name: "Soham", email: "soham@company.com" },
  { id: "c9n9qp5sgy6fadw1q1rpir", name: "Shivam", email: "shivam@company.com" },
  { id: "lnktu7ejaagz45294m59bd", name: "Priya", email: "priya@company.com" },
  { id: "dzlvfu6lveh657dekgsi2i", name: "Tanvi", email: "tanvi@company.com" }
];

async function main() {
  console.log("Updating team member names and email addresses...");
  for (const item of updates) {
    try {
      await db.execute({
        sql: "UPDATE users SET name = ?, email = ? WHERE id = ?",
        args: [item.name, item.email, item.id]
      });
      console.log(`[Success] ID: ${item.id} renamed to ${item.name} (${item.email})`);
    } catch (err: any) {
      console.error(`[Error] Failed to update ID ${item.id}:`, err.message || err);
    }
  }
}

main().catch(console.error);
