import { readFileSync } from 'node:fs';
import template from '../assets/customer-role.yaml?raw';

test('downloaded IAM template matches the audited infrastructure template', () => {
  expect(template.trim()).toBe(readFileSync('../infra/customer-role.yaml', 'utf8').trim());
});
