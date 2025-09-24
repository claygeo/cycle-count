// src/utils/api.js - Complete Dual Tracking System API - v5.2.2-LOOP-FIXED
// FIXED: Removed immediate execution and circular dependencies while preserving all functionality

// =====================================================
// API BASE CONFIGURATION - ENHANCED VERSION
// =====================================================

const getApiBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_URL;
  
  if (envUrl && envUrl.trim() !== '') {
    // Clean any trailing /api or /api/generate-labels paths
    return envUrl.replace(/\/api.*$/, '');
  }
  
  // Fallback URL (should not be needed now that env var is set)
  return 'https://inventory-insights.onrender.com';
};

const API_BASE_URL = getApiBaseUrl();

// =====================================================
// ENHANCED HELPER FUNCTIONS - FIXED: No immediate execution
// =====================================================

const getToken = () => {
  return localStorage.getItem('supabase_token') || localStorage.getItem('jwt_token');
};

const getAuthToken = () => {
  return localStorage.getItem('supabase_token') || localStorage.getItem('jwt_token');
};

const getAuthHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

const getUserData = () => {
  try {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
};

// FIXED: Enhanced request with retry logic but no loop-causing error handling
const makeRequestWithRetry = async (endpoint, options = {}, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiRequest(endpoint, options);
    } catch (error) {
      lastError = error;
      
      // Don't retry on authentication errors
      if (error.message.includes('401') || error.message.includes('403') || 
          error.message.includes('unauthorized') || error.message.includes('token')) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  
  throw lastError;
};

// =====================================================
// ENHANCED GENERIC API REQUEST FUNCTION - FIXED: No handleLogout calls
// =====================================================

const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: getAuthHeaders(),
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
    // Handle non-JSON responses (like PDF downloads)
    if (response.headers.get('content-type')?.includes('application/pdf')) {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.blob();
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    // FIXED: Don't call handleLogout here - it causes loops
    // Let the calling component handle authentication errors
    throw error;
  }
};

// =====================================================
// AUTHENTICATION API - Enhanced with Supabase support
// =====================================================

export const authAPI = {
  registerTenant: async (tenantData) => {
    return apiRequest('/api/auth/register-tenant', {
      method: 'POST',
      body: JSON.stringify(tenantData),
    });
  },

  login: async (email, passcode, tenantDomain = null) => {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, passcode, tenantDomain }),
    });
  },

  verifyToken: async () => {
    return apiRequest('/api/auth/verify', {
      method: 'GET',
    });
  },

  getCurrentUser: async () => {
    return apiRequest('/api/auth/user', {
      method: 'GET',
    });
  },
};

// =====================================================
// DASHBOARD API - Enhanced with unified progress tracking
// =====================================================

export const dashboardAPI = {
  getDashboardData: async () => {
    return apiRequest('/api/dashboard', {
      method: 'GET',
    });
  },

  getDashboardStats: async (location) => {
    const params = location ? `?location=${location}` : '';
    return apiRequest(`/api/dashboard/stats${params}`, {
      method: 'GET',
    });
  },
};

// =====================================================
// COMPONENTS API - Enhanced for unified count system
// =====================================================

export const componentsAPI = {
  getComponents: async (location, search = '', limit = 100) => {
    const params = new URLSearchParams({
      limit: limit.toString()
    });
    
    if (location) params.append('location', location);
    if (search) params.append('search', search);

    return apiRequest(`/api/components?${params}`, {
      method: 'GET',
    });
  },

  importComponents: async (components) => {
    return apiRequest('/api/components/import', {
      method: 'POST',
      body: JSON.stringify(components),
    });
  },

  updateQuantity: async (barcode, quantity, location) => {
    return apiRequest('/api/components/update-quantity', {
      method: 'POST',
      body: JSON.stringify({ barcode, quantity, location }),
    });
  },

  getByBarcode: async (barcode) => {
    return apiRequest('/api/components/by-barcode', {
      method: 'POST',
      body: JSON.stringify({ barcode }),
    });
  },
};

// =====================================================
// ENHANCED PRIORITY ASSIGNMENTS API - UNIFIED SYSTEM
// =====================================================

export const priorityAPI = {
  /**
   * Add component to priority for specific day
   */
  addToPriority: async (barcode, day, location = 'PRIMARY') => {
    console.log(`Adding ${barcode} to priority for ${day} at ${location}`);
    
    try {
      const response = await makeRequestWithRetry('/api/priority/add', {
        method: 'POST',
        body: JSON.stringify({
          barcode: barcode,
          day: day,
          location: location
        }),
      });
      
      console.log(`Added ${barcode} to priority for ${day}`);
      return response;
    } catch (error) {
      console.error(`Error adding ${barcode} to priority:`, error);
      throw error;
    }
  },

  /**
   * Remove component from priority for specific day (or all days if day not specified)
   */
  removeFromPriority: async (barcode, day = null, location = 'PRIMARY') => {
    console.log(`Removing ${barcode} from priority${day ? ` for ${day}` : ''} at ${location}`);
    
    try {
      const body = { barcode: barcode, location: location };
      if (day) body.day = day;
      
      const response = await makeRequestWithRetry('/api/priority/remove', {
        method: 'DELETE',
        body: JSON.stringify(body),
      });
      
      console.log(`Removed ${barcode} from priority${day ? ` for ${day}` : ''}`);
      return response;
    } catch (error) {
      console.error(`Error removing ${barcode} from priority:`, error);
      throw error;
    }
  },

  /**
   * Get priority components for a specific day with enhanced tracking
   */
  getPriorityForDay: async (day, location = 'PRIMARY') => {
    console.log(`Fetching priority components for ${day} at ${location}`);
    
    try {
      const params = new URLSearchParams({ day, location });
      const response = await apiRequest(`/api/priority/for-day?${params}`, {
        method: 'GET',
      });
      
      console.log(`Fetched ${response.components?.length || 0} priority components for ${day}`);
      return response;
    } catch (error) {
      console.error(`Error fetching priority components for ${day}:`, error);
      throw error;
    }
  },

  /**
   * Get all priority assignments for a component
   */
  getComponentAssignments: async (barcode) => {
    return apiRequest('/api/priority/assignments', {
      method: 'POST',
      body: JSON.stringify({ barcode }),
    });
  },

  // Get weekly priority progress with dual tracking awareness
  getWeeklyPriorityProgress: async (location = 'PRIMARY') => {
    try {
      console.log(`Fetching weekly priority progress for ${location}`);
      
      const progress = {};
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      
      // Get current week start date
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
      startOfWeek.setHours(0, 0, 0, 0);
      
      for (const day of days) {
        const dayData = await priorityAPI.getPriorityForDay(day, location);
        const totalPriorityItems = dayData?.components?.length || 0;
        
        if (totalPriorityItems > 0) {
          const countedThisWeek = dayData.components.filter(comp => {
            if (!comp.last_counted_date || comp.last_counted_source !== 'weekly') return false;
            const countedDate = new Date(comp.last_counted_date);
            return countedDate >= startOfWeek;
          }).length;
          
          progress[day] = {
            total: totalPriorityItems,
            counted: countedThisWeek,
            percentage: Math.round((countedThisWeek / totalPriorityItems) * 100)
          };
        } else {
          progress[day] = { total: 0, counted: 0, percentage: 0 };
        }
      }
      
      console.log(`Fetched weekly priority progress for ${location}`);
      return progress;
    } catch (error) {
      console.error(`Error fetching weekly priority progress:`, error);
      throw error;
    }
  },
};

// =====================================================
// ENHANCED ADMIN API FUNCTIONS WITH UNIFIED SYSTEM
// =====================================================

export const adminAPI = {
  /**
   * Get comprehensive priority management statistics with dual tracking
   */
  getPriorityStats: async () => {
    console.log('Fetching priority management stats with dual tracking');
    
    try {
      const response = await apiRequest('/api/admin/priority-stats', {
        method: 'GET',
      });
      
      console.log('Fetched priority management stats with dual tracking');
      return response;
    } catch (error) {
      console.error('Error fetching priority stats:', error);
      throw error;
    }
  },

  /**
   * Clear all priority items (affects dual tracking)
   */
  clearAllPriority: async () => {
    console.log('Clearing all priority items (admin action - affects dual tracking)');
    
    try {
      const response = await apiRequest('/api/admin/clear-all-priority', {
        method: 'POST',
      });
      
      console.log('All priority items cleared successfully');
      return response;
    } catch (error) {
      console.error('Error clearing all priority items:', error);
      throw error;
    }
  },

  /**
   * Get all components with admin details
   */
  getAllComponentsAdmin: async () => {
    return apiRequest('/api/components', {
      method: 'GET',
    });
  },

  /**
   * Legacy support for backward compatibility
   */
  updateComponentPriority: async (barcode, isHighVolume, day = null, location = 'PRIMARY') => {
    if (isHighVolume && day) {
      return priorityAPI.addToPriority(barcode, day, location);
    } else if (!isHighVolume) {
      return priorityAPI.removeFromPriority(barcode, day, location);
    } else {
      throw new Error('Invalid priority operation. Use priorityAPI.addToPriority or priorityAPI.removeFromPriority instead.');
    }
  },

  /**
   * Bulk update priority status for multiple components
   */
  bulkUpdatePriority: async (barcodes, isHighVolume, day = null, location = 'PRIMARY') => {
    const promises = barcodes.map(barcode => {
      if (isHighVolume && day) {
        return priorityAPI.addToPriority(barcode, day, location);
      } else if (!isHighVolume) {
        return priorityAPI.removeFromPriority(barcode, day, location);
      }
      return Promise.resolve();
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');

    return {
      success: true,
      updated_count: successful.length,
      failed_count: failed.length,
      message: `Bulk updated ${successful.length} components${failed.length > 0 ? `, ${failed.length} failed` : ''}`,
      dual_tracking_affected: true
    };
  }
};

// =====================================================
// HIGH VOLUME API (ENHANCED INTEGRATION)
// =====================================================

export const highVolumeAPI = {
  /**
   * Get high volume components for a specific day and location
   */
  getHighVolumeForDay: async (day, location) => {
    return priorityAPI.getPriorityForDay(day, location);
  },

  /**
   * Configure high volume assignments for a component
   */
  configureHighVolume: async (barcode, assignments) => {
    const promises = assignments.map(assignment => 
      priorityAPI.addToPriority(barcode, assignment.day, assignment.location)
    );
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled');
    
    return {
      success: true,
      configured_count: successful.length,
      assignments: assignments,
      dual_tracking_enabled: true
    };
  },

  /**
   * Bulk add/remove high volume assignments
   */
  bulkUpdateHighVolume: async (barcodes, day, location, action) => {
    const promises = barcodes.map(barcode => {
      if (action === 'add') {
        return priorityAPI.addToPriority(barcode, day, location);
      } else if (action === 'remove') {
        return priorityAPI.removeFromPriority(barcode, day, location);
      }
      return Promise.resolve();
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled');

    return {
      success: true,
      updated_count: successful.length,
      action: action,
      dual_tracking_affected: true
    };
  },

  /**
   * Get component with high volume configuration
   */
  getComponentWithHighVolumeConfig: async (barcode) => {
    try {
      const component = await supabaseReplacementAPI.getComponentByBarcodeWithCountStatus(barcode);
      if (component) {
        // Get priority assignments for this component
        const assignments = await priorityAPI.getComponentAssignments(barcode);
        component.priority_assignments = assignments;
      }
      return component;
    } catch (error) {
      console.error('Error fetching component with high volume config:', error);
      throw error;
    }
  }
};

// =====================================================
// HIGH VOLUME SKUS API (LEGACY - NOW USES NEW PRIORITY SYSTEM)
// =====================================================

export const highVolumeSkusAPI = {
  getSkus: async (day, location) => {
    return priorityAPI.getPriorityForDay(day, location);
  },
};

// =====================================================
// WEEKLY COUNTS API - Enhanced with unified system
// =====================================================

export const weeklyCountsAPI = {
  getWeeklyCounts: async (location = null, day = null) => {
    const params = new URLSearchParams();
    if (location) params.append('location', location);
    if (day) params.append('day', day);
    
    return apiRequest(`/api/weekly-counts?${params}`, {
      method: 'GET',
    });
  },

  saveWeeklyCount: async (countData) => {
    return apiRequest('/api/weekly-counts', {
      method: 'POST',
      body: JSON.stringify(countData),
    });
  },

  deleteWeeklyCount: async (countId) => {
    return apiRequest(`/api/weekly-counts/${countId}`, {
      method: 'DELETE',
    });
  },

  // Get weekly count progress with dual tracking
  getWeeklyProgress: async (location = 'PRIMARY') => {
    return priorityAPI.getWeeklyPriorityProgress(location);
  },
};

// =====================================================
// CYCLE COUNTS API
// =====================================================

export const cycleCountsAPI = {
  getCycleCounts: async (location = null, userType = null) => {
    const params = new URLSearchParams();
    if (location) params.append('location', location);
    if (userType) params.append('user_type', userType);
    
    return apiRequest(`/api/cycle-counts?${params}`, {
      method: 'GET',
    });
  },

  saveCycleCount: async (countData) => {
    return apiRequest('/api/cycle-counts', {
      method: 'POST',
      body: JSON.stringify(countData),
    });
  },

  deleteCycleCount: async (countId) => {
    return apiRequest(`/api/cycle-counts/${countId}`, {
      method: 'DELETE',
    });
  },
};

// =====================================================
// COUNT HISTORY API - Enhanced for dual tracking system
// =====================================================

export const countHistoryAPI = {
  getCountHistory: async (sku = null, location = null, countType = null, dualTracking = null) => {
    const params = new URLSearchParams();
    if (sku) params.append('sku', sku);
    if (location) params.append('location', location);
    if (countType) params.append('count_type', countType);
    if (dualTracking !== null) params.append('dual_tracking', dualTracking.toString());
    
    return apiRequest(`/api/count-history?${params}`, {
      method: 'GET',
    });
  },

  logCountAction: async (countData) => {
    return apiRequest('/api/count-history', {
      method: 'POST',
      body: JSON.stringify(countData),
    });
  },

  // Get count history for specific component with dual tracking filters
  getComponentHistory: async (barcode, filters = {}) => {
    const params = new URLSearchParams({
      sku: barcode,
      ...filters
    });
    
    return apiRequest(`/api/audit/trail?${params}`, {
      method: 'GET',
    });
  },

  // Get dual tracking history specifically
  getDualTrackingHistory: async (barcode = null, location = null, limit = 50) => {
    const params = new URLSearchParams({
      dual_tracking: 'true',
      limit: limit.toString()
    });
    
    if (barcode) params.append('sku', barcode);
    if (location) params.append('location', location);
    
    return apiRequest(`/api/audit/trail?${params}`, {
      method: 'GET',
    });
  },
};

// =====================================================
// AUDIT TRAIL API - Enhanced with dual tracking
// =====================================================

export const auditTrailAPI = {
  /**
   * Get audit trail entries with optional filters including dual tracking
   */
  async getAuditTrail(filters = {}) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const params = new URLSearchParams();
    
    if (filters.location) params.append('location', filters.location);
    if (filters.sku) params.append('sku', filters.sku);
    if (filters.source) params.append('source', filters.source);
    if (filters.user_type) params.append('user_type', filters.user_type);
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.dual_tracking !== undefined) params.append('dual_tracking', filters.dual_tracking.toString());
    if (filters.count_type) params.append('count_type', filters.count_type);

    const url = `${API_BASE_URL}/api/audit/trail${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - please log in again');
      }
      const errorText = await response.text();
      throw new Error(`Failed to fetch audit trail: ${response.status} ${errorText}`);
    }

    return await response.json();
  },

  /**
   * Log audit entry with dual tracking support
   */
  async logAuditEntry(auditData) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/api/audit/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(auditData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to log audit entry: ${response.status} ${errorText}`);
    }

    return await response.json();
  },

  /**
   * Get audit statistics with dual tracking metrics
   */
  async getAuditStats(location = null) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const params = new URLSearchParams();
    if (location) params.append('location', location);

    const url = `${API_BASE_URL}/api/audit/stats${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - please log in again');
      }
      const errorText = await response.text();
      throw new Error(`Failed to fetch audit stats: ${response.status} ${errorText}`);
    }

    return await response.json();
  }
};

// =====================================================
// LABELS API
// =====================================================

export const labelsAPI = {
  generateLabels: async (components, options = {}) => {
    return apiRequest('/api/generate-labels', {
      method: 'POST',
      body: JSON.stringify({
        components,
        ...options,
      }),
    });
  },
};

// =====================================================
// ENHANCED UTILITY FUNCTIONS WITH DUAL TRACKING SUPPORT
// =====================================================

export const utils = {
  isAuthenticated: () => {
    const token = getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch (error) {
      return false;
    }
  },

  getCurrentUser: () => {
    return getUserData();
  },

  getTenantId: () => {
    const user = getUserData();
    return user?.tenantId || user?.tenant_id || null;
  },

  // FIXED: Don't expose logout function that can cause loops
  // logout: () => {
  //   handleLogout();
  // },

  downloadBlob: (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  makeAuthenticatedRequest: async (endpoint, options = {}) => {
    return apiRequest(endpoint, options);
  },

  makeRequestWithRetry: makeRequestWithRetry,

  // Date helpers for count cycles with dual tracking awareness
  getStartOfWeek: () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  },

  getStartOfMonth: () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  },

  isCurrentWeek: (date) => {
    const startOfWeek = utils.getStartOfWeek();
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const checkDate = new Date(date);
    return checkDate >= startOfWeek && checkDate <= endOfWeek;
  },

  isCurrentMonth: (date) => {
    const startOfMonth = utils.getStartOfMonth();
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    const checkDate = new Date(date);
    return checkDate >= startOfMonth && checkDate <= endOfMonth;
  },

  // Dual tracking helper functions
  isDualTrackedItem: (component) => {
    return component?.is_high_volume && component?.last_counted_source === 'weekly';
  },

  getDualTrackingStatus: (component) => {
    if (!component?.is_high_volume) return null;
    
    const startOfMonth = utils.getStartOfMonth();
    const lastCountedDate = component.last_counted_date ? new Date(component.last_counted_date) : null;
    
    if (!lastCountedDate || lastCountedDate < startOfMonth) return null;
    
    return {
      isPriorityItem: true,
      countedThisMonth: true,
      countedViaWeekly: component.last_counted_source === 'weekly',
      countedViaMonthly: component.last_counted_source === 'monthly',
      isDualTracked: component.last_counted_source === 'weekly'
    };
  },
};

// =====================================================
// ADMIN UTILITIES - Enhanced with dual tracking
// =====================================================

export const adminUtils = {
  /**
   * Check if current user is admin
   */
  isAdmin: (user) => {
    return user?.email === 'admin@example.com' || 
           user?.email === 'test@example.com' ||
           user?.role === 'admin' || 
           user?.is_admin === true;
  },

  /**
   * Get admin capabilities for user with dual tracking features
   */
  getAdminCapabilities: (user) => {
    const isAdmin = adminUtils.isAdmin(user);
    return {
      canManagePriority: isAdmin,
      canViewAdminStats: isAdmin,
      canBulkUpdate: isAdmin,
      canClearAll: isAdmin,
      canAccessAdminPanel: isAdmin,
      canResetCounts: isAdmin,
      canViewFullHistory: isAdmin,
      canManageDualTracking: isAdmin,
      canViewDualTrackingStats: isAdmin,
    };
  },

  /**
   * Require admin access (throws error if not admin)
   */
  requireAdmin: (user) => {
    if (!adminUtils.isAdmin(user)) {
      throw new Error('Admin access required');
    }
  }
};

// FIXED: Remove handleLogout function that causes loops
// Handle logout should be managed by the components, not utilities

// =====================================================
// QUANTITY FIELD HELPERS (for location-aware quantities)
// =====================================================

export const quantityHelpers = {
  getQuantityFieldMap: () => ({
    'PRIMARY': 'primary_quantity',
    'SECONDARY': 'secondary_quantity', 
    'FULFILLMENT': 'fulfillment_quantity',
    'DISTRIBUTION': 'distribution_quantity'
  }),

  getQuantityField: (location) => {
    const map = quantityHelpers.getQuantityFieldMap();
    return map[location] || 'primary_quantity';
  },

  getLocationQuantity: (component, location) => {
    const field = quantityHelpers.getQuantityField(location);
    return component[field] ?? 0;
  },
};

// =====================================================
// COMPLETE DUAL TRACKING SUPABASE REPLACEMENT API - LOOP-FIXED VERSION
// =====================================================

export const supabaseReplacementAPI = {
  /**
   * Get components with count status for unified system with dual tracking awareness
   */
  getComponentsWithCountStatus: async (location, countType = 'monthly', day = null) => {
    try {
      console.log(`Fetching components for ${location} with count type: ${countType}${day ? ` for ${day}` : ''} (dual tracking aware)`);
      
      const response = await apiRequest('/api/components/with-count-status', {
        method: 'POST',
        body: JSON.stringify({ 
          location: location,
          count_type: countType,
          day: day
        }),
      });
      
      console.log(`Fetched ${response?.length || 0} components with dual tracking awareness`);
      return response;
    } catch (error) {
      console.error('Error fetching components with count status:', error);
      throw error;
    }
  },

  /**
   * Get high volume components for a specific day
   */
  getHighVolumeComponentsForDay: async (day, location) => {
    try {
      return await priorityAPI.getPriorityForDay(day, location);
    } catch (error) {
      console.error('Error fetching high volume components for day:', error);
      throw error;
    }
  },

  /**
   * Update component with COMPLETE DUAL TRACKING implementation
   */
  updateComponentWithCountTracking: async (barcode, quantity, location, source, session, userId, timestamp) => {
    try {
      console.log(`Updating component: ${barcode}, qty: ${quantity}, source: ${source} (dual tracking enabled)`);
      
      const response = await makeRequestWithRetry('/api/components/update-with-tracking', {
        method: 'POST',
        body: JSON.stringify({
          barcode: barcode,
          quantity: quantity !== null ? parseInt(quantity) : null,
          location: location,
          source: source, // Server will map: priority → weekly (with dual tracking), full → monthly
          session: session,
          user_id: userId,
          timestamp: timestamp
        }),
      });
      
      console.log(`Component updated successfully: ${barcode} (dual tracking: ${response.dual_tracking ? 'enabled' : 'disabled'})`);
      return response;
    } catch (error) {
      console.error('Error updating component with tracking:', error);
      throw error;
    }
  },

  /**
   * Reset component counts with cycle-specific logic - ENHANCED VERSION WITH DUAL TRACKING AWARENESS
   */
  resetCounts: async (location, countType) => {
    try {
      console.log(`API: Resetting ${countType} counts for ${location} (dual tracking aware)`);
      
      // Validate count type
      const validCountTypes = ['monthly', 'weekly', 'priority', 'full'];
      if (!validCountTypes.includes(countType)) {
        throw new Error(`Invalid count type: ${countType}. Must be one of: ${validCountTypes.join(', ')}`);
      }
      
      // Map count types for consistency
      let apiCountType = countType;
      if (countType === 'priority') {
        apiCountType = 'weekly'; // Priority counts are weekly-based
      } else if (countType === 'full') {
        apiCountType = 'monthly'; // Full counts are monthly-based
      }
      
      console.log(`Count type mapping: ${countType} → ${apiCountType} (dual tracking aware)`);
      
      const response = await makeRequestWithRetry('/api/components/reset-counts', {
        method: 'POST',
        body: JSON.stringify({
          location: location,
          count_type: apiCountType
        }),
      }, 2); // Only 2 retries for reset operations
      
      console.log(`API: ${countType} counts reset successfully for ${location} (dual tracking aware)`);
      console.log('Reset response:', response);
      
      return response;
    } catch (error) {
      console.error(`API: Error resetting ${countType} counts:`, error);
      
      // Better error handling with specific messages
      if (error.message.includes('403') || error.message.includes('Admin access required')) {
        throw new Error('Admin access required to reset counts');
      } else if (error.message.includes('404')) {
        throw new Error('Reset endpoint not found');
      } else if (error.message.includes('500')) {
        throw new Error('Server error during reset operation');
      } else {
        throw error;
      }
    }
  },

  /**
   * Enhanced get component by barcode with count status
   */
  getComponentByBarcodeWithCountStatus: async (barcode) => {
    try {
      return await apiRequest('/api/components/by-barcode', {
        method: 'POST',
        body: JSON.stringify({ barcode: barcode }),
      });
    } catch (error) {
      console.error('Error fetching component by barcode with count status:', error);
      return null;
    }
  },

  // UPDATED: ADMIN FUNCTIONS FOR UNIFIED PRIORITY MANAGEMENT WITH DUAL TRACKING
  
  /**
   * Update component priority status with day assignment (admin only) - dual tracking aware
   */
  updateComponentPriority: async (barcode, isHighVolume, day = null, location = 'PRIMARY') => {
    try {
      return await adminAPI.updateComponentPriority(barcode, isHighVolume, day, location);
    } catch (error) {
      console.error('Error updating component priority:', error);
      throw error;
    }
  },

  /**
   * Bulk update priority status with day assignment - dual tracking aware
   */
  bulkUpdateComponentPriority: async (barcodes, isHighVolume, day = null, location = 'PRIMARY') => {
    try {
      return await adminAPI.bulkUpdatePriority(barcodes, isHighVolume, day, location);
    } catch (error) {
      console.error('Error bulk updating priority:', error);
      throw error;
    }
  },

  /**
   * Get priority management stats with dual tracking metrics
   */
  getAdminPriorityStats: async () => {
    try {
      return await adminAPI.getPriorityStats();
    } catch (error) {
      console.error('Error fetching priority stats:', error);
      throw error;
    }
  },

  /**
   * Clear all priority items (affects dual tracking)
   */
  clearAllPriorityItems: async () => {
    try {
      return await adminAPI.clearAllPriority();
    } catch (error) {
      console.error('Error clearing all priority items:', error);
      throw error;
    }
  },

  // Legacy support functions
  getComponentByBarcode: async (barcode) => {
    try {
      const componentWithStatus = await supabaseReplacementAPI.getComponentByBarcodeWithCountStatus(barcode);
      if (componentWithStatus) {
        return componentWithStatus;
      }
      
      const components = await componentsAPI.getComponents();
      return components.find(c => c.barcode === barcode) || null;
    } catch (error) {
      console.error('Error in getComponentByBarcode:', error);
      return null;
    }
  },

  updateComponentQuantity: async (barcode, quantity, location) => {
    try {
      return await componentsAPI.updateQuantity(barcode, quantity, location);
    } catch (error) {
      throw error;
    }
  },

  // Functions for complete dual tracking system
  
  /**
   * Get monthly count progress with dual tracking awareness
   */
  getMonthlyProgress: async (location = 'PRIMARY') => {
    try {
      const allComponents = await supabaseReplacementAPI.getComponentsWithCountStatus(location, 'monthly');
      const startOfMonth = utils.getStartOfMonth();
      
      // Count items with monthly source OR priority items with weekly source (dual tracking)
      const countedThisMonth = allComponents?.filter(comp => {
        if (!comp.last_counted_date) return false;
        const countedDate = new Date(comp.last_counted_date);
        if (countedDate < startOfMonth) return false;
        
        // Include if directly counted via monthly OR priority item counted via weekly (dual tracking)
        return comp.last_counted_source === 'monthly' || 
               (comp.is_high_volume && comp.last_counted_source === 'weekly');
      }).length || 0;
      
      const total = allComponents?.length || 0;
      
      return {
        total,
        counted: countedThisMonth,
        percentage: total > 0 ? Math.round((countedThisMonth / total) * 100) : 0,
        remaining: total - countedThisMonth,
        dual_tracking_enabled: true
      };
    } catch (error) {
      console.error('Error fetching monthly progress:', error);
      throw error;
    }
  },

  /**
   * Get weekly priority progress with dual tracking
   */
  getWeeklyProgress: async (location = 'PRIMARY') => {
    return priorityAPI.getWeeklyPriorityProgress(location);
  },

  /**
   * Get unified dashboard statistics with complete dual tracking
   */
  getUnifiedStats: async (location = 'PRIMARY') => {
    try {
      const [monthlyProgress, weeklyProgress] = await Promise.all([
        supabaseReplacementAPI.getMonthlyProgress(location),
        supabaseReplacementAPI.getWeeklyProgress(location)
      ]);
      
      // Calculate priority items for today
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const todayPriority = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(today) 
        ? await priorityAPI.getPriorityForDay(today, location)
        : { components: [] };
      
      // Calculate items counted today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const allComponents = await supabaseReplacementAPI.getComponentsWithCountStatus(location, 'monthly');
      const countedToday = allComponents?.filter(comp => {
        if (!comp.last_counted_date) return false;
        const countedDate = new Date(comp.last_counted_date);
        return countedDate >= todayStart;
      }).length || 0;
      
      const totalWeeklyProgress = Object.values(weeklyProgress).reduce(
        (acc, day) => ({
          counted: acc.counted + day.counted,
          total: acc.total + day.total
        }),
        { counted: 0, total: 0 }
      );

      // Get dual tracking statistics
      const dualTrackedItems = allComponents?.filter(comp => 
        utils.isDualTrackedItem(comp)
      ).length || 0;
      
      return {
        totalComponents: monthlyProgress.total,
        priorityComponents: todayPriority.components?.length || 0,
        countedToday,
        monthlyProgress: monthlyProgress.percentage,
        weeklyProgress: totalWeeklyProgress.total > 0 ? 
          Math.round((totalWeeklyProgress.counted / totalWeeklyProgress.total) * 100) : 0,
        fullCountStarted: monthlyProgress.counted > 0,
        priorityCountActive: totalWeeklyProgress.counted > 0 || (todayPriority.components?.length || 0) > 0,
        // Dual tracking statistics
        dualTrackingEnabled: true,
        dualTrackedItems,
        monthlyProgressIncludesPriority: true
      };
    } catch (error) {
      console.error('Error fetching unified stats:', error);
      throw error;
    }
  },

  // Enhanced scan history function with proper error handling and bulk retrieval support
  
  /**
   * Get complete scan history for a component (or all components) including dual tracking
   * @param {string|null} barcode - Component barcode, or null to get all dual tracking history  
   * @param {string} location - Location filter
   * @param {number} days - Number of days to look back
   * @returns {Array} Array of scan history entries
   */
  getComponentScanHistory: async (barcode = null, location = 'PRIMARY', days = 90) => {
    try {
      console.log(`Fetching scan history for ${barcode || 'all components'} at ${location} (${days} days)`);
      
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      
      // Build filters object for auditTrailAPI
      const filters = {
        location: location,
        start_date: daysAgo.toISOString(),
        limit: barcode ? 100 : 500 // Higher limit when getting all dual tracking history
      };
      
      // Add barcode filter only if specified
      if (barcode) {
        filters.sku = barcode;
      }
      
      // If no barcode specified, filter for dual tracking entries only
      if (!barcode) {
        filters.dual_tracking = 'true';
        console.log('Fetching dual tracking history for all components...');
      }
      
      // Use auditTrailAPI with proper filters
      const history = await auditTrailAPI.getAuditTrail(filters);
      
      console.log(`Found ${history.length} scan history entries for ${barcode || 'dual tracking'}`);
      
      // Sort by timestamp (newest first) and return with enhanced formatting
      return history
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map(entry => ({
          ...entry,
          // Ensure user_name is available for display
          user_name: entry.user_name || entry.user_id || 'Unknown User'
        }));
      
    } catch (error) {
      console.error('Error fetching component scan history:', error);
      // Return empty array instead of throwing to prevent UI breaks
      return [];
    }
  },

  /**
   * Get dual tracking statistics for admin dashboard
   */
  getDualTrackingStats: async (location = 'PRIMARY') => {
    try {
      const [dualTrackingHistory, monthlyProgress, weeklyProgress] = await Promise.all([
        countHistoryAPI.getDualTrackingHistory(null, location, 50),
        supabaseReplacementAPI.getMonthlyProgress(location),
        supabaseReplacementAPI.getWeeklyProgress(location)
      ]);
      
      const totalWeeklyProgress = Object.values(weeklyProgress).reduce(
        (acc, day) => ({ counted: acc.counted + day.counted, total: acc.total + day.total }),
        { counted: 0, total: 0 }
      );
      
      return {
        dual_tracking_events: dualTrackingHistory.length,
        monthly_progress: monthlyProgress,
        weekly_progress: {
          total: totalWeeklyProgress.total,
          counted: totalWeeklyProgress.counted,
          percentage: totalWeeklyProgress.total > 0 ? 
            Math.round((totalWeeklyProgress.counted / totalWeeklyProgress.total) * 100) : 0
        },
        dual_tracking_enabled: true,
        critical_fixes_applied: true,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching dual tracking stats:', error);
      throw error;
    }
  },
};

// =====================================================
// ERROR HANDLING WRAPPER
// =====================================================

export const withErrorHandling = (apiCall) => {
  return async (...args) => {
    try {
      return await apiCall(...args);
    } catch (error) {
      // FIXED: Don't call utils.logout() here - it can cause loops
      // Let the calling component handle authentication errors
      throw error;
    }
  };
};

// =====================================================
// DEFAULT EXPORT WITH COMPLETE DUAL TRACKING SYSTEM - LOOP-FIXED
// =====================================================

const api = {
  authAPI,
  dashboardAPI,
  componentsAPI,
  priorityAPI,
  highVolumeAPI,
  highVolumeSkusAPI,
  weeklyCountsAPI,
  cycleCountsAPI,
  countHistoryAPI,
  auditTrailAPI,
  labelsAPI,
  adminAPI,
  utils,
  adminUtils,
  quantityHelpers,
  supabaseReplacementAPI,
  withErrorHandling,
  
  // Version and fix information
  version: '5.2.2-LOOP-FIXED',
  criticalFixesApplied: {
    infiniteLoopFixes: 'Removed immediate execution and circular dependencies',
    enhancedScanHistoryAPI: 'Supports both single component and bulk dual tracking history',
    resetFunctionality: 'Server-side reset now uses priority_assignments table join',
    dualTrackingProgress: 'Frontend enhanced to include count_history dual tracking entries',
    timezoneHandling: 'EST/EDT DST detection for accurate boundary calculations'
  },
  dualTrackingFeatures: {
    priorityScansCountBoth: 'Priority scans count toward both weekly and monthly progress',
    enhancedProgressCalculation: 'Monthly progress includes all dual tracking entries',
    completeScanHistory: 'Full audit trail with source tracking and drill-down capability',
    visualIndicators: 'Clear identification of dual-tracked items in UI',
    independentResets: 'Separate reset controls for weekly and monthly cycles',
    enhancedAuditTrail: 'Complete metadata tracking for all dual tracking operations'
  }
};

export default api;