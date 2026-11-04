"use server";
import { requireStaff } from "@/lib/auth";
import { dbError, done, fail, int, optStr, refreshCatalog, str } from "@/features/admin/actions/common";

const back = (id: string) => `/admin/orders/${id}`;

/** Bank transfer verified by a human (sales/admin). Amount must equal the order total. */
export async function confirmTransfer(form: FormData) {
  const staff = await requireStaff(["sales"]);
  const id = str(form, "order_id");
  const reference = str(form, "reference");
  const amount = int(form, "amount");
  if (!reference || !amount) fail(back(id), "Indica la referencia bancaria y el monto recibido.");
  const { data, error } = await staff.sb.rpc("confirm_payment", {
    p_order_id: id,
    p_provider: "transfer",
    p_transaction_id: reference,
    p_amount: amount,
    p_status: "approved",
    p_raw: { confirmed_by: staff.email, note: optStr(form, "note") },
  });
  if (error) fail(back(id), dbError(error.message));
  refreshCatalog();
  done(back(id), `Pago registrado. Estado: ${(data as { status: string }).status}.`);
}

export async function confirmSupplierItem(form: FormData) {
  const staff = await requireStaff(["sales", "inventory"]);
  const id = str(form, "order_id");
  const { error } = await staff.sb.rpc("confirm_supplier_item", {
    p_order_item_id: str(form, "item_id"),
    p_available: str(form, "available") === "yes",
    p_notes: optStr(form, "notes"),
  });
  if (error) fail(back(id), dbError(error.message));
  refreshCatalog();
  done(back(id), "Confirmación del proveedor registrada.");
}

export async function shipOrder(form: FormData) {
  const staff = await requireStaff(["sales"]);
  const id = str(form, "order_id");
  const { error } = await staff.sb.rpc("record_shipment", {
    p_order_id: id,
    p_carrier: str(form, "carrier"),
    p_tracking: str(form, "tracking"),
    p_notes: optStr(form, "notes"),
  });
  if (error) fail(back(id), dbError(error.message));
  done(back(id), "Despacho registrado.");
}

export async function setStatus(form: FormData) {
  const staff = await requireStaff(["sales"]);
  const id = str(form, "order_id");
  const { error } = await staff.sb.rpc("set_order_status", { p_order_id: id, p_status: str(form, "status"), p_note: optStr(form, "note") });
  if (error) fail(back(id), dbError(error.message));
  refreshCatalog();
  done(back(id), "Estado actualizado.");
}

export async function saveStaffNotes(form: FormData) {
  const staff = await requireStaff(["sales"]);
  const id = str(form, "order_id");
  const { error } = await staff.sb.from("orders").update({ staff_notes: optStr(form, "staff_notes") }).eq("id", id);
  if (error) fail(back(id), dbError(error.message));
  done(back(id), "Notas guardadas.");
}
