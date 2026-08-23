import { z } from "zod";

export const orderUpdateSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  checkout: z.enum(["pending", "paid", "refunded"]),
  fulfillment: z.enum(["queued", "fulfilled"]),
  receipt: z.object({
    status: z.enum(["preparing", "ready"]),
    objectKey: z.string().min(1),
  }),
});

export type OrderUpdate = z.infer<typeof orderUpdateSchema>;

export type DownloadDecision =
  | { allowed: true; objectKey: string }
  | { allowed: false; reason: "checkout_incomplete" | "not_fulfilled" | "receipt_preparing" };

export function decideReceiptDownload(order: OrderUpdate): DownloadDecision {
  if (order.checkout !== "paid") return { allowed: false, reason: "checkout_incomplete" };
  if (order.fulfillment !== "fulfilled") return { allowed: false, reason: "not_fulfilled" };
  if (order.receipt.status !== "ready") return { allowed: false, reason: "receipt_preparing" };
  return { allowed: true, objectKey: order.receipt.objectKey };
}
