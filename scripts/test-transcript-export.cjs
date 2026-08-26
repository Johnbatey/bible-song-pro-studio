const assert = require('assert');

// Test the export formatting functions
function testTranscriptExportLogic() {
  console.log('Testing transcript export formatting...');

  const payload = {
    churchName: 'Grace City Church',
    title: 'Walking in the Light',
    speaker: 'Pastor John Doe',
    dateTime: 'Sunday, Aug 25, 2026 10:30 AM',
    scriptures: [
      {
        reference: 'John 8:12',
        text: 'Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.',
        version: 'KJV'
      },
      {
        reference: 'Psalm 119:105',
        text: 'Thy word is a lamp unto my feet, and a light unto my path.',
        version: 'KJV'
      }
    ],
    transcript: 'Welcome everyone to today service. God is good all the time. Today we are exploring what it means to walk in the light. When Jesus spoke to the people, he said that he is the light of the world. Therefore we should not walk in darkness. Let us apply this truth to our daily lives.'
  };

  // Test paragraph splitting
  function formatTranscriptIntoParagraphs(text, sentencesPerParagraph = 3) {
    const clean = String(text || '').trim();
    if (!clean) return [];
    const rawSentences = clean
      .replace(/([.?!])\s+/g, '$1|BSP_SPLIT|')
      .split('|BSP_SPLIT|')
      .map((s) => s.trim())
      .filter(Boolean);

    if (rawSentences.length <= sentencesPerParagraph) return [clean];
    const paragraphs = [];
    let currentGroup = [];
    for (const sentence of rawSentences) {
      currentGroup.push(sentence);
      if (currentGroup.length >= sentencesPerParagraph) {
        paragraphs.push(currentGroup.join(' '));
        currentGroup = [];
      }
    }
    if (currentGroup.length > 0) paragraphs.push(currentGroup.join(' '));
    return paragraphs;
  }

  const paras = formatTranscriptIntoParagraphs(payload.transcript);
  console.log('Paragraphs count:', paras.length);
  assert(paras.length >= 1, 'Should have at least 1 paragraph');

  // Verify scripture formatting in Markdown
  const lines = [];
  lines.push(`# ${payload.title}`, '');
  lines.push(`**Church:** ${payload.churchName}  \n**Speaker:** ${payload.speaker}  \n**Date & Time:** ${payload.dateTime}`, '');
  lines.push('---', '');
  lines.push('## Mentioned Scriptures', '');
  payload.scriptures.forEach(sc => {
    lines.push(`> *“${sc.text}”*`, `> `, `> — **${sc.reference} (${sc.version})**`, '');
  });
  lines.push('---', '');
  lines.push('## Sermon Transcript', '');
  paras.forEach(p => lines.push(p, ''));

  const markdown = lines.join('\n');
  assert(markdown.includes('# Walking in the Light'), 'Markdown should contain title');
  assert(markdown.includes('> *“Then spake Jesus again unto them'), 'Markdown should contain scripture quote in italicized quotes');
  assert(markdown.includes('> — **John 8:12 (KJV)**'), 'Markdown should contain bold reference on separate line');
  assert(markdown.includes('## Sermon Transcript'), 'Markdown should contain transcript section');

  console.log('Generated Markdown Preview:\n---------------------------------');
  console.log(markdown);
  console.log('---------------------------------');
  console.log('All transcript export tests passed successfully!');
}

testTranscriptExportLogic();
