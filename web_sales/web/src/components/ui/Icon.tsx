import React from 'react';

// مجموعة أيقونات خطية موحّدة (stroke 1.75) بدل الإيموجي، حتى يبدو كل شيء من نفس العائلة.
const paths = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
  ledger: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm0 14a2 2 0 0 1 2-2h13M9 7h6m-6 4h6',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H3',
  pie: 'M12 3a9 9 0 1 0 9 9h-9V3Zm3-.5A9 9 0 0 1 21.5 9H15V2.5Z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10',
  chevronDown: 'm6 9 6 6 6-6',
  chevronLeft: 'm15 6-6 6 6 6',
  sidebar: 'M4 5h16v14H4zM9 5v14',
  search: 'm20 20-4.2-4.2M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z',
  wallet: 'M4 7a2 2 0 0 1 2-2h12v4M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2Zm12 6h.01',
  trendUp: 'm3 17 6-6 4 4 8-8m0 0h-5m5 0v5',
  coins:
    'M12 7c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3Zm8-3v6c0 1.7-3.6 3-8 3s-8-1.3-8-3V4m16 6v6c0 1.7-3.6 3-8 3s-8-1.3-8-3v-6',
  tag: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Zm5-4h.01',
  scale: 'M12 3v18m-7 0h14M5 7h14M5 7l-3 7a3 3 0 0 0 6 0L5 7Zm14 0-3 7a3 3 0 0 0 6 0l-3-7Z',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2-8Z',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16m0-10h2a2 2 0 0 1 2 2v8M3 21h18M8 7h4m-4 4h4m-4 4h4',
  calendar: 'M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  percent: 'M19 5 5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  mail: 'M4 6h16v12H4zm0 0 8 7 8-7',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 1 1 8 0v4',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  filter: 'M4 5h16l-6 8v5l-4 2v-7L4 5Z',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  sparkle: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
} as const;

export type IconName = keyof typeof paths;

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const Icon: React.FC<IconProps> = ({ name, size = 18, className, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...rest}
  >
    <path d={paths[name]} />
  </svg>
);

export default Icon;
