import type { ProgramSurfaceState } from './ProgramSurface';

export const programSurfaceFixtures: Array<{ name: string; state: ProgramSurfaceState }> = [
  {
    name: 'Bible Fullscreen',
    state: {
      outputMode: 'fullscreen',
      bgFill: 'linear-gradient(135deg, #171b26, #35281b)',
      scene: {
        id: 'fixture-bible',
        name: 'John 3:16',
        type: 'bible',
        content: {
          text: 'For God so loved the world, that he gave his only begotten Son.',
          reference: 'John 3:16',
          version: 'KJV',
        },
      },
    },
  },
  {
    name: 'Compare View',
    state: {
      outputMode: 'fullscreen',
      bgFill: '#10131a',
      scene: {
        id: 'fixture-compare',
        name: 'Psalm 23 Compare',
        type: 'bible',
        content: {
          text: 'The LORD is my shepherd; I shall not want.',
          reference: 'Psalm 23:1',
          version: 'KJV',
          secondaryVerse: {
            text: 'The LORD is my shepherd; I have all that I need.',
            reference: 'Psalm 23:1',
            version: 'ASV',
          },
        },
      },
    },
  },
  {
    name: 'Lower Third',
    state: {
      outputMode: 'lowerThird',
      bgFill: 'transparent',
      scene: {
        id: 'fixture-lt',
        name: 'Romans 8:28',
        type: 'bible',
        content: {
          text: 'All things work together for good to them that love God.',
          reference: 'Romans 8:28',
          version: 'KJV',
        },
      },
    },
  },
  {
    name: 'Song Credit',
    state: {
      outputMode: 'fullscreen',
      bgFill: 'linear-gradient(180deg, #0b1118, #182333)',
      scene: {
        id: 'fixture-song',
        name: 'Amazing Grace',
        type: 'song',
        content: {
          text: 'Amazing grace how sweet the sound\nThat saved a wretch like me',
          reference: 'Verse 1',
          songCredit: {
            title: 'Amazing Grace',
            author: 'John Newton',
            ccli: '123456',
          },
        },
      },
    },
  },
  {
    name: 'Alert And Transcription',
    state: {
      outputMode: 'fullscreen',
      bgFill: '#050505',
      transcription: 'Live transcription text appears here.',
      activeAlert: {
        id: 'fixture-alert',
        text: 'Service begins in 2 minutes',
        type: 'announcement',
        duration: 5,
        animation: 'slideDown',
      },
      scene: {
        id: 'fixture-alert-scene',
        name: 'Welcome',
        type: 'custom',
        content: { text: 'Welcome', reference: 'Sunday Service' },
      },
    },
  },
  {
    name: 'Solid Background',
    state: {
      outputMode: 'fullscreen',
      bgFill: '#1d3b2a',
      scene: {
        id: 'fixture-solid',
        name: 'Solid Background',
        type: 'custom',
        content: {
          text: 'Solid background',
          reference: 'Fixture',
        },
      },
    },
  },
  {
    name: 'Transparent Background',
    state: {
      outputMode: 'fullscreen',
      bgFill: 'transparent',
      scene: {
        id: 'fixture-transparent',
        name: 'Transparent Background',
        type: 'custom',
        content: {
          text: 'Transparent background',
          reference: 'Fixture',
        },
      },
    },
  },
  {
    name: 'Image Background',
    state: {
      outputMode: 'fullscreen',
      bgCustomImage: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1600 900%22%3E%3Cdefs%3E%3ClinearGradient id=%22g%22 x1=%220%22 x2=%221%22 y1=%220%22 y2=%221%22%3E%3Cstop stop-color=%22%23203a43%22/%3E%3Cstop offset=%221%22 stop-color=%22%232c5364%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%221600%22 height=%22900%22 fill=%22url(%23g)%22/%3E%3Ccircle cx=%221180%22 cy=%22220%22 r=%22220%22 fill=%22%23f4e4b0%22 opacity=%22.18%22/%3E%3Crect x=%22120%22 y=%22620%22 width=%221360%22 height=%226%22 fill=%22%23ffffff%22 opacity=%22.22%22/%3E%3C/svg%3E',
      scene: {
        id: 'fixture-image',
        name: 'Image Background',
        type: 'custom',
        content: {
          text: 'Image background',
          reference: 'Fixture',
        },
      },
    },
  },
  {
    /* A projected slide paints its own design edge to edge: no theme font, no
       reference row, no background from the theme. If this case ever comes
       back as centred white text on the theme's fill, the projection stopped
       reaching the surface. */
    name: 'Projected PowerPoint Slide',
    state: {
      outputMode: 'fullscreen',
      bgFill: '#10131a',
      scene: {
        id: 'fixture-projected-slide',
        name: 'Deck — Slide 1',
        type: 'presentation',
        content: {
          text: 'Our Mission\nReaching the city, one street at a time',
          reference: 'Fixture Deck',
          slide: {
            kind: 'pptx',
            sizeEmu: { cx: 12192000, cy: 6858000 },
            textFallbackColor: '#1f2937',
            parsed: {
              id: 1,
              kind: 'pptx',
              parsed: true,
              backgroundColor: '#f8f5ef',
              shapes: [
                {
                  id: 'fixture-shape-title',
                  kind: 'text',
                  left: 8,
                  top: 18,
                  width: 84,
                  height: 22,
                  paragraphs: [[{ text: 'Our Mission', bold: true, fontSize: 54, color: '#b3400f' }]],
                },
                {
                  id: 'fixture-shape-body',
                  kind: 'text',
                  left: 8,
                  top: 46,
                  width: 84,
                  height: 30,
                  paragraphs: [
                    [{ text: 'Reaching the city, one street at a time', fontSize: 28 }],
                    [{ text: 'Every week, every door', fontSize: 28, italic: true }],
                  ],
                },
                {
                  id: 'fixture-shape-rule',
                  kind: 'shape',
                  left: 8,
                  top: 41,
                  width: 20,
                  height: 1,
                  paragraphs: [],
                  fillColor: '#b3400f',
                },
              ],
            },
          },
        },
      },
    },
  },
  {
    name: 'Video Background',
    state: {
      outputMode: 'fullscreen',
      bgVideo: '/fixtures/display-video-fixture.mp4',
      bgVideoLoop: true,
      scene: {
        id: 'fixture-video',
        name: 'Video Background',
        type: 'custom',
        content: {
          text: 'Video background',
          reference: 'Fixture',
        },
      },
    },
  },
];
