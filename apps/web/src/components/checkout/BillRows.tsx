import { formatInr, type Bill } from "@ration/shared";

function Row({ l, v, tone = "" }: { l: string; v: string; tone?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted">{l}</span>
      <span className={tone}>{v}</span>
    </div>
  );
}

export function BillRows({ bill }: { bill: Bill }) {
  return (
    <div className="space-y-1.5">
      <Row l="Items total" v={formatInr(bill.subtotal)} />
      {bill.item_savings > 0 ? <Row l="Savings on MRP" v={`-${formatInr(bill.item_savings)}`} tone="text-success" /> : null}
      {bill.discount > 0 ? <Row l={`Coupon ${bill.coupon_code ?? ""}`} v={`-${formatInr(bill.discount)}`} tone="text-success" /> : null}
      <Row l="Delivery fee" v={bill.delivery_fee === 0 ? "FREE" : formatInr(bill.delivery_fee)} tone={bill.delivery_fee === 0 ? "text-success" : ""} />
      {bill.small_order_fee > 0 ? <Row l="Small order fee" v={formatInr(bill.small_order_fee)} /> : null}
      <Row l="Handling fee" v={formatInr(bill.handling_fee)} />
      {bill.tip > 0 ? <Row l="Delivery partner tip" v={formatInr(bill.tip)} /> : null}
      <div className="mt-2 flex justify-between border-t border-divider pt-2 font-bold">
        <span>To pay</span>
        <span>{formatInr(bill.total)}</span>
      </div>
    </div>
  );
}
