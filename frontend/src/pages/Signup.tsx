import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Sparkles, Mail, Lock, ArrowRight } from 'lucide-react';

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        // Immediately create their profile in the database
        if (data.user) {
            await supabase.from('profiles').insert([
                { id: data.user.id, email: data.user.email }
            ]).select();
        }

        navigate('/dashboard');
    };

    return (
        <div className="auth-split-layout">
            {/* Left branding panel */}
            <div className="auth-brand-panel">
                <Link to="/" className="logo">Mismatched</Link>
                <div className="auth-brand-content">
                    <div className="auth-brand-icon">
                        <Sparkles size={48} color="var(--secondary)" />
                    </div>
                    <h2>Join Mismatched</h2>
                    <p>Thousands of meaningful connections start here. Be part of something different.</p>
                </div>
                <div className="auth-brand-footer">
                    <p>Already have an account? <Link to="/login" className="auth-link">Sign in</Link></p>
                </div>
            </div>

            {/* Right form panel */}
            <div className="auth-form-panel">
                <div className="auth-form-inner animate-fade-in">
                    <h1 className="auth-form-title">Create Account</h1>
                    <p className="auth-form-subtitle">Sign up to start your journey to finding your match</p>

                    {error && (
                        <div className="alert alert-error">
                            <span>⚠️ {error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="auth-form">
                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <div className="input-icon-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    type="email"
                                    className="form-input with-icon"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="input-icon-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type="password"
                                    className="form-input with-icon"
                                    placeholder="Minimum 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                            <p className="form-hint">Use at least 6 characters for a secure password</p>
                        </div>

                        <button type="submit" className="btn btn-primary full-width auth-submit-btn" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="btn-spinner"></span>
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="auth-terms text-center mt-4">
                        By signing up, you agree to our <span className="terms-link">Terms of Service</span> and <span className="terms-link">Privacy Policy</span>
                    </p>

                    <p className="auth-mobile-link text-center mt-4">
                        Already have an account? <Link to="/login" style={{ color: 'var(--primary)' }}>Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
