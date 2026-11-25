'use strict';
// Prepare local static files only. This script never connects to XServer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {promisify} = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
(async () => {
const root = path.resolve(__dirname, '..');
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'xserver-files.json')));
const files = spec.files;
if (spec.domain !== 'shihoshoshipass.com' || !Array.isArray(files) ||
    new Set(files).size !== files.length || !files.includes('index.html')) throw Error('Invalid release allowlist');
const output = path.join(root, 'release/xserver');
fs.mkdirSync(output, {recursive: true});
const site = path.join(output, 'site');
fs.rmSync(site, {recursive: true, force: true});
fs.mkdirSync(site);
const records = [];
for (const name of files) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.startsWith('/') || name.split('/').includes('..') ||
      name.startsWith('icons/') || /(?:^|\/)(?:mobile|pass-review|pass-review-private)(?:\/|$)/.test(name)) throw Error('Unsafe release path: ' + name);
  const source = path.join(root, name);
  if (!fs.lstatSync(source).isFile()) throw Error('Regular source file required: ' + name);
  const bytes = fs.readFileSync(source);
  if (/\.(?:html|css|js|json|webmanifest)$/.test(name) && /(^|[^\w-])icons\//m.test(bytes.toString())) {
    throw Error('Legacy icons/ reference in release: ' + name);
  }
  const destination = path.join(site, name);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, bytes, {mode: 0o644});
  records.push({path: name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')});
}
const manifest = {
  schema: 1, domain: spec.domain,
  sourceCommit: (await execFile('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'})).stdout.trim(),
  sourceDirty: Boolean((await execFile('git', ['status', '--porcelain', '--untracked-files=normal'], {cwd: root, encoding: 'utf8'})).stdout.trim()),
  files: records
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await execFile('python3', ['-c', `
import pathlib,zipfile,sys
site=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED) as archive:
 for file in sorted(site.rglob('*')):
  if file.is_file():
   entry=zipfile.ZipInfo(file.relative_to(site).as_posix(),date_time=(1980,1,1,0,0,0))
   entry.compress_type=zipfile.ZIP_DEFLATED
   entry.external_attr=0o100644<<16
   archive.writestr(entry,file.read_bytes())
`, site, path.join(output, 'shihoshoshi-pass.zip')]);
console.log(JSON.stringify({files: records.length, sourceDirty: manifest.sourceDirty, output: 'release/xserver'}, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
