const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');

// Fallback categories defined in data.js
const FALLBACK_CATEGORIES = [
  { slug: "video-editing", name: "Video Editing", icon: "clap", tone: "L" },
  { slug: "graphic-design", name: "Graphic Design", icon: "pen", tone: "B" },
  { slug: "content-writing", name: "Content Writing", icon: "wr", tone: "Y" },
  { slug: "web-development", name: "Web Development", icon: "code", tone: "L" },
  { slug: "photography", name: "Photography", icon: "cam", tone: "B" },
  { slug: "social-media", name: "Social Media", icon: "mega", tone: "Y" },
  { slug: "presentations", name: "Presentations", icon: "pres", tone: "L" },
  { slug: "coding", name: "Coding Help", icon: "term", tone: "B" },
  { slug: "ui-ux-design", name: "UI/UX & App Design", icon: "pen", tone: "L" },
  { slug: "tutoring-academics", name: "Tutoring & Academics", icon: "cap", tone: "Y" },
  { slug: "music-audio", name: "Music & Audio Production", icon: "spark", tone: "B" },
  { slug: "career-resume", name: "Resume & Career Prep", icon: "wr", tone: "L" },
  { slug: "event-coverage", name: "Event & Campus Coverage", icon: "cam", tone: "Y" },
  { slug: "ai-data-analytics", name: "AI & Data Analytics", icon: "code", tone: "B" }
];

/**
 * GET /api/categories
 * Returns all active service categories
 */
router.get('/', async (req, res) => {
  try {
    const categories = await query('SELECT slug, name, icon, tone FROM categories ORDER BY display_order ASC, id ASC');
    if (categories && categories.length > 0) {
      return res.json({ categories });
    }
    // If DB is connected but empty, return fallback
    return res.json({ categories: FALLBACK_CATEGORIES });
  } catch (err) {
    console.warn('Database error fetching categories, serving fallback:', err.message);
    return res.json({ categories: FALLBACK_CATEGORIES });
  }
});

module.exports = router;
