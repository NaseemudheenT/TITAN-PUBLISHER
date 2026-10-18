import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Only needed for `db:migrate` / studio. `db:generate` does not connect.
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/titan",
  },
  strict: true,
  verbose: true,
});
