"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadTossPayments,
  TossPaymentsWidgets,
  ANONYMOUS,
} from "@tosspayments/tosspayments-sdk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;

interface CheckoutClientProps {
  userId: string;
  userEmail: string;
}

function generateOrderId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORDER-${dateStr}-${random}`;
}

export function CheckoutClient({ userId, userEmail }: CheckoutClientProps) {
  const [widgets, setWidgets] = useState<TossPaymentsWidgets | null>(null);
  const [amount, setAmount] = useState({ currency: "KRW", value: 50000 });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const paymentMethodRef = useRef<HTMLDivElement>(null);
  const agreementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function init() {
      const tossPayments = await loadTossPayments(clientKey);
      const w = tossPayments.widgets({
        customerKey: userId,
      });

      await w.setAmount(amount);

      await Promise.all([
        w.renderPaymentMethods({
          selector: "#payment-method",
        }),
        w.renderAgreement({
          selector: "#agreement",
        }),
      ]);

      setWidgets(w);
      setReady(true);
    }

    init();
  }, [userId]);

  async function handlePayment() {
    if (!widgets) return;
    setLoading(true);

    try {
      const orderId = generateOrderId();

      const supabase = createClient();
      await supabase.from("payments").insert({
        user_id: userId,
        order_id: orderId,
        order_name: "IT 서비스 이용료",
        amount: amount.value,
        status: "pending",
      });

      await widgets.requestPayment({
        orderId,
        orderName: "IT 서비스 이용료",
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: userEmail,
      });
    } catch (error) {
      setLoading(false);
    }
  }

  async function handleAmountChange(newValue: number) {
    const newAmount = { currency: "KRW", value: newValue };
    setAmount(newAmount);
    if (widgets) {
      await widgets.setAmount(newAmount);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">결제하기</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">결제 금액</label>
            <div className="flex gap-2">
              {[10000, 30000, 50000, 100000].map((v) => (
                <Button
                  key={v}
                  variant={amount.value === v ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleAmountChange(v)}
                >
                  {v.toLocaleString()}원
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-2xl font-bold">
              {amount.value.toLocaleString()}원
            </p>
          </div>

          <div id="payment-method" ref={paymentMethodRef} />

          <div id="agreement" ref={agreementRef} />

          <Button
            onClick={handlePayment}
            disabled={!ready || loading}
            className="w-full"
            size="lg"
          >
            {loading ? "결제 처리 중..." : `${amount.value.toLocaleString()}원 결제하기`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
