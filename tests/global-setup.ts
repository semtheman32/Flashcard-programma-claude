import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const DB = "file:./test-vitest.db";

export default function setup() {
  const file = path.resolve(__dirname, "../prisma/test-vitest.db");
  rmSync(file, { force: true });
  rmSync(`${file}-journal`, { force: true });
  execSync("npx prisma migrate deploy", { stdio: "ignore", env: { ...process.env, DATABASE_URL: DB } });
  return () => {
    rmSync(file, { force: true });
    rmSync(`${file}-journal`, { force: true });
  };
}
