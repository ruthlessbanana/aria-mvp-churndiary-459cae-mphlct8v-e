const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const root = __dirname;
const conn = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!conn) {
  console.error("missing DATABASE_URL");
  process.exit(1);
}
const files = ["db/migrations/0005_cancellation_entries.sql","db/migrations/0006_trial_entries.sql","db/migrations/0007_notification_preferences.sql"];

const missing = files.filter((rel) => !fs.existsSync(path.join(root, rel)));
if (missing.length > 0) {
  const details = JSON.stringify({
    error: "planned_migration_file_missing",
    detail: "One or more plannedSqlMigrationFiles are missing from the generated repo.",
    expectedFiles: files,
    missingFiles: missing,
    migrationPolicy: {
      firstGeneratedLabel: "0005",
      templateReservedRangeLabel: "0001-0004",
    },
  });
  console.error(details);
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    for (const rel of files) {
      const filePath = path.join(root, rel);
      const sql = fs.readFileSync(filePath, "utf8");
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});