import { Studio } from "@/components/ecosystem/recordings";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense fallback={<p>Opening recorder…</p>}>
      <Studio />
    </Suspense>
  );
}
