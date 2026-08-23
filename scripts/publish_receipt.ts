import { ensureReceiptBucket, infrai } from "../src/infrai_storage.js";

const bucket = process.env.RECEIPT_BUCKET ?? "creator-shop-receipts";
const key = process.argv[2] ?? "receipts/order-1042.pdf";
const filePath = process.argv[3] ?? "./receipt.pdf";

await ensureReceiptBucket(bucket);
const signed = await infrai.storage.object.presign(bucket, key, {
  op: "put",
  expires_seconds: 600,
  content_type: "application/pdf",
  idempotency_key: `publish-${key}`,
});

const file = await import("node:fs/promises").then((fs) => fs.readFile(filePath));
const uploaded = await fetch(signed.url, {
  method: "PUT",
  headers: { "Content-Type": "application/pdf" },
  body: file,
});
if (!uploaded.ok) throw new Error(`Receipt upload returned HTTP ${uploaded.status}`);
console.log(JSON.stringify({ bucket, key, uploaded: true }));
