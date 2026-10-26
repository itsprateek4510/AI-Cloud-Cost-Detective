import { MarketingLayout } from "@/components/chrome";
import { PageHeading } from "@/components/ui";
export const metadata = {
  title: "Privacy details",
  description:
    "How CloudLedger handles account, cost, and usage data. This page is under legal review.",
};
export default function PrivacyPage() {
  return (
    <MarketingLayout>
      <div className="container">
        <PageHeading
          label="Last updated · October 2026"
          title="Privacy details"
          description="This page is under legal review."
        />
        <div className="narrow prose">
          <div className="notice" role="note">
            <strong>TODO — legal review required.</strong> This page was not rewritten for
            CloudLedger. Clauses still refer to recordings, audio, family and people records,
            sharing levels, consent for recording, and a 30-day account-deletion cooling-off
            period. Replace them with CloudLedger&apos;s actual data practices before launch.
          </div>
          {[
            [
              "What we store",
              "Your account details, family and people records, recordings, transcripts, memories, and sharing preferences are stored on the Smriti server you use — a PostgreSQL database plus private recording storage. Recording files are private by default and are not shared unless you deliberately grant access.",
            ],
            [
              "Services and external requests",
              "When AI features are enabled, the text and audio you choose to process are sent to the configured model provider (OpenAI or Anthropic) under that provider’s privacy policy, and your instance’s retention configuration applies separately. Booking links, when configured, are handled by the booking service under its own policy.",
            ],
            [
              "Access controls",
              "Sharing is enforced on the server before any memory or recording is returned. You can grant access at Summary, Transcript, or Audio level, review effective access with View as, and revoke a grant at any time — a revoked grant takes effect immediately.",
            ],
            [
              "Your choices",
              "Export your archive, correct transcripts, delete individual recordings, or delete your whole account. Account deletion has a 30-day cooling-off period, after which contributed content is withdrawn and recordings are purged.",
            ],
            [
              "Content principles",
              "Smriti's design does not clone voices, create speaking avatars, or invent personal opinions. The public sample archive contains clearly labelled fictional text, not recordings of real family members.",
            ],
            [
              "Changes to this policy",
              "This notice describes the implementation currently available. When the way Smriti handles information changes, this page is updated and its date revised before the change takes effect.",
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
