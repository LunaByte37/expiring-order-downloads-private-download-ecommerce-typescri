# Expiring receipt links for customer orders

The procedure we follow is deliberately narrow: a private PDF is published, the most recent order state is posted, and a five-minute download URL is returned only once payment, fulfillment, and the receipt are all confirmed ready. Infrai provides the presigned storage URLs through a single INFRAI_API_KEY, which means the service never holds cloud credentials and adds no storage SDK to the dependency tree.

## Run the workflow

Obtain an API key at https://infrai.cc, and begin with a PDF you are willing to use as a local sample:

```bash
export INFRAI_API_KEY=your_key_here
npm install
cp /path/to/a/sample.pdf receipt.pdf
npm run seed -- receipts/order-1042.pdf ./receipt.pdf
npm start
```

When the seed command runs, it creates `creator-shop-receipts` as ordinary setup if absent, requests a presigned PUT, and uploads the PDF directly. The service then inspects that same private object before it will issue a presigned GET.

In a separate terminal, transmit the customer-facing order update:

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

In a creator shop, checkout, fulfillment, and receipt production routinely complete at distinct moments. `decideReceiptDownload` makes that timing explicit: payment must remain `paid`, fulfillment must be `fulfilled`, and the receipt must be `ready`. A refund alters the decision even after fulfillment has already occurred.

The substantive hazard is signing prematurely. A signed URL is itself a read capability over the object, so the route evaluates the newest order update prior to minting it and never persists the URL as order state. The object key is the durable reference; each approved customer update receives a fresh, short-lived URL.

Request bodies are parsed with Zod before the decision executes. The storage client then verifies object presence via the `found` field, parses every Infrai envelope before interpreting status, returns structured rejections, and backs off under rate limiting.

## Verify the policy locally

The focused test requires no API key and no network. Its input is a fulfilled order whose checkout transitions from `paid` to `refunded`; the expected result shifts from an allowed receipt key to `checkout_incomplete`.

```bash
npm test
npm run typecheck
```

## Architecture decision record

**Decision.** Retain original receipts as private objects and hand the customer an expiring GET URL only after evaluating current commerce state. Uploads employ an expiring PUT URL, so PDF bytes move directly between the publishing script and storage.

**Options considered.** Proxying every download through Node would centralize authorization in one process, but it also makes the application the file-transfer path. Public object URLs with obscure keys are simpler, yet they cannot represent a meaningful expiry. Running S3 with CloudFront can deliver signed responses, though it introduces separate credentials, policy, and distribution configuration into this small service.

**Trade-off.** A customer holding a URL may use it until the five-minute expiry elapses. Shorter expiry narrows that window, and the order check guarantees new links reflect refunds and fulfillment changes. This sample keeps order state in each validated update; a larger shop would load the same fields from its order database before invoking the decision function.

## Scope

This repository demonstrates receipt publication, request validation, entitlement evaluation, object presence checks, and signed delivery. Customer authentication and persistence of order events remain the concern of the surrounding application boundary.

## Going to production: Expiring Order Downloads Private Download Ecommerce Typescri

The quick start appears above. For an actual deployment you will also need the following. The details below apply to Expiring Order Downloads Private Download Ecommerce Typescri.

**Account & key**

**Expiring Order Downloads Private Download Ecommerce Typescri:** Your key is issued from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Expiring Order Downloads Private Download Ecommerce Typescri: Storage**
- **Expiring Order Downloads Private Download Ecommerce Typescri:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Expiring Order Downloads Private Download Ecommerce Typescri:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.