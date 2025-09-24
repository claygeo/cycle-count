// frontend/src/components/Login.js - White Focus Border Specifications
import React, { useState } from 'react';
import supabase from '../utils/supabaseClient';

const Login = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      console.log('🔐 Attempting secure authentication...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) throw error;

      if (data.user && data.session) {
        console.log('✅ Supabase auth successful, user ID:', data.user.id);
        console.log('🔑 Session token received, length:', data.session.access_token.length);
        setMessage('Loading your profile securely...');
        setMessageType('info');
        
        console.log('🔍 Loading profile via secure RPC...');
        const { data: profileData, error: profileError } = await supabase
          .rpc('get_current_user_profile');

        if (profileError) {
          console.error('❌ Profile RPC error:', profileError);
          throw new Error(`Profile loading failed: ${profileError.message}`);
        }

        let currentProfileData = profileData;

        if (!currentProfileData || currentProfileData.length === 0) {
          console.log('⚠️ No profile found, waiting for trigger...');
          setMessage('Setting up your profile...');
          setMessageType('info');
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const { data: retryProfileData, error: retryError } = await supabase
            .rpc('get_current_user_profile');
          
          if (retryError || !retryProfileData || retryProfileData.length === 0) {
            console.error('❌ Profile still not found after retry');
            throw new Error('Profile setup incomplete. Please try signing in again or contact support.');
          }
          
          console.log('✅ Profile created by trigger, found on retry');
          currentProfileData = retryProfileData;
        }

        const profile = currentProfileData[0];
        console.log('📋 Profile loaded:', { id: profile.id, email: profile.email, role: profile.role });

        if (!profile.is_active) {
          setMessage('Your account has been deactivated. Please contact support.');
          setMessageType('error');
          await supabase.auth.signOut();
          return;
        }

        const userData = {
          id: data.user.id,
          email: data.user.email,
          name: profile.name || email.split('@')[0],
          role: profile.role || 'user',
          tenantId: profile.tenant_id,
          tenant_id: profile.tenant_id,
          companyName: profile.company_name || 'Your Company',
          plan: profile.plan_name || 'trial',
          subscriptionStatus: profile.subscription_status || 'trial'
        };

        console.log('✅ Secure login completed successfully for:', userData.email);
        
        // 🔧 CRITICAL DEBUG: Verify token before sending
        console.log('🔄 About to call onLogin with:');
        console.log('   - User data:', { email: userData.email, role: userData.role, tenantId: userData.tenantId });
        console.log('   - Token (first 50 chars):', data.session.access_token.substring(0, 50) + '...');
        console.log('   - Token is valid JWT:', data.session.access_token.split('.').length === 3);
        
        onLogin(userData, data.session.access_token);
        
        // 🔍 VERIFY STORAGE AFTER onLogin
        setTimeout(() => {
          const storedToken = localStorage.getItem('jwt_token');
          const storedUser = localStorage.getItem('user_data');
          console.log('🔍 POST-LOGIN VERIFICATION:');
          console.log('   - Token stored:', !!storedToken);
          console.log('   - User data stored:', !!storedUser);
          
          if (!storedToken) {
            console.error('❌ CRITICAL: JWT token was NOT stored by App.js handleLogin!');
            console.log('🔧 Manually storing token as fallback...');
            localStorage.setItem('jwt_token', data.session.access_token);
          }
          
          if (!storedUser) {
            console.error('❌ CRITICAL: User data was NOT stored by App.js handleLogin!');
            console.log('🔧 Manually storing user data as fallback...');
            localStorage.setItem('user_data', JSON.stringify(userData));
          }
          
          console.log('🎯 Final storage check:');
          console.log('   - JWT Token exists:', !!localStorage.getItem('jwt_token'));
          console.log('   - User data exists:', !!localStorage.getItem('user_data'));
        }, 200);
        
        setMessage('Welcome back!');
        setMessageType('success');
      }

    } catch (error) {
      console.error('❌ Secure login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and confirm your account.';
      } else if (error.message.includes('Too many requests')) {
        errorMessage = 'Too many attempts. Please wait before trying again.';
      } else if (error.message.includes('Profile setup incomplete')) {
        errorMessage = error.message;
      } else if (error.message.includes('subscription')) {
        errorMessage = error.message;
      } else {
        errorMessage = `Authentication error: ${error.message}`;
      }
      
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!name.trim()) {
      setMessage('Please enter your full name');
      setMessageType('error');
      setLoading(false);
      return;
    }

    try {
      console.log('📝 Creating new secure account...');
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: name.trim(),
            full_name: name.trim()
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        console.log('✅ Account created, user ID:', data.user.id);
        
        if (data.user.email_confirmed_at || !data.user.confirmation_sent_at) {
          setMessage('Account created successfully! Your profile will be set up automatically when you sign in.');
          setMessageType('success');
          setIsSignUp(false);
          setPassword('');
          setName('');
        } else {
          setMessage('Please check your email and confirm your account, then sign in.');
          setMessageType('info');
          setIsSignUp(false);
          setPassword('');
          setName('');
        }
      }
    } catch (error) {
      console.error('❌ Secure sign up error:', error);
      
      let errorMessage = 'Sign up failed. Please try again.';
      if (error.message.includes('already registered')) {
        errorMessage = 'This email is already registered. Please sign in instead.';
        setIsSignUp(false);
      } else if (error.message.includes('Password should be')) {
        errorMessage = 'Password must be at least 6 characters long.';
      } else if (error.message.includes('invalid email')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.message.includes('weak_password')) {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      }
      
      setMessage(errorMessage);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#181B22' }}
    >
      <div 
        className="rounded-2xl p-8 w-full max-w-md"
        style={{ 
          backgroundColor: '#15161B',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)'
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#374151' }}
          >
            <span className="text-emerald-300 font-bold text-2xl">I</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#F8FAFC' }}>
            Inventory Insights
          </h1>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 border ${
            messageType === 'success' ? 'bg-emerald-900/20 border-emerald-300 text-emerald-300' :
            messageType === 'error' ? 'bg-red-900/20 border-red-400 text-red-400' :
            'bg-yellow-900/20 border-yellow-400 text-yellow-400'
          }`}>
            <div className="flex items-center">
              <span className="mr-2">
                {messageType === 'success' ? '✓' : messageType === 'error' ? '✗' : 'ℹ'}
              </span>
              <span className="text-sm font-medium">{message}</span>
            </div>
          </div>
        )}

        {/* Toggle Sign In / Sign Up */}
        <div className="flex rounded-lg p-1 mb-6" style={{ backgroundColor: '#374151' }}>
          <button
            onClick={() => {
              setIsSignUp(false);
              setMessage('');
              setPassword('');
              setName('');
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              !isSignUp 
                ? 'bg-emerald-300 text-gray-900 shadow-sm' 
                : 'text-white hover:bg-gray-600'
            }`}
            style={!isSignUp ? {} : { color: '#FAFCFB' }}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setIsSignUp(true);
              setMessage('');
              setPassword('');
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              isSignUp 
                ? 'bg-emerald-300 text-gray-900 shadow-sm' 
                : 'text-white hover:bg-gray-600'
            }`}
            style={isSignUp ? {} : { color: '#FAFCFB' }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
          {/* Name field (only for sign up) */}
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#F8FAFC' }}>
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={isSignUp}
                className="w-full px-4 py-3 rounded-lg transition-colors"
                style={{
                  backgroundColor: '#181B22',
                  borderWidth: '2px',
                  borderColor: '#39414E',
                  color: '#9FA3AC'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#FAFCFB';
                  e.target.style.outline = 'none';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#39414E';
                }}
                placeholder="Enter your full name"
              />
            </div>
          )}

          {/* Email field */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#F8FAFC' }}>
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg transition-colors"
              style={{
                backgroundColor: '#181B22',
                borderWidth: '2px',
                borderColor: '#39414E',
                color: '#9FA3AC'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#FAFCFB';
                e.target.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#39414E';
              }}
              placeholder="Enter your email"
            />
          </div>

          {/* Password field */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#F8FAFC' }}>
              Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-lg transition-colors"
              style={{
                backgroundColor: '#181B22',
                borderWidth: '2px',
                borderColor: '#39414E',
                color: '#9FA3AC'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#FAFCFB';
                e.target.style.outline = 'none';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#39414E';
              }}
              placeholder={isSignUp ? "Create a password (min 6 characters)" : "Enter your password"}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (isSignUp && !name.trim())}
            className="w-full bg-emerald-300 hover:bg-emerald-200 text-gray-900 py-3 px-4 rounded-lg font-semibold transition-colors focus:ring-4 focus:ring-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-gray-800 border-t-transparent rounded-full animate-spin mr-2"></div>
                {isSignUp ? 'Creating Account...' : 'Signing In...'}
              </div>
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;