import { MarketingLayout } from "@/components/chrome";
import { BookingConfirmation } from "@/components/booking";
export const metadata = {
  title: "Your booking draft",
  description: "Your saved booking details and calendar export for a CloudLedger intro call.",
};
export default function ConfirmedPage() {
  return (
    <MarketingLayout>
      <div className="container section narrow">
        <BookingConfirmation />
      </div>
    </MarketingLayout>
  );
}
