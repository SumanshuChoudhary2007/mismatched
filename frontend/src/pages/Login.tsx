import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Heart, Mail, Lock, ArrowRight } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError(error.message);
            setLoading(false);
            return;
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
                        <Heart size={48} color="var(--primary)" />
                    </div>
                    <h2>Welcome Back</h2>
                    <p>Your perfect match is waiting. Sign in to continue your journey.</p>
                </div>
                <div className="auth-brand-footer">
                    <p>Don't have an account? <Link to="/signup" className="auth-link">Sign up free</Link></p>
                </div>
            </div>

            {/* Right form panel */}
            <div className="auth-form-panel">
                <div className="auth-form-inner animate-fade-in">
                    <h1 className="auth-form-title">Sign In</h1>
                    <p className="auth-form-subtitle">Enter your credentials to access your account</p>

                    {error && (
                        <div className="alert alert-error">
                            <span>⚠️ {error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="auth-form">
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
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary full-width auth-submit-btn" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="btn-spinner"></span>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="auth-mobile-link text-center mt-4">
                        Don't have an account? <Link to="/signup" style={{ color: 'var(--primary)' }}>Sign up</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
