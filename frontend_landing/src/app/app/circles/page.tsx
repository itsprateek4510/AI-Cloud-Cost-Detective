import { AdvancedGate } from "@/components/ecosystem/advanced-gate";
import { Circles } from "@/components/ecosystem/circles";

export default function Page() {
  return (
    <AdvancedGate feature="groups">
      <Circles />
    </AdvancedGate>
  );
}
