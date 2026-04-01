import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CheckoutClient } from "./components/checkout-client";

export const metadata = {
  title: "결제하기 - KT Estate",
};

export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <CheckoutClient userId={user.id} userEmail={user.email ?? ""} />;
}
