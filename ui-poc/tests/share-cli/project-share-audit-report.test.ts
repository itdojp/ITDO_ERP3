import { describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const reportScript = path.resolve(__dirname, "../../../scripts/project-share-audit-report.js");

describe("project-share-audit-report", () => {
  test("summarizes audit log in text format", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-audit-report-"));
    try {
      const logPath = path.join(tempDir, "audit.json");
      writeFileSync(
        logPath,
        JSON.stringify(
          {
            title: "Weekly Projects",
            generatedAt: "2025-10-12T01:30:00.000Z",
            attempts: [
              {
                timestamp: "2025-10-12T01:30:01.000Z",
                webhook: "https://hooks.slack.com/services/AAA/BBB/CCC",
                attempt: 0,
                success: false,
                statusCode: 500,
                elapsedMs: 1200,
                error: "server error",
              },
              {
                timestamp: "2025-10-12T01:30:05.500Z",
                webhook: "https://hooks.slack.com/services/AAA/BBB/CCC",
                attempt: 1,
                success: true,
                statusCode: 200,
                elapsedMs: 900,
                responseBody: "ok",
              },
            ],
          },
          null,
          2,
        ),
        "utf-8",
      );
      const result = spawnSync(process.execPath, [reportScript, "--input", logPath], {
        encoding: "utf-8",
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Weekly Projects");
      expect(result.stdout).toContain("Attempts: 2 (success: 1, failure: 1)");
      expect(result.stdout).toContain("Overall result: success");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("produces JSON summary", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-audit-report-json-"));
    try {
      const logPath = path.join(tempDir, "audit.json");
      writeFileSync(
        logPath,
        JSON.stringify(
          {
            title: "Daily Check",
            generatedAt: "2025-10-12T02:00:00.000Z",
            attempts: [
              {
                timestamp: "2025-10-12T02:00:01.000Z",
                webhook: "https://hooks.slack.com/services/DDD/EEE/FFF",
                attempt: 0,
                success: true,
                statusCode: 200,
                elapsedMs: 800,
                responseBody: "ok",
              },
            ],
          },
          null,
          2,
        ),
        "utf-8",
      );
      const result = spawnSync(process.execPath, [reportScript, "--input", logPath, "--format", "json"], {
        encoding: "utf-8",
      });
      expect(result.status).toBe(0);
      const summaries = JSON.parse(result.stdout);
      expect(Array.isArray(summaries)).toBe(true);
      expect(summaries[0].title).toBe("Daily Check");
      expect(summaries[0].webhooks[0].lastStatus).toBe("success");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when final status is failure and --fail-on-error is set", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-audit-report-fail-"));
    try {
      const logPath = path.join(tempDir, "audit.json");
      writeFileSync(
        logPath,
        JSON.stringify(
          {
            title: "Fallback Check",
            generatedAt: "2025-10-12T03:00:00.000Z",
            attempts: [
              {
                timestamp: "2025-10-12T03:00:01.000Z",
                webhook: "https://hooks.slack.com/services/ZZZ/YYY/XXX",
                attempt: 0,
                success: false,
                statusCode: 500,
                error: "timeout",
              },
            ],
          },
          null,
          2,
        ),
        "utf-8",
      );
      const result = spawnSync(
        process.execPath,
        [reportScript, "--input", logPath, "--fail-on-error"],
        { encoding: "utf-8" },
      );
      expect(result.status).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
