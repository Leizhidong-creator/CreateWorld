import {story} from '../content.js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateConfig } from '../src/validate.js';
import { harbor } from '../examples/harbor.js';
import { station } from '../examples/station.js';
for(const c of [harbor,station,story]){
  validateConfig(c);
  for(const a of c.assets){const file=fileURLToPath(new URL(a.src,c.assetBase));if(!fs.existsSync(file))throw new Error(c.id+' missing asset: '+file);}
  console.log('Config and asset check: '+c.id+' OK');
}
