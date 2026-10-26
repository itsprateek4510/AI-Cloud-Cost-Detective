import {
  LockKeyhole,
  FileDown,
  ListChecks,
  MessageCircle,
  Search,
  ShieldCheck,
  Cloud,
  Users,
  ArrowRight,
} from "lucide-react";
import { Button, SectionLabel } from "../ui";
import { ProductPreview } from "./product-preview";
import why from "./why-smriti.module.css";
import ending from "./ending.module.css";

export function TrustStrip() {
  return (
    <section className="trust-strip" aria-label="Built for engineering teams">
      <p>Familiar to your stack. Ready for what’s next.</p>
      <div className="trust-items">
        <span>
          <ShieldCheck color="#3caa79" />
          Read-only access
        </span>
        <span>
          <ListChecks color="#477bc0" />
          Source-linked findings
        </span>
        <span>
          <Search color="#bd875c" />
          Searchable spend · Coming soon
        </span>
        <span>
          <FileDown color="#618376" />
          Open formats · Coming soon
        </span>
        <span>
          <Users color="#7d74b3" />
          Team access · Coming soon
        </span>
      </div>
    </section>
  );
}

export function UseCases() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-title">
          <h2>
            Built for the people
            <br />
            who own the bill.
          </h2>
          <p>Different teams. Different clouds. The same goal: spend less, and know why.</p>
        </div>
        <div className="use-cases">
          <article className="use-case">
            <div>
              <span className="tag">STARTUPS</span>
              <h3>Make your credits last.</h3>
              <p>
                Know your post-credit bill before it arrives, and get a short list of changes that
                cut it, ranked by saving. Forecasting is coming soon.
              </p>
              <Button href="/for/families">
                See the startup plan <ArrowRight size={14} />
              </Button>
            </div>
            <div className="case-visual">
              <ProductPreview />
            </div>
          </article>
          <article className="use-case">
            <div>
              <span className="tag">ENGINEERING TEAMS · COMING SOON</span>
              <h3>
                Fixes that fit
                <br />
                your workflow.
              </h3>
              <p>
                Terraform and CLI fixes with a risk rating, opened as pull requests or tickets. You
                approve. Your pipeline applies. Coming soon.
              </p>
              <Button href="/docs/record-a-story">
                See how findings work <ArrowRight size={14} />
              </Button>
            </div>
            <div className="case-visual">
              <ProductPreview step={2} />
            </div>
          </article>
          <article className="use-case">
            <div>
              <span className="tag">FINANCE AND FOUNDERS</span>
              <h3>
                One summary.
                <br />
                Every week.
              </h3>
              <p>
                Spend, change, and what’s still recoverable, in a message you can read in two
                minutes.
              </p>
              <Button href="/pricing">
                Explore plans <ArrowRight size={14} />
              </Button>
            </div>
            <div className="chat-preview">
              <div className="mini-person">
                <span className="avatar">
                  <MessageCircle size={20} />
                </span>
                <div>
                  <strong>Your weekly cloud summary</strong>
                  <small>Every Monday</small>
                </div>
              </div>
              <div className="chat-bubble">
                <strong>Spend is down 6%. Three new findings.</strong>
                <p>$1,240 a month still recoverable.</p>
                <small>Two-minute read.</small>
              </div>
            </div>
          </article>
          <article className="use-case">
            <div>
              <span className="tag">DONE FOR YOU</span>
              <h3>An expert on your account.</h3>
              <p>
                A human cloud-cost review, a written report, and a call to walk through every
                change. Multi-client dashboards for agencies and MSPs are coming soon.
              </p>
              <Button href="/book?type=story">
                Book an audit <ArrowRight size={14} />
              </Button>
            </div>
            <div className="book-preview">
              <div className="book-cover">
                <small>A CLOUD COST REPORT</small>
                <h3>
                  Every client.
                  <br />
                  One
                  <br />
                  dashboard.
                </h3>
                <small>CLIENT PORTFOLIO · SAMPLE</small>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export function WhySmriti() {
  const items = [
    {
      title: "Every number has a source.",
      text: "Go beyond a summary. Follow any finding back to the exact resource, metric and time window it came from.",
      label: "Context matters",
    },
    {
      title: "Your cloud. Your say.",
      text: "Choose which accounts and regions are scanned. Hide sensitive projects. Revoke access any time by deleting the role. Team rules are coming soon.",
      label: "Control before convenience",
    },
    {
      title: "It stays yours. Always.",
      text: "Export findings, reports and spend history is coming soon. Delete your data whenever you choose.",
      label: "Made to be exported",
    },
  ];
  return (
    <section className={`section ${why.section}`} aria-labelledby="why-heading">
      <div className="container">
        <div className={why.heading}>
          <div>
            <SectionLabel>How we work</SectionLabel>
            <h2 id="why-heading">Why CloudLedger</h2>
          </div>
          <p>Careful engineering. Plain-spoken answers.</p>
        </div>
        <div className={why.grid}>
          {items.map((item, i) => (
            <article className={why.column} key={item.title}>
              <div className={why.kicker}>
                <span>0{i + 1}</span>
                <span>{item.label}</span>
              </div>
              <div className={why.illustration} aria-hidden="true">
                {i === 0 ? (
                  <div className={why.source}>
                    <span className={why.paperLabel}>COST FINDING · SAMPLE</span>
                    <p>
                      NAT Gateway · us-east-1.
                      <br />
                      <em>4.1 TB processed.</em>
                    </p>
                    <div className={why.recording}>
                      <span className={why.wave}>
                        {[8, 15, 21, 12, 25, 17, 9, 20, 14, 23, 10, 16].map((height, n) => (
                          <i key={n} style={{ height }} />
                        ))}
                      </span>
                      <span>
                        $184 this month <b>↗ [1]</b>
                      </span>
                    </div>
                  </div>
                ) : i === 1 ? (
                  <div className={why.privacy}>
                    <LockKeyhole size={21} strokeWidth={1.3} />
                    <p>
                      Some accounts are
                      <br />
                      <em>off-limits.</em>
                    </p>
                    <span className={why.privacyNote}>Your cloud. Your rules.</span>
                  </div>
                ) : (
                  <div className={why.documents}>
                    <div className={why.backSheet} />
                    <div className={why.frontSheet}>
                      <span className={why.paperLabel}>YOUR DATA</span>
                      <p>
                        Your data,
                        <br />
                        <em>in your hands.</em>
                      </p>
                      <div className={why.formats}>
                        <span>CSV</span>
                        <span>JSON</span>
                        <span>PDF</span>
                        <span>TF</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Promise() {
  return (
    <section className="promise-section">
      <div className="container">
        <SectionLabel>A promise, not a feature</SectionLabel>
        <h2>
          We read your cloud.
          <br />
          We never touch it.
        </h2>
        <p>
          Some things should never be automatic. Deleting a resource. Spending your money.
          Inventing a number.
        </p>
        <div className="promise-tags">
          <span>No write access</span>
          <span>No auto-deletes</span>
          <span>No invented numbers</span>
        </div>
        <Button href="/trust" variant="outline" className="button-white">
          Our approach to trust <ArrowRight size={14} />
        </Button>
      </div>
    </section>
  );
}

export function ClosingCTA() {
  return (
    <section className={ending.cta} aria-labelledby="closing-heading">
      <div className={`container ${ending.invitation}`}>
        <div className={ending.copy}>
          <span className={ending.eyebrow}>
            <Cloud size={14} /> YOUR NEXT BILL STARTS NOW
          </span>
          <h2 id="closing-heading">
            Check before
            <br />
            the next bill does<span>.</span>
          </h2>
          <p>
            A few minutes today.
            <br />A smaller bill every month.
          </p>
          <div className={`button-row ${ending.actions}`}>
            <Button href="/signup" variant="white">
              Start free <ArrowRight size={16} />
            </Button>
            <Button href="/book" variant="outline">
              Talk to us
            </Button>
          </div>
          <span className={ending.note}>One account. One scan. A place to begin.</span>
        </div>
        <div className={ending.promptScene}>
          <div className={ending.promptCard}>
            <div className={ending.cardTop}>
              <span>A QUESTION FOR YOUR NEXT STANDUP</span>
              <Cloud size={16} strokeWidth={1.5} />
            </div>
            <span className={ending.quoteMark} aria-hidden="true">
              “
            </span>
            <p>
              What’s running
              <br />
              in production that
              <br />
              nobody can <strong>explain?</strong>
            </p>
            <div className={ending.cardBottom}>
              <span className={ending.voice} aria-hidden="true">
                {[8, 16, 25, 14, 30, 20, 11, 23, 15, 27, 12, 18].map((height, i) => (
                  <i key={i} style={{ height }} />
                ))}
              </span>
              <span>
                So much starts
                <br />
                with looking.
              </span>
            </div>
          </div>
          <span className={ending.sceneCaption}>THE SAVINGS YOU HAVEN’T FOUND YET.</span>
        </div>
      </div>
    </section>
  );
}
