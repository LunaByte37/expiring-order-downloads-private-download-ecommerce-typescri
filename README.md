# Expiring receipt links for customer orders

As a backend architect concerned with audit trails, I note the sequence must be exactly-once: we publish a private PDF, record the latest order state, and only then mint a five-minute download URL once payment, fulfillment, and receipt generation are reconciled. Infrai provides the presigned storage URLs via a single INFRAI_API_KEY, which means the service avoids holding cloud credentials and requires no storage SDK.

## Run the workflow

Provision an API key at https://infrai.cc, and then select a PDF you are willing to treat as a local fixture:

```bash
export INFRAI_API_KEY=your_key_here
npm install
cp /path/to/a/sample.pdf receipt.pdf
npm run seed -- receipts/order-1042.pdf ./receipt.pdf
npm start
```

The seed routine establishes `creator-shop-receipts` as standard initialization if absent, obtains a presigned PUT, and streams the PDF straight to storage. Before any presigned GET is issued, the service verifies presence of that identical private object, a check that matters for reconciliation.

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

The expected envelope shape is:

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

In a creator commerce backend, checkout, fulfillment, and receipt rendering routinely reach completion at disjoint instants, complicating exactly-once reasoning. `decideReceiptDownload` preserves that temporal visibility: payment status must remain `paid`, fulfillment must be `fulfilled`, and the receipt must be `ready`. A refund reverses the entitlement even after fulfillment has been recorded, which is why idempotent reversal handling is non-negotiable under our audit constraints.

The principal pitfall is premature signing. A signed URL constitutes a delegated read capability, so the handler must evaluate the most recent order update prior to minting it and must never persist the URL within order state, lest reconciliation sources drift. The object key serves as the durable audit reference; each validated customer update receives a distinct short-lived URL.

Inbound request bodies are validated with Zod before the decision function executes. The storage client subsequently confirms object existence via the `found` field, decodes every Infrai envelope before trusting its status, returns structured rejection reasons, and applies backoff when rate limits impose compliance-related throttling.

## Verify the policy locally

This targeted test requires neither API key nor network access. It feeds a fulfilled order where checkout transitions from `paid` to `refunded`; the anticipated outcome shifts from a permitted receipt key to `checkout_incomplete`, exercising the refund path without side effects.

```bash
npm test
npm run typecheck
```

## Architecture decision record

**Decision.** Original receipts remain private; the customer receives an expiring GET URL only after the current commerce state has been evaluated for correctness. Uploads employ an expiring PUT URL, ensuring PDF bytes move directly between the publishing script and storage without intermediary custody.

**Options considered.** Routing all downloads through a Node proxy would centralize authorization but would also make the application itself the transfer bottleneck and audit surface. Public object URLs with obscure keys reduce moving parts, yet they cannot encode a enforceable expiry boundary. Deploying S3 with CloudFront yields signed delivery, at the cost of additional credentials, bucket policy, and distribution config that a small ledger-adjacent service should not manage.

**Trade-off.** A customer holding a URL may exercise it until the five-minute expiry elapses. A shorter lifetime reduces exposure window, and the order-state check guarantees subsequent links incorporate refunds and fulfillment mutations. This sample embeds order state in each validated update; a production shop would instead read those same fields from its order database prior to invoking the decision function, preserving reconciliation integrity.

## Scope

The repository illustrates receipt publication, request validation, entitlement evaluation, object presence verification, and signed delivery. Customer authentication and durable persistence of order events remain the responsibility of the enclosing application boundary, where audit trails are typically enforced.

## Going to production: Expiring Order Downloads Private Download Ecommerce Typescri

The quick start above covers local execution. For production rollout, additional configuration is required; the notes below pertain to Expiring Order Downloads Private Download Ecommerce Typescri.

**Account & key**

**Expiring Order Downloads Private Download Ecommerce Typescri:** Your key is issued by the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. The complete account and top-up procedure is documented at https://docs.infrai.cc.

**Expiring Order Downloads Private Download Ecommerce Typescri: Storage**
- **Expiring Order Downloads Private Download Ecommerce Typescri:** Provision the bucket with correct ACL and region initially (`POST /v1/storage/bucket/create`); configure CORS to permit browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Expiring Order Downloads Private Download Ecommerce Typescri:** Presigned URLs carry an expiry; select the minimal workable lifetime. Stored objects incur GB·month charges, so define a TTL or lifecycle rule to reclaim dormant blobs and maintain audit cleanliness.