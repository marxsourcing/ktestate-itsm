import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SECRET_KEY = process.env.TOSS_SECRET_KEY!;

export async function POST(request: NextRequest) {
  const { paymentKey, orderId, amount } = await request.json();

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json(
      { message: "필수 파라미터가 누락되었습니다." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (!payment) {
    return NextResponse.json(
      { message: "주문 정보를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (payment.amount !== amount) {
    return NextResponse.json(
      { message: "결제 금액이 일치하지 않습니다." },
      { status: 400 },
    );
  }

  const encryptedSecretKey =
    "Basic " + Buffer.from(SECRET_KEY + ":").toString("base64");

  const tossResponse = await fetch(
    "https://api.tosspayments.com/v1/payments/confirm",
    {
      method: "POST",
      headers: {
        Authorization: encryptedSecretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    },
  );

  const tossData = await tossResponse.json();

  if (!tossResponse.ok) {
    await supabase
      .from("payments")
      .update({ status: "aborted" })
      .eq("order_id", orderId);

    return NextResponse.json(
      {
        message: tossData.message || "결제 승인에 실패했습니다.",
        code: tossData.code,
      },
      { status: tossResponse.status },
    );
  }

  await supabase
    .from("payments")
    .update({
      payment_key: tossData.paymentKey,
      status: "done",
      method: tossData.method,
      approved_at: tossData.approvedAt,
      receipt_url: tossData.receipt?.url ?? null,
      raw_response: tossData,
    })
    .eq("order_id", orderId);

  return NextResponse.json(tossData);
}
