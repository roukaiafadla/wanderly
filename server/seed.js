'use strict';

const db = require('./db');

const destinations = [
  {
    slug: 'ghardaia-algeria',
    name: 'Ghardaïa',
    country: 'Algeria',
    price_from: 310,
    rating: 4.7,
    review_count: 132,
    tags: ['Culture', 'Desert', 'Heritage'],
    image: '/images/destinations/ghardaia.jpg',
    blurb: 'A UNESCO-listed oasis town of pink-beige kasbahs in the M\u2019zab Valley, where five fortified ksour rise straight out of the Sahara.',
    featured: 1,
    sort_order: 1
  },
  {
    slug: 'kyoto-japan',
    name: 'Kyoto',
    country: 'Japan',
    price_from: 990,
    rating: 4.9,
    review_count: 401,
    tags: ['Culture', 'Nature', 'Tranquility'],
    image: '/images/destinations/kyoto.jpg',
    blurb: 'Japan\u2019s former imperial capital, home to over a thousand temples, quiet bamboo groves and geisha-era streets.',
    featured: 1,
    sort_order: 2
  },
  {
    slug: 'santorini-greece',
    name: 'Santorini',
    country: 'Greece',
    price_from: 880,
    rating: 4.8,
    review_count: 512,
    tags: ['Views', 'Island', 'Romance'],
    image: '/images/destinations/santorini.jpg',
    blurb: 'Whitewashed cliffside villages over a sunken volcanic caldera, famous for its sunsets over the Aegean.',
    featured: 1,
    sort_order: 3
  },
  {
    slug: 'bali-indonesia',
    name: 'Bali',
    country: 'Indonesia',
    price_from: 740,
    rating: 4.9,
    review_count: 674,
    tags: ['Wellness', 'Nature', 'Adventure'],
    image: '/images/destinations/bali.jpg',
    blurb: 'Terraced rice paddies, jungle waterfalls and temple ceremonies on Indonesia\u2019s Island of the Gods.',
    featured: 1,
    sort_order: 4
  },
  {
    slug: 'marrakech-morocco',
    name: 'Marrakech',
    country: 'Morocco',
    price_from: 420,
    rating: 4.6,
    review_count: 288,
    tags: ['Culture', 'Markets', 'Heritage'],
    image: '/images/destinations/marrakech.jpg',
    blurb: 'Maze-like souks, riad courtyards and the Atlas Mountains on the horizon.',
    featured: 0,
    sort_order: 5
  },
  {
    slug: 'reykjavik-iceland',
    name: 'Reykjav\u00edk',
    country: 'Iceland',
    price_from: 1150,
    rating: 4.8,
    review_count: 219,
    tags: ['Nature', 'Adventure', 'Northern Lights'],
    image: '/images/destinations/reykjavik.jpg',
    blurb: 'Glaciers, geysers and the aurora, all within a short drive of the capital.',
    featured: 0,
    sort_order: 6
  },
  {
    slug: 'queenstown-new-zealand',
    name: 'Queenstown',
    country: 'New Zealand',
    price_from: 1290,
    rating: 4.9,
    review_count: 176,
    tags: ['Adventure', 'Nature', 'Views'],
    image: '/images/destinations/queenstown.jpg',
    blurb: 'The adventure capital of the world, ringed by the Remarkables and Lake Wakatipu.',
    featured: 0,
    sort_order: 7
  },
  {
    slug: 'lisbon-portugal',
    name: 'Lisbon',
    country: 'Portugal',
    price_from: 560,
    rating: 4.7,
    review_count: 344,
    tags: ['Culture', 'Coastal', 'Food'],
    image: '/images/destinations/lisbon.jpg',
    blurb: 'Pastel tram lines, fado music and pastel de nata on every corner.',
    featured: 0,
    sort_order: 8
  }
];

const testimonials = [
  {
    name: 'Youcef Badi',
    quote: 'Exploring Algeria with local guides was the best decision ever. Thanks, Wanderly!',
    avatar: '/images/testimonials/youcef.jpg',
    trip: 'Ghardaïa, Algeria',
    rating: 5,
    sort_order: 1
  },
  {
    name: 'Roukaia Fad',
    quote: 'Wanderly made my honeymoon unforgettable! Everything was seamless and so personal.',
    avatar: '/images/testimonials/roukaia.jpg',
    trip: 'Santorini, Greece',
    rating: 5,
    sort_order: 2
  },
  {
    name: 'Mohamed Abd',
    quote: 'Wanderly made my honeymoon unforgettable! Everything was seamless and so personal.',
    avatar: '/images/testimonials/mohamed.jpg',
    trip: 'Bali, Indonesia',
    rating: 5,
    sort_order: 3
  }
];

const insertDestination = db.prepare(`
  INSERT INTO destinations (slug, name, country, price_from, rating, review_count, tags, image, blurb, featured, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    name=excluded.name, country=excluded.country, price_from=excluded.price_from,
    rating=excluded.rating, review_count=excluded.review_count, tags=excluded.tags,
    image=excluded.image, blurb=excluded.blurb, featured=excluded.featured, sort_order=excluded.sort_order
`);

const insertTestimonial = db.prepare(`
  INSERT INTO testimonials (name, quote, avatar, trip, rating, sort_order)
  VALUES (?, ?, ?, ?, ?, ?)
`);

db.exec('BEGIN');
try {
  for (const d of destinations) {
    insertDestination.run(
      d.slug, d.name, d.country, d.price_from, d.rating, d.review_count,
      JSON.stringify(d.tags), d.image, d.blurb, d.featured, d.sort_order
    );
  }

  const existingTestimonials = db.prepare('SELECT COUNT(*) AS c FROM testimonials').get();
  if (existingTestimonials.c === 0) {
    for (const t of testimonials) {
      insertTestimonial.run(t.name, t.quote, t.avatar, t.trip, t.rating, t.sort_order);
    }
  }
  db.exec('COMMIT');
  console.log(`Seeded ${destinations.length} destinations and testimonials.`);
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}
