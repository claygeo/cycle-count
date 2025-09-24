// src/config/theme.js - Updated Mobile-First Theme with New Color Scheme
export const theme = {
  // Brand Identity
  brandName: 'Inventory Insights',
  tagline: 'Mobile-First Inventory Counting',
  
  // ✅ NEW: Dark Background with Light Green Accents
  colors: {
    primary: '#86EFAC',      // Light green (emerald-300)
    primaryDark: '#059669',  // Dark emerald (emerald-600)
    primaryLight: '#DCFCE7', // Very light green (emerald-100)
    secondary: '#64748B',    // Slate gray
    secondaryDark: '#334155', // Darker slate
    accent: '#86EFAC',       // Light green accent
    background: '#15161B',   // Very dark background
    surface: '#FFFFFF',      // White surfaces
    text: {
      primary: '#00001C',    // Very dark text
      secondary: '#64748B',  // Slate gray
      muted: '#94A3B8',      // Light slate
      onDark: '#FFFFFF'      // White text on dark backgrounds
    },
    status: {
      success: '#86EFAC',    // Light green
      warning: '#FDE047',    // Yellow (yellow-300)
      error: '#F87171',      // Red (red-400)
      info: '#60A5FA'        // Blue (blue-400)
    }
  },
  
  // Typography
  fonts: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace']
  },
  
  // Logo/Branding
  logo: {
    text: 'Inventory Insights',
    icon: 'I',
    favicon: '/favicon-inventory.ico'
  },
  
  // ✅ SIMPLIFIED: Core features only
  features: {
    mobileFirst: true,
    priorityCount: true,
    fullCount: true,
    barcodeScanning: true,
    multiLocation: true,
    auditTrail: true,
    stripePayments: true
  },

  // ✅ UPDATED: Pricing with Stripe integration
  plans: {
    trial: {
      name: 'Free Trial',
      price: '$0',
      duration: '14 days',
      stripeId: null,
      features: ['1 location', 'All count modes', 'Mobile app', 'Basic support'],
      description: 'Try before you buy',
      maxLocations: 1,
      locations: ['Primary Warehouse']
    },
    starter: {
      name: 'Professional',
      price: '$50',
      duration: 'per month',
      stripeId: process.env.REACT_APP_STRIPE_PRICE_ID || 'price_1234567890',
      features: ['1 location', 'Priority + Full count', 'Mobile app', 'Email support'],
      description: 'Perfect for single warehouse',
      maxLocations: 1,
      locations: ['Primary Warehouse']
    }
  }
};

// =====================================================
// ✅ SIMPLIFIED: AUTO-LOCATION SYSTEM 
// =====================================================

export const locationDefinitions = {
  'Primary Warehouse': {
    code: 'PRIMARY',
    name: 'Primary Warehouse',
    description: 'Main warehouse facility',
    icon: '🏢',
    requiredPlan: 'trial',
    dbField: 'primary_quantity',
    isDefault: true
  }
};

// Helper functions
export const getLocationByCode = (code) => {
  return Object.values(locationDefinitions).find(loc => loc.code === code);
};

export const getAvailableLocations = (planName) => {
  // For simplified version, everyone gets Primary Warehouse
  return [locationDefinitions['Primary Warehouse']];
};

export const getDefaultLocation = () => {
  return locationDefinitions['Primary Warehouse'];
};

// ✅ SIMPLIFIED: Database field mapping
export const quantityFieldMap = {
  'PRIMARY': 'primary_quantity'
};

// =====================================================
// ✅ NEW: DARK THEME MOBILE-FIRST STYLING SYSTEM
// =====================================================

// Tailwind-compatible classes for mobile-first design
export const mobileStyles = {
  // Touch targets (minimum 48px)
  touchTarget: 'min-h-[48px] min-w-[48px]',
  
  // Typography scale for mobile
  typography: {
    h1: 'text-xl md:text-2xl font-bold',
    h2: 'text-lg md:text-xl font-semibold',
    h3: 'text-base md:text-lg font-medium',
    body: 'text-sm md:text-base',
    caption: 'text-xs md:text-sm'
  },
  
  // Spacing system
  spacing: {
    xs: 'p-2',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8'
  },
  
  // Component variants with new color scheme
  buttons: {
    primary: 'bg-emerald-300 hover:bg-emerald-200 text-gray-900 font-medium px-6 py-3 rounded-lg transition-colors focus:ring-4 focus:ring-emerald-200',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-6 py-3 rounded-lg transition-colors',
    danger: 'bg-red-400 hover:bg-red-300 text-white font-medium px-6 py-3 rounded-lg transition-colors',
    ghost: 'text-emerald-300 hover:bg-emerald-900/20 font-medium px-4 py-2 rounded-lg transition-colors',
    dark: 'bg-gray-800 hover:bg-gray-700 text-white font-medium px-6 py-3 rounded-lg transition-colors'
  },
  
  inputs: {
    base: 'w-full px-4 py-3 bg-emerald-300 border-2 border-emerald-400 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-gray-900 placeholder-gray-600',
    error: 'border-red-400 focus:ring-red-500 focus:border-red-500 bg-red-100',
    success: 'border-emerald-400 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-100'
  },
  
  cards: {
    base: 'bg-white rounded-xl shadow-sm border border-gray-200',
    elevated: 'bg-white rounded-xl shadow-md border border-gray-200',
    interactive: 'bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer',
    dark: 'bg-gray-800 rounded-xl shadow-sm border border-gray-700 text-white'
  },
  
  status: {
    success: 'bg-emerald-100 border-emerald-300 text-emerald-800',
    error: 'bg-red-100 border-red-300 text-red-800',
    warning: 'bg-yellow-100 border-yellow-300 text-yellow-800',
    info: 'bg-blue-100 border-blue-300 text-blue-800'
  },

  // New background gradients
  backgrounds: {
    main: 'min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-900',
    card: 'bg-white',
    dark: 'bg-gray-900'
  }
};

// =====================================================
// ✅ SIMPLIFIED: COUNT MODE CONFIGURATION
// =====================================================

export const countModes = {
  priority: {
    id: 'priority',
    name: 'Priority Count',
    description: 'Count high-volume items only',
    icon: '📊',
    color: 'blue',
    frequency: 'Daily/Weekly',
    filterHighVolume: true
  },
  full: {
    id: 'full',
    name: 'Full Count',
    description: 'Count all items in location',
    icon: '📋',
    color: 'emerald',
    frequency: 'Monthly',
    filterHighVolume: false
  }
};

// =====================================================
// ✅ STRIPE CONFIGURATION
// =====================================================

export const stripeConfig = {
  publishableKey: 'pk_live_51RcVoJE2IXtRuHSiffHSbxRTUmaRGo2JdLSEOqgKb32HW0RynZavu73bogDvS89QmtxHMdULA2hvcJoDxOJqbW2J00Gx7TWDsp',
  priceId: process.env.REACT_APP_STRIPE_PRICE_ID || 'price_professional_monthly',
  successUrl: `${window.location.origin}/payment-success`,
  cancelUrl: `${window.location.origin}/payment-cancelled`,
  trialDays: 14,
  monthlyPrice: 5000, // $50.00 in cents
  currency: 'usd'
};

// =====================================================
// ✅ USER FLOW CONFIGURATION
// =====================================================

export const userFlows = {
  // Skip location selection for basic users
  skipLocationSelection: (user) => {
    return user?.plan === 'trial' || user?.plan === 'starter';
  },
  
  // Auto-assign default location
  getAutoLocation: (user) => {
    if (userFlows.skipLocationSelection(user)) {
      return getDefaultLocation().code;
    }
    return null;
  },
  
  // Check if payment is required
  requiresPayment: (user) => {
    return !user?.subscriptionStatus || 
           !['trial', 'active'].includes(user.subscriptionStatus);
  }
};

// =====================================================
// ✅ VALIDATION HELPERS
// =====================================================

export const isValidLocationCode = (code) => {
  return Object.keys(quantityFieldMap).includes(code);
};

export const getValidLocationCodes = () => {
  return Object.keys(quantityFieldMap);
};

export const getLocationDisplayName = (code) => {
  const location = getLocationByCode(code);
  return location?.name || code;
};

// =====================================================
// ✅ MOBILE UTILITY FUNCTIONS
// =====================================================

export const mobileUtils = {
  // Check if device is mobile
  isMobile: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },
  
  // Vibrate for feedback (if supported)
  vibrate: (pattern = [100]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  },
  
  // Show mobile-friendly toast
  showToast: (message, type = 'info', duration = 3000) => {
    console.log(`Toast [${type}]: ${message}`);
  }
};

// =====================================================
// ✅ ACCESSIBILITY HELPERS
// =====================================================

export const a11y = {
  // Screen reader announcements
  announce: (message) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }
};

// =====================================================
// ✅ THEME CONFIGURATION OBJECT
// =====================================================

const themeConfig = {
  theme,
  locationDefinitions,
  quantityFieldMap,
  mobileStyles,
  countModes,
  stripeConfig,
  userFlows,
  mobileUtils,
  a11y,
  getLocationByCode,
  getAvailableLocations,
  getDefaultLocation,
  isValidLocationCode,
  getValidLocationCodes,
  getLocationDisplayName
};

export default themeConfig;