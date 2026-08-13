/* =========================================================================
   <StageZones> — the confidence view's percentage-grid zones
   -------------------------------------------------------------------------
   Each zone is absolutely placed on the 100x100 grid its layout defines, and
   draws one kind of thing: the current text, what is next, the clock, the
   elapsed timer, the song cue, or broadcast messages.

   The clock and the timer own their own tick rather than being driven from
   above, so a second passing repaints two small numbers instead of the whole
   stage — which in hybrid mode would mean repainting the program output four
   times a second behind them.

   Ported from buildZone/renderZones/syncContent in the old
   public/stage-display/stage-display.js.
   ========================================================================= */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { StageLayout, StageZone } from './layouts';
import { resolveColor, type StageTheme } from './theme';
import { formatTime, timerSeconds, type StageContent, type StageMessage, type StageTimer } from './stage-state';
import { SlideStage } from '../renderer/components/display/SlideStage';
import type { SlideProjection } from '../renderer/types';

/** The most messages that fit before the block starts covering the lyrics. */
const MAX_MESSAGES = 3;

/** The live scene's own picture, when it has one. */
export interface StageMedia {
  kind: 'image' | 'video';
  /** Already resolved against the asset origin — the zone just loads it. */
  url: string;
  fit?: 'cover' | 'contain' | 'fill';
  loop?: boolean;
}

export interface StageZonesProps {
  layout: StageLayout;
  theme: StageTheme;
  current: StageContent | null;
  /** The live slide, when what is on screen is a projected slide rather than
      text. The current-text zone draws it in place of the body. */
  currentSlide?: SlideProjection | null;
  /** The live scene's image or video background. Drawn behind the words in the
      current-text and slide zones, so the musicians see the same picture the
      room does — and, when the scene is nothing but that picture, see it whole
      rather than reading its file name off a coloured rectangle. */
  currentMedia?: StageMedia | null;
  next: StageContent | null;
  songTitle: string;
  songSubtitle: string;
  timer: StageTimer;
  messages: StageMessage[];
}

/**
 * The scene's picture, filling its zone.
 *
 * Muted and looping without exception: this is a confidence monitor at the
 * side of a platform, and a second audio path out of the same clip would
 * arrive a beat behind the one the room is hearing.
 */
function ZoneMedia({ media }: { media: StageMedia }) {
  const objectFit = media.fit === 'contain' ? 'contain' : media.fit === 'fill' ? 'fill' : 'cover';
  if (media.kind === 'video') {
    return (
      <video
        className="zone-media"
        /* Keyed on the url so a change of clip loads the new one rather than
           leaving the element pointed at the old src. */
        key={media.url}
        src={media.url}
        autoPlay
        muted
        playsInline
        loop={media.loop !== false}
        style={{ objectFit }}
      />
    );
  }
  return <img className="zone-media" src={media.url} alt="" style={{ objectFit }} />;
}

/**
 * Only our own verse-number superscripts are allowed through as markup. Body
 * text is escaped upstream, so anything else with an angle bracket in it did
 * not come from the verse formatter and is rendered as literal text.
 */
export function isSafeVerseMarkup(html: string): boolean {
  const stripped = String(html || '')
    .replace(/<sup class="stage-verse-num">/g, '')
    .replace(/<\/sup>/g, '');
  return stripped.indexOf('<') === -1 && stripped.indexOf('>') === -1;
}

function BodyText({ content, style }: { content: StageContent | null; style: CSSProperties }) {
  const html = content && typeof content.bodyHtml === 'string' ? content.bodyHtml : '';
  if (html && isSafeVerseMarkup(html)) {
    return <div className="zone-body" style={style} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <div className="zone-body" style={style}>{content?.body || ''}</div>;
}

function ClockValue({ style }: { style: CSSProperties }) {
  const [value, setValue] = useState(() => clockString());
  useEffect(() => {
    // Ten seconds is enough for a minute-resolution clock and keeps the stage
    // idle between ticks.
    const id = window.setInterval(() => setValue(clockString()), 10_000);
    return () => window.clearInterval(id);
  }, []);
  return <div className="zone-value" style={style}>{value}</div>;
}

function clockString(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function TimerValue({ timer, style }: { timer: StageTimer; style: CSSProperties }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!timer.running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [timer.running]);
  return <div className="zone-value" style={style}>{formatTime(timerSeconds(timer))}</div>;
}

function zoneFrame(zone: StageZone): CSSProperties {
  return {
    left: `${zone.x}%`,
    top: `${zone.y}%`,
    width: `${zone.w}%`,
    height: `${zone.h}%`,
    background: zone.bgColor,
    borderRadius: zone.borderRadius ? `${zone.borderRadius}px` : undefined,
    padding: zone.padding ? `${zone.padding}px` : undefined,
    // Cascades to the title/body/value below, so an operator can pick a face
    // for the scripture zone without restyling every child.
    fontFamily: zone.fontFamily,
  };
}

export function StageZones({
  layout,
  theme,
  current,
  currentSlide,
  currentMedia,
  next,
  songTitle,
  songSubtitle,
  timer,
  messages,
}: StageZonesProps) {
  const scale = theme.fontScale;
  const px = (size: number) => `${Math.round(size * scale)}px`;

  return (
    <div className="stage-zones">
      {layout.zones.map((zone) => {
        if (zone.visible === false) return null;
        const frame = zoneFrame(zone);
        const align = zone.textAlign || 'left';
        const key = zone.id;

        if (zone.type === 'current-text' || zone.type === 'slide') {
          /* The reference sits directly above the verse and is sized as a
             percentage of it, so the pair scales together. */
          const refScale = Number.isFinite(Number(zone.referenceFontScale))
            ? Number(zone.referenceFontScale)
            : 42;
          const base = zone.fontSize || 48;
          /* A slide zone is a window onto the deck rather than a text cell that
             can hold a picture: when a slide is live it takes the cell whole,
             and the reference line and notes that frame verse text stand down.
             With nothing projected the zone falls back to the same text a
             current-text zone draws, so the Slide layout is not a blank screen
             the moment the service moves off the deck. */
          const activeSlide = currentSlide || current?.slide || null;
          /* A designed slide already carries its own background, so the scene's
             media would only be a second picture underneath one that covers
             it. Media is what this zone falls back to when there is no slide. */
          const activeMedia = activeSlide ? null : currentMedia || null;
          /* Words the stage exists to show. A pure media scene has none — the
             operator sent a picture, not a line — and that is the case where
             the picture may take the cell whole. With lyrics or a verse over
             it, the media stays a backdrop and the text keeps its inset. */
          const hasWords = Boolean(current?.title || current?.body || current?.bodyHtml);
          const fullBleed = !!activeSlide || (!!activeMedia && !hasWords);
          const classes = [
            'zone',
            zone.type === 'slide' ? 'zone-slide' : 'zone-current-text',
            fullBleed ? 'zone-slide-full' : '',
            activeMedia ? 'zone-has-media' : '',
          ].filter(Boolean).join(' ');
          return (
            <div key={key} className={classes} data-zone={zone.type} style={frame}>
              {activeMedia && <ZoneMedia media={activeMedia} />}
              <div className="zone-inner">
                <div
                  className="zone-title zone-reference"
                  style={{
                    display: !fullBleed && current?.title ? undefined : 'none',
                    fontSize: `${Math.max(16, Math.round(base * (refScale / 100) * scale))}px`,
                    fontWeight: 700,
                    textAlign: zone.textAlign || 'center',
                    color: resolveColor('accent', theme),
                  }}
                >
                  {current?.title || ''}
                </div>
                {/* When a slide projection is active, draw the full graphical slide board fitted to the cell */}
                {activeSlide ? (
                  <SlideStage projection={activeSlide} className="zone-slide-stage" />
                ) : (
                  <BodyText
                    content={current}
                    style={{
                      fontSize: px(base),
                      fontWeight: zone.fontWeight || 600,
                      textAlign: zone.textAlign || 'center',
                      color: resolveColor(zone.color || 'text', theme),
                    }}
                  />
                )}
                {!fullBleed && <div className="zone-notes">{current?.notes || ''}</div>}
              </div>
            </div>
          );
        }

        if (zone.type === 'next-item') {
          const base = zone.fontSize || 18;
          const color = resolveColor(zone.color || 'muted', theme);
          return (
            <div key={key} className="zone zone-next-item" data-zone="next-item" style={frame}>
              <div className="zone-inner">
                <div className="section-label">Next</div>
                <div
                  className="zone-title"
                  style={{
                    display: next?.title ? undefined : 'none',
                    fontSize: px(base),
                    fontWeight: zone.fontWeight || 500,
                    textAlign: align,
                    color,
                  }}
                >
                  {next?.title || ''}
                </div>
                <BodyText content={next} style={{ fontSize: px(base * 0.85), textAlign: align, color }} />
              </div>
            </div>
          );
        }

        if (zone.type === 'clock' || zone.type === 'timer') {
          const valueStyle: CSSProperties = {
            fontSize: px(zone.fontSize || 20),
            color: resolveColor(zone.color || (zone.type === 'timer' ? 'accent' : 'faint'), theme),
          };
          return (
            <div key={key} className={`zone zone-${zone.type}`} data-zone={zone.type} style={frame}>
              <div className="zone-inner">
                {zone.type === 'clock'
                  ? <ClockValue style={valueStyle} />
                  : <TimerValue timer={timer} style={valueStyle} />}
              </div>
            </div>
          );
        }

        if (zone.type === 'playlist') {
          const cue = [songTitle, songSubtitle].filter(Boolean).join(' — ');
          return (
            <div key={key} className="zone zone-playlist" data-zone="playlist" style={frame}>
              <div className="zone-inner">
                <div
                  className="zone-cue"
                  style={{ fontSize: px(zone.fontSize || 16), color: resolveColor(zone.color || 'accent', theme) }}
                >
                  {cue}
                </div>
              </div>
            </div>
          );
        }

        if (zone.type === 'messages') {
          const shown = messages.slice(-MAX_MESSAGES);
          return (
            <div
              key={key}
              className="zone zone-messages"
              data-zone="messages"
              // The zone carries its own red block, so an empty one has to go
              // rather than sit on the layout as a coloured rectangle.
              style={{ ...frame, display: shown.length > 0 ? 'flex' : 'none' }}
            >
              <div className="zone-inner">
                {shown.map((message) => (
                  <div key={message.id} className="stage-message">{message.text}</div>
                ))}
              </div>
            </div>
          );
        }

        return (
          <div key={key} className={`zone zone-${zone.type}`} data-zone={zone.type} style={frame}>
            <div className="zone-inner">
              <div className="section-label">{zone.label || zone.type}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default StageZones;
