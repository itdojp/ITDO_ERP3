import { describe, expect, test } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const runScriptRaw = (args: string[] = []) =>
  spawnSync(process.execPath, [scriptPath, ...args], {
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

  test("load defaults from config", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-config-"));
    try {
      const configPath = path.join(tempDir, "config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            url: "https://example.com/projects?status=planned&manager=Suzuki",
            title: "Config Title",
            notes: "Config Notes",
            format: "json",
            count: 7,
          },
          null,
          2,
        ),
        "utf-8",
      );

      const result = runScriptRaw(["--config", configPath]);
      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      validateSharePayload(payload);
      expect(payload.title).toBe("Config Title");
      expect(payload.notes).toBe("Config Notes");
      expect(payload.filters.status).toBe("planned");
      expect(payload.filters.manager).toBe("Suzuki");
      expect(payload.projectCount).toBe(7);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("loads template defaults from config", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-template-"));
    try {
      const configPath = path.join(tempDir, "config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            templates: {
              daily: {
                title: "Daily Template",
                notes: "Template notes",
                format: "json",
                count: 3,
              },
            },
            url: "https://example.com/projects?status=planned",
          },
          null,
          2,
        ),
        "utf-8",
      );

      const result = runScriptRaw(["--config", configPath, "--template", "daily"]);
      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.title).toBe("Daily Template");
      expect(payload.notes).toBe("Template notes");
      expect(payload.filters.status).toBe("planned");
      expect(payload.projectCount).toBe(3);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("includes metrics in json output when --fetch-metrics is enabled", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-metrics-"));
    const apiDir = mkdtempSync(path.join(tmpdir(), "share-cli-metrics-api-"));
    try {
      await new Promise<void>((resolve, reject) => {
        const server = createServer((request, response) => {
          const url = new URL(request.url ?? "", `http://${request.headers.host}`);
          const health = url.searchParams.get("health");
          const total = health === "red" ? 2 : health === "yellow" ? 4 : 10;
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ items: [], meta: { total } }));
        });

        server.listen(0, "127.0.0.1", () => {
          const address = server.address() as AddressInfo | null;
          if (!address || typeof address === "string") {
            server.close();
            reject(new Error("Failed to start metrics test server"));
            return;
          }
          const apiBase = `http://127.0.0.1:${address.port}`;
          const configPath = path.join(tempDir, "config.json");
          writeFileSync(
            configPath,
            JSON.stringify(
              {
                url: "https://example.com/projects?status=active&manager=Yamada",
                title: "Metrics Test",
                notes: "with metrics",
                format: "json",
                count: 5,
                post: [],
              "fetch-metrics": true,
              projectsApi: {
                baseUrl: apiBase,
                timeoutMs: 2000,
              },
              },
              null,
              2,
            ),
            "utf-8",
          );

          const args = [
            "--config",
            configPath,
            "--format",
            "json",
          ];
          const child = spawn(process.execPath, [scriptPath, ...args], {
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
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
          child.on("error", (error) => {
            server.close(() => reject(error));
          });
          child.on("close", (code) => {
            server.close(() => {
              try {
                expect(code).toBe(0);
                const payload = JSON.parse(stdout);
                expect(payload.metrics.totalProjects).toBe(10);
                expect(payload.metrics.riskProjects).toBe(2);
                expect(payload.metrics.warningProjects).toBe(4);
                expect(payload.message).toContain("• API 件数: 10");
                resolve();
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error(stderr);
                reject(error);
              }
            });
          });
        });
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      rmSync(apiDir, { recursive: true, force: true });
    }
  });

  test("lists templates when --list-templates is provided", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-templates-"));
    try {
      const configPath = path.join(tempDir, "share.config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            templates: {
              weekly: { title: "Weekly", notes: "Weekly note" },
              review: { title: "Exec" },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );
      const result = runScriptRaw(["--config", configPath, "--list-templates"]);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Available templates:");
      expect(result.stdout).toContain("- review");
      expect(result.stdout).toContain("- weekly");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("removes template from config when --remove-template is used", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-remove-template-"));
    try {
      const configPath = path.join(tempDir, "share.config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            templates: {
              daily: { title: "Daily Update" },
              review: { title: "Exec Review" },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );
      const result = runScriptRaw(["--config", configPath, "--remove-template", "daily"]);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Removed template: daily");
      const updated = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(updated.templates?.daily).toBeUndefined();
      expect(updated.templates?.review).toBeTruthy();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when removing unknown template", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-remove-missing-"));
    try {
      const configPath = path.join(tempDir, "share.config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            templates: {
              weekly: { title: "Weekly" },
            },
          },
          null,
          2,
        ),
        "utf-8",
      );
      const result = runScriptRaw(["--config", configPath, "--remove-template", "unknown"]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Unknown template");
      const updated = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(updated.templates?.weekly).toBeTruthy();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("fails when template name is unknown", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-template-missing-"));
    try {
      const configPath = path.join(tempDir, "config.json");
      writeFileSync(
        configPath,
        JSON.stringify({ templates: { daily: { title: "Daily" } } }, null, 2),
        "utf-8",
      );

      const result = runScriptRaw(["--config", configPath, "--template", "weekly"]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Unknown template: weekly");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
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

  test("includes metrics in json output when --fetch-metrics is enabled", async () => {
    const requests: Array<{ path: string; auth: string | undefined; tenant: string | undefined }> = [];
    await new Promise<void>((resolve, reject) => {
      const server = createServer((request, response) => {
        const requestUrl = new URL(request.url ?? "", `http://${request.headers.host}`);
        requests.push({
          path: requestUrl.toString(),
          auth: request.headers.authorization,
          tenant: request.headers["x-tenant-id"] as string | undefined,
        });
        const health = requestUrl.searchParams.get("health");
        const total =
          health === "red" ? 2 : health === "yellow" ? 4 : requestUrl.searchParams.get("status") === "active" ? 10 : 0;
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ items: [], meta: { total } }));
      });

      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo | null;
        if (!address || typeof address === "string") {
          server.close();
          reject(new Error("Failed to determine metrics test server address"));
          return;
        }
        const apiBase = `http://127.0.0.1:${address.port}`;
        runScriptAsync([
          "--format",
          "json",
          "--fetch-metrics",
          "--projects-api-base",
          apiBase,
          "--projects-api-token",
          "token-123",
          "--projects-api-tenant",
          "example-tenant",
        ])
          .then((result) => {
            server.close(() => {
              try {
                expect(result.status).toBe(0);
                const payload = JSON.parse(result.stdout);
                expect(payload.metrics).toBeTruthy();
                expect(payload.metrics.totalProjects).toBe(10);
                expect(payload.metrics.riskProjects).toBe(2);
                expect(payload.metrics.warningProjects).toBe(4);
                expect(Array.isArray(payload.metrics.requests)).toBe(true);
                expect(payload.metrics.requests).toHaveLength(3);
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

    expect(requests).toHaveLength(3);
    requests.forEach((entry) => {
      expect(entry.auth).toBe("Bearer token-123");
      expect(entry.tenant).toBe("example-tenant");
      expect(entry.path).toContain("/api/v1/projects?");
      const url = new URL(entry.path);
      expect(url.searchParams.get("first")).toBe("1");
      expect(url.searchParams.get("status")).toBe("active");
      expect(url.searchParams.get("manager")).toBe("Yamada");
      expect(url.searchParams.getAll("tags").join(",")).toContain("DX");
    });
    const healthParameters = requests.map((entry) => new URL(entry.path).searchParams.get("health"));
    expect(new Set(healthParameters)).toEqual(new Set([null, "red", "yellow"]));
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

  test("honors Retry-After header when --respect-retry-after is enabled", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-respect-"));
    const auditPath = path.join(tempDir, "audit.json");
    let callCount = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        const server = createServer((request, response) => {
          callCount += 1;
          if (callCount === 1) {
            response.statusCode = 429;
            response.setHeader("Retry-After", "0.05");
            response.setHeader("Content-Type", "text/plain");
            response.end("rate limited");
          } else {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end("ok");
          }
        });

        server.listen(0, "127.0.0.1", () => {
          const address = server.address() as AddressInfo | null;
          const webhookUrl = `http://127.0.0.1:${address?.port ?? 0}/respect`;
          runScriptAsync([
            "--format",
            "json",
            "--post",
            webhookUrl,
            "--retry",
            "1",
            "--retry-delay",
            "5",
            "--retry-backoff",
            "2",
            "--retry-max-delay",
            "100",
            "--retry-jitter",
            "0",
            "--respect-retry-after",
            "--audit-log",
            auditPath,
            "--ensure-ok",
          ])
            .then((result) => {
              server.close(() => {
                try {
                  expect(result.status).toBe(0);
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

      expect(callCount).toBe(2);
      const auditContent = JSON.parse(readFileSync(auditPath, "utf-8"));
      expect(Array.isArray(auditContent.attempts)).toBe(true);
      expect(auditContent.attempts.length).toBe(2);
      const firstAttempt = auditContent.attempts[0];
      expect(firstAttempt.success).toBe(false);
      expect(typeof firstAttempt.retryAfterMs).toBe("number");
      expect(firstAttempt.retryAfterMs).toBeGreaterThanOrEqual(50);
      expect(firstAttempt.nextDelayMs).toBeGreaterThanOrEqual(firstAttempt.retryAfterMs);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("applies per-webhook retry overrides from config", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-webhook-override-"));
    try {
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
          if (!address || typeof address === "string") {
            server.close();
            reject(new Error("Failed to start webhook override server"));
            return;
          }
          const webhookUrl = `http://127.0.0.1:${address.port}/retry-override`;
          const configPath = path.join(tempDir, "share.config.json");
          writeFileSync(
            configPath,
            JSON.stringify(
              {
                post: [
                  {
                    url: webhookUrl,
                    retry: 1,
                    retryDelay: 5,
                    retryBackoff: 1,
                    retryMaxDelay: 5,
                    retryJitter: 0,
                  },
                ],
              },
              null,
              2,
            ),
            "utf-8",
          );
          const configData = JSON.parse(readFileSync(configPath, "utf-8"));
          expect(typeof configData.post[0].url).toBe("string");
          runScriptAsync(["--config", configPath, "--retry", "0", "--format", "json"])
            .then((result) => {
              server.close(() => {
                try {
                  expect(result.status).toBe(0);
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
      expect(callCount).toBe(2);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("webhook override can disable global retries", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "share-cli-webhook-disable-"));
    try {
      let callCount = 0;
      await new Promise<void>((resolve) => {
        const server = createServer((request, response) => {
          callCount += 1;
          response.writeHead(500, { "Content-Type": "text/plain" });
          response.end("still failing");
        });

        server.listen(0, "127.0.0.1", () => {
          const address = server.address() as AddressInfo | null;
          const webhookUrl = `http://127.0.0.1:${address?.port ?? 0}/disable-retry`;
          const configPath = path.join(tempDir, "share.config.json");
          writeFileSync(
            configPath,
            JSON.stringify(
              {
                post: [
                  {
                    url: webhookUrl,
                    retry: 0,
                  },
                ],
              },
              null,
              2,
            ),
            "utf-8",
          );
          runScriptAsync(["--config", configPath, "--retry", "2", "--format", "json"])
            .then((result) => {
              server.close(() => {
                expect(result.status).toBe(1);
                resolve();
              });
            })
            .catch(() => {
              server.close(() => resolve());
            });
        });
      });
      expect(callCount).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
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
