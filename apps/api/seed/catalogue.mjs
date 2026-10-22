
/**
 * Editorial seed content: real destination guides, journal articles and FAQs.
 * Venue records are never invented here; they are created and published from
 * the admin console, so the public directory contains only real properties.
 */
// Real venue records are created and published from the admin console.
// No sample or placeholder venues are shipped with the product.
export const venues = [];

export const cities = [
  {
    slug: "udaipur",
    name: "Udaipur",
    tagline: "Lakes, palaces and golden-hour pheras.",
    description:
      "Udaipur remains India's most loved destination-wedding city — lake-facing palaces, heritage havelis and open courtyards that glow at sunset. Most large weddings here run across 2–3 days with separate venues for haldi, sangeet and pheras.",
    image:
      "/images/udaipur-city.jpg",
    imageAlt: "Lake Palace reflecting on Lake Pichola, Udaipur",
    venueCountLabel: "Curated venue selection",
    popularTypes: ["Heritage Palace", "Lakeside Lawns", "Heritage Haveli", "Resort"],
  },
  {
    slug: "jaipur",
    name: "Jaipur",
    tagline: "Rajput grandeur, an hour from Delhi.",
    description:
      "Jaipur pairs Rajput architecture with easy logistics — forts, garden resorts and city palaces that work for both intimate functions and 1000-guest baraats.",
    image:
      "/images/udaipur-palace2.jpg",
    imageAlt: "Amber Fort overlooking Jaipur",
    venueCountLabel: "Curated venue selection",
    popularTypes: ["Fort Venue", "Garden Resort", "City Palace", "Hotel"],
  },
  {
    slug: "goa",
    name: "Goa",
    tagline: "Barefoot luxury by the sea.",
    description:
      "Goa is for couples who want a relaxed, multi-day celebration — beach lawns, Portuguese villas and cliff-top resorts, best between October and March.",
    image:
      "/images/hero-poster.jpg",
    imageAlt: "Palm-lined beach in Goa",
    venueCountLabel: "Curated venue selection",
    popularTypes: ["Beach Resort", "Private Villa", "Cliff-top Lawn", "Hotel"],
  },
  {
    slug: "jaisalmer",
    name: "Jaisalmer",
    tagline: "Golden sandstone, desert forts and dune-side evenings.",
    description:
      "Jaisalmer pairs honey-coloured forts with desert resorts and open dune lawns. It suits winter weddings, intimate heritage stays and celebrations that want a dramatic golden-hour backdrop.",
    image: "/images/udaipur-palace2.jpg",
    imageAlt: "Golden sandstone fort and desert venue in Jaisalmer",
    venueCountLabel: "Curated venue selection",
    popularTypes: ["Fort Palace", "Desert Resort", "Heritage Haveli", "Luxury Camp"],
  },
  {
    slug: "jodhpur",
    name: "Jodhpur",
    tagline: "Blue-city rooftops beneath Mehrangarh.",
    description:
      "Jodhpur brings Mehrangarh views, blue-city rooftops and palace courtyards together. It is a strong choice for royal-themed weddings, mehendi lunches and intimate receptions.",
    image: "/images/udaipur-palace2.jpg",
    imageAlt: "Palace venue beneath Mehrangarh in Jodhpur",
    venueCountLabel: "Curated venue selection",
    popularTypes: ["Palace", "Heritage Haveli", "Courtyard Venue", "Resort"],
  },
  {
    slug: "sawai-madhopur",
    name: "Sawai Madhopur",
    tagline: "Jungle-edge resorts and royal Ranthambore.",
    description:
      "Sawai Madhopur combines Ranthambore wilderness with palace stays and nature-facing lawns. It works beautifully for multi-day celebrations where guests want a safari and a slower rhythm.",
    image: "/images/hero-poster.jpg",
    imageAlt: "Jungle resort and heritage venue near Ranthambore",
    venueCountLabel: "Curated venue selection",
    popularTypes: ["Jungle Resort", "Heritage Palace", "Nature Lawn", "Luxury Camp"],
  },
];

export const blogPosts = [
  {
    slug: "how-to-choose-wedding-venue-india",
    title: "How to choose a wedding venue in India (without regrets)",
    excerpt:
      "Capacity, seasonality, guest logistics and food — the four decisions that matter before you pay an advance.",
    category: "Venue selection",
    author: "Venue On My Plate Studio",
    publishedOn: "2026-08-14",
    readingMinutes: 8,
    image: "/images/wedding-decor.jpg",
    imageAlt: "Dressed wedding table with florals and candles",
    body: [
      "Start with your guest count and season, not with photographs. A venue that holds 1200 guests in December may be unusable for the same gathering in May.",
      "Visit with a checklist: power backup, kitchen placement, bridal changing rooms, parking for baraat movement, and noise cut-off timings. These five decide guest comfort more than decor does.",
      "Ask for two quotes — venue-only and venue-plus-catering — and confirm what the advance locks: dates, spaces, rooms and price validity. Get it in writing before you announce dates.",
    ],
  },
  {
    slug: "udaipur-destination-wedding-cost-guide",
    title: "Udaipur destination wedding: a practical cost guide",
    excerpt: "What a 2-day palace wedding actually involves — venues, rooms, logistics and where couples overspend.",
    category: "Destination weddings",
    author: "Venue On My Plate Studio",
    publishedOn: "2026-09-02",
    readingMinutes: 10,
    image:
      "/images/udaipur-palace2.jpg",
    imageAlt: "City Palace architecture in Udaipur",
    body: [
      "Udaipur weddings typically split across a welcome dinner, haldi/sangeet and the wedding day. Room inventory near Lake Pichola sells out first — lock rooms before you lock decor.",
      "The biggest cost surprises are guest transport, sound-and-light after 10 pm permissions, and vendor stay. Ask your venue for all three in writing.",
      "If your list is under 200 guests, consider a haveli or villa buyout instead of a palace — you get privacy at a calmer pace.",
    ],
  },
  {
    slug: "outdoor-vs-indoor-wedding-venue",
    title: "Outdoor vs indoor venue: making the right call",
    excerpt: "Weather risk, sound limits and guest comfort — how to decide between lawns and ballrooms.",
    category: "Planning",
    author: "Venue On My Plate Studio",
    publishedOn: "2026-07-20",
    readingMinutes: 6,
    image: "/images/indian-ceremony.jpg",
    imageAlt: "Wedding details captured in warm light",
    body: [
      "Outdoor venues photograph beautifully but carry weather and sound-curfew risk. Always ask for a wet-weather plan and the exact music cut-off time.",
      "Indoor venues control climate and timelines. For May–June and peak winter nights in the north, a pillarless hall with an attached lawn is the safest hybrid.",
      "Whatever you choose, walk the guest journey once — entry, seating, food counters, washrooms and exit — before signing.",
    ],
  },
];

export const generalFaqs = [
  {
    question: "What does Venue On My Plate do?",
    answer:
      "We help you discover venues and shortlist the right ones for your date, guest count and budget. Share your requirements once and our team responds with curated options and proposal assistance.",
  },
  {
    question: "Is there a fee for your help?",
    answer:
      "Discovery and shortlisting assistance is free for customers. Venues may share commercial terms directly with you before you confirm — nothing is booked without your written approval.",
  },
  {
    question: "How fast will I hear back?",
    answer:
      "Most enquiries receive a first response within one business day. During peak wedding season it can take slightly longer — include your event date so we can prioritise.",
  },
  {
    question: "Can you help with destination weddings?",
    answer:
      "Yes — Udaipur, Jaipur and Goa are our most requested circuits. We help sequence venues across functions (haldi, sangeet, wedding) and flag room and logistics constraints early.",
  },
  {
    question: "Do you handle decor, catering or planning?",
    answer:
      "No — we provide venues only. Venues may have in-house catering or preferred decor partners, and we flag those options during shortlisting, but you contract any additional vendors directly.",
  },
  {
    question: "How early should we book our venue?",
    answer:
      "For peak-season weekends (November–February), begin 9–12 months ahead — palace venues and lake-facing resorts sell out first. Off-season dates can often be arranged in 6–8 weeks with better negotiating room.",
  },
  {
    question: "Are there hidden costs beyond the quote?",
    answer:
      "No — every proposal we arrange itemises venue rental, catering, decor, sound-and-light, permissions and taxes separately. If a charge appears that was not in your written quote, we take it up with the venue before you pay.",
  },
  {
    question: "How do advance payments work?",
    answer:
      "A 20–30% advance typically locks your date, with the balance on milestones. We make sure your confirmation letter covers dates, spaces, rooms, price validity and postponement terms before any money moves.",
  },
  {
    question: "Can you negotiate better prices for us?",
    answer:
      "Yes — venues quote differently by date, occupancy and function mix. Share any quote you already have and we will benchmark it across 2–3 comparable venues and negotiate the inclusions, not just the headline number.",
  },
];

