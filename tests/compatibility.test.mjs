import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('module.json',root)));
test('manifesto: alvo 14.368 sem alegação de homologação funcional nem dependência obrigatória opcional',()=>{
 assert.equal(manifest.compatibility.minimum,'14.368');assert.equal(manifest.compatibility.maximum,'14.368');assert.equal(manifest.compatibility.verified,undefined);
 for(const file of [...manifest.esmodules,...manifest.styles])assert.ok(fs.existsSync(new URL(file,root)),file);
 assert.ok(!manifest.relationships?.requires?.some(p=>p.id?.includes('calendar')));
 assert.match(fs.readFileSync(new URL('scripts/main.mjs',root),'utf8'),new RegExp("version:'"+manifest.version.replaceAll('.','\\.')+"'"));
});
