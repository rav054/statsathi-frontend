// The stroke icons drawn for the redesign (24px grid, 2px strokes), so the shell matches the mockups exactly.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' };

export const HomeIcon = ({ className = 'h-[18px] w-[18px]' }) => (
  <svg {...base} className={className} aria-hidden="true"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></svg>
);
export const FolderIcon = ({ className = 'h-[18px] w-[18px]' }) => (
  <svg {...base} className={className} aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>
);
export const BookIcon = ({ className = 'h-[18px] w-[18px]' }) => (
  <svg {...base} className={className} aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z" /><path d="M4 19V5" /></svg>
);
export const SearchIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const UploadIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className} aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
);
export const PlusIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
);
export const DotsIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className} aria-hidden="true"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>
);
export const DatabaseIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className} aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>
);
export const DocumentIcon = ({ className = 'h-[22px] w-[22px]' }) => (
  <svg {...base} className={className} aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
);
export const ChevronRightIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className} aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
);
export const DownloadIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className} aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 20h16" /></svg>
);
export const ShareIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className} aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M19 8v6M16 11h6" /></svg>
);
export const CheckIcon = ({ className = 'h-4 w-4' }) => (
  <svg {...base} className={className} aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
);
