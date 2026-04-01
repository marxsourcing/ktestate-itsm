"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [paymentInfo, setPaymentInfo] = useState<{
    orderId: string;
    amount: number;
    method: string;
    approvedAt: string;
  } | null>(null);

  useEffect(() => {
    async function confirmPayment() {
      const paymentKey = searchParams.get("paymentKey");
      const orderId = searchParams.get("orderId");
      const amount = searchParams.get("amount");

      if (!paymentKey || !orderId || !amount) {
        setStatus("error");
        setErrorMessage("결제 정보가 올바르지 않습니다.");
        return;
      }

      try {
        const response = await fetch("/api/payment/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: Number(amount),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus("error");
          setErrorMessage(data.message || "결제 승인에 실패했습니다.");
          return;
        }

        setPaymentInfo({
          orderId: data.orderId,
          amount: data.totalAmount,
          method: data.method,
          approvedAt: data.approvedAt,
        });
        setStatus("success");
      } catch {
        setStatus("error");
        setErrorMessage("결제 승인 요청 중 오류가 발생했습니다.");
      }
    }

    confirmPayment();
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-lg font-medium">결제를 승인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-20">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <span className="text-3xl">✕</span>
            </div>
            <CardTitle className="text-xl text-red-600">
              결제 승인 실패
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">{errorMessage}</p>
            <Button onClick={() => router.push("/payment/checkout")}>
              다시 시도하기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-20">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <CardTitle className="text-xl">결제가 완료되었습니다</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentInfo && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">주문번호</span>
                <span className="text-sm font-medium">
                  {paymentInfo.orderId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">결제금액</span>
                <span className="text-sm font-bold">
                  {paymentInfo.amount.toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">결제수단</span>
                <span className="text-sm">{paymentInfo.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-sm">승인일시</span>
                <span className="text-sm">
                  {new Date(paymentInfo.approvedAt).toLocaleString("ko-KR")}
                </span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push("/dashboard")}
            >
              대시보드로 이동
            </Button>
            <Button
              className="flex-1"
              onClick={() => router.push("/requests")}
            >
              요청 목록 보기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
