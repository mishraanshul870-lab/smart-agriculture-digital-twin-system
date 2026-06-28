import React, { useState, useEffect } from 'react';
import { Sprout, Lock, Mail, User as UserIcon, Loader2, Eye, EyeOff, Check, ArrowRight, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { User } from '../types';
import { fetch } from '../utils/api';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

type AuthView = 'login' | 'register' | 'forgot_password' | 'reset_password';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [view, setView] = useState<AuthView>('login');
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Clear errors when view changes
  useEffect(() => {
    setError('');
    setSuccess('');
    setToast(null);
  }, [view]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 5) score += 1;
    if (pass.length > 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return Math.min(score, 4); // 0 to 4
  };

  const renderPasswordStrength = (pass: string) => {
    const strength = getPasswordStrength(pass);
    const bars = [1, 2, 3, 4];
    
    let colorClass = 'bg-gray-600';
    let textClass = 'text-gray-400';
    let label = 'Too weak';
    
    if (strength === 1) { colorClass = 'bg-red-500'; textClass = 'text-red-400'; label = 'Weak'; }
    if (strength === 2) { colorClass = 'bg-yellow-500'; textClass = 'text-yellow-400'; label = 'Fair'; }
    if (strength === 3) { colorClass = 'bg-blue-500'; textClass = 'text-blue-400'; label = 'Good'; }
    if (strength === 4) { colorClass = 'bg-green-500'; textClass = 'text-green-400'; label = 'Strong'; }
    
    if (pass.length === 0) return null;

    return (
      <div className="mt-2">
        <div className="flex gap-1 h-1.5 w-full rounded-full overflow-hidden">
          {bars.map(bar => (
            <div key={bar} className={`h-full flex-1 ${bar <= strength ? colorClass : 'bg-white/10 transition-colors'}`} />
          ))}
        </div>
        <p className={`text-[10px] mt-1 font-medium ${textClass} text-right`}>{label}</p>
      </div>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (view === 'login') {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Authentication failed');
        
        const userWithToken = { ...data.user, token: data.token };
        showToast('Successfully logged in!', 'success');
        setTimeout(() => onLoginSuccess(userWithToken), 1000);
      } 
      else if (view === 'register') {
        if (!termsAccepted) throw new Error('You must accept the terms and conditions');
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Registration failed');
        
        setSuccess('Account created successfully!');
        showToast('Account registered! Please log in.', 'success');
        setTimeout(() => {
          setView('login');
          setPassword('');
          setConfirmPassword('');
        }, 2000);
      }
      else if (view === 'forgot_password') {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Failed to request reset link');

        setSuccess('Password reset link has been sent to your email.');
        showToast('Reset link sent!', 'success');
        setTimeout(() => {
          setView('reset_password'); // auto transition for demo purposes
        }, 2000);
      }
      else if (view === 'reset_password') {
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        if (getPasswordStrength(password) < 2) throw new Error('Password is too weak');
        
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Failed to reset password');

        setSuccess('Password successfully reset!');
        showToast('Password reset successful! Please log in.', 'success');
        setTimeout(() => {
          setView('login');
          setPassword('');
          setConfirmPassword('');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
      showToast(err.message || 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A1A] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#9333EA]/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#C026D3]/20 blur-[120px] pointer-events-none" />
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-top-5 fade-in ${
          toast.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {toast.type === 'success' ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Main Card */}
      <div className="w-full max-w-5xl min-h-[600px] flex flex-col md:flex-row bg-[#121024]/80 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative z-10">
        
        {/* Left Side: Hero Image (Hidden on small screens) */}
        <div className="hidden md:flex w-1/2 relative bg-black">
          <img 
            src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=2070&auto=format&fit=crop" 
            alt="Agriculture Field" 
            className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A1A] via-[#0B0A1A]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0A1A]/20 to-[#121024]/90" />
          
          <div className="relative z-10 p-12 flex flex-col h-full justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-[#9333EA] to-[#C026D3] rounded-xl shadow-lg shadow-[#9333EA]/20">
                <Sprout className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">SmartAg Twin</h1>
            </div>
            
            <div className="mb-12 space-y-6 max-w-md">
              <h2 className="text-4xl font-bold leading-tight">
                Welcome to the Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#9333EA] to-[#C026D3]">Farming</span>
              </h2>
              <p className="text-[#E9D5FF] text-lg font-medium">
                Monitor your fields, predict yields, and get AI-powered insights with our advanced digital twin platform.
              </p>
              
              <div className="flex items-center gap-4 pt-4">
                <div className="flex -space-x-3">
                  <div className="h-10 w-10 rounded-full border-2 border-[#121024] bg-gray-600">
                    <img src="https://i.pravatar.cc/100?img=1" alt="User" className="rounded-full w-full h-full object-cover" />
                  </div>
                  <div className="h-10 w-10 rounded-full border-2 border-[#121024] bg-gray-600">
                    <img src="https://i.pravatar.cc/100?img=2" alt="User" className="rounded-full w-full h-full object-cover" />
                  </div>
                  <div className="h-10 w-10 rounded-full border-2 border-[#121024] bg-gray-600">
                    <img src="https://i.pravatar.cc/100?img=3" alt="User" className="rounded-full w-full h-full object-cover" />
                  </div>
                </div>
                <div className="text-sm">
                  <p className="font-bold text-white">Join 10,000+ farmers</p>
                  <p className="text-[#E9D5FF]/70">growing smarter every day.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center relative">
          
          {/* Mobile Header (Only visible on small screens) */}
          <div className="md:hidden flex items-center justify-center gap-3 mb-10">
            <div className="p-2.5 bg-gradient-to-br from-[#9333EA] to-[#C026D3] rounded-xl shadow-lg shadow-[#9333EA]/20">
              <Sprout className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">SmartAg Twin</h1>
          </div>

          <div className="max-w-md w-full mx-auto">
            {/* Header */}
            <div className="mb-8 text-center md:text-left">
              <h2 className="text-3xl font-bold text-white mb-2">
                {view === 'login' && 'Welcome back'}
                {view === 'register' && 'Create an account'}
                {view === 'forgot_password' && 'Reset password'}
                {view === 'reset_password' && 'Set new password'}
              </h2>
              <p className="text-[#E9D5FF]/70 text-sm">
                {view === 'login' && 'Enter your details to access your dashboard.'}
                {view === 'register' && 'Start managing your farm smarter today.'}
                {view === 'forgot_password' && 'Enter your email and we will send you a reset link.'}
                {view === 'reset_password' && 'Please enter your new secure password.'}
              </p>
            </div>

            {/* Error / Success Banners */}
            {error && !toast && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
            
            {success && !toast && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3 text-green-400">
                <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="text-sm font-medium">{success}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Name Field (Register) */}
              {view === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#E9D5FF] uppercase tracking-wider">Full Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-[#D946EF] transition-colors">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full h-11 pl-12 pr-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA] focus:ring-1 focus:ring-[#9333EA] transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Email Field (All except Reset Password) */}
              {view !== 'reset_password' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#E9D5FF] uppercase tracking-wider">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-[#D946EF] transition-colors">
                      <Mail className="h-5 w-5" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="farmer@example.com"
                      className="w-full h-11 pl-12 pr-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA] focus:ring-1 focus:ring-[#9333EA] transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Password Field */}
              {(view === 'login' || view === 'register' || view === 'reset_password') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#E9D5FF] uppercase tracking-wider">Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-[#D946EF] transition-colors">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-12 pr-12 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA] focus:ring-1 focus:ring-[#9333EA] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 hover:text-white transition-colors focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {(view === 'register' || view === 'reset_password') && renderPasswordStrength(password)}
                </div>
              )}

              {/* Confirm Password Field */}
              {(view === 'register' || view === 'reset_password') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#E9D5FF] uppercase tracking-wider">Confirm Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500 group-focus-within:text-[#D946EF] transition-colors">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 pl-12 pr-12 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9333EA] focus:ring-1 focus:ring-[#9333EA] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500 hover:text-white transition-colors focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Extras (Remember Me, Forgot Password) */}
              {view === 'login' && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-4 h-4 border border-white/20 rounded bg-black/20 peer-checked:bg-[#9333EA] peer-checked:border-[#9333EA] transition-colors" />
                      <Check className="absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-sm text-gray-400 group-hover:text-white transition-colors">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setView('forgot_password')}
                    className="text-sm font-medium text-[#D946EF] hover:text-white transition-colors focus:outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Terms (Register) */}
              {view === 'register' && (
                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                      <input 
                        type="checkbox" 
                        required
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-4 h-4 border border-white/20 rounded bg-black/20 peer-checked:bg-[#9333EA] peer-checked:border-[#9333EA] transition-colors" />
                      <Check className="absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <span className="text-xs text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                      I agree to the <button type="button" className="text-[#D946EF] hover:underline">Terms of Service</button> and <button type="button" className="text-[#D946EF] hover:underline">Privacy Policy</button>
                    </span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-[#9333EA] to-[#C026D3] hover:shadow-lg hover:shadow-[#9333EA]/30 text-white rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:hover:-translate-y-0 group focus:outline-none focus:ring-2 focus:ring-[#9333EA] focus:ring-offset-2 focus:ring-offset-[#121024]"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {view === 'login' && 'Sign In'}
                    {view === 'register' && 'Create Account'}
                    {view === 'forgot_password' && 'Send Reset Link'}
                    {view === 'reset_password' && 'Reset Password'}
                    {view !== 'forgot_password' && view !== 'reset_password' && (
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    )}
                  </>
                )}
              </button>

            </form>

            {/* Bottom Links */}
            <div className="mt-8 text-center text-sm text-gray-400">
              {view === 'login' && (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setView('register')}
                    className="text-[#D946EF] font-bold hover:text-white transition-colors focus:outline-none"
                  >
                    Sign up
                  </button>
                </p>
              )}
              {view === 'register' && (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setView('login')}
                    className="text-[#D946EF] font-bold hover:text-white transition-colors focus:outline-none"
                  >
                    Sign in
                  </button>
                </p>
              )}
              {(view === 'forgot_password' || view === 'reset_password') && (
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="inline-flex items-center gap-2 text-[#D946EF] font-medium hover:text-white transition-colors focus:outline-none"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </button>
              )}
            </div>
            
            {view === 'login' && (
              <div className="mt-8 pt-6 border-t border-white/5 text-center text-[10px] text-gray-500 flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Demo Credentials: darkfantasy937@gmail.com / password123
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
