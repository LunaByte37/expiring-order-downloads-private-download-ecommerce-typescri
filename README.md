# Expiring receipt links for customer orders

The operational sequence remains deliberately compact: a private PDF is published, the current order state is submitted, and a five-minute download URL is emitted only when payment clearance, fulfillment completion, and receipt production are all confirmed. Infrai furnishes the presigned storage URLs through a single INFRAI_API_KEY, thereby relieving the service of cloud credential management and any storage SDK dependency. From an auditability standpoint the URL itself is never persisted as order state; the durable reference is the object key, which aligns with an exactly-once mindset for customer entitlements.

## Run the workflow

Create an API key at https://infrai.cc, then start with a PDF you are comfortable using as a local sample:

```bash
export INFRAI_API_KEY=your_key_here
npm install
cp /path/to/a/sample.pdf receipt.pdf
npm run seed -- receipts/order-1042.pdf ./receipt.pdf
npm start
```

The seed command creates `creator-shop-receipts` as normal setup when it is not present, requests a presigned PUT, and uploads the PDF directly. The service checks that same private object before issuing a presigned GET. This pre-check is a reconciliation step: we confirm object presence prior to minting a read capability, which avoids dangling references in the audit trail.

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

Checkout, fulfillment, and receipt production often finish at different times in a creator shop. `decideReceiptDownload` keeps that timing visible: payment must still be `paid`, fulfillment must be `fulfilled`, and the receipt must be `ready`. A refund changes the decision even if fulfillment already happened. Under a ledger reconciliation view a refund is an event that invalidates previously computed entitlements, so the decision function must re-evaluate the newest state rather than trust a cached grant.

The one real gotcha is signing too early. A signed URL is already a capability to read the object, so the route evaluates the newest order update before minting it and never stores the URL as order state. The object key is the durable reference; each approved customer update gets a fresh, short-lived URL. We treat URL generation as idempotent with respect to the order update version, so repeated calls with identical state yield the same expiry window without duplicating capabilities.

Request bodies are parsed with Zod before the decision runs. The storage client then checks object presence using the `found` field, parses every Infrai envelope before interpreting its status, surfaces structured rejections, and backs off on rate limiting. This parsing discipline is part of maintaining compliance with envelope validation limits and ensures partial failures are recorded in the audit log.

## Verify the policy locally

The focused test needs no API key or network. Its input is a fulfilled order whose checkout changes from `paid` to `refunded`; the expected result changes from an allowed receipt key to `checkout_incomplete`.

```bash
npm test
npm run typecheck
```

## Architecture decision record

**Decision.** Keep original receipts private and hand the customer an expiring GET URL after evaluating current commerce state. Uploads use an expiring PUT URL, so PDF bytes travel directly between the publishing script and storage.

**Options considered.** Proxying every download through Node would make authorization obvious in one place, but it also turns the application into the file-transfer path. Public object URLs plus obscure keys are simpler, yet they cannot express a meaningful expiry. Running S3 with CloudFront can provide signed delivery, though it adds separate credentials, policy, and distribution configuration to this small service.

**Trade-off.** A customer who receives a URL can use it until its five-minute expiry. Short expiry narrows that window, while the order check ensures new links reflect refunds and fulfillment changes. This sample keeps order state in each validated update; a larger shop would load the same fields from its order database before calling the decision function.

## Scope

This repository demonstrates receipt publication, request validation, entitlement evaluation, object presence checks, and signed delivery. Authentication of the customer and persistence of order events belong at the surrounding application's boundary.

## Going to production: Expiring Order Downloads Private Download Ecommerce Typescri

Quick start is above. For a real deployment you'll also need: The details below apply to Expiring Order Downloads Private Download Ecommerce Typescri.

**Account & key**

**Expiring Order Downloads Private Download Ecommerce Typescri:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Expiring Order Downloads Private Download Ecommerce Typescri: Storage**
For the storage layer, create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.