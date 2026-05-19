import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SERVER_VERSION } from "../src/server.js";

test("server version follows package version", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  assert.equal(SERVER_VERSION, packageJson.version);
});
