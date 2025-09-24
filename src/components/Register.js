import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import supabase from '../utils/supabaseClient';
import auditLogger from '../utils/auditLogger';

const Register = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    plan: 'starter'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ✅ SIMPLIFIED: Plan options for mobile-first experience
  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$50/month',
      features: ['1 location', 'Priority + Full count', 'Mobile optimized', 'Email support'],
      description: 'Perfect for small warehouses',
      popular: false
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '$50 + $25/location',
      features: ['Multiple locations', 'All features', 'Priority support', 'Advanced reporting'],
      description: 'For growing operations',
      popular: true
    }
  ];

  // ✅ SIMPLIFIED: Form validation
  const validateForm = useCallback(() => {
    const { companyName, email, name, password, confirmPassword } = formData;

    if (!companyName.trim()) return 'Company name is required';
    if (!name.trim()) return 'Your name is required';
    if (!email.trim()) return 'Email address is required';

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email address';

    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirmPassword) return 'Passwords do not match';

    return null;
  }, [formData]);

  // ✅ SIMPLIFIED: Supabase registration
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const registrationStart = new Date().toISOString();

    try {
      // 1. Sign up user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            company_name: formData.companyName,
            plan: formData.plan
          }
        }
      });

      if (authError) {
        // Log failed registration
        await auditLogger.logAuthEvent('registration_failed', {
          email: formData.email,
          reason: 'supabase_auth_error',
          error_message: authError.message,
          timestamp: new Date().toISOString(),
          registration_start: registrationStart
        });

        throw authError;
      }

      if (authData.user) {
        // 2. Create tenant record
        const { data: tenant, error: tenantError } = await supabase
          .from('tenants')
          .insert({
            company_name: formData.companyName,
            contact_email: formData.email,
            contact_name: formData.name,
            plan_name: formData.plan,
            subscription_status: 'trial'
          })
          .select()
          .single();

        if (tenantError) throw tenantError;

        // 3. Create user profile
        const { error: profileError } = await supabase
          .from('tenant_users')
          .insert({
            id: authData.user.id,
            tenant_id: tenant.id,
            email: formData.email,
            name: formData.name,
            role: 'admin',
            is_active: true
          });

        if (profileError) throw profileError;

        // 4. Create tenant settings
        await supabase
          .from('tenant_settings')
          .insert({
            tenant_id: tenant.id,
            enabled_locations: ['PRIMARY'],
            default_location: 'PRIMARY'
          });

        // Log successful registration
        await auditLogger.logAuthEvent('registration_successful', {
          email: formData.email,
          user_id: authData.user.id,
          tenant_id: tenant.id,
          company_name: formData.companyName,
          plan: formData.plan,
          timestamp: new Date().toISOString(),
          registration_start: registrationStart,
          registration_duration_ms: new Date() - new Date(registrationStart)
        });

        setSuccess(true);
        if (onSuccess) {
          onSuccess({
            user: authData.user,
            tenant: tenant
          });
        }
      }

    } catch (error) {
      console.error('Registration error:', error);

      let userFriendlyMessage = 'Registration failed. Please try again.';

      if (error.message.includes('already registered')) {
        userFriendlyMessage = 'An account with this email already exists. Please try logging in.';
      } else if (error.message.includes('weak_password')) {
        userFriendlyMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.message.includes('invalid_email')) {
        userFriendlyMessage = 'Please enter a valid email address.';
      } else if (error.message.includes('signup_disabled')) {
        userFriendlyMessage = 'New registrations are temporarily disabled. Please try again later.';
      }

      // Log registration error
      await auditLogger.logAuthEvent('registration_error', {
        email: formData.email,
        error_message: error.message,
        timestamp: new Date().toISOString(),
        registration_start: registrationStart
      });

      setError(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  }, [formData, validateForm, onSuccess]);

  // ✅ MOBILE-FIRST: Input change handler
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  }, [error]);

  // ✅ MOBILE-FIRST: Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-emerald-600 text-2xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Inventory Insights!</h2>
          <p className="text-gray-600 mb-6">
            Your account has been created successfully. Please check your email to verify your account.
          </p>
          <div className="bg-emerald-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-emerald-800">
              <strong>Company:</strong> {formData.companyName}<br/>
              <strong>Plan:</strong> {plans.find(p => p.id === formData.plan)?.name}<br/>
              <strong>Email:</strong> {formData.email}
            </p>
          </div>
          <Link 
            to="/login"
            className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 transition-colors font-medium inline-block"
          >
            Continue to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50">
      {/* ✅ MOBILE-FIRST: Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">I</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Inventory Insights</span>
            </div>
            <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-medium text-sm">
              Already have an account?
            </Link>
          </div>
        </div>
      </div>

      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* ✅ MOBILE-FIRST: Hero Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Start Your Mobile-First Inventory Journey
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Simplified inventory counting with priority + full count modes. 
              Mobile-optimized for warehouse teams.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* ✅ MOBILE-FIRST: Registration Form */}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 order-2 lg:order-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Your Account</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    placeholder="Acme Warehouse"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    placeholder="John Smith"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Work Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    placeholder="john@acme.com"
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    placeholder="••••••••"
                    minLength={6}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Creating Account...
                    </div>
                  ) : (
                    'Start Free Trial'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  By signing up, you agree to our terms and privacy policy
                </p>
              </div>
            </div>

            {/* ✅ MOBILE-FIRST: Simplified Plan Selection */}
            <div className="space-y-4 order-1 lg:order-2">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Choose Your Plan</h3>
              
              {plans.map((plan) => (
                <label
                  key={plan.id}
                  className={`block cursor-pointer border-2 rounded-xl p-4 transition-all ${
                    formData.plan === plan.id
                      ? 'border-emerald-500 bg-emerald-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  } ${plan.popular ? 'ring-1 ring-emerald-200' : ''}`}
                >
                  {plan.popular && (
                    <div className="text-center mb-2">
                      <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{plan.name}</h4>
                      <p className="text-sm text-gray-600">{plan.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900">{plan.price}</div>
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={formData.plan === plan.id}
                        onChange={(e) => handleInputChange('plan', e.target.value)}
                        className="mt-2 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <ul className="space-y-1">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-600">
                        <span className="w-3 h-3 text-emerald-500 mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </label>
              ))}
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center">
                  <span className="text-emerald-500 mr-2">🎯</span>
                  <p className="text-sm text-emerald-800">
                    <strong>14-day free trial</strong> • No credit card required • Mobile-first design
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;