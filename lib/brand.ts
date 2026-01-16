/**
 * Single source of truth for Good Hemp Distros branding
 * Ensures consistent logo, colors, and metadata across the entire site
 */

export const brand = {
  // Company info
  name: "Good Hemp Distros",
  tagline: "Community-driven hemp marketplace",
  description: "Discover premium hemp products from verified vendors. Join our community.",
  
  // Logo
  logoPath: "/brand/goodhempdistrologo.png",
  logoWidth: 1536,
  logoHeight: 1024,
  logoAlt: "Good Hemp Distros Logo",
  
  // Color Palette (derived from logo)
  colors: {
    // Primary backgrounds
    bg: "#05080D",           // Near-black
    surface: "#0B1220",      // Card surface
    
    // Text
    text: "#EAF2FF",         // Primary text
    muted: "rgba(234, 242, 255, 0.7)", // Muted text
    
    // Brand colors (from logo)
    lime: "#66D11E",         // Primary green/lime
    limeSecondary: "#2F8F1A", // Deep green
    teal: "#1FA6A8",         // Teal accent
    orange: "#F2B233",       // Amber/gold accent
    
    // Utilities
    border: "rgba(255, 255, 255, 0.08)",
    borderLight: "rgba(255, 255, 255, 0.12)",
  },
  
  // Social/metadata
  url: "https://goodhempdistro.com",
  twitterHandle: "@goodhempdistro",
  ogImageWidth: 1200,
  ogImageHeight: 630,
} as const;

/**
 * Convenient color getters for CSS variable assignments
 */
export const colorVars = {
  "--bg": brand.colors.bg,
  "--surface": brand.colors.surface,
  "--text": brand.colors.text,
  "--muted": brand.colors.muted,
  "--brand-lime": brand.colors.lime,
  "--brand-lime-secondary": brand.colors.limeSecondary,
  "--brand-teal": brand.colors.teal,
  "--brand-orange": brand.colors.orange,
  "--border": brand.colors.border,
  "--border-light": brand.colors.borderLight,
} as const;
