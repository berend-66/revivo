import { spawn, type ChildProcess } from "node:child_process";

/**
 * Serve generated mockups through the real `apps/mockups` SSR app for screenshotting.
 *
 * Supabase env is stripped so the app uses its local-JSON fallback
 * (examples/generated/<slug>.json — what the generator writes), and it renders each
 * slug through the production per-variant route (/v/<layout>/<slug>), so the
 * screenshot ships exactly the CSS the real mockup would. Returns a handle whose
 * `.close()` tears down the detached process group.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface MockupServer {
  port: number;
  /** Full URL for a given slug. */
  url(slug: string): string;
  close(): void;
}

export async function serveMockups(opts: { port: number; repoRoot: string; timeoutMs?: number }): Promise<MockupServer> {
  const env = { ...process.env };
  delete env.SUPABASE_URL;
  delete env.SUPABASE_SERVICE_ROLE_KEY;

  const child: ChildProcess = spawn(
    "pnpm",
    ["-F", "@revivo/mockups", "exec", "astro", "dev", "--port", String(opts.port), "--host"],
    { cwd: opts.repoRoot, env, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", (d) => process.env.VERIFY_DEBUG && process.stderr.write(d));

  // Poll until it answers (the first request also triggers Astro's initial compile).
  const root = `http://localhost:${opts.port}/`;
  const deadline = Date.now() + (opts.timeoutMs ?? 60_000);
  while (Date.now() < deadline) {
    try {
      await fetch(root);
      await sleep(800); // settle after first response
      return makeHandle(child, opts.port);
    } catch {
      await sleep(500);
    }
  }
  killTree(child);
  throw new Error(`mockups dev server did not come up on :${opts.port} within ${opts.timeoutMs ?? 60_000}ms`);
}

function makeHandle(child: ChildProcess, port: number): MockupServer {
  return {
    port,
    url: (slug: string) => `http://localhost:${port}/${slug}`,
    close: () => killTree(child),
  };
}

function killTree(child: ChildProcess): void {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM"); // negative pid → the detached process group
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
}
