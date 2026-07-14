/* Lullbrook — sound catalog. All audio assets from Moodist (MIT), see ATTRIBUTIONS.md. */

export const CATEGORIES = [
  { id: 'rain',      name: 'Rain',      icon: 'heavy-rain' },
  { id: 'water',     name: 'Water',     icon: 'waves' },
  { id: 'forest',    name: 'Forest',    icon: 'wind-in-trees' },
  { id: 'birds',     name: 'Birds',     icon: 'birds' },
  { id: 'fire',      name: 'Fire',      icon: 'campfire' },
  { id: 'wind',      name: 'Wind',      icon: 'wind' },
  { id: 'night',     name: 'Night',     icon: 'ui-moon' },
  { id: 'places',    name: 'Places',    icon: 'cafe' },
  { id: 'transport', name: 'Transport', icon: 'train' },
  { id: 'city',      name: 'City',      icon: 'busy-street' },
  { id: 'home',      name: 'Home',      icon: 'clock' },
  { id: 'noise',     name: 'Noise',     icon: 'white-noise' },
];

const S = (id, name, cat, ext = 'mp3', iconName = id) =>
  ({ id, name, cat, file: `sounds/${cat}/${id}.${ext}`, icon: iconName });

export const SOUNDS = [
  S('light-rain', 'Light Rain', 'rain'),
  S('heavy-rain', 'Heavy Rain', 'rain'),
  S('rain-on-window', 'Rain on Window', 'rain'),
  S('rain-on-tent', 'Rain on Tent', 'rain'),
  S('rain-on-leaves', 'Rain on Leaves', 'rain'),
  S('rain-on-umbrella', 'Rain on Umbrella', 'rain'),
  S('rain-on-car-roof', 'Rain on Car Roof', 'rain'),
  S('thunder', 'Distant Thunder', 'rain'),

  S('waves', 'Ocean Waves', 'water'),
  S('river', 'River', 'water'),
  S('waterfall', 'Waterfall', 'water'),
  S('droplets', 'Droplets', 'water'),
  S('underwater', 'Underwater', 'water'),

  S('jungle', 'Jungle', 'forest'),
  S('wind-in-trees', 'Wind in Trees', 'forest'),
  S('walk-on-leaves', 'Walk on Leaves', 'forest'),
  S('walk-in-snow', 'Walk in Snow', 'forest'),
  S('walk-on-gravel', 'Walk on Gravel', 'forest'),

  S('birds', 'Songbirds', 'birds'),
  S('seagulls', 'Seagulls', 'birds'),
  S('crows', 'Crows', 'birds'),
  S('woodpecker', 'Woodpecker', 'birds'),
  S('chickens', 'Chickens', 'birds'),

  S('campfire', 'Crackling Fire', 'fire'),

  S('wind', 'Soft Wind', 'wind'),
  S('howling-wind', 'Howling Wind', 'wind'),
  S('wind-chimes', 'Wind Chimes', 'wind'),

  S('crickets', 'Crickets', 'night'),
  S('frog', 'Frogs', 'night'),
  S('owl', 'Owl', 'night'),
  S('wolf', 'Distant Wolf', 'night'),
  S('night-village', 'Night Village', 'night'),

  S('cafe', 'Café', 'places'),
  S('library', 'Library', 'places'),
  S('office', 'Office', 'places'),
  S('restaurant', 'Restaurant', 'places'),
  S('church', 'Church', 'places'),
  S('temple', 'Temple', 'places'),
  S('airport', 'Airport', 'places'),
  S('subway-station', 'Subway Station', 'places'),
  S('supermarket', 'Supermarket', 'places'),
  S('crowded-bar', 'Crowded Bar', 'places'),

  S('train', 'Passing Train', 'transport'),
  S('inside-a-train', 'Inside a Train', 'transport'),
  S('airplane', 'Airplane Cabin', 'transport'),
  S('sailboat', 'Sailboat', 'transport'),
  S('rowing-boat', 'Rowing Boat', 'transport'),
  S('submarine', 'Submarine', 'transport'),

  S('busy-street', 'Busy Street', 'city'),
  S('traffic', 'Traffic', 'city'),
  S('highway', 'Highway', 'city'),
  S('crowd', 'Crowd', 'city'),

  S('clock', 'Ticking Clock', 'home'),
  S('keyboard', 'Keyboard', 'home'),
  S('typewriter', 'Typewriter', 'home'),
  S('paper', 'Turning Pages', 'home'),
  S('ceiling-fan', 'Ceiling Fan', 'home'),
  S('washing-machine', 'Washing Machine', 'home'),
  S('dryer', 'Dryer', 'home'),
  S('vinyl-effect', 'Vinyl Crackle', 'home'),
  S('tuning-radio', 'Tuning Radio', 'home'),
  S('singing-bowl', 'Singing Bowl', 'home'),

  S('white-noise', 'White Noise', 'noise', 'wav'),
  S('pink-noise', 'Pink Noise', 'noise', 'wav'),
  S('brown-noise', 'Brown Noise', 'noise', 'wav'),
];

export const SOUND_MAP = new Map(SOUNDS.map(s => [s.id, s]));

/* Built-in starting mixes; users can save their own on top. */
export const DEFAULT_PRESETS = [
  { name: 'Sleep', mix: { 'heavy-rain': 0.55, 'thunder': 0.22, 'wind': 0.3 } },
  { name: 'Focus', mix: { 'cafe': 0.5, 'light-rain': 0.42, 'brown-noise': 0.16 } },
  { name: 'Cabin Night', mix: { 'campfire': 0.6, 'crickets': 0.3, 'owl': 0.18, 'wind-in-trees': 0.25 } },
];
