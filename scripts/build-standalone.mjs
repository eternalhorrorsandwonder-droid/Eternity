/** Build an offline, single-file HTML edition from the same production bundle. */
import fs from 'node:fs';
import path from 'node:path';
import { escapeInlineCode, replaceLiteral } from './inline-utils.mjs';

const root=process.cwd(), dist=path.join(root,'dist');
let html=fs.readFileSync(path.join(dist,'index.html'),'utf8');
const jsTag=html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
const cssTag=html.match(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/);
if(!jsTag||!cssTag) throw new Error('Expected one production JS bundle and one stylesheet. Run npm run build first.');
const readDist=url=>fs.readFileSync(path.join(dist,url.replace(/^\//,'')));
let js=readDist(jsTag[1]).toString('utf8');
let css=readDist(cssTag[1]).toString('utf8');
const mime={'.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.glb':'model/gltf-binary'};
const uri=file=>`data:${mime[path.extname(file)]};base64,${fs.readFileSync(file).toString('base64')}`;
const embedded={};
for(const name of fs.readdirSync(path.join(dist,'assets'))) {
  const file=path.join(dist,'assets',name), ext=path.extname(name);
  if(!mime[ext]) continue;
  if(ext==='.glb') embedded[name]=uri(file);
  else {
    // Vite references these fixed URLs in the bundled CSS and UI templates.
    const url=`/assets/${name}`, data=uri(file);
    css=css.split(url).join(data);
    js=js.split(url).join(data);
  }
}
if(Object.keys(embedded).length < 5) throw new Error('Expected local character and building models.');
// NPC portrait paths must stay literal in the source; dynamic URL assembly
// would leave the standalone pointing at missing /assets files on file://.
for (const name of ['mira','tavi','sera','rowan','bram','kea','nia']) {
  const file=path.join(dist,'assets',`${name}-portrait.webp`);
  if (!js.includes(uri(file))) throw new Error(`Dialogue portrait was not embedded: ${name}`);
}
if(/url\(["']?\/assets\//.test(css)) throw new Error('An asset URL in the CSS was not embedded.');
const bootstrap=`<script>globalThis.__ETERNITY_EMBEDDED_ASSETS__=${JSON.stringify(embedded)};</script>`;
const inlineJs=escapeInlineCode(js,'script');
const inlineCss=escapeInlineCode(css,'style');
html=replaceLiteral(html,cssTag[0],`<style>${inlineCss}</style>`);
html=replaceLiteral(html,jsTag[0],`${bootstrap}\n<script type="module">${inlineJs}</script>`);
const licenseFiles=['THREE-MIT.txt','CINZEL-OFL.txt','DM-SANS-OFL.txt','KAYKIT-ADVENTURERS-CC0.txt','KAYKIT-MEDIEVAL-CC0.txt'];
const licenses=licenseFiles.map(name => `===== ${name} =====\n${fs.readFileSync(path.join(root,'public','licenses',name),'utf8')}`).join('\n\n');
html=replaceLiteral(html,'</head>',`<script type="text/plain" id="third-party-licenses">${escapeInlineCode(licenses,'script')}</script>\n  </head>`);
html=html.replace('<title>', '<!-- Eternity 6.0 standalone: all game resources and third-party licenses are embedded. -->\n    <title>');
const output=path.join(root,'Eternity-V6.html');
fs.writeFileSync(output,html);
console.log(`Created ${path.basename(output)} (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MiB), with ${Object.keys(embedded).length} embedded models.`);
