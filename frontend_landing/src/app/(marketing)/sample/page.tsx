import { Suspense } from "react";
import { SampleArchive } from "@/components/marketing/sample-archive";
export const metadata = {
  title: "Sample report",
  description:
    "See a sample CloudLedger report: six findings from a fictional cloud account, with the evidence behind every number.",
};
export default function SamplePage() {
  return (
    <Suspense>
      <SampleArchive />
    </Suspense>
  );
}
