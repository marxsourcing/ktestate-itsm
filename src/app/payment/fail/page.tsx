"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PaymentFailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = searchParams.get("code") ?? "UNKNOWN_ERROR";
  const message = searchParams.get("message") ?? "결제 중 오류가 발생했습니다.";
  const orderId = searchParams.get("orderId");

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-20">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-10 w-10 text-red-600" />
          </div>
          <CardTitle className="text-xl text-red-600">결제 실패</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex justify-between">
              <span className="text-sm text-red-600">에러 코드</span>
              <span className="text-sm font-mono font-medium text-red-800">
                {code}
              </span>
            </div>
            <div>
              <span className="text-sm text-red-600">에러 메시지</span>
              <p className="mt-1 text-sm text-red-800">{message}</p>
            </div>
            {orderId && (
              <div className="flex justify-between">
                <span className="text-sm text-red-600">주문번호</span>
                <span className="text-sm font-medium text-red-800">
                  {orderId}
                </span>
              </div>
            )}
          </div>
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
              onClick={() => router.push("/payment/checkout")}
            >
              다시 시도하기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
