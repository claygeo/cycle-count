// src/utils/auditLogger.js - SIMPLIFIED MOBILE-FIRST VERSION
// ✅ SIMPLIFIED: Backend API only, no direct Supabase calls
// ✅ MOBILE-FIRST: Optimized for mobile performance
// ✅ 80/20 APPROACH: Core logging functionality only

class AuditLogger {
  constructor() {
    this.isEnabled = true;
    this.debugMode = process.env.NODE_ENV === 'development';
    this.apiBaseUrl = this.getApiBaseUrl();
    
    // ✅ SIMPLIFIED: Setup essential functions only
    this.setupGlobalFunctions();
    
    this.log('🔧 Simplified AuditLogger initialized', {
      apiBaseUrl: this.apiBaseUrl,
      debugMode: this.debugMode,
      version: '2.0_simplified'
    });
  }

  /**
   * ✅ SIMPLIFIED: Get API base URL
   */
  getApiBaseUrl() {
    const candidates = [
      process.env.REACT_APP_API_BASE_URL,
      process.env.REACT_APP_API_URL,
      'https://warehouse-inventory-manager-backend.onrender.com'
    ];
    
    for (const url of candidates) {
      if (url) {
        const cleanUrl = url.replace(/\/api.*$/, '');
        return cleanUrl;
      }
    }
    
    return 'https://warehouse-inventory-manager-backend.onrender.com';
  }

  /**
   * ✅ SIMPLIFIED: Logging utility
   */
  log(message, data = null) {
    if (this.debugMode || message.includes('❌') || message.includes('⚠️') || message.includes('✅')) {
      if (data) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * ✅ SIMPLIFIED: Get current user info from localStorage
   */
  getCurrentUserInfo() {
    try {
      const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
      const token = localStorage.getItem('jwt_token') || localStorage.getItem('supabase_session');
      
      const tenant_id = userData.tenant_id || userData.tenantId;
      
      if (!tenant_id || !token) {
        this.log('⚠️ Missing user info for audit logging');
        return null;
      }
      
      return {
        tenant_id,
        user_id: userData.id,
        user_name: userData.name || userData.email || 'Unknown User',
        user_type: userData.role || 'user',
        email: userData.email
      };
    } catch (error) {
      this.log('❌ Error getting user info:', error);
      return null;
    }
  }

  /**
   * ✅ SIMPLIFIED: Get auth headers
   */
  getAuthHeaders() {
    const token = localStorage.getItem('jwt_token') || localStorage.getItem('supabase_session');
    
    if (!token) {
      return { 'Content-Type': 'application/json' };
    }
    
    // Handle Supabase session format
    let authToken = token;
    if (token.startsWith('{')) {
      try {
        const session = JSON.parse(token);
        authToken = session.access_token || token;
      } catch (e) {
        // Use token as-is if parsing fails
      }
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
  }

  /**
   * ✅ SIMPLIFIED: Core audit logging via backend API
   */
  async logAuditEntry(auditData) {
    if (!this.isEnabled) {
      return true;
    }
    
    const userInfo = this.getCurrentUserInfo();
    if (!userInfo) {
      return false;
    }

    const auditEntry = {
      sku: String(auditData.sku || 'UNKNOWN'),
      quantity: parseInt(auditData.quantity) || 1,
      location: String(auditData.location || 'SYSTEM'),
      source: String(auditData.source || 'mobile_app'),
      user_type: auditData.user_type || userInfo.user_type,
      user_name: auditData.user_name || userInfo.user_name,
      metadata: auditData.metadata || {}
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/audit/log`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(auditEntry)
      });

      if (!response.ok) {
        this.log('❌ Audit logging failed:', response.status);
        return false;
      }

      this.log('✅ Audit logged:', auditEntry.sku);
      return true;

    } catch (error) {
      this.log('❌ Audit logging error:', error);
      return false;
    }
  }

  /**
   * ✅ CORE FUNCTION: Log inventory scan (main use case)
   */
  async logInventoryScan(sku, quantity, location, source = 'mobile_count', additionalData = {}) {
    return await this.logAuditEntry({
      sku: String(sku),
      quantity: parseInt(quantity) || 0,
      location: String(location),
      source: String(source),
      metadata: {
        type: 'inventory_scan',
        scan_timestamp: new Date().toISOString(),
        ...additionalData
      }
    });
  }

  /**
   * ✅ CORE FUNCTION: Log authentication events
   */
  async logAuthEvent(event, additionalData = {}) {
    return await this.logAuditEntry({
      sku: `AUTH_${String(event).toUpperCase()}`,
      quantity: 1,
      location: 'SYSTEM',
      source: 'authentication',
      metadata: {
        event_type: event,
        type: 'auth_event',
        timestamp: new Date().toISOString(),
        ...additionalData
      }
    });
  }

  /**
   * ✅ CORE FUNCTION: Log count actions (start/reset/complete)
   */
  async logCycleCountAction(location, action, isComplete = false, metadata = {}) {
    return await this.logAuditEntry({
      sku: `COUNT_${String(action).toUpperCase()}_${String(location).toUpperCase()}`,
      quantity: isComplete ? 100 : 1,
      location: String(location),
      source: 'count_management',
      metadata: {
        type: 'count_action',
        action: action,
        completed: isComplete,
        action_timestamp: new Date().toISOString(),
        ...metadata
      }
    });
  }

  /**
   * ✅ SIMPLIFIED: Log configuration changes
   */
  async logConfigurationChange(configType, oldValue, newValue, metadata = {}) {
    return await this.logAuditEntry({
      sku: `CONFIG_${String(configType).toUpperCase()}`,
      quantity: 1,
      location: 'SYSTEM',
      source: 'configuration',
      metadata: {
        type: 'configuration_change',
        config_type: configType,
        old_value: oldValue,
        new_value: newValue,
        change_timestamp: new Date().toISOString(),
        ...metadata
      }
    });
  }

  /**
   * ✅ SIMPLIFIED: Get audit trail via backend
   */
  async getAuditTrail(filters = {}) {
    try {
      const params = new URLSearchParams();
      
      if (filters.sku) params.append('sku', filters.sku);
      if (filters.location) params.append('location', filters.location);
      if (filters.source) params.append('source', filters.source);
      if (filters.limit) params.append('limit', filters.limit);

      const response = await fetch(`${this.apiBaseUrl}/api/audit/trail?${params}`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.log('✅ Audit trail fetched:', data.length);
      return data;

    } catch (error) {
      this.log('❌ Error fetching audit trail:', error);
      return [];
    }
  }

  /**
   * ✅ SIMPLIFIED: Test function
   */
  async testAuditLogging() {
    this.log('🧪 Testing audit logging...');
    
    const userInfo = this.getCurrentUserInfo();
    if (!userInfo) {
      this.log('❌ No user info available');
      return false;
    }
    
    const success = await this.logAuditEntry({
      sku: 'TEST_MOBILE_AUDIT',
      quantity: 1,
      location: 'SYSTEM',
      source: 'mobile_test',
      metadata: {
        type: 'test',
        message: 'Testing mobile audit logging',
        test_timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent.substring(0, 50)
      }
    });

    this.log(`🧪 Audit test result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
    return success;
  }

  /**
   * ✅ SIMPLIFIED: Setup essential global functions only
   */
  setupGlobalFunctions() {
    // Core debugging functions for development
    window.auditLogger = this;
    
    window.testAuditLogging = () => {
      return this.testAuditLogging();
    };
    
    window.getAuditTrail = (filters) => {
      return this.getAuditTrail(filters);
    };
    
    window.debugAuditLogger = () => {
      return {
        apiBaseUrl: this.apiBaseUrl,
        enabled: this.isEnabled,
        debugMode: this.debugMode,
        userInfo: this.getCurrentUserInfo(),
        version: '2.0_simplified'
      };
    };

    this.log('🌐 Essential debugging functions registered');
  }

  /**
   * ✅ SIMPLIFIED: Control functions
   */
  disable() {
    this.isEnabled = false;
    this.log('⚠️ Audit logging disabled');
  }

  enable() {
    this.isEnabled = true;
    this.log('✅ Audit logging enabled');
  }

  isAuditEnabled() {
    return this.isEnabled;
  }
}

// =====================================================
// CREATE AND EXPORT SINGLETON INSTANCE
// =====================================================

const auditLogger = new AuditLogger();

console.log('✅ Simplified Audit Logger initialized - Mobile-First');
console.log('🧪 Test with: window.testAuditLogging()');

export default auditLogger;

// Export core functions for convenience
export const {
  logInventoryScan,
  logCycleCountAction,
  logAuthEvent,
  logConfigurationChange,
  getAuditTrail
} = auditLogger;