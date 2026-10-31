const paths = {
  star: '<path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2Z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  river: '<path d="M3 7c2-2 4 2 6 0s4 2 6 0 4 2 6 0M3 12c2-2 4 2 6 0s4 2 6 0 4 2 6 0M3 17c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/>',
  tree: '<path d="M12 21v-6M6 15l6-11 6 11H6ZM8 10l4-7 4 7"/>',
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m15.7 8.3-2 5.4-5.4 2 2-5.4 5.4-2Z"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
  book: '<path d="M4 4.5C7.2 3.5 9.7 4 12 6c2.3-2 4.8-2.5 8-1.5V19c-3.2-1-5.7-.5-8 1.5-2.3-2-4.8-2.5-8-1.5V4.5Z"/><path d="M12 6v14"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="m19 12 2-1-1-3-2.2.1-1.4-1.4L16.5 4l-3-1-1 2-2-.1-1-2-3 1 .1 2.2L5.2 7.6 3 7.5l-1 3 2 1v2l-2 1 1 3 2.2-.1 1.4 1.4L6.5 21l3 1 1-2h2l1 2 3-1-.1-2.2 1.4-1.4 2.2.1 1-3-2-1v-1.5Z"/>',
  fullscreen: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  exitfullscreen: '<path d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5"/>',
  sound:
    '<path d="M4 10v4h4l4 4V6l-4 4H4ZM16 9c1.5 1.5 1.5 4.5 0 6M19 6c3 3 3 9 0 12"/>',
  muted: '<path d="M4 10v4h4l4 4V6l-4 4H4ZM16 9l5 6M21 9l-5 6"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z"/><path d="M9 12l2 2 4-4"/>',
  sword:
    '<path d="m14 5 5-3 2 2-3 5-8 8-4-4 8-8ZM5 12l7 7M4 20l3-3M3 21l2-2"/>',
  dash: '<path d="M3 8h9M2 12h7M4 16h8M14 5l6 7-6 7M11 12h9"/>',
  hand: '<path d="M8 12V5a1.5 1.5 0 0 1 3 0v5-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v5c0 4-2.5 7-6.5 7H12c-2.3 0-3.5-1-4.8-3L4 14a1.5 1.5 0 0 1 2.2-2l1.8 2"/>',
  potion:
    '<path d="M9 3h6M10 3v5l-4 5v5a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-5l-4-5V3M7 15h10M12 12v6M9 15h6"/>',
  pulse:
    '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M4 12h15M14 7l5 5-5 5"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  crown: '<path d="m3 7 4 4 5-7 5 7 4-4-2 11H5L3 7ZM5 21h14"/>',
  leaf: '<path d="M20 4C12 3 5 6 5 14c0 3 2 5 5 5 8 0 11-7 10-15ZM5 19c2-3 5-6 10-9"/>',
  gem: '<path d="m5 4-3 5 10 12L22 9l-3-5H5ZM2 9h20M8 4l-1 5 5 12 5-12-1-5"/>',
  flag: '<path d="M5 21V4m0 1c5-3 8 3 14 0v9c-6 3-9-3-14 0"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/>',
  upload: '<path d="M12 16V4M8 8l4-4 4 4M4 17v3h16v-3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  heart:
    '<path d="M20 9c0 4-8 10-8 10S4 13 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1Z"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
};
export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.star}</svg>`;
}
