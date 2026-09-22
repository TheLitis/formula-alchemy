import type { CSSProperties } from 'react';
export type IconName = 'book' | 'flask' | 'journal' | 'save' | 'pause' | 'play' | 'plus' | 'trash' | 'reset' | 'volume' | 'muted' | 'music' | 'close' | 'help' | 'arrow' | 'sliders' | 'grid' | 'search' | 'download' | 'upload' | 'check' | 'chevron' | 'cursor' | 'settings';
const paths: Record<IconName, string> = {
    book: 'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5',
    flask: 'M9 3h6m-5 0v7l-6 9c-.5 1 .1 2 1 2h14c1 0 1.5-1 1-2l-6-9V3M7 15h10',
    journal: 'M6 3h14v18H6V3M3 7h5M3 12h5M3 17h5M11 8h5M11 12h5M11 16h3',
    save: 'M5 3h12l4 4v14H3V3h2M7 3v7h10V3M7 21v-7h10v7',
    pause: 'M8 5v14M16 5v14', play: 'M7 4l13 8-13 8V4', plus: 'M12 5v14M5 12h14', trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6', volume: 'M11 4L5 9H2v6h3l6 5V4M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
    muted: 'M11 4L5 9H2v6h3l6 5V4M16 9l6 6M22 9l-6 6', music: 'M9 18V5l12-2v13M9 9l12-2M9 18c0 4-6 4-6 1s6-3 6-1M21 16c0 4-6 4-6 1s6-3 6-1',
    close: 'M5 5l14 14M19 5L5 19', help: 'M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3M12 18v.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    arrow: 'M4 12h16M14 6l6 6-6 6', sliders: 'M4 6h5m4 0h7M4 12h11m4 0h1M4 18h2m4 0h10M9 3v6M15 9v6M6 15v6',
    grid: 'M4 4h16v16H4V4M4 12h16M12 4v16', search: 'M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16M16 16l6 6', download: 'M12 3v12M7 10l5 5 5-5M4 15v6h16v-6',
    upload: 'M12 16V4M7 9l5-5 5 5M4 15v6h16v-6', check: 'M4 12l5 5L20 6', chevron: 'M6 9l6 6 6-6', cursor: 'M5 3l14 10-7 1-4 7-3-18', settings: 'M3 6h18M3 12h18M3 18h18M8 3v6M16 9v6M10 15v6',
};
export function Icon({ name, size = 18, style }: {
    name: IconName;
    size?: number;
    style?: CSSProperties;
}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]}/></svg>; }
