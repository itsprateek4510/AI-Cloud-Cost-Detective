import type { Account, Scan } from '../api';

export const accounts: Account[] = [
  { id: 1, role_arn: 'arn:aws:iam::123456789012:role/ReadOnly', external_id: 'external-id', verified_at: '2026-10-25T00:00:00Z' },
];

export const scan: Scan = {
  scan_id: 10, account_id: 1, status: 'completed', progress: 100,
  totals: { findings_count: 2, savings_monthly: '11.65' }, skipped_checks: [], error_message: null,
  created_at: '2026-10-25T00:00:00Z', completed_at: '2026-10-25T00:01:00Z',
  findings: [
    { id: 1, rule_id: 'eip_unused', resource_id: 'eip-cheap', resource_type: 'eip', region: 'us-west-2', severity: 'low', title: 'Unused IP', description: 'Review', savings_monthly: '3.65', details: {} },
    { id: 2, rule_id: 'ebs_unattached', resource_id: 'vol-expensive', resource_type: 'ebs', region: 'us-east-1', severity: 'medium', title: 'Unattached volume', description: 'Review', savings_monthly: '8.00', details: {} },
  ],
};
