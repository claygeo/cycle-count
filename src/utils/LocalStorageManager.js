// Fixed LocalStorageManager.js - Enhanced barcode support and proper progress tracking

/**
 * Enhanced LocalStorage-based data management with barcode support
 */

const STORAGE_KEYS = {
  CURRENT_SESSION: 'inventory_current_session',
  SESSION_HISTORY: 'inventory_session_history',
  USER_PREFERENCES: 'inventory_user_preferences',
  APP_STATE: 'inventory_app_state'
};

// Enhanced validation helpers
const validateSku = (sku) => {
  return sku && typeof sku === 'string' && sku.trim().length > 0;
};

const validateQuantity = (quantity) => {
  const num = parseInt(quantity);
  return !isNaN(num) && num >= 0;
};

// Normalize identifier for consistent matching
const normalizeIdentifier = (identifier) => {
  if (!identifier) return '';
  return identifier.toString().trim().toLowerCase();
};

export class LocalStorageManager {
  constructor() {
    this.initializeStorage();
  }

  // Initialize storage structure
  initializeStorage() {
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION)) {
      this.createNewSession();
    }
    
    if (!localStorage.getItem(STORAGE_KEYS.SESSION_HISTORY)) {
      localStorage.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify([]));
    }
    
    if (!localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES)) {
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify({
        lastUploadDate: null,
        countingPreferences: {
          showDescriptions: true,
          autoFocusQuantity: true,
          enableVibration: true,
          enableBarcodeScanning: true
        }
      }));
    }
    
    if (!localStorage.getItem(STORAGE_KEYS.APP_STATE)) {
      localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify({
        lastActiveSession: null,
        totalSessionsCompleted: 0,
        lastBarcodeScanned: null
      }));
    }
  }

  // Session Management
  createNewSession(uploadData = null) {
    const session = {
      id: `session_${Date.now()}`,
      uploadDate: new Date().toISOString(),
      status: 'active', // active, completed, cancelled
      uploadData: uploadData || {
        filename: null,
        totalSkus: 0,
        skusToCount: [],
        hasBarcode: false,
        hasSku: false
      },
      countProgress: {
        total: 0,
        counted: 0,
        percentage: 0,
        startTime: new Date().toISOString(),
        endTime: null,
        timeSpent: 0
      },
      skus: [], // Array of SKU objects with count data
      lastActivity: new Date().toISOString(),
      barcodeSupport: true
    };

    localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(session));
    this.updateAppState({ lastActiveSession: session.id });
    
    return session;
  }

  getCurrentSession() {
    try {
      const session = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  updateCurrentSession(updates) {
    const session = this.getCurrentSession();
    if (!session) return null;

    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(updatedSession));
    return updatedSession;
  }

  completeSession() {
    const session = this.getCurrentSession();
    if (!session) return null;

    const completedSession = {
      ...session,
      status: 'completed',
      countProgress: {
        ...session.countProgress,
        endTime: new Date().toISOString(),
        timeSpent: Date.now() - new Date(session.countProgress.startTime).getTime(),
        percentage: Math.round((session.countProgress.counted / session.countProgress.total) * 100)
      }
    };

    // Move to history
    this.addToHistory(completedSession);
    
    // Clear current session
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
    
    // Update app state
    const appState = this.getAppState();
    this.updateAppState({ 
      totalSessionsCompleted: (appState.totalSessionsCompleted || 0) + 1,
      lastActiveSession: null 
    });

    return completedSession;
  }

  // Enhanced CSV Upload and Processing with barcode support
  processCSVUpload(filename, csvData) {
    try {
      console.log('Processing CSV upload:', filename, csvData.length, 'items');
      
      const uploadData = {
        filename,
        uploadTime: new Date().toISOString(),
        totalSkus: csvData.length,
        hasBarcode: csvData.some(item => item.barcode && item.barcode !== item.sku),
        hasSku: csvData.some(item => item.sku),
        skusToCount: csvData.map((row, index) => ({
          id: `sku_${index}`,
          sku: row.sku || '', // Primary identifier
          barcode: row.barcode || row.sku || '', // Barcode or fallback to SKU
          alternateId: (row.alternateId && row.alternateId !== row.sku) ? row.alternateId : null,
          description: row.description || '',
          expectedQuantity: parseInt(row.expected_quantity || 0),
          counted: false,
          countedQuantity: null,
          countedTime: null,
          notes: '',
          originalRow: row.originalRow || index + 2
        })).filter(item => validateSku(item.sku)) // Filter out invalid SKUs
      };

      console.log('Upload data processed:', {
        totalItems: uploadData.skusToCount.length,
        hasBarcode: uploadData.hasBarcode,
        hasSku: uploadData.hasSku
      });

      // Create new session with upload data
      const session = this.createNewSession();
      const updatedSession = this.updateCurrentSession({
        uploadData,
        skus: uploadData.skusToCount,
        countProgress: {
          ...session.countProgress,
          total: uploadData.skusToCount.length
        },
        barcodeSupport: uploadData.hasBarcode
      });

      return {
        success: true,
        session: updatedSession,
        processed: uploadData.skusToCount.length,
        skipped: csvData.length - uploadData.skusToCount.length
      };
    } catch (error) {
      console.error('Error processing CSV upload:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Enhanced SKU Counting Operations with barcode support
  countSku(identifier, quantity, notes = '') {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    if (!validateQuantity(quantity)) {
      throw new Error('Invalid quantity');
    }

    console.log('Counting SKU:', identifier, 'Quantity:', quantity);

    // Enhanced search - look for matches in multiple fields
    const normalizedIdentifier = normalizeIdentifier(identifier);
    const skuIndex = session.skus.findIndex(item => {
      return normalizeIdentifier(item.sku) === normalizedIdentifier ||
             normalizeIdentifier(item.barcode) === normalizedIdentifier ||
             (item.alternateId && normalizeIdentifier(item.alternateId) === normalizedIdentifier);
    });

    if (skuIndex === -1) {
      console.error('SKU not found:', identifier);
      console.log('Available SKUs:', session.skus.slice(0, 5).map(s => ({
        sku: s.sku,
        barcode: s.barcode,
        alternateId: s.alternateId
      })));
      throw new Error(`SKU not found in current session: ${identifier}`);
    }

    console.log('Found SKU at index:', skuIndex, session.skus[skuIndex]);

    // Update SKU count
    const updatedSkus = [...session.skus];
    const previouslyCounted = updatedSkus[skuIndex].counted;
    
    updatedSkus[skuIndex] = {
      ...updatedSkus[skuIndex],
      counted: true,
      countedQuantity: parseInt(quantity),
      countedTime: new Date().toISOString(),
      notes: notes
    };

    // Calculate progress
    const countedItems = updatedSkus.filter(item => item.counted).length;
    const percentage = Math.round((countedItems / updatedSkus.length) * 100);

    console.log('Progress update:', {
      countedItems,
      total: updatedSkus.length,
      percentage,
      previouslyCounted
    });

    const updatedSession = this.updateCurrentSession({
      skus: updatedSkus,
      countProgress: {
        ...session.countProgress,
        counted: countedItems,
        percentage
      }
    });

    // Update app state with last scanned barcode
    this.updateAppState({ lastBarcodeScanned: identifier });

    return {
      success: true,
      session: updatedSession,
      skuData: updatedSkus[skuIndex],
      wasAlreadyCounted: previouslyCounted
    };
  }

  // Enhanced Search with barcode support
  searchSkus(searchTerm, includeDescriptions = true) {
    const session = this.getCurrentSession();
    if (!session || !session.skus) return [];

    const term = searchTerm.toLowerCase().trim();
    if (term.length === 0) return [];

    return session.skus.filter(sku => {
      // Search in SKU
      if (sku.sku.toLowerCase().includes(term)) return true;
      
      // Search in barcode
      if (sku.barcode && sku.barcode.toLowerCase().includes(term)) return true;
      
      // Search in alternate ID
      if (sku.alternateId && sku.alternateId.toLowerCase().includes(term)) return true;
      
      // Search in description if enabled
      if (includeDescriptions && sku.description && sku.description.toLowerCase().includes(term)) return true;
      
      return false;
    }).sort((a, b) => {
      // Prioritize exact matches
      const aExact = a.sku.toLowerCase() === term || a.barcode.toLowerCase() === term;
      const bExact = b.sku.toLowerCase() === term || b.barcode.toLowerCase() === term;
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Then prioritize uncounted items
      if (!a.counted && b.counted) return -1;
      if (a.counted && !b.counted) return 1;
      
      return 0;
    });
  }

  getSkuByIdentifier(identifier) {
    const session = this.getCurrentSession();
    if (!session || !session.skus) return null;

    const normalizedIdentifier = normalizeIdentifier(identifier);
    return session.skus.find(sku => {
      return normalizeIdentifier(sku.sku) === normalizedIdentifier ||
             normalizeIdentifier(sku.barcode) === normalizedIdentifier ||
             (sku.alternateId && normalizeIdentifier(sku.alternateId) === normalizedIdentifier);
    });
  }

  // Enhanced Statistics and Progress
  getCountStatistics() {
    const session = this.getCurrentSession();
    if (!session) return null;

    const countedSkus = session.skus.filter(sku => sku.counted);
    const uncountedSkus = session.skus.filter(sku => !sku.counted);
    
    // Calculate time spent
    const startTime = new Date(session.countProgress.startTime);
    const currentTime = new Date();
    const timeSpent = currentTime - startTime;

    // Calculate average time per SKU
    const avgTimePerSku = countedSkus.length > 0 ? timeSpent / countedSkus.length : 0;

    // Estimate remaining time
    const estimatedRemainingTime = uncountedSkus.length * avgTimePerSku;

    return {
      total: session.skus.length,
      counted: countedSkus.length,
      remaining: uncountedSkus.length,
      percentage: session.skus.length > 0 ? Math.round((countedSkus.length / session.skus.length) * 100) : 0,
      timeSpent: timeSpent,
      avgTimePerSku: avgTimePerSku,
      estimatedRemainingTime: estimatedRemainingTime,
      sessionStatus: session.status,
      lastActivity: session.lastActivity,
      barcodeSupport: session.barcodeSupport || false,
      hasBarcode: session.uploadData?.hasBarcode || false
    };
  }

  getDashboardStats() {
    const session = this.getCurrentSession();
    const appState = this.getAppState();
    const stats = this.getCountStatistics();

    return {
      currentSession: {
        active: !!session,
        filename: session?.uploadData?.filename || null,
        uploadDate: session?.uploadDate || null,
        progress: stats || { total: 0, counted: 0, percentage: 0 },
        barcodeSupport: session?.barcodeSupport || false,
        hasBarcode: session?.uploadData?.hasBarcode || false
      },
      history: {
        totalSessions: appState.totalSessionsCompleted || 0,
        lastCompletedSession: this.getLastCompletedSession(),
        lastBarcodeScanned: appState.lastBarcodeScanned || null
      }
    };
  }

  // History Management
  addToHistory(session) {
    try {
      const history = this.getSessionHistory();
      history.unshift(session); // Add to beginning
      
      // Keep only last 100 sessions (increased for better history)
      if (history.length > 100) {
        history.splice(100);
      }
      
      localStorage.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(history));
    } catch (error) {
      console.error('Error adding to history:', error);
    }
  }

  getSessionHistory() {
    try {
      const history = localStorage.getItem(STORAGE_KEYS.SESSION_HISTORY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error getting session history:', error);
      return [];
    }
  }

  getLastCompletedSession() {
    const history = this.getSessionHistory();
    return history.find(session => session.status === 'completed') || null;
  }

  // Enhanced Data Export with barcode support
  exportSessionData(sessionId = null) {
    const session = sessionId ? 
      this.getSessionHistory().find(s => s.id === sessionId) : 
      this.getCurrentSession();

    if (!session) return null;

    const exportData = {
      sessionInfo: {
        id: session.id,
        filename: session.uploadData?.filename,
        uploadDate: session.uploadDate,
        status: session.status,
        countProgress: session.countProgress,
        barcodeSupport: session.barcodeSupport || false,
        hasBarcode: session.uploadData?.hasBarcode || false
      },
      results: session.skus.map(sku => ({
        sku: sku.sku,
        barcode: sku.barcode,
        alternateId: sku.alternateId,
        description: sku.description,
        expectedQuantity: sku.expectedQuantity,
        countedQuantity: sku.countedQuantity,
        counted: sku.counted,
        countedTime: sku.countedTime,
        notes: sku.notes,
        variance: sku.counted ? (sku.countedQuantity - sku.expectedQuantity) : null
      }))
    };

    return exportData;
  }

  exportToCSV(sessionId = null) {
    const exportData = this.exportSessionData(sessionId);
    if (!exportData) return null;

    const headers = [
      'SKU',
      'Barcode', 
      'Alternate ID',
      'Description',
      'Expected Quantity',
      'Counted Quantity',
      'Variance',
      'Status',
      'Counted Time',
      'Notes'
    ];

    const csvRows = [
      headers.join(','),
      ...exportData.results.map(row => [
        `"${row.sku}"`,
        `"${row.barcode || ''}"`,
        `"${row.alternateId || ''}"`,
        `"${row.description}"`,
        row.expectedQuantity,
        row.countedQuantity || '',
        row.variance || '',
        row.counted ? 'Counted' : 'Not Counted',
        row.countedTime ? new Date(row.countedTime).toLocaleString() : '',
        `"${row.notes}"`
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  // Utility Methods
  clearCurrentSession() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  }

  clearAllData() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    this.initializeStorage();
  }

  getAppState() {
    try {
      const state = localStorage.getItem(STORAGE_KEYS.APP_STATE);
      return state ? JSON.parse(state) : {};
    } catch (error) {
      console.error('Error getting app state:', error);
      return {};
    }
  }

  updateAppState(updates) {
    const currentState = this.getAppState();
    const newState = { ...currentState, ...updates };
    localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(newState));
    return newState;
  }

  // User Preferences
  getUserPreferences() {
    try {
      const prefs = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      return prefs ? JSON.parse(prefs) : {};
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return {};
    }
  }

  updateUserPreferences(updates) {
    const currentPrefs = this.getUserPreferences();
    const newPrefs = { ...currentPrefs, ...updates };
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(newPrefs));
    return newPrefs;
  }

  // Data validation and cleanup
  validateSession(session) {
    if (!session || typeof session !== 'object') return false;
    if (!session.id || !session.uploadDate) return false;
    if (!Array.isArray(session.skus)) return false;
    return true;
  }

  cleanupOldData() {
    try {
      const history = this.getSessionHistory();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const cleanedHistory = history.filter(session => {
        const sessionDate = new Date(session.uploadDate);
        return sessionDate > thirtyDaysAgo;
      });

      localStorage.setItem(STORAGE_KEYS.SESSION_HISTORY, JSON.stringify(cleanedHistory));
      
      return {
        success: true,
        cleaned: history.length - cleanedHistory.length
      };
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced debugging methods
  debugCurrentSession() {
    const session = this.getCurrentSession();
    if (!session) {
      console.log('No current session');
      return;
    }

    console.log('Current Session Debug:', {
      id: session.id,
      status: session.status,
      totalSkus: session.skus.length,
      countedSkus: session.skus.filter(s => s.counted).length,
      barcodeSupport: session.barcodeSupport,
      hasBarcode: session.uploadData?.hasBarcode,
      sampleSkus: session.skus.slice(0, 3).map(s => ({
        sku: s.sku,
        barcode: s.barcode,
        alternateId: s.alternateId,
        counted: s.counted
      }))
    });
  }
}

// Create singleton instance
export const localStorageManager = new LocalStorageManager();

// Enhanced helper functions
export const storageHelpers = {
  formatTime: (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  },

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

  exportSessionAsCSV: (sessionId = null) => {
    const csvContent = localStorageManager.exportToCSV(sessionId);
    if (!csvContent) return false;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const session = sessionId ? 
      localStorageManager.getSessionHistory().find(s => s.id === sessionId) : 
      localStorageManager.getCurrentSession();
    
    const filename = `inventory_count_${session?.uploadData?.filename || 'session'}_${new Date().toISOString().split('T')[0]}.csv`;
    
    storageHelpers.downloadBlob(blob, filename);
    return true;
  },

  // Validate barcode format
  isValidBarcode: (barcode) => {
    if (!barcode || typeof barcode !== 'string') return false;
    
    const cleaned = barcode.replace(/\D/g, ''); // Remove non-digits
    
    // Check common barcode lengths
    const validLengths = [8, 10, 12, 13, 14]; // EAN-8, UPC-A, EAN-13, etc.
    return validLengths.includes(cleaned.length);
  },

  // Debug helper
  debugSession: () => {
    localStorageManager.debugCurrentSession();
  }
};

export default LocalStorageManager;