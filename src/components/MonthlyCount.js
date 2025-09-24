import React from 'react';
import CountItems from './CountItems';
import AdminView from './AdminView';

// ✅ FIXED: Now properly receiving and passing the user prop
const MonthlyCount = ({ userType, selectedLocation, user }) => {
  console.log('🔍 MonthlyCount: Props received:', {
    userType,
    selectedLocation,
    user: user ? { ...user, adminPasscode: '***' } : null
  });

  // MonthlyCount is just a wrapper that renders the correct component
  // The actual styling is handled by CountItems and AdminView components
  return (
    <>
      {userType === 'admin' ? (
        <AdminView 
          userType={userType} 
          selectedLocation={selectedLocation} 
          user={user} 
        />
      ) : (
        <CountItems 
          userType={userType} 
          selectedLocation={selectedLocation} 
          user={user} 
        />
      )}
    </>
  );
};

export default MonthlyCount;