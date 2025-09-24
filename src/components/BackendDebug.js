import React, { useState, useEffect } from 'react';

const BackendHealthTest = () => {
  const [healthData, setHealthData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testBackendHealth();
  }, []);

  const testBackendHealth = async () => {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 
                         process.env.REACT_APP_API_URL || 
                         'https://warehouse-inventory-manager-backend.onrender.com';

    try {
      console.log('🔍 Testing backend health at:', API_BASE_URL);
      
      // Test root endpoint
      const rootResponse = await fetch(`${API_BASE_URL}/`);
      const rootData = await rootResponse.json();
      
      // Test health endpoint
      const healthResponse = await fetch(`${API_BASE_URL}/health`);
      const healthData = await healthResponse.json();
      
      setHealthData({
        root: rootData,
        health: healthData,
        baseUrl: API_BASE_URL
      });
      
    } catch (err) {
      console.error('❌ Backend health test failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testRegistrationEndpoint = async () => {
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 
                         process.env.REACT_APP_API_URL || 
                         'https://warehouse-inventory-manager-backend.onrender.com';

    try {
      // Test with empty body to see if endpoint exists
      const response = await fetch(`${API_BASE_URL}/api/auth/register-tenant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      console.log('🔍 Registration endpoint test:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      const data = await response.text();
      console.log('📄 Registration response:', data);
      
    } catch (err) {
      console.error('❌ Registration test failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-blue-50 rounded">
        <p>Testing backend connection...</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="text-lg font-bold mb-4">Backend Health Test</h3>
      
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <h4 className="font-semibold text-red-800">Connection Error</h4>
          <p className="text-red-700">{error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <h4 className="font-semibold text-green-800">✅ Backend Connected</h4>
            <p className="text-sm text-gray-600">Base URL: {healthData?.baseUrl}</p>
          </div>
          
          <div className="bg-gray-50 border rounded p-4">
            <h4 className="font-semibold mb-2">Root Endpoint Response</h4>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(healthData?.root, null, 2)}
            </pre>
          </div>
          
          <div className="bg-gray-50 border rounded p-4">
            <h4 className="font-semibold mb-2">Health Endpoint Response</h4>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(healthData?.health, null, 2)}
            </pre>
          </div>
          
          <button
            onClick={testRegistrationEndpoint}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Test Registration Endpoint
          </button>
        </div>
      )}
    </div>
  );
};

export default BackendHealthTest;