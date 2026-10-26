import { MarketingLayout } from "@/components/chrome";
import { Button, PageHeading } from "@/components/ui";
export default function NotFound() {
  return (
    <MarketingLayout>
      <div className="container section">
        <PageHeading
          label="404 · Page not found"
          title="This page isn’t here."
          description="The address may have changed, or the page may have moved."
        >
          <div className="button-row">
            <Button href="/">Back to CloudLedger</Button>
            <Button href="/app" variant="outline">
              Open your workspace
            </Button>
          </div>
        </PageHeading>
      </div>
    </MarketingLayout>
  );
}
