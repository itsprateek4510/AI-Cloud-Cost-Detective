import { ArrowRight, Cloud, FileCheck2, ShieldCheck, Unplug } from "lucide-react";
import { MarketingLayout } from "@/components/chrome";
import { Button, SectionLabel } from "@/components/ui";
import { dashboardUrl } from "@/lib/product-url";
import styles from "./page.module.css";

export const metadata = {
  title: "Cloud integrations",
  description: "Connect AWS with a dedicated read-only role. Azure and Google Cloud integrations are coming soon.",
};

export default function IntegrationsPage() {
  return <MarketingLayout>
    <section className={styles.intro}>
      <div className="container">
        <SectionLabel>Connected, not complicated</SectionLabel>
        <h1>Connect your cloud.<br />Keep control.</h1>
        <p>One read-only connection. A clearer picture of your cloud costs.<br />Your infrastructure stays exactly where it belongs: with you.</p>
        <div className={styles.trust}><ShieldCheck size={15} /> No stored access keys <span /> No agents to install <span /> No automatic changes</div>
      </div>
    </section>
    <section className={styles.catalog}>
      <div className="container">
        <div className={styles.sectionHeading}><h2>Your cloud providers</h2><span>Start with AWS. More clouds on the roadmap.</span></div>
        <div className={styles.grid}>
          <article className={styles.card}>
            <div className={styles.cardTop}><span className={`${styles.provider} ${styles.aws}`}>aws<span>⌣</span></span><span className={styles.available}>Available now</span></div>
            <h3>Amazon Web Services</h3><p>Connect a dedicated IAM role to review your costs and find idle resources across enabled regions.</p>
            <ul><li><FileCheck2 size={15} /> Eight deterministic waste checks</li><li><FileCheck2 size={15} /> Cost Explorer history by service</li><li><FileCheck2 size={15} /> Resource-level savings estimates</li></ul>
            <Button href="/signup" arrow>Connect AWS</Button>
          </article>
          {[{ name: "Microsoft Azure", symbol: "A", copy: "Bring subscriptions, resource groups, and Azure costs into a single view." }, { name: "Google Cloud", symbol: "G", copy: "Understand your project-level costs and service usage alongside your other clouds." }].map(provider => <article className={styles.card} key={provider.name}>
            <div className={styles.cardTop}><span className={styles.provider}>{provider.symbol}</span><span className={styles.planned}>On the roadmap</span></div>
            <h3>{provider.name}</h3><p>{provider.copy}</p><div className={styles.future}><Cloud size={20} /><span>Multi-cloud visibility is coming.<br />AWS is ready today.</span></div><Button variant="outline" disabled>Coming soon</Button>
          </article>)}
        </div>
        <div className={styles.steps}>
          {[{ icon: Cloud, title: "Create a connection", text: "Sign in and generate your account-specific ExternalId." }, { icon: ShieldCheck, title: "Deploy a read-only role", text: "Use the supplied CloudFormation template and connection parameters." }, { icon: FileCheck2, title: "Verify, then scan", text: "Confirm access before starting your first resource scan." }].map((step, index) => <div key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><step.icon size={22} /><h3>{step.title}</h3><p>{step.text}</p></div>)}
        </div>
        <div className={styles.preview}><div><SectionLabel>Take a look around</SectionLabel><h2>See what connects the dots.</h2><p>Explore a sample workspace with fictional costs and findings. No credentials required.</p></div><a href={dashboardUrl({ demo: true })} className="button button-primary">Explore sample workspace <ArrowRight size={16} /></a></div>
        <p className={styles.note}><Unplug size={15} /> Revoke the IAM role whenever you choose. Read more about <a href="/trust">our access model</a>.</p>
      </div>
    </section>
  </MarketingLayout>;
}
