import assert from 'node:assert/strict';
import test from 'node:test';

import { planWarningViewModels } from '../src/ui/render.js';

test('verbergt ook een eerder opgeslagen tijdelijke aanpassingsmelding', () => {
  const visible = planWarningViewModels([
    {
      code: 'NO_ADJUSTMENT_AVAILABLE',
      severity: 'info',
      message: 'Geen betere optie beschikbaar.',
    },
    {
      code: 'LARGE_TARGET_DEVIATION',
      severity: 'warning',
      message: 'Het dagdoel wijkt af.',
    },
  ]);

  assert.deepEqual(visible.map((warning) => warning.code), ['LARGE_TARGET_DEVIATION']);
  assert.equal(visible[0].title, 'Let op');
});
