import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("CLI help works", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /cheap-llm-mcp/);
  assert.match(result.stdout, /setup/);
});

test("setup help works", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "setup", "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /interactive setup wizard/i);
});

test("doctor help works", () => {
  const result = spawnSync(process.execPath, ["dist/index.js", "doctor", "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Checks Node/);
});
