import { describe, expect, test } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

const scriptPath = path.resolve(__dirname, "../../../scripts/project-share-slack.js");
const baseArgs = [
  "--url",
  "https://example.com/projects?status=active&manager=Yamada&tags=DX,SAP",
  "--title",
  "テスト",
  "--notes",
  "メモ",
];

const runScript = (extraArgs: string[] = []) =>
  spawnSync(process.execPath, [scriptPath, ...baseArgs, ...extraArgs], {
    encoding: "utf-8",
  });

const validateSharePayload = (payload: any) => {
  expect(payload).toBeTruthy();
  expect(typeof payload.title).toBe("string");
  expect(payload.title.length).toBeGreaterThan(0);
  expect(typeof payload.url).toBe("string");
  expect(() => new URL(payload.url)).not.toThrow();
  expect(typeof payload.generatedAt).toBe("string");
  expect(Number.isNaN(Date.parse(payload.generatedAt))).toBe(false);
  expect(typeof payload.message).toBe("string");
  expect(typeof payload.notes).toBe("string");
  expect(payload).toHaveProperty("filters");
  expect(typeof payload.filters.status).toBe("string");
  expect(typeof payload.filters.keyword).toBe("string");
  expect(typeof payload.filters.manager).toBe("string");
  expect(typeof payload.filters.health).toBe("string");
  expect(Array.isArray(payload.filters.tags)).toBe(true);
  expect(
    payload.filters.count === null ||
      typeof payload.filters.count === "number" ||
      typeof payload.filters.count === "undefined",
  ).toBe(true);
  if (typeof payload.projectCount !== "undefined" && payload.projectCount !== null) {
    expect(typeof payload.projectCount).toBe("number");
    expect(payload.projectCount).toBeGreaterThanOrEqual(0);
  }
};

const runScriptAsync = (extraArgs: string[] = []) =>
  new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...baseArgs, ...extraArgs], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ status: code, stdout, stderr });
    });
  });

describe("project-share-slack CLI", () => {
  test("outputs text format by default", () => {
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(":clipboard: *テスト* _(");
    expect(result.stdout).toContain("• ステータス: *Active*");
    expect(result.stdout).toContain("• タグ: DX, SAP");
  });

  test("includes count bullet when provided", () => {
    const result = runScript(["--count", "17"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("• 件数: 17");
  });

  test("outputs markdown format", () => {
    const result = runScript(["--format", "markdown"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.startsWith("**テスト** (_")).toBe(true);
    expect(result.stdout).toContain("- タグ: DX, SAP");
  });

  test("writes output to file when --out is provided", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-"));
    try {
      const outPath = path.join(tempDir, "share.txt");
      const result = runScript(["--out", outPath]);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const fileContent = readFileSync(outPath, "utf-8");
      expect(fileContent.trimEnd()).toBe(result.stdout.trimEnd());
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("outputs json format with filters and count", () => {
    const result = runScript(["--format", "json", "--count", "42"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const payload = JSON.parse(result.stdout);
    validateSharePayload(payload);
    expect(payload.title).toBe("テスト");
    expect(payload.filters.manager).toBe("Yamada");
    expect(payload.filters.tags).toEqual(["DX", "SAP"]);
    expect(payload.notes).toBe("メモ");
    expect(typeof payload.generatedAt).toBe("string");
    expect(payload.projectCount).toBe(42);
    expect(payload.message).toContain("• 件数: 42");
  });

  test("returns error for unknown format", () => {
    const result = runScript(["--format", "csv"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unknown format");
  });

  test("returns error for invalid count", () => {
    const result = runScript(["--count", "abc"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Invalid count provided");
  });

  test("returns error for invalid retry-backoff", () => {
    const result = runScript(["--retry-backoff", "0.5"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Invalid retry-backoff value");
  });

  test("returns error for invalid retry-max-delay", () => {
    const result = runScript(["--retry-max-delay", "abc"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Invalid retry-max-delay value");
  });

  test("returns error for invalid retry-jitter", () => {
    const result = runScript(["--retry-jitter", "xyz"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Invalid retry-jitter value");
  });

  test("posts to one or more webhooks when --post provided", async () => {
    const received: Array<{ text: string; path: string | undefined }> = [];
    await new Promise<void>((resolve, reject) => {
      const server = createServer((request, response) => {
        let body = "";
        request.on("data", (chunk) => {
          body += chunk;
        });
        request.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            received.push({ text: parsed.text, path: request.url ?? undefined });
          } catch (error) {
            // ignore parse errors and let assertion fail later
          }
          response.writeHead(200, { "Content-Type": "text/plain" });
          response.end("ok");
        });
      });

      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo | null;
        if (!address || typeof address === "string") {
          server.close();
          reject(new Error("Failed to determine webhook test server address"));
          return;
        }
        const webhookUrl = `http://127.0.0.1:${address.port}/webhook`;
        const webhookUrlSecondary = `http://127.0.0.1:${address.port}/webhook-secondary`;
        runScriptAsync(["--format", "json", "--post", webhookUrl, "--post", webhookUrlSecondary])
          .then((result) => {
            server.close((closeError) => {
              if (closeError) {
                reject(closeError);
                return;
              }
              try {
                expect(result.status).toBe(0);
                expect(received).toHaveLength(2);
                expect(received[0].text).toContain(":clipboard: *テスト*");
                expect(received[1].text).toContain(":clipboard: *テスト*");
                expect(new Set(received.map((entry) => entry.path))).toEqual(
                  new Set(["/webhook", "/webhook-secondary"]),
                );
                expect(result.stderr).toContain(`Posted share message to webhook: ${webhookUrl}`);
                expect(result.stderr).toContain(`Posted share message to webhook: ${webhookUrlSecondary}`);
                resolve();
              } catch (assertionError) {
                reject(assertionError);
              }
            });
          })
          .catch((error) => {
            server.close(() => {
              reject(error);
            });
          });
      });
    });
  });

  test("fails when --ensure-ok and webhook body is not ok", async () => {
    await new Promise<void>((resolve) => {
      const server = createServer((request, response) => {
        response.writeHead(200, { "Content-Type": "text/plain" });
        response.end("accepted");
      });

      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo | null;
        const webhookUrl = `http://127.0.0.1:${address?.port ?? 0}/webhook`;
        runScriptAsync(["--format", "json", "--post", webhookUrl, "--ensure-ok"])
          .then((result) => {
            server.close(() => {
              expect(result.status).toBe(1);
              expect(result.stderr).toContain("Unexpected webhook response body");
              resolve();
            });
          })
          .catch(() => {
            server.close(() => resolve());
          });
      });
    });
  });

  test("retries webhook posting when --retry is specified", async () => {
    let callCount = 0;
    await new Promise<void>((resolve, reject) => {
      const server = createServer((request, response) => {
        callCount += 1;
        if (callCount === 1) {
          response.writeHead(500, { "Content-Type": "text/plain" });
          response.end("error");
        } else {
          response.writeHead(200, { "Content-Type": "text/plain" });
          response.end("ok");
        }
      });

      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo | null;
        const webhookUrl = `http://127.0.0.1:${address?.port ?? 0}/retry`;
        runScriptAsync([
          "--format",
          "json",
          "--post",
          webhookUrl,
          "--retry",
          "1",
          "--retry-delay",
          "10",
          "--retry-backoff",
          "2",
          "--retry-max-delay",
          "15",
          "--retry-jitter",
          "0",
          "--ensure-ok",
        ])
          .then((result) => {
            server.close(() => {
              try {
                expect(result.status).toBe(0);
                expect(callCount).toBe(2);
                resolve();
              } catch (error) {
                reject(error);
              }
            });
          })
          .catch((error) => {
            server.close(() => reject(error));
          });
      });
    });
  });

  test("stops after exceeding retry attempts", async () => {
    let callCount = 0;
    await new Promise<void>((resolve) => {
      const server = createServer((request, response) => {
        callCount += 1;
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.end("still failing");
      });

      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo | null;
        const webhookUrl = `http://127.0.0.1:${address?.port ?? 0}/retry-fail`;
        runScriptAsync([
          "--format",
          "json",
          "--post",
          webhookUrl,
          "--retry",
          "2",
          "--retry-delay",
          "5",
        ])
          .then((result) => {
            server.close(() => {
              expect(result.status).toBe(1);
              expect(callCount).toBe(3);
              resolve();
            });
          })
          .catch(() => {
            server.close(() => resolve());
          });
      });
    });
  });

  test("writes audit log with retry details", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-audit-"));
    const auditPath = path.join(tempDir, "audit.json");
    let callCount = 0;
    await new Promise<void>((resolve, reject) => {
      const server = createServer((request, response) => {
        callCount += 1;
        if (callCount === 1) {
          response.writeHead(500, { "Content-Type": "text/plain" });
          response.end("server error");
        } else {
          response.writeHead(200, { "Content-Type": "text/plain" });
          response.end("ok");
        }
      });

      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo | null;
        const webhookUrl = `http://127.0.0.1:${address?.port ?? 0}/audit`;
        runScriptAsync([
          "--format",
          "json",
          "--post",
          webhookUrl,
          "--retry",
          "1",
          "--retry-delay",
          "5",
          "--audit-log",
          auditPath,
          "--ensure-ok",
        ])
          .then((result) => {
            server.close(() => {
              try {
                expect(result.status).toBe(0);
                const auditContent = JSON.parse(readFileSync(auditPath, "utf-8"));
                expect(Array.isArray(auditContent.attempts)).toBe(true);
                expect(auditContent.attempts.length).toBe(2);
                expect(auditContent.attempts[0].success).toBe(false);
                expect(auditContent.attempts[1].success).toBe(true);
                resolve();
              } catch (error) {
                reject(error);
              }
            });
          })
          .catch((error) => {
            server.close(() => reject(error));
          });
      });
    }).finally(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
