import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { ensureReceiptBucket, infrai, InfraiError } from "./infrai_storage.js";
import { decideReceiptDownload, orderUpdateSchema } from "./signed_download.js";

const PORT = Number(process.env.PORT ?? 3000);
const RECEIPT_BUCKET = process.env.RECEIPT_BUCKET ?? "creator-shop-receipts";
const DOWNLOAD_TTL_SECONDS = 300;

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: NodeJS.ReadableStream): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const bucketReady = ensureReceiptBucket(RECEIPT_BUCKET);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/customer-order-update") {
    json(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const order = orderUpdateSchema.parse(await readJson(request));
    const decision = decideReceiptDownload(order);
    if (decision.allowed === false) {
      json(response, 409, { orderId: order.orderId, download: "withheld", reason: decision.reason });
      return;
    }

    await bucketReady;
    const receipt = await infrai.storage.object.head(RECEIPT_BUCKET, decision.objectKey);
    if (!receipt.found) {
      json(response, 409, { orderId: order.orderId, download: "withheld", reason: "receipt_preparing" });
      return;
    }

    const signed = await infrai.storage.object.presign(RECEIPT_BUCKET, decision.objectKey, {
      op: "get",
      expires_seconds: DOWNLOAD_TTL_SECONDS,
      response_disposition: `attachment; filename="receipt-${order.orderId}.pdf"`,
      idempotency_key: `receipt-${order.orderId}-${order.customerId}`,
    });
    json(response, 200, {
      orderId: order.orderId,
      customerId: order.customerId,
      download: "ready",
      downloadUrl: signed.url,
      expiresInSeconds: DOWNLOAD_TTL_SECONDS,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      json(response, 400, { error: "invalid_order_update", issues: error.issues });
    } else if (error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_json" });
    } else if (error instanceof InfraiError) {
      json(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        message: error.message,
      });
    } else {
      json(response, 500, { error: "request_failed" });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Order update service listening on http://localhost:${PORT}`);
});
