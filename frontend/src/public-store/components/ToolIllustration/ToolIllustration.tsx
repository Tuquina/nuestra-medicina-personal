import { useId, type JSX } from 'react';
import type { ToolSlug } from '../../../shared/cms/collectionContent';
import styles from './ToolIllustration.module.css';

interface ToolIllustrationProps {
  tool: ToolSlug;
  className?: string;
}

/**
 * Hand-drawn-style SVG scenes for the three Herramientas tools (an open
 * notebook, a window with soft light, a warm sunset). All colors come from
 * design tokens through the CSS Module, so they stay on-palette. Purely
 * decorative: the card/page title already says what the tool is.
 */
export function ToolIllustration({ tool, className }: ToolIllustrationProps) {
  // Gradient ids must be unique per instance and valid inside url(#…).
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const Scene = SCENES[tool];

  return (
    <svg
      className={[styles.svg, className].filter(Boolean).join(' ')}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <Scene uid={uid} />
    </svg>
  );
}

const SCENES: Record<ToolSlug, (props: { uid: string }) => JSX.Element> = {
  'escritura-diaria': NotebookScene,
  preguntas: WindowScene,
  'cierre-semanal': SunsetScene,
};

function NotebookScene({ uid }: { uid: string }) {
  const bg = `${uid}-notebook-bg`;
  return (
    <>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className={styles.stopCream} />
          <stop offset="100%" className={styles.stopSand} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${bg})`} />
      <circle cx="318" cy="64" r="64" className={styles.glow} />
      <circle cx="318" cy="64" r="30" className={styles.sunSoft} />

      <ellipse cx="200" cy="252" rx="160" ry="16" className={styles.shadow} />

      {/* Open notebook */}
      <path d="M52 108 Q128 88 198 114 L198 244 Q128 222 52 238 Z" className={styles.paper} />
      <path d="M202 114 Q272 88 348 108 L348 238 Q272 222 202 244 Z" className={styles.paper} />
      <rect x="194" y="112" width="12" height="134" rx="6" className={styles.spine} />
      {[136, 154, 172, 190, 208].map((y) => (
        <path key={`l-${y}`} d={`M72 ${y} Q128 ${y - 12} 184 ${y + 4}`} className={styles.ruled} />
      ))}
      {[136, 154, 172, 190, 208].map((y) => (
        <path key={`r-${y}`} d={`M216 ${y + 4} Q272 ${y - 12} 330 ${y}`} className={styles.ruled} />
      ))}
      <path
        d="M220 134 c8 -7 13 5 21 -1 s13 5 21 -1 s13 5 21 -1 M220 152 c8 -7 13 5 21 -1 s13 5 21 -1 M220 170 c8 -7 13 5 21 -1 s13 5 21 -1 s13 5 21 -1 s12 5 18 -1"
        className={styles.handwriting}
      />

      {/* Pencil */}
      <g transform="rotate(-28 262 214)">
        <rect x="200" y="208" width="104" height="12" rx="2" className={styles.pencil} />
        <rect x="292" y="208" width="14" height="12" className={styles.ferrule} />
        <path d="M200 208 L182 214 L200 220 Z" className={styles.pencilTip} />
        <path d="M182 214 L188 212 L188 216 Z" className={styles.lead} />
      </g>

      {/* Sprig */}
      <path d="M44 250 Q62 214 96 196" className={styles.stem} />
      <ellipse cx="62" cy="222" rx="11" ry="5" transform="rotate(-50 62 222)" className={styles.leaf} />
      <ellipse cx="76" cy="208" rx="11" ry="5" transform="rotate(-20 76 208)" className={styles.leafDeep} />
      <ellipse cx="88" cy="199" rx="10" ry="4.5" transform="rotate(-60 88 199)" className={styles.leaf} />
    </>
  );
}

function WindowScene({ uid }: { uid: string }) {
  const wall = `${uid}-window-wall`;
  const sky = `${uid}-window-sky`;
  const windowShape = 'M136 196 V112 A64 64 0 0 1 264 112 V196 Z';
  return (
    <>
      <defs>
        <linearGradient id={wall} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className={styles.stopSkySoft} />
          <stop offset="100%" className={styles.stopCream} />
        </linearGradient>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className={styles.stopSky} />
          <stop offset="70%" className={styles.stopSkyPale} />
          <stop offset="100%" className={styles.stopAmberLight} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${wall})`} />
      <rect y="250" width="400" height="50" className={styles.floor} />

      {/* Light falling through the window */}
      <path d="M140 196 L260 196 L352 300 L196 300 Z" className={styles.lightBeam} />

      <path d={windowShape} fill={`url(#${sky})`} />
      <circle cx="226" cy="122" r="16" className={styles.sunSoft} />
      <path d="M150 150 q10 -12 24 -6 q8 -10 22 -2 q12 0 12 10 h-58 z" className={styles.cloud} />
      <path d={windowShape} className={styles.windowFrame} />
      <path d="M200 50 V196 M136 136 H264" className={styles.mullion} />
      <rect x="122" y="194" width="156" height="10" rx="3" className={styles.sill} />

      {/* Plant on the sill */}
      <path d="M150 176 h26 l-4 18 h-18 z" className={styles.pot} />
      <ellipse cx="156" cy="166" rx="10" ry="5" transform="rotate(-40 156 166)" className={styles.leaf} />
      <ellipse cx="170" cy="164" rx="10" ry="5" transform="rotate(35 170 164)" className={styles.leafDeep} />
      <ellipse cx="163" cy="156" rx="9" ry="4.5" transform="rotate(-85 163 156)" className={styles.leaf} />

      {/* Specks of light */}
      {[
        [230, 232, 2.5],
        [262, 258, 2],
        [288, 238, 1.8],
        [244, 276, 2.2],
        [304, 280, 1.6],
      ].map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} className={styles.speck} />
      ))}
    </>
  );
}

function SunsetScene({ uid }: { uid: string }) {
  const sky = `${uid}-sunset-sky`;
  return (
    <>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className={styles.stopSkySoft} />
          <stop offset="45%" className={styles.stopRose} />
          <stop offset="100%" className={styles.stopAmberSoft} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${sky})`} />
      <circle cx="200" cy="192" r="92" className={styles.glow} />
      <circle cx="200" cy="192" r="46" className={styles.sun} />

      <ellipse cx="96" cy="78" rx="46" ry="9" className={styles.cloud} />
      <ellipse cx="304" cy="110" rx="56" ry="10" className={styles.cloud} />
      <path d="M118 104 q8 -8 16 0 q8 -8 16 0 M162 86 q6 -6 12 0 q6 -6 12 0" className={styles.birds} />

      <path d="M0 206 Q92 166 182 200 T400 190 V300 H0 Z" className={styles.hillBack} />
      <path d="M0 240 Q120 204 232 236 T400 228 V300 H0 Z" className={styles.hillFront} />
      <path d="M150 262 h100 M174 274 h52 M188 286 h24" className={styles.shimmer} />
    </>
  );
}
