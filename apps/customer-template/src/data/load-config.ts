import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SiteConfigSchema, type SiteConfig } from "@revivo/shared";

/**
 * Resolves the active site config from (in priority order):
 *   1. REVIVO_CONFIG env var — a path to a JSON file relative to cwd
 *   2. examples/lume-atelier.json — sensible dev default
 *
 * In production (mockups + customer sites), the mockup-generator writes the
 * config to the build env or to a path the build script reads.
 */
export function loadConfig(): SiteConfig {
  const path = process.env.REVIVO_CONFIG ?? "examples/lume-atelier.json";
  const abs = resolve(process.cwd(), path);
  const raw = readFileSync(abs, "utf-8");
  const json = JSON.parse(raw);
  return SiteConfigSchema.parse(json);
}
