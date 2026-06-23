import type { nl } from "./nl";

// English copy. Typed as Record<keyof typeof nl, string> so the build breaks if
// a key is missing or extra — this is what prevents the NL/EN drift that left
// the old EN FAQ saying "€1,500" (now corrected to €999 below).
export const en: Record<keyof typeof nl, string> = {
  "splash.sub": "Websites for salons",

  "nav.process": "Process",
  "nav.pricing": "Pricing",
  "nav.about": "About",
  "nav.contact": "Contact",

  "hero.h1": "Your business deserves more than just a booking link.",
  "hero.sub":
    "We build stylish custom websites for salons and local businesses — so you radiate the same quality online as in your salon.",
  "hero.cta1": "Request your website proposal",
  "hero.cta2": "View our process",

  "problem.eyebrow": "Why your own website",
  "problem.h2":
    'A booking page helps customers book. A website helps customers <em style="font-style:italic">choose.</em>',
  "problem.p1":
    "On platforms like Treatwell or Fresha, you're listed next to dozens of other salons. There's little room for your own atmosphere, story or style.",
  "problem.p2":
    "With your own website, you show who you are — before anyone clicks book.",

  "compare.platform.title": "Booking platform",
  "compare.platform.1": "Listed next to competitors",
  "compare.platform.2": "Little room for your brand",
  "compare.platform.3": "Your story stays in the background",
  "compare.revivo.title": "Own website via Revivo",
  "compare.revivo.1": "Your brand front and centre — your vibe, your story",
  "compare.revivo.2": "Photos, services and reviews in one place",
  "compare.revivo.3": "Customers book via your existing system",

  "voorwie.eyebrow": "Who we work with",
  "voorwie.h2": "For business owners proud of what they've built.",
  "voorwie.p":
    "You built your business. We make sure people feel that online too.",

  "features.eyebrow": "What you get",
  "features.h2": "Everything you need.",
  "feat.1.title": "Custom design",
  "feat.1.desc": "A website that matches your business and style.",
  "feat.2.title": "Mobile-first",
  "feat.2.desc": "Strong on phone, tablet and desktop.",
  "feat.3.title": "Online bookings",
  "feat.3.desc": "Connected to your existing booking system.",
  "feat.4.title": "SEO & speed",
  "feat.4.desc":
    "Built blazing-fast with modern tech, so Google finds you with ease.",
  "feat.5.title": "Google Maps",
  "feat.5.desc": "Visitors easily find how to reach you.",
  "feat.6.title": "Live quickly",
  "feat.6.desc": "No lengthy processes.",

  "ww.eyebrow": "Our process",
  "ww.h2": 'From introduction <em style="font-style:italic">to live.</em>',
  "ww.sub":
    "We deliver a concrete design before the collaboration even starts — so you know exactly what you're getting.",
  "ww.1.title": "Introduction",
  "ww.1.desc":
    "We get to know your business — style, audience and booking system. We use that to create an initial design right away.",
  "ww.2.title": "Custom design",
  "ww.2.desc":
    "You immediately see what the website looks like for your business. Fully tailored to your atmosphere and style.",
  "ww.3.title": "Feedback & refinement",
  "ww.3.desc":
    "Want something different? We adjust it. You have the final say until you're truly happy.",
  "ww.4.title": "Live",
  "ww.4.desc":
    "The website goes online. Customers find you, read your story and book via your existing system.",

  "inv.eyebrow": "Pricing",
  "inv.h2": "Clear and fairly priced.",
  "inv.p1":
    "A professional website at an agency quickly costs €5,000 to €10,000. That's not realistic for most local businesses.",
  "inv.p2":
    "We keep it simple: one fixed price, no subscription, no hidden costs.",
  "price.label": "Custom website",
  "price.note": "One-time · No subscription · No hidden costs",
  "price.inc.1": "Custom design",
  "price.inc.2": "Mobile-first version",
  "price.inc.3": "Connected to your booking system",
  "price.inc.4": "Contact form & Google Maps",
  "price.inc.5": "SEO & secure setup",
  "price.inc.6": "Revision round after first delivery",
  "price.opt.title": "Optionally add",
  "price.opt.1": "Hosting & technical management",
  "price.opt.2": "Extra pages or integrations",
  "price.opt.3": "Ongoing maintenance or support",

  "about.eyebrow": "Who we are",
  "about.h2": 'Two friends. <em style="font-style:italic">One passion.</em>',
  "about.p1":
    "Revivo Studios started from a simple idea: many local businesses have a beautiful salon, but that's not always visible online.",
  "about.p2":
    "We love great design and moving fast. Personal, hands-on and with attention to your business.",
  "about.cta": "Get in touch",

  "team.eyebrow": "The team",
  "team.sub": "Two friends putting your business on the map online.",
  "team.role": "Co-founder",
  "team.nelson.desc":
    "Focuses on connecting with salons and makes sure every design already feels like a real, personal proposal.",
  "team.berend.desc":
    "Builds the technology — blazing fast, mobile-friendly and fully custom.",

  "faq.eyebrow": "Frequently asked questions",
  "faq.h2": "Everything you want to know.",
  "faq.1.q": "Can I keep using my current booking system?",
  "faq.1.a":
    "Yes. We connect your website to your existing system — Treatwell, Fresha, Salonized or any other. Your customers keep booking as they're used to, but through a much more attractive experience.",
  "faq.2.q": "Is the website really custom-made?",
  "faq.2.a":
    "Yes. No standard look. Everything is tailored to your business, atmosphere and target audience.",
  "faq.3.q": "What if I want to change the design?",
  "faq.3.a":
    "That's exactly the point. We deliver a first design and adjust it to your wishes — until you're truly happy.",
  "faq.4.q": "Does the website work well on mobile?",
  "faq.4.a":
    "Yes, we build mobile-first. Most customers search and book via their phone.",
  "faq.5.q": "Can you also handle hosting?",
  "faq.5.a":
    "Yes. We take care of the domain and hosting for you — so you don't have to worry about it.",
  "faq.6.q": "What does it cost and how quickly will it be ready?",
  "faq.6.a":
    "€999 one-time. No subscription, no hidden costs. Once all input is complete, your website is ready quickly.",

  "contact.eyebrow": "Contact",
  "contact.h2": "Ready to be more visible online?",
  "contact.p":
    "Tell us briefly about your business. We'll get in touch and explore the possibilities, no strings attached.",
  "contact.email.label": "Email",

  "form.naam": "Name",
  "form.bedrijf": "Business name",
  "form.email": "Email address",
  "form.telefoon": "Phone number",
  "form.tool": "Which booking tool do you use?",
  "form.bericht": "How can we help you?",
  "form.placeholder": "Tell us briefly about your business...",
  "form.submit": "Send request",
  "form.select": "Select...",
  "form.other": "Other / none",
  "form.success.h": "Request received.",
  "form.success.p": "Thank you! We'll get in touch as soon as possible.",

  "footer.tagline": "Your business deserves a place to be proud of.",
  "footer.voor": "For salons",
};
