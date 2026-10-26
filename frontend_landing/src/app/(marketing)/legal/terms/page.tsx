import { MarketingLayout } from "@/components/chrome";
import { PageHeading } from "@/components/ui";
export const metadata = {
  title: "Terms of use",
  description: "The terms for using CloudLedger. This page is under legal review.",
};
export default function TermsPage() {
  return (
    <MarketingLayout>
      <div className="container">
        <PageHeading
          label="Terms of use · October 2026"
          title="Terms of use"
          description="This page is under legal review."
        />
        <div className="narrow prose">
          <div className="notice" role="note">
            <strong>TODO — legal review required.</strong> This page was not rewritten for
            CloudLedger. Clauses still refer to recording permission, audio files, the Mehra
            family sample, booking drafts, and planned package pricing. Replace them with the
            real service terms before launch.
          </div>
          {[
            [
              "Record with permission",
              "Get permission from the person telling their story before recording or uploading it. Smriti records consent for each recording and respects each person's decisions about what to keep, remove, and share.",
            ],
            [
              "Your content",
              "Your recordings remain yours. Smriti stores your files privately on your own server. Keep your own backups of important originals; the running instance is not a backup service.",
            ],
            [
              "Your account",
              "Creating an account registers you with this Smriti instance. Booking drafts are not confirmed appointments, and selecting a plan does not complete a purchase. Connected services are identified before use.",
            ],
            [
              "Sample content",
              "The Mehra family and all sample transcripts are fictional illustrations. They should not be treated as real testimony, biographies, or professional advice.",
            ],
            [
              "Paid services",
              "Prices describe planned packages and may change. No payment is collected in this version. Final scope, availability, taxes, cancellation, and refund terms must be provided before a paid service is booked.",
            ],
          ].map(([title, body]) => (
            <section key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </div>
    </MarketingLayout>
  );
}
