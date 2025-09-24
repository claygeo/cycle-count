// src/utils/LocalStorageManager.js - Pure Frontend Data Management (Fixed)

/**
 * Pure Frontend LocalStorage-based data management
 * Replaces all backend/API functionality with localStorage
 */

const STORAGE_KEYS = {
  CURRENT_SESSION: 'inventory_current_session',
  SESSION_HISTORY: 'inventory_session_history',
  USER_PREFERENCES: 'inventory_user_preferences',
  APP_STATE: 'inventory_app_state'
};

// Data validation helpers
const validateSku = (sku) => {
  return sku && typeof sku === 'string' && sku.trim().length > 0;
};

const validateQuantity = (quantity) => {
  const num = parseInt(quantity);
  return !isNaN(num) && num >= 0;
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
          enableVibration: true
        }
      }));
    }
    
    if (!localStorage.getItem(STORAGE_KEYS.APP_STATE)) {
      localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify({
        lastActiveSession: null,
        totalSessionsCompleted: 0
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
        skusToCount: []
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
      lastActivity: new Date().toISOString()
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
        timeSpent: Date.now() - new Date(session.countProgress.startTime).getTime()
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

  // CSV Upload and Processing
  processCSVUpload(filename, csvData) {
    try {
      const uploadData = {
        filename,
        uploadTime: new Date().toISOString(),
        totalSkus: csvData.length,
        skusToCount: csvData.map((row, index) => ({
          id: `sku_${index}`,
          sku: row.sku || row.SKU || '',
          barcode: row.barcode || row.sku || row.SKU || '',
          description: row.description || row.Description || '',
          expectedQuantity: parseInt(row.expected_quantity || row.expectedQuantity || row.quantity || 0),
          counted: false,
          countedQuantity: null,
          countedTime: null,
          notes: ''
        })).filter(item => validateSku(item.sku)) // Filter out invalid SKUs
      };

      // Create new session with upload data
      const session = this.createNewSession();
      const updatedSession = this.updateCurrentSession({
        uploadData,
        skus: uploadData.skusToCount,
        countProgress: {
          ...session.countProgress,
          total: uploadData.skusToCount.length
        }
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

  // SKU Counting Operations
  countSku(sku, quantity, notes = '') {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No active session');
    }

    if (!validateQuantity(quantity)) {
      throw new Error('Invalid quantity');
    }

    const skuIndex = session.skus.findIndex(item => 
      item.sku === sku || item.barcode === sku
    );

    if (skuIndex === -1) {
      throw new Error('SKU not found in current session');
    }

    // Update SKU count
    const updatedSkus = [...session.skus];
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

    const updatedSession = this.updateCurrentSession({
      skus: updatedSkus,
      countProgress: {
        ...session.countProgress,
        counted: countedItems,
        percentage
      }
    });

    return {
      success: true,
      session: updatedSession,
      skuData: updatedSkus[skuIndex]
    };
  }

  // Search and Filter
  searchSkus(searchTerm, includeDescriptions = true) {
    const session = this.getCurrentSession();
    if (!session || !session.skus) return [];

    const term = searchTerm.toLowerCase();
    return session.skus.filter(sku => {
      return sku.sku.toLowerCase().includes(term) ||
             sku.barcode.toLowerCase().includes(term) ||
             (includeDescriptions && sku.description.toLowerCase().includes(term));
    });
  }

  getSkuByIdentifier(identifier) {
    const session = this.getCurrentSession();
    if (!session || !session.skus) return null;

    return session.skus.find(sku => 
      sku.sku === identifier || sku.barcode === identifier
    );
  }

  // Statistics and Progress
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
      percentage: Math.round((countedSkus.length / session.skus.length) * 100),
      timeSpent: timeSpent,
      avgTimePerSku: avgTimePerSku,
      estimatedRemainingTime: estimatedRemainingTime,
      sessionStatus: session.status,
      lastActivity: session.lastActivity
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
        progress: stats || { total: 0, counted: 0, percentage: 0 }
      },
      history: {
        totalSessions: appState.totalSessionsCompleted || 0,
        lastCompletedSession: this.getLastCompletedSession()
      }
    };
  }

  // History Management
  addToHistory(session) {
    try {
      const history = this.getSessionHistory();
      history.unshift(session); // Add to beginning
      
      // Keep only last 50 sessions
      if (history.length > 50) {
        history.splice(50);
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

  // Data Export
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
        countProgress: session.countProgress
      },
      results: session.skus.map(sku => ({
        sku: sku.sku,
        barcode: sku.barcode,
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
        row.sku,
        row.barcode,
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
}

// Create singleton instance
export const localStorageManager = new LocalStorageManager();

// Export helper functions
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
  }
};

export default LocalStorageManager;