/**
 * The media library references the operator's files where they live — it does
 * not copy them. That makes three things load-bearing, and this pins all three:
 *
 *   - removing an entry must never delete the operator's file
 *   - a file that moves must be reported missing, not silently dropped
 *   - relink must recover the entry with its id intact, so scenes already
 *     built on it keep resolving
 *
 * Plus the traversal defence, which changed shape when entries stopped living
 * in one folder: /media/<key> is matched against the index and never joined
 * onto a path.
 */
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const { createMediaService } = require(path.join(process.cwd(), 'src/electron/media-service.cjs'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bsp-media-'));
const userData = path.join(tmp, 'userData');
const vault = path.join(tmp, 'vault'); fs.mkdirSync(vault, { recursive: true });
const moved = path.join(tmp, 'moved'); fs.mkdirSync(moved, { recursive: true });

const src = path.join(vault, 'loop.mp4');
fs.writeFileSync(src, Buffer.alloc(2048, 7));
const svc = createMediaService({ app: { getPath: () => userData } });

// 1. Import references in place — no copy.
let r = svc.importPaths([src]);
assert.equal(r.ok, true, 'import should succeed');
const id = r.items[0].id;
assert.equal(r.items[0].sourcePath, src, 'entry must record the original path');
const mediaDir = path.join(userData, 'media');
const copies = fs.readdirSync(mediaDir).filter((f) => f !== 'index.json');
assert.deepEqual(copies, [], `no file should be copied, found: ${copies}`);
console.log('1 ✓ import references in place, nothing copied');

// 2. Resolve serves the original.
assert.equal(svc.resolve(id), src, 'resolve by id must return the source path');
console.log('2 ✓ /media/<id> resolves to the original file');

// 3. Duplicate import is refused.
assert.equal(svc.importPaths([src]).ok, false, 'duplicate import should be refused');
console.log('3 ✓ re-importing the same file is refused');

// 4. Move the file away -> missing, entry survives.
const dest = path.join(moved, 'loop.mp4');
fs.renameSync(src, dest);
let listed = svc.list().items;
assert.equal(listed.length, 1, 'entry must NOT be pruned when the file goes');
assert.equal(listed[0].missing, true, 'entry must report missing');
assert.equal(svc.resolve(id), null, 'a missing file must not resolve');
console.log('4 ✓ moved file -> missing:true, entry retained, resolve refuses');

// 5. Relink recovers it, id and url unchanged.
r = svc.relink(id, dest);
assert.equal(r.ok, true, `relink should succeed: ${r.error}`);
listed = svc.list().items;
assert.equal(listed[0].missing, false, 'relinked entry must be alive');
assert.equal(listed[0].id, id, 'id must survive a relink so scenes keep working');
assert.equal(svc.resolve(id), dest, 'resolve must follow to the new path');
console.log('5 ✓ relink recovers the entry, id and url preserved');

// 6. Relink to a different media kind is refused.
const img = path.join(moved, 'still.png'); fs.writeFileSync(img, Buffer.alloc(64, 1));
assert.equal(svc.relink(id, img).ok, false, 'video entry must refuse an image');
console.log('6 ✓ relinking across media kinds is refused');

// 7. Remove drops the entry and LEAVES the operator file alone.
assert.equal(svc.remove(id).ok, true);
assert.equal(svc.list().items.length, 0, 'entry should be gone');
assert.equal(fs.existsSync(dest), true, 'THE OPERATOR FILE MUST SURVIVE REMOVAL');
console.log("7 ✓ remove de-indexes only — the operator's file is untouched");

// 8. Legacy entries (copied into userData/media) still resolve.
const legacyFile = 'legacy-abc.png';
fs.writeFileSync(path.join(mediaDir, legacyFile), Buffer.alloc(32, 3));
fs.writeFileSync(path.join(mediaDir, 'index.json'), JSON.stringify([
  { id: 'legacy-1', file: legacyFile, name: 'Old', type: 'image', size: 32, addedAt: 1, url: '/media/' + legacyFile },
]));
const legacy = svc.list().items[0];
assert.equal(legacy.missing, false, 'a legacy copy that exists is not missing');
assert.equal(svc.resolve(legacyFile), path.join(mediaDir, legacyFile), 'legacy filename must still resolve');
assert.equal(svc.resolve('legacy-1'), path.join(mediaDir, legacyFile), 'legacy id must also resolve');
console.log('8 ✓ entries from older builds keep working');

// 9. Traversal is refused.
assert.equal(svc.resolve('../../../../etc/passwd'), null, 'traversal must not resolve');
assert.equal(svc.resolve('/etc/passwd'), null, 'absolute paths must not resolve');
console.log('9 ✓ path traversal and absolute paths refused');

// 10. Optimized slide import writes an owned copy and leaves the original.
const PNG_1X1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex',
);
const photo = path.join(vault, 'photo.png');
fs.writeFileSync(photo, PNG_1X1);
const optimized = svc.importOptimizedImage(photo);
assert.equal(optimized.ok, true, `optimized import should succeed: ${optimized.error}`);
assert.ok(optimized.item.file, 'optimized entry must own a copy');
assert.equal(typeof optimized.item.sourcePath, 'undefined', 'optimized entry must not play from the original');
assert.equal(fs.existsSync(photo), true, 'the original file must be left in place');
const copyPath = svc.resolve(optimized.item.id);
assert.ok(copyPath && copyPath.startsWith(mediaDir), 'resolve must serve the owned copy');
assert.notEqual(copyPath, photo, 'the owned copy is not the original');
assert.equal(svc.importOptimizedImage('/no/such/photo.jpg').ok, false, 'missing file must fail');
assert.equal(svc.importOptimizedImage(dest).ok, false, 'a video must be refused');
assert.equal(svc.remove(optimized.item.id).ok, true);
assert.equal(fs.existsSync(copyPath), false, 'removing an optimized entry deletes the owned copy');
assert.equal(fs.existsSync(photo), true, 'removing an optimized entry must not delete the original');
console.log('10 ✓ optimized slide import writes a copy, original survives, remove cleans the copy');

fs.rmSync(tmp, { recursive: true, force: true });
console.log('\nAll 10 media-service checks passed.');
