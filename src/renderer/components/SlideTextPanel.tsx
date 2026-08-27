import type { CSSProperties } from 'react';
import { editableTextShapes, shapeFullText } from '../slide-engine/edit/text';
import type { ParsedShape } from '../slide-engine/parser/slide-parser';
import { useI18n } from '../../i18n/useI18n';

export interface SlideTextPanelProps {
  shapes: ParsedShape[];
  onEdit: (shape: ParsedShape, value: string) => void;
}

export function SlideTextPanel({ shapes, onEdit }: SlideTextPanelProps) {
  const { t } = useI18n();
  const boxes = editableTextShapes(shapes);

  if (boxes.length === 0) {
    return <div style={styles.sectionEmpty}>{t('slideEditor.textPanel.empty')}</div>;
  }

  return (
    <div style={styles.section}>
      <div style={styles.panelHead}>
        {boxes.length === 1
          ? t('slideEditor.textPanel.count', { count: boxes.length })
          : t('slideEditor.textPanel.countPlural', { count: boxes.length })}
      </div>
      {boxes.map((shape, i) => {
        const label = shape.paragraphs[0].map((r) => r.text).join('').trim().slice(0, 28) || t('slideEditor.textPanel.textBoxN', { n: i + 1 });
        return (
          <label key={shape.id} style={styles.field}>
            <span style={styles.fieldLabel}>{label}</span>
            <textarea
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
