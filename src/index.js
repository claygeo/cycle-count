import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// ✅ MOBILE-FIRST: Initialize React app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ✅ MOBILE-FIRST: Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Clean up any existing service workers first
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
        console.log('🧹 ServiceWorker unregistered:', registration.scope);
      }
      
      // Register new service worker for PWA
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('✅ SW registered:', registration);
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Show update available notification
                console.log('🔄 New content available, refresh to update');
                showUpdateNotification();
              }
            });
          });
        })
        .catch((error) => {
          console.log('❌ SW registration failed:', error);
        });
    });
  });
}

// ✅ MOBILE-FIRST: PWA install prompt
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  console.log('💾 PWA install prompt available');
  e.preventDefault();
  deferredPrompt = e;
  showInstallPrompt();
});

// ✅ MOBILE-FIRST: PWA install button handler
function showInstallPrompt() {
  // You can show a custom install button here
  const installButton = document.createElement('button');
  installButton.innerHTML = '📱 Install App';
  installButton.className = 'fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-medium';
  installButton.onclick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('✅ PWA installed');
        }
        deferredPrompt = null;
        document.body.removeChild(installButton);
      });
    }
  };
  
  // Show install button for 10 seconds
  document.body.appendChild(installButton);
  setTimeout(() => {
    if (document.body.contains(installButton)) {
      document.body.removeChild(installButton);
    }
  }, 10000);
}

// ✅ MOBILE-FIRST: Update notification
function showUpdateNotification() {
  const updateNotification = document.createElement('div');
  updateNotification.innerHTML = `
    <div class="fixed top-4 left-4 right-4 bg-emerald-600 text-white p-4 rounded-lg shadow-lg z-50 flex items-center justify-between">
      <span class="text-sm font-medium">📱 App update available!</span>
      <button onclick="window.location.reload()" class="bg-white text-emerald-600 px-3 py-1 rounded text-sm font-medium">
        Update
      </button>
    </div>
  `;
  document.body.appendChild(updateNotification);
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (document.body.contains(updateNotification)) {
      document.body.removeChild(updateNotification);
    }
  }, 10000);
}

// ✅ MOBILE-FIRST: Viewport and orientation handling
function handleViewportChanges() {
  // Set viewport height CSS variable for mobile browsers
  const setViewportHeight = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  
  setViewportHeight();
  window.addEventListener('resize', setViewportHeight);
  window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 100); // Delay for orientation change
  });
}

// ✅ MOBILE-FIRST: Touch and gesture improvements
function setupMobileOptimizations() {
  // Prevent double-tap zoom on buttons
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
  // Improve scroll performance
  document.addEventListener('touchstart', () => {}, { passive: true });
  document.addEventListener('touchmove', () => {}, { passive: true });
  
  // Add touch feedback for better UX
  document.addEventListener('touchstart', (e) => {
    const target = e.target.closest('button, [role="button"], .clickable');
    if (target) {
      target.style.transform = 'scale(0.98)';
      target.style.opacity = '0.8';
    }
  });
  
  document.addEventListener('touchend', (e) => {
    const target = e.target.closest('button, [role="button"], .clickable');
    if (target) {
      setTimeout(() => {
        target.style.transform = '';
        target.style.opacity = '';
      }, 100);
    }
  });
}

// ✅ MOBILE-FIRST: Performance monitoring
function setupPerformanceMonitoring() {
  // Log performance metrics
  if ('performance' in window && 'measure' in window.performance) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0];
        if (perfData) {
          console.log('📊 Performance Metrics:');
          console.log(`DOM Content Loaded: ${perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart}ms`);
          console.log(`Load Complete: ${perfData.loadEventEnd - perfData.loadEventStart}ms`);
          console.log(`Time to Interactive: ${perfData.domInteractive - perfData.navigationStart}ms`);
        }
      }, 0);
    });
  }
  
  // Monitor memory usage (if available)
  if ('memory' in performance) {
    setInterval(() => {
      const memory = performance.memory;
      if (memory.usedJSHeapSize > memory.totalJSHeapSize * 0.9) {
        console.warn('⚠️ High memory usage detected');
      }
    }, 30000); // Check every 30 seconds
  }
}

// ✅ MOBILE-FIRST: Network status monitoring
function setupNetworkMonitoring() {
  // Online/offline status
  const updateOnlineStatus = () => {
    const status = navigator.onLine ? 'online' : 'offline';
    document.body.setAttribute('data-network-status', status);
    
    if (!navigator.onLine) {
      showOfflineNotification();
    }
  };
  
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
  
  // Connection quality monitoring
  if ('connection' in navigator) {
    const connection = navigator.connection;
    const updateConnectionInfo = () => {
      document.body.setAttribute('data-connection-type', connection.effectiveType || 'unknown');
      
      if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
        console.log('🐌 Slow connection detected, optimizing for performance');
        document.body.classList.add('slow-connection');
      } else {
        document.body.classList.remove('slow-connection');
      }
    };
    
    connection.addEventListener('change', updateConnectionInfo);
    updateConnectionInfo();
  }
}

// ✅ MOBILE-FIRST: Offline notification
function showOfflineNotification() {
  const offlineNotification = document.createElement('div');
  offlineNotification.innerHTML = `
    <div class="fixed top-4 left-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg z-50 flex items-center">
      <span class="text-sm font-medium">📵 You're offline. Some features may not work.</span>
    </div>
  `;
  offlineNotification.id = 'offline-notification';
  
  // Remove existing notification
  const existing = document.getElementById('offline-notification');
  if (existing) {
    document.body.removeChild(existing);
  }
  
  document.body.appendChild(offlineNotification);
  
  // Auto-hide when back online
  const hideWhenOnline = () => {
    if (navigator.onLine && document.body.contains(offlineNotification)) {
      document.body.removeChild(offlineNotification);
      window.removeEventListener('online', hideWhenOnline);
    }
  };
  
  window.addEventListener('online', hideWhenOnline);
}

// ✅ MOBILE-FIRST: Error handling
window.addEventListener('error', (event) => {
  console.error('💥 Global error:', event.error);
  
  // Show user-friendly error message for critical errors
  if (event.error && event.error.message && event.error.message.includes('ChunkLoadError')) {
    showChunkLoadError();
  }
});

// ✅ MOBILE-FIRST: Chunk load error handling (common in SPAs)
function showChunkLoadError() {
  const errorNotification = document.createElement('div');
  errorNotification.innerHTML = `
    <div class="fixed top-4 left-4 right-4 bg-orange-600 text-white p-4 rounded-lg shadow-lg z-50 flex items-center justify-between">
      <span class="text-sm font-medium">🔄 App update detected. Please refresh to continue.</span>
      <button onclick="window.location.reload()" class="bg-white text-orange-600 px-3 py-1 rounded text-sm font-medium">
        Refresh
      </button>
    </div>
  `;
  document.body.appendChild(errorNotification);
}

// ✅ MOBILE-FIRST: Initialize all mobile optimizations
document.addEventListener('DOMContentLoaded', () => {
  handleViewportChanges();
  setupMobileOptimizations();
  setupPerformanceMonitoring();
  setupNetworkMonitoring();
  
  console.log('✅ Mobile-first optimizations loaded');
  console.log('📱 Inventory Insights - Mobile-First Warehouse Counting');
});

// ✅ MOBILE-FIRST: Debug information for development
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Development mode active');
  console.log('📱 Screen size:', `${window.screen.width}x${window.screen.height}`);
  console.log('📐 Viewport size:', `${window.innerWidth}x${window.innerHeight}`);
  console.log('🤳 Device pixel ratio:', window.devicePixelRatio);
  console.log('📶 Connection type:', navigator.connection?.effectiveType || 'unknown');
  console.log('💾 Storage quota:', navigator.storage?.estimate ? 'available' : 'not available');
  
  // Make useful debugging functions global
  window.debugInfo = () => ({
    screenSize: `${window.screen.width}x${window.screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    devicePixelRatio: window.devicePixelRatio,
    userAgent: navigator.userAgent,
    connectionType: navigator.connection?.effectiveType,
    onlineStatus: navigator.onLine,
    serviceWorker: 'serviceWorker' in navigator,
    localStorage: 'localStorage' in window,
    indexedDB: 'indexedDB' in window
  });
}