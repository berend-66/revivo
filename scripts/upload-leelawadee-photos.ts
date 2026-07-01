/**
 * Upload Leelawadee HR photos to Supabase Storage.
 * Creates public bucket "salon-photos" if it doesn't exist, then uploads each
 * MMK-*.jpg.jpeg under the path leelawadee/MMK-*.jpeg (strips the double ext).
 *
 *   pnpm tsx scripts/upload-leelawadee-photos.ts
 */
import dotenv from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
dotenv.config({ path: resolve(fileURLToPath(import.meta.url), "../../.env") });

import { createServiceClient } from "@revivo/db";

const BUCKET = "salon-photos";
const PREFIX = "leelawadee";
const PHOTO_DIR =
  "C:\\Users\\NvanDommele\\OneDrive - Timeless Management\\Desktop\\Revivo_sawadee";

const client = createServiceClient();

// Ensure bucket exists (public = URLs accessible without auth token).
const { data: buckets, error: listErr } = await client.storage.listBuckets();
if (listErr) throw listErr;
const bucketExists = buckets?.some((b) => b.name === BUCKET);
if (!bucketExists) {
  const { error } = await client.storage.createBucket(BUCKET, { public: true });
  if (error) throw error;
  console.log(`✓ Bucket "${BUCKET}" aangemaakt (public)`);
} else {
  console.log(`↻ Bucket "${BUCKET}" bestaat al`);
}

// Collect MMK photos from the root folder.
const files = readdirSync(PHOTO_DIR).filter(
  (f) => f.startsWith("MMK-") && f.endsWith(".jpeg"),
);
console.log(`\n${files.length} foto's gevonden — uploaden...\n`);

const urls: string[] = [];
const failed: string[] = [];

for (const file of files) {
  const localPath = `${PHOTO_DIR}\\${file}`;
  // MMK-4368-HR.jpg.jpeg → MMK-4368-HR.jpeg (strip the spurious .jpg suffix)
  const storageName = file.replace(".jpg.jpeg", ".jpeg");
  const storagePath = `${PREFIX}/${storageName}`;

  const body = readFileSync(localPath);
  const { error } = await client.storage
    .from(BUCKET)
    .upload(storagePath, body, { contentType: "image/jpeg", upsert: true });

  if (error) {
    console.error(`  ✗ ${storageName}: ${error.message}`);
    failed.push(storageName);
  } else {
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
    urls.push(publicUrl);
    process.stdout.write(`  ✓ ${storageName}\n`);
  }
}

console.log(`\n✓ ${urls.length}/${files.length} geüpload${failed.length ? ` — ${failed.length} mislukt` : ""}`);

console.log("\n=== Public URLs (plak in SiteConfig) ===");
for (const url of urls) {
  console.log(url);
}
