/**
 * First-run content for the public website.
 * These rows are only inserted when the content table is empty, so editors can
 * safely replace every word and image from the admin console afterwards.
 */

const slide = (blockKey, eyebrow, title, body, image, imageAlt, primaryLabel, primaryHref, secondaryLabel, secondaryHref) => ({
  section: "hero",
  blockKey,
  subtitle: eyebrow,
  title,
  body,
  image,
  imageAlt,
  linkLabel: primaryLabel,
  linkHref: primaryHref,
  meta: { secondaryLabel, secondaryHref },
});

const heading = (blockKey, eyebrow, title, body, linkLabel = "", linkHref = "") => ({
  section: "heading",
  blockKey,
  title: eyebrow,
  subtitle: title,
  body,
  linkLabel,
  linkHref,
});

export const contentBlocks = [
  // ── Homepage headings ──────────────────────────────────────────────────
  heading("highlights", "This season's highlights", "Every celebration starts with the right venue", "Switch by occasion — the same private, quote-led discovery behind every option."),
  heading("about", "About us", "Luxury venue access shaped around your family", "Venue On My Plate brings private venue intelligence, high-touch shortlisting, and discreet proposal support for weddings and landmark celebrations that deserve more than a generic listing page."),
  heading("cities", "Destinations", "Explore destinations", "Udaipur, Jaipur, Goa and beyond — each circuit has its own season, scale and mood.", "View all", "/cities"),
  heading("categories", "Venue categories", "Venues only — picked for your occasion", "We provide the venue itself. Choose a category to browse palaces, resorts, banquets and destination venues."),
  heading("why", "Why we are better", "Why families trust us", "Exclusive pricing, private proposal support, and practical venue signals — compare more than photographs."),
  heading("steps", "How it works", "Your venue in 3 easy steps", ""),
  heading("gallery", "Events gallery", "Steal-worthy celebration inspiration", "Browse by mood, guest experience, and the level of occasion you want to create."),
  heading("films", "Films", "Celebrations in motion", "Haldi mornings, floral details and first looks — the moments venues are made for."),
  heading("testimonials", "Client testimonials", "Loved by families across India", "Families value a calmer way to compare ambience, hospitality, privacy, and the final proposal."),
  heading("journal", "Journal", "Ideas worth stealing", "", "View all blogs", "/blogs"),
  heading("support", "Support", "Get venues picked for you", "Two minutes now saves two weeks of calling venues. We reply within one business day — by call."),

  // ── Hero ───────────────────────────────────────────────────────────────
  {
    section: "hero",
    blockKey: "video",
    title: "/videos/hero-bg.mp4",
    subtitle: "",
    body: "",
    image: "https://images.pexels.com/photos/38951530/pexels-photo-38951530.jpeg?auto=compress&cs=tinysrgb&w=1600",
    imageAlt: "Wedding venue highlights video",
    meta: {},
  },
  slide("slide-1", "Venue On My Plate", "A venue as unforgettable as your love story.", "Palaces, lakefront estates and private resorts — curated for families who expect every detail to feel considered.", "https://images.pexels.com/photos/38951530/pexels-photo-38951530.jpeg?auto=compress&cs=tinysrgb&w=1600", "White floral wedding stage on a green lawn", "Explore venues", "/venues", "Get a private quote", "/contact"),
  slide("slide-2", "Udaipur · Jaipur · Goa", "Destination weddings without the drama.", "From City Palace sunsets to barefoot luxury in Goa — compare ambience, privacy, rooms and service fit before you visit.", "/images/udaipur-city.jpg", "Lake Palace in Udaipur", "View destinations", "/cities", "Get a private quote", "/contact"),
  slide("slide-3", "Shortlist in a day", "Your dream shortlist, in one day flat.", "Share your city, date, guest count and mood. Receive a bespoke shortlist with private quote-led options in one business day.", "https://images.pexels.com/photos/32854443/pexels-photo-32854443.jpeg?auto=compress&cs=tinysrgb&w=1600", "White draped wedding mandap with crystal chandelier", "How it works", "#how-it-works", "Talk to an expert", "/contact"),

  // ── Ticker ─────────────────────────────────────────────────────────────
  ...["Udaipur", "Jaipur", "Goa", "Delhi NCR", "Mumbai", "Weddings", "Sangeet", "Haldi", "Receptions", "Corporate"].map((title) => ({
    section: "ticker",
    title,
    subtitle: "",
    body: "",
    meta: {},
  })),

  // ── About ──────────────────────────────────────────────────────────────
  {
    section: "about",
    blockKey: "about-main",
    title: "Luxury venue access shaped around your family",
    subtitle: "About us",
    body: "Venue On My Plate brings private venue intelligence, high-touch shortlisting, and discreet proposal support for weddings and landmark celebrations that deserve more than a generic listing page.",
    image: "https://images.pexels.com/photos/35985196/pexels-photo-35985196.jpeg?auto=compress&cs=tinysrgb&w=1100",
    imageAlt: "Bright white wedding reception tablescape",
    linkLabel: "More about us",
    linkHref: "/about",
    meta: {
      phone: "+91 94624 60555",
      badge: "Private, quote-led shortlists",
      stats: [
        { value: "Venue-only", label: "No decor or catering commissions" },
        { value: "Human", label: "Assisted follow-up" },
        { value: "Private", label: "Quote-led proposals" },
      ],
    },
  },

  // ── Signature band ─────────────────────────────────────────────────────
  {
    section: "film",
    blockKey: "signature-band",
    title: "Drapes, blooms and morning light.",
    subtitle: "Signature stages",
    body: "",
    image: "https://videos.pexels.com/video-files/20697239/20697239-hd_1280_720_25fps.mp4",
    imageAlt: "Wedding stage details",
    linkLabel: "Explore venues",
    linkHref: "/venues",
    meta: { placement: "band" },
  },

  // ── Venue categories ───────────────────────────────────────────────────
  { section: "category", title: "Palaces & heritage", body: "Royal palaces and heritage properties for weddings and receptions.", icon: "castle", linkLabel: "Browse venues", linkHref: "/venues?event=Wedding", meta: {} },
  { section: "category", title: "Resorts & lawns", body: "Green resorts, farmhouses and open lawns for haldi, sangeet and pheras.", icon: "palm", linkLabel: "Browse venues", linkHref: "/venues", meta: {} },
  { section: "category", title: "Banquets & ballrooms", body: "Premium indoor halls for receptions, anniversaries and large guest lists.", icon: "landmark", linkLabel: "Browse venues", linkHref: "/venues", meta: {} },
  { section: "category", title: "Beach & destination", body: "Goa, Udaipur, Jaipur and beyond — venues worth travelling for.", icon: "tent", linkLabel: "Browse destinations", linkHref: "/cities", meta: {} },
  { section: "category", title: "Corporate venues", body: "Conferences, offsites and annual days with rooms, AV and banquets.", icon: "building", linkLabel: "Browse venues", linkHref: "/venues?event=Corporate event", meta: {} },
  { section: "category", title: "Private party venues", body: "Birthdays, anniversaries and intimate gatherings at verified venues.", icon: "users", linkLabel: "Browse venues", linkHref: "/venues?event=Birthday / Anniversary", meta: {} },

  // ── Why us ─────────────────────────────────────────────────────────────
  { section: "feature", title: "Exclusive pricing", body: "Get a private quote-led proposal shaped around date, guest count, rooms, menu preferences, and service level.", icon: "badge", linkLabel: "Learn more", linkHref: "/contact", meta: {} },
  { section: "feature", title: "Expert insights", body: "Compare venue flow, ceremony zones, guest arrival, privacy, hospitality depth, and visit questions before you go.", icon: "sparkles", linkLabel: "Learn more", linkHref: "/contact", meta: {} },
  { section: "feature", title: "Discreet follow-up", body: "Your enquiry stays request-led. Our team follows up by call to refine fit, options, and next steps.", icon: "phone", linkLabel: "Learn more", linkHref: "/contact", meta: {} },

  // ── Steps ──────────────────────────────────────────────────────────────
  { section: "step", subtitle: "01", title: "Share your celebration brief", body: "Tell us your event city, date, guest count, venue mood, room needs, food preferences, and family priorities.", meta: {} },
  { section: "step", subtitle: "02", title: "Receive a bespoke proposal", body: "Our team shortlists venues that match ambience, logistics, privacy, and hospitality expectations.", meta: {} },
  { section: "step", subtitle: "03", title: "Confirm next steps by call", body: "Plan visits, compare private quote options, and continue with a human-assisted enquiry.", meta: {} },

  // ── Gallery ────────────────────────────────────────────────────────────
  { section: "gallery", title: "Grand celebrations", image: "https://images.pexels.com/photos/35985256/pexels-photo-35985256.jpeg?auto=compress&cs=tinysrgb&w=900", imageAlt: "White floral decoration with golden table outdoors", meta: {} },
  { section: "gallery", title: "Palace weddings", image: "https://images.pexels.com/photos/38254676/pexels-photo-38254676.jpeg?auto=compress&cs=tinysrgb&w=900", imageAlt: "Cream wedding mandap with marigold hangings", meta: {} },
  { section: "gallery", title: "Floral tablescapes", image: "https://images.pexels.com/photos/32476128/pexels-photo-32476128.jpeg?auto=compress&cs=tinysrgb&w=900", imageAlt: "White floral bouquets on a wedding table", meta: {} },
  { section: "gallery", title: "Open-air mandaps", image: "https://images.pexels.com/photos/37828118/pexels-photo-37828118.jpeg?auto=compress&cs=tinysrgb&w=900", imageAlt: "White canopy mandap in daylight", meta: {} },

  // ── Films ──────────────────────────────────────────────────────────────
  { section: "film", title: "Haldi mornings", image: "https://videos.pexels.com/video-files/35067978/14854574_960_540_50fps.mp4", imageAlt: "Haldi morning celebration", meta: {} },
  { section: "film", title: "Floral details", image: "https://videos.pexels.com/video-files/35222217/14921664_960_540_50fps.mp4", imageAlt: "Floral wedding details", meta: {} },
  { section: "film", title: "First looks", image: "https://videos.pexels.com/video-files/34519848/14625946_960_540_24fps.mp4", imageAlt: "First look moment", meta: {} },
  { section: "film", title: "Aisle walks", image: "https://videos.pexels.com/video-files/27979648/12279918_960_540_25fps.mp4", imageAlt: "Aisle walk at a wedding", meta: {} },

  // ── FAQs ───────────────────────────────────────────────────────────────
  { section: "faq", title: "What does Venue On My Plate do?", body: "We help you discover venues and shortlist the right ones for your date, guest count and budget. Share your requirements once and our team responds with curated options and proposal assistance.", meta: {} },
  { section: "faq", title: "Is there a fee for your help?", body: "Discovery and shortlisting assistance is free for customers. Venues may share commercial terms directly with you before you confirm — nothing is booked without your written approval.", meta: {} },
  { section: "faq", title: "How fast will I hear back?", body: "Most enquiries receive a first response within one business day. During peak wedding season it can take slightly longer — include your event date so we can prioritise.", meta: {} },
  { section: "faq", title: "Can you help with destination weddings?", body: "Yes — Udaipur, Jaipur and Goa are our most requested circuits. We help sequence venues across functions (haldi, sangeet, wedding) and flag room and logistics constraints early.", meta: {} },
  { section: "faq", title: "Do you handle decor, catering or planning?", body: "No — we provide venues only. Venues may have in-house catering or preferred decor partners, and we flag those options during shortlisting, but you contract any additional vendors directly.", meta: {} },
  { section: "faq", title: "How early should we book our venue?", body: "For peak-season weekends (November–February), begin 9–12 months ahead — palace venues and lake-facing resorts sell out first. Off-season dates can often be arranged in 6–8 weeks with better negotiating room.", meta: {} },

  // ── SEO copy ───────────────────────────────────────────────────────────
  {
    section: "seo",
    blockKey: "home-seo",
    title: "Finding wedding and party venues in India, without the legwork.",
    body: "Venue On My Plate helps you discover venues for weddings, receptions, birthdays, corporate events and private celebrations across India — from heritage palaces in Udaipur and garden resorts in Jaipur to beach venues in Goa and banquet estates in Delhi NCR.\n\nWe focus only on venues — not decor, catering, or photography. Our team helps you compare venue flow, ceremony zones, guest movement, rooms and private quote options, so haldi mornings, sangeet evenings and the wedding day itself start from the right venue choice.\n\nStart by browsing all venues or pick a destination such as Udaipur, Jaipur or Goa. Want ideas first? The journal covers costs, seasonality and visit checklists.",
    meta: {},
  },

  // ── Footer CTA ─────────────────────────────────────────────────────────
  {
    section: "cta",
    blockKey: "partner-cta",
    title: "Are you a luxury venue partner?",
    body: "List your venue, showcase your signature spaces, and receive relevant enquiry leads from families planning premium celebrations.",
    linkLabel: "Join us",
    linkHref: "/partner",
    meta: { secondaryLabel: "Explore venues", secondaryHref: "/venues" },
  },
];
