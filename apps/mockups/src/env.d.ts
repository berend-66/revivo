/// <reference path="../.astro/types.d.ts" />
import type { SiteConfig } from "@revivo/shared";

declare global {
  namespace App {
    interface Locals {
      /** Set by the /{slug} dispatcher, read by the per-variant render page —
       * avoids a second config lookup across the rewrite. */
      mockupConfig?: SiteConfig;
    }
  }
}

export {};
