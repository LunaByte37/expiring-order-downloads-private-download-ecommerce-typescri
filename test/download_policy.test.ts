import assert from "node:assert/strict";
import test from "node:test";
import { decideReceiptDownload, orderUpdateSchema } from "../src/signed_download.js";

const fulfilledOrder = {
  orderId: "order-1042",
  customerId: "customer-7",
  checkout: "paid" as const,
  fulfillment: "fulfilled" as const,
  receipt: { status: "ready" as const, objectKey: "receipts/order-1042.pdf" },
};

test("a paid fulfilled order with a ready receipt can receive a link", () => {
  const order = orderUpdateSchema.parse(fulfilledOrder);
  assert.deepEqual(decideReceiptDownload(order), {
    allowed: true,
    objectKey: "receipts/order-1042.pdf",
  });
});

test("a refund revokes the download decision even after fulfillment", () => {
  const order = orderUpdateSchema.parse({ ...fulfilledOrder, checkout: "refunded" });
  assert.deepEqual(decideReceiptDownload(order), {
    allowed: false,
    reason: "checkout_incomplete",
  });
});
