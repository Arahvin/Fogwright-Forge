// Species glyphs: 48x48 line drawings, stroke only (colour from CSS, .glyph.sp-<id>).
window.SPECIES_ICONS = {
  // Human: plain head, calm eyes, straight mouth, shoulders
  humans: `<ellipse cx="24" cy="20" rx="9.5" ry="11.5"/><path d="M14.5 19.5c-2 0-2.6 4.5.3 5.4M33.5 19.5c2 0 2.6 4.5-.3 5.4"/><path d="M19.5 18.5h3M25.5 18.5h3"/><path d="M24 20v4.2h1.5"/><path d="M21.5 27.5h5"/><path d="M15 15c3-1 5.5-3.5 6.5-6.5 2 3 6 5 11.5 5.5"/><path d="M10 45c0-6 6-10 14-10s14 4 14 10"/>`,
  // Grafted: half flesh, half machine plate with a lens eye and rivets
  grafted: `<path d="M24 8.5c-5.5 0-9.5 4.5-9.5 11.5s4 13.5 9.5 13.5"/><path d="M24 8.5h7.5l3 4v13l-3 5.5L24 33.5z"/><path d="M24 8.5v25"/><path d="M18 19.5h3"/><circle cx="29" cy="19.5" r="2.6"/><circle cx="29" cy="19.5" r=".6"/><path d="M20 27.5h4M24 27.5h4.5"/><path d="M31.5 26.5v-2M27 13h4"/><circle cx="33" cy="16" r=".5"/><path d="M10 45c0-6 6-10 14-10s14 4 14 10"/><path d="M24 35v10M29 36.5v8.5"/>`,
  // Warbred: heavy brow, broad jaw, tusks, scar
  warbred: `<path d="M14 15.5c0-5 4.5-8 10-8s10 3 10 8v6c0 7-4.5 12-10 12s-10-5-10-12z"/><path d="M16.5 17.5l5.5 1.5M31.5 17.5L26 19"/><path d="M19 21.5h2.5M26.5 21.5H29"/><path d="M22.5 24.5l1.5 1 1.5-1"/><path d="M19.5 28.5c3 1 6 1 9 0"/><path d="M19.8 28.6c-.9-1.2-1.1-2.6-.6-4M28.2 28.6c.9-1.2 1.1-2.6.6-4"/><path d="M29 10l2.5 6"/><path d="M9 45c0-6 7-10.5 15-10.5S39 39 39 45"/>`,
  // Firstborn: slender face, small rounded ears, wide unblinking eyes, long hair
  firstborn: `<path d="M24 7.5c-5 0-8 4.5-8 10.5 0 8 4 15 8 15s8-7 8-15c0-6-3-10.5-8-10.5z"/><path d="M16 18.5c-1.6 0-1.8 3.4 0 3.6M32 18.5c1.6 0 1.8 3.4 0 3.6"/><circle cx="20.5" cy="19.5" r="1.8"/><circle cx="27.5" cy="19.5" r="1.8"/><path d="M24 22v3"/><path d="M22.5 28h3"/><path d="M16 15c-2.5 6-3 16-3 27M32 15c2.5 6 3 16 3 27"/><path d="M20 35.5c1 2 2.5 3 4 3s3-1 4-3"/><path d="M24 38.5V45"/>`,
  // Lightborn: calm face under a broken halo, light at the eyes
  lightborn: `<ellipse cx="24" cy="24" rx="8.5" ry="10.5"/><path d="M13.5 12.5a14 6 0 0 1 21 0"/><path d="M24 2.5v3.5M15 4.5l1.8 3M33 4.5l-1.8 3"/><path d="M19.5 22.5h3M25.5 22.5h3"/><path d="M21 19.8l-.8-1.3M27 19.8l.8-1.3"/><path d="M24 24.5v3"/><path d="M22 30.5h4"/><path d="M11 45c0-5.5 5.5-9.5 13-9.5s13 4 13 9.5"/><path d="M24 38v4"/>`,
  // Ashmaw: scaled reptile head in profile, ridge spines, breath gland at the throat
  ashmaw: `<path d="M17 12c-2 4-3 9-2 14 1 5 4 10 9 14 5-4 8-9 9-14 1-5 0-10-2-14"/><path d="M17 12C15 8 12 6 8 5.5c2.5 2 3.5 4.5 3.5 7.5M31 12c2-4 5-6 9-6.5-2.5 2-3.5 4.5-3.5 7.5"/><path d="M17 12c2-2 4.5-3 7-3s5 1 7 3"/><path d="M18.5 20l4 1.5M29.5 20l-4 1.5"/><path d="M20 20.8v.4M28 20.8v.4"/><path d="M22 34.5h4M22.5 31.5l-.5 1M25.5 31.5l.5 1"/><path d="M21 13.5l3 2 3-2M22 16.5l2 1.3 2-1.3"/><path d="M24 40v5M19 37.5l-2 7.5M29 37.5l2 7.5"/>`,
  // Stonebound: broad head, braided beard, a mountain line on the brow
  stonebound: `<path d="M14 13.5c0-4 4.5-6.5 10-6.5s10 2.5 10 6.5v8H14z"/><path d="M18.5 12l3-3 2.5 2.5 2.5-2.5 3 3"/><path d="M18.5 17h3M26.5 17h3"/><path d="M24 17.5v3.5"/><path d="M14 21.5c0 6 2 9 4 11l2 6 4 4 4-4 2-6c2-2 4-5 4-11"/><path d="M20 23.5h8"/><path d="M24 26v14M21 30l3 2 3-2M21 34.5l3 2 3-2"/><path d="M9 45c.5-4 2.5-7 5.5-8.5M39 45c-.5-4-2.5-7-5.5-8.5"/>`,
  // Tinkerfolk: small round face, large ears, goggles pushed up on the brow
  tinkerfolk: `<circle cx="24" cy="25" r="9.5"/><path d="M15 23l-5.5-4.5 1 7.5 4.5 1.5M33 23l5.5-4.5-1 7.5-4.5 1.5"/><path d="M14.8 19h18.4"/><circle cx="20" cy="17.5" r="3"/><circle cx="28" cy="17.5" r="3"/><path d="M23 17.5h2"/><path d="M20.5 25h2.5M25 25h2.5"/><path d="M24 27v2.5"/><path d="M22.5 31.5h3"/><path d="M14 45c0-5 4.5-8.5 10-8.5s10 3.5 10 8.5"/><path d="M19.5 40.5l2 2M28.5 40.5l-2 2"/>`
};
