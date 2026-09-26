import { describe, it, expect } from 'vitest';
import { backgroundFieldsFor } from '../../src/renderer/utils/display-fields';
import { createDefaultTheme } from '../../src/renderer/utils/defaultTheme';

function themeWith(fullScreen: Record<string, any>) {
  const theme = createDefaultTheme();
  return { ...theme, fullScreen: { ...theme.fullScreen, ...fullScreen } };
}

const scene = (background?: any) => ({
  id: 's',
  name: 'Fixture',
  type: 'song' as const,
  content: { text: 'Lyric' },
  ...(background ? { background } : {}),
});

const ground = (fields: any) => ({
  bgVideo: fields.bgVideo,
  bgCustomImage: fields.bgCustomImage,
  bgFill: fields.bgFill,
});

describe('Display Fields & Ground Resolution', () => {
  it('cleared/takedown scene produces transparent blank ground', () => {
    const res = ground(backgroundFieldsFor(null, themeWith({ background: '', backgroundColor: '#123456' }), 'fullscreen'));
    expect(res).toEqual({ bgVideo: '', bgCustomImage: '', bgFill: 'transparent' });
  });

  it('theme solid reaches the display', () => {
    const res = ground(backgroundFieldsFor(scene(), themeWith({ background: '', backgroundColor: '#123456' }), 'fullscreen'));
    expect(res).toEqual({ bgVideo: '', bgCustomImage: '', bgFill: '#123456' });
  });

  it('theme gradient is not flattened to its start colour', () => {
    const res = ground(backgroundFieldsFor(
      scene(),
      themeWith({ background: 'linear-gradient(135deg, #0f172a, #312e81)', backgroundColor: '#0f172a' }),
      'fullscreen',
    ));
    expect(res).toEqual({ bgVideo: '', bgCustomImage: '', bgFill: 'linear-gradient(135deg, #0f172a, #312e81)' });
  });

  it('theme image outranks the colour every theme carries', () => {
    const res = ground(backgroundFieldsFor(
      scene(),
      themeWith({ backgroundMediaUrl: '/media/still.png', backgroundMediaType: 'image', backgroundColor: '#123456' }),
      'fullscreen',
    ));
    expect(res).toEqual({ bgVideo: '', bgCustomImage: '/media/still.png', bgFill: '' });
  });

  it('theme video reaches the display as a video, not a fill', () => {
    const res = ground(backgroundFieldsFor(
      scene(),
      themeWith({ backgroundMediaUrl: '/media/loop.mp4', backgroundMediaType: 'video', backgroundColor: '#123456' }),
      'fullscreen',
    ));
    expect(res).toEqual({ bgVideo: '/media/loop.mp4', bgCustomImage: '', bgFill: '' });
  });

  it("a song's own gradient outranks the theme's image", () => {
    const res = ground(backgroundFieldsFor(
      scene({ type: 'gradient', gradient: 'linear-gradient(135deg, #062a20, #0f5132)' }),
      themeWith({ backgroundMediaUrl: '/media/still.png', backgroundMediaType: 'image' }),
      'fullscreen',
    ));
    expect(res).toEqual({ bgVideo: '', bgCustomImage: '', bgFill: 'linear-gradient(135deg, #062a20, #0f5132)' });
  });

  it("a song's own clip outranks the theme's clip", () => {
    const res = ground(backgroundFieldsFor(
      scene({ type: 'video', mediaUrl: '/media/song.mp4', mediaType: 'video' }),
      themeWith({ backgroundMediaUrl: '/media/theme.mp4', backgroundMediaType: 'video' }),
      'fullscreen',
    ));
    expect(res).toEqual({ bgVideo: '/media/song.mp4', bgCustomImage: '', bgFill: '' });
  });

  it('loop follows the theme when the theme supplied the clip', () => {
    const loop = backgroundFieldsFor(
      scene(),
      themeWith({ backgroundMediaUrl: '/media/loop.mp4', backgroundMediaType: 'video', backgroundLoop: false }),
      'fullscreen',
    ).bgVideoLoop;
    expect(loop).toBe(false);
  });

  it('loop follows the scene when the scene supplied the clip', () => {
    const loop = backgroundFieldsFor(
      scene({ type: 'video', mediaUrl: '/media/song.mp4', loop: false }),
      themeWith({ backgroundMediaUrl: '/media/theme.mp4', backgroundMediaType: 'video', backgroundLoop: true }),
      'fullscreen',
    ).bgVideoLoop;
    expect(loop).toBe(false);
  });
});
