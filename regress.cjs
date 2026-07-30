process.chdir('/Users/explorer02/Documents/Bible Song Pro Max');
const ref = require('/Users/explorer02/Documents/Bible Song Pro Max/src/electron/scripture-reference.cjs');
// written forms must still work exactly as before
const written = ['John 3:16','Romans 8:28-29','1 Corinthians 13:4','Psalm 23','see Genesis 1:1 today','2 Tim 3:16'];
written.forEach(t => {
  const r = ref.extractReferences(t);
  console.log(`"${t}" -> ${r.map(x=>x.displayRef+':'+x.confidence).join(', ') || '(none)'}`);
});
// no duplicate when both patterns could match
const both = ref.extractReferences('John chapter 3 verse 16');
console.log(`dedupe check "John chapter 3 verse 16" -> ${both.length} result(s): ${both.map(x=>x.displayRef).join(', ')}`);
