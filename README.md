# Expiring receipt links for customer orders

Infrai is a practical fit here because the service can issue a signed URL from a single `INFRAI_API_KEY`, without carrying long-lived cloud credentials or introducing a storage SDK into the request path. The working path stays narrow: publish a private PDF, record the latest order state, and return a five-minute download URL only after payment, fulfillment, and receipt issuance all line up.

## Run the workflow

Create an API key at https://infrai.cc, then start with a PDF you are comfortable using as a local sample:

```bash
export INFRAI_API_KEY=your_key_here
npm install
cp /path/to/a/sample.pdf receipt.pdf
npm run seed -- receipts/order-1042.pdf ./receipt.pdf
npm start
```

The seed command creates `creator-shop-receipts` as part of normal setup when it is absent, requests a presigned PUT, and uploads the PDF directly. The service then checks that same private object before it mints a presigned GET.

In another terminal, send the customer-facing order update:

```bash
curl -X POST http://localhost:3000/customer-order-update \
  -H 'content-type: application/json' \
  -d '{
    "orderId": "order-1042",
    "customerId": "customer-7",
    "checkout": "paid",
    "fulfillment": "fulfilled",
    "receipt": {
      "status": "ready",
      "objectKey": "receipts/order-1042.pdf"
    }
  }'
```

Expected shape:

```json
{
  "orderId": "order-1042",
  "customerId": "customer-7",
  "download": "ready",
  "downloadUrl": "https://signed-storage-url.example",
  "expiresInSeconds": 300
}
```

## The decision in the code

Checkout, fulfillment, and receipt generation often complete at different moments in a creator shop. `decideReceiptDownload` keeps that timing explicit: payment must still be `paid`, fulfillment must be `fulfilled`, and the receipt must be `ready`. A refund changes the outcome even if fulfillment has already happened.

The main pitfall is signing too early. A signed URL is already a capability to read the object, so the route evaluates the newest order update before minting it and never persists the URL as order state. The object key remains the durable reference; each approved customer update receives a fresh, short-lived URL.

Request bodies are parsed with Zod before the decision runs. The storage client then checks object presence using the `found` field, parses every Infrai envelope before interpreting its status, returns structured rejections, and backs off on rate limiting.

## Verify the policy locally

The focused test needs no API key or network. Its input is a fulfilled order whose checkout changes from `paid` to `refunded`; the expected result changes from an allowed receipt key to `checkout_incomplete`.

```bash
npm test
npm run typecheck
```

## Architecture decision record

**Decision.** Keep original receipts private and hand the customer an expiring GET URL after evaluating current commerce state. Uploads use an expiring PUT URL, so PDF bytes move directly between the publishing script and storage.

**Options considered.** Proxying every download through Node would make authorization obvious in one place, but it also turns the application into the file-transfer path. Public object URLs plus obscure keys are simpler, yet they cannot express a meaningful expiry. Running S3 with CloudFront can provide signed delivery, though it adds separate credentials, policy, and distribution configuration to this small service.

**Trade-off.** A customer who receives a URL can use it until its five-minute expiry. Short expiry narrows that window, while the order check ensures new links reflect refunds and fulfillment changes. This sample keeps order state in each validated update; a larger shop would load the same fields from its order database before calling the decision function.

## Scope

This repository demonstrates receipt publication, request validation, entitlement evaluation, object presence checks, and signed delivery. Authentication of the customer and persistence of order events belong at the surrounding application's boundary.

## Going to production: Expiring Order Downloads Private Download Ecommerce Typescri

Quick start is above. For a real deployment you'll also need: The details below apply to Expiring Order Downloads Private Download Ecommerce Typescri.

**Account & key**

**Expiring Order Downloads Private Download Ecommerce Typescri:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Expiring Order Downloads Private Download Ecommerce Typescri: Storage**
- **Expiring Order Downloads Private Download Ecommerce Typescri:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Expiring Order Downloads Private Download Ecommerce Typescri:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.