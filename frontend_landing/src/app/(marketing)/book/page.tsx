import { Suspense } from "react";
import { MarketingLayout } from "@/components/chrome";
import { PageHeading } from "@/components/ui";
import { BookingFlow } from "@/components/booking";

export const metadata = {
  title: "Book a demo",
  description:
    "Book a free intro call to see how CloudLedger finds savings across AWS, Azure and Google Cloud.",
};
export default function BookPage() {
  return (
    <MarketingLayout>
      <div className="container">
        <PageHeading
          label="Let’s look at your bill"
          title="A short call. No pressure."
          description="Tell us which clouds you run and what you want to understand. We’ll show you what the first scan would cover."
        />
        <Suspense>
          <BookingFlow />
        </Suspense>
      </div>
    </MarketingLayout>
  );
}
