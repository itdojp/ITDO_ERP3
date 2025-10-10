import { describe, expect, test } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";

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

describe("project-share-slack CLI", () => {
  test("outputs text format by default", () => {
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(":clipboard: *テスト* _(");
    expect(result.stdout).toContain("• ステータス: *Active*");
    expect(result.stdout).toContain("• タグ: DX, SAP");
  });

  test("outputs markdown format", () => {
    const result = runScript(["--format", "markdown"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.startsWith("**テスト** (_")).toBe(true);
    expect(result.stdout).toContain("- タグ: DX, SAP");
  });

  test("outputs json format with filters", () => {
    const result = runScript(["--format", "json"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const payload = JSON.parse(result.stdout);
    expect(payload.title).toBe("テスト");
    expect(payload.filters.manager).toBe("Yamada");
    expect(payload.filters.tags).toEqual(["DX", "SAP"]);
    expect(payload.notes).toBe("メモ");
    expect(typeof payload.generatedAt).toBe("string");
  });

  test("returns error for unknown format", () => {
    const result = runScript(["--format", "csv"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unknown format");
  });
});
