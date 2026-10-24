import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// Exact source identity against production 1.3.1 (unchanged since 1.2.7); existing numerical regression suites remain mandatory.
const baseline = {
  'src/core/aron.ts': '885537633a9433092748ce8ba2f2182c29777031526f62794be9f85cf8c2c022',
  'src/core/comparisons.ts': '2f9040893199cc2da274e96b5ad55a887a9ba0e6811c31d6a922f31713d0c8f3',
  'src/core/config.ts': '53e39dc3cf9b8484e47122f7b6d4f7fee469671eb230260f56a64d4a6b0b64ad',
  'src/core/current.ts': '95b3959cb4b70ca430760b68c6ff3dc8da8ad7b72c1f11786f57e8b2c604b314',
  'src/core/diagnosis.ts': '9d20416767fb549962d7170542e32108b7cdb5703a42817317f12bdadfcd43c3',
  'src/core/energy.ts': '76b3be69565e7a0da59d5bc7662d00b3608d6b5b4146e82b1448909b3d26f26f',
  'src/core/historyView.ts': '1f330d426fe73967a62acde4869f2983872bdb95047728ee0abeb15a3456aef0',
  'src/core/intervalCheck.ts': 'fb105c561cf7191da0e4b98eb81aedc2a0ced0bb49590d8f12eade481e52db5c',
  'src/core/measurement.ts': '5a80a9ede6701f85f5b111139c0b59adcc239c5c201461c202ac571ca05f8516',
  'src/core/numbers.ts': '7c15338533e02f9c2f7aa40bcefbb2d5c9137f1660bca64b00054cce2f31cfde',
  'src/core/physics.ts': '09331ad47c88c5077465634bf669e0b44b328c1969105a235df1f6922498bf1b',
  'src/core/powerConsistency.ts':
    '456090e5275dde8233d051e3a7c3e72d7ea7cb42233a6918a0c5f86ecb378a6b',
  'src/core/types.ts': '565cacae382f078927842a4226b57535d16eb8f72a4a0d16b69e1f445380e61f',
};
it('ověřené výpočtové jádro je beze změny proti 1.3.1', () => {
  for (const [path, sha] of Object.entries(baseline))
    expect(createHash('sha256').update(readFileSync(path)).digest('hex'), path).toBe(sha);
});
