import type { CSSProperties } from 'react';

const ICON: CSSProperties = {
  width: 12,
  height: 12,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function IconSave({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  );
}

export function IconImport({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconRefresh({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}

export function IconExport({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function IconTrash({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconFolder({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconMusic({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function IconSparkles({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z" />
    </svg>
  );
}

export function IconPencil({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function IconPlus({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconCopy({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconChevronUp({ size = 10 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

export function IconChevronDown({ size = 10 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconX({ size = 11 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconGrip({ size = 11 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconCheck({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ ...ICON, width: size, height: size }} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function LayerKindIcon({ kind, size = 12 }: { kind: string; size?: number }) {
  const s = { ...ICON, width: size, height: size };
  switch (kind) {
    case 'group':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
        </svg>
      );
    case 'text':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M4 7V4h16v3M9 20h6M12 4v16" />
        </svg>
      );
    case 'image':
    case 'imagefill':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      );
    case 'connector':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <line x1="5" y1="19" x2="19" y2="5" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="5" r="2" />
        </svg>
      );
    case 'table':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      );
    case 'pencil':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      );
    case 'bezier':
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <path d="M4 20c8-16 16-16 16-16" />
          <circle cx="4" cy="20" r="2" />
          <circle cx="20" cy="4" r="2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" style={s} aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      );
  }
}
