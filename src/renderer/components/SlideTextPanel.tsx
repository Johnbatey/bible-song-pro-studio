/* =========================================================================
   <SlideTextPanel> — every text box on an imported slide, as fields
   -------------------------------------------------------------------------
   One field per real text box — PowerPoint's own unit — never one per split
   run. Decorative custGeom art carries a throwaway txBody and is skipped, or a
   single illustration slide would list hundreds of empty fields.

   The canvas is directly editable too; this is the same text reached from the
   inspector, for boxes that are small, overlapped or off to the edge.
   ========================================================================= */
import type { CSSProperties } from 'react';
import { editableTextShapes, shapeFullText } from '../slide-engine/edit/text';
import type { ParsedShape } from '../slide-engine/parser/slide-parser';

export interface SlideTextPanelProps {
  shapes: ParsedShape[];
  onEdit: (shape: ParsedShape, value: string) => void;
}

export function SlideTextPanel({ shapes, onEdit }: SlideTextPanelProps) {
  const boxes = editableTextShapes(shapes);

  if (boxes.length === 0) {
    return <div style={styles.sectionEmpty}>No editable text on this slide.</div>;
  }

  return (
    <div style={styles.section}>
      <div style={styles.panelHead}>
        {boxes.length} text box{boxes.length === 1 ? '' : 'es'}
      </div>
      {boxes.map((shape, i) => {
        const label = shape.paragraphs[0].map((r) => r.text).join('').trim().slice(0, 28) || `Text box ${i + 1}`;
        return (
          <label key={shape.id} style={styles.field}>
            <span style={styles.fieldLabel}>{label}</span>
            <textarea
              /* Controlled, so editing a run on the canvas is reflected here
                 too. Uncontrolled would go stale, and the next keystroke in
                 this field would then write the old text back over the canvas
                 edit. onEdit writes through synchronously and bumps the
                 revision, so the value is always what the box actually says. */
              value={shapeFullText(shape)}
              rows={Math.min(4, shape.paragraphs.length)}
              onChange={(e) => onEdit(shape, e.target.value)}
              style={styles.textarea}
              spellCheck={false}
            />
          </label>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionEmpty: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  panelHead: {
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    background: '#16191f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 5,
    color: '#fff',
    fontSize: 12,
    fontFamily: 'inherit',
    padding: '6px 8px',
    outline: 'none',
  },
};

export default SlideTextPanel;
