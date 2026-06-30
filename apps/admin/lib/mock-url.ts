import { DEFAULT_MOCK_BASE_URL } from "@revivo/shared";

/** The deployed mock host, env-overridable — matches what the CLI/openers use, so
 * a link pasted from here is identical to one from `pnpm build-openers`. */
export function mockBaseUrl(): string {
  return (process.env.REVIVO_MOCK_BASE_URL || DEFAULT_MOCK_BASE_URL).replace(/\/+$/, "");
}

export function mockUrlForSlug(slug: string): string {
  return `${mockBaseUrl()}/${slug}`;
}
