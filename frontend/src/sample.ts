import type { Scan } from './api';

// Explicitly fictional, isolated from all authenticated API state.
export const sampleScan: Scan = {
  scan_id: 1, account_id: 1, status: 'completed', progress: 100,
  totals: { findings_count: 3, savings_monthly: '93.99' },
  skipped_checks: [], error_message: null,
  created_at: '2026-09-30T10:00:00Z', completed_at: '2026-09-30T10:02:00Z',
  findings: [
    { id: 1, rule_id: 'ebs_unattached', resource_id: 'vol-sample-01', resource_type: 'ebs', region: 'us-east-1', severity: 'low', title: 'An unattached volume is still costing you.', description: 'This 600 GiB gp3 volume is not attached to an instance. Check ownership and backup requirements before removal.', savings_monthly: '48.00', details: { pricing_note: 'Illustration: 600 GiB × $0.08/GiB-month. Verify your applicable rate.' } },
    { id: 2, rule_id: 'ec2_idle', resource_id: 'i-sample-02', resource_type: 'ec2', region: 'us-east-1', severity: 'medium', title: 'Low utilization across 14 complete days.', description: 'A sample t3.medium instance has consistently low CPU and network activity. Confirm workload dependencies before stopping it.', savings_monthly: '42.34', details: { pricing_note: 'Illustrative rate, not live AWS pricing. Low utilization is a review signal.' } },
    { id: 3, rule_id: 'eip_unused', resource_id: 'eipalloc-sample-03', resource_type: 'eip', region: 'us-east-1', severity: 'low', title: 'An Elastic IP has no associated resource.', description: 'This address is unassociated. Check DNS and allowlists before releasing it.', savings_monthly: '3.65', details: { pricing_note: 'Illustration: $0.005/hour × 730 hours.' } },
  ],
};

export const sampleSpend = [
  { month: 'Apr', amount: 642 }, { month: 'May', amount: 714 },
  { month: 'Jun', amount: 685 }, { month: 'Jul', amount: 762 },
  { month: 'Aug', amount: 708 }, { month: 'Sep', amount: 584 },
];
