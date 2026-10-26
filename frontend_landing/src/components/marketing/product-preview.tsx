import { BookOpen, CheckCheck, LockKeyhole, ShieldCheck, Sparkles, ArrowUpRight } from "lucide-react";
import { Waveform } from "../ui";

export function ProductPreview({ step = 0 }: { step?: number }) {
  return (
    <div className="product-window">
      <div className="window-toolbar">
        <span className="window-dots">
          <i />
          <i />
          <i />
        </span>
        <span>CloudLedger / {["connect account", "findings", "ask your bill"][step]}</span>
        <LockKeyhole size={10} />
      </div>
      <div className="product-content">
        {step === 0 && (
          <>
            <span className="small-label">Read-only access. A few minutes.</span>
            <h3>
              Connect your first
              <br />
              AWS account.
            </h3>
            <div className="mini-person">
              <span className="avatar">AWS</span>
              <div>
                <strong>Read-only role</strong>
                <small>No agents · No keys stored</small>
              </div>
              <span className="record-indicator">● Verifying access</span>
            </div>
            <Waveform active />
            <p className="preview-timer">Scanning cost and usage data · read-only</p>
            <div className="preview-bottom">
              <ShieldCheck size={12} /> Read-only by design
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <span className="small-label">A clear finding. An exact saving.</span>
            <h3>Unattached disk (vol-0a1b…).</h3>
            {[
              ["AWS · us-east-1", "Low risk"],
              ["EBS · 14 days idle", "$48 / month"],
              ["Detected 2 min ago", "Evidence attached"],
            ].map(([title, meta]) => (
              <div className="preview-chapter" key={title}>
                <BookOpen size={15} />
                <span>{title}</span>
                <small>{meta}</small>
                <ArrowUpRight size={12} />
              </div>
            ))}
            <div className="preview-bottom">
              <LockKeyhole size={12} /> Sample data. Evidence attached.
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <span className="small-label">Answers from your data · Coming soon</span>
            <h3>Ask something specific.</h3>
            <div className="preview-query">
              <Sparkles size={15} /> Why did EC2 cost rise in September?
            </div>
            <p className="preview-answer">
              Spend rose 18%, mostly from six new instances launched on Sept 9 in us-east-1.{" "}
              <span className="citation">1</span>
            </p>
            <div className="preview-chapter">
              <BookOpen size={15} />
              <span>Cost data, Sept 9 · us-east-1</span>
              <small>Source</small>
            </div>
            <div className="preview-bottom">
              <CheckCheck size={12} /> Source-linked sample answer · Coming soon
            </div>
          </>
        )}
      </div>
    </div>
  );
}
