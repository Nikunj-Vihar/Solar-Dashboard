import path from "node:path";

try {
  process.loadEnvFile(path.resolve(__dirname, "../.env.local"));
} catch {
  // .env.local not present — fine for tests that don't need live credentials.
}
