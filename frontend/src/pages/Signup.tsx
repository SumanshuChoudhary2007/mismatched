import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getRegistrationCounts } from '../lib/api';
import { Sparkles, Mail, Lock, ArrowRight, Users, User, XCircle, AlertTriangle } from 'lucide-react';

const LIMIT = 50;

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [counts, setCounts] = useState<{ male_count: number; female_count: number }>({ male_count: 0, female_count: 0 });
    const [countsLoading, setCountsLoading] = useState(true);
    const navigate = useNavigate();

    // Load and refresh counts every 10 seconds
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            const c = await getRegistrationCounts();
            if (mounted) {
                setCounts(c);
                setCountsLoading(false);
            }
        };
        load();
        const interval = setInterval(load, 10000);
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    const malePercent = Math.round((counts.male_count / LIMIT) * 100);
    const femalePercent = Math.round((counts.female_count / LIMIT) * 100);
    const maleFull = counts.male_count >= LIMIT;
    const femaleFull = counts.female_count >= LIMIT;
    const bothFull = maleFull && femaleFull;
    const selectedGenderFull = gender === 'male' ? maleFull : femaleFull;

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Re-check limits right before submission
        const currentCounts = await getRegistrationCounts();
        const isFull = gender === 'male' ? currentCounts.male_count >= LIMIT : currentCounts.female_count >= LIMIT;
        if (isFull) {
            setError(`Sorry, registrations for ${gender === 'male' ? 'boys' : 'girls'} are full (${LIMIT}/${LIMIT}). Check back later!`);
            setLoading(false);
            setCounts(currentCounts);
            return;
        }

        const { data, error: signupError } = await supabase.auth.signUp({ email, password });
        if (signupError) {
            setError(signupError.message);
            setLoading(false);
            return;
        }

        if (data.user) {
            await supabase.from('profiles').insert([
                { id: data.user.id, email: data.user.email, gender }
            ]).select();
        }

        navigate('/dashboard');
    };

    // ── BOTH FULL: Show full-page closed screen ──────────────────────────────
    if (!countsLoading && bothFull) {
        return (
            <div className="auth-split-layout">
                <div className="auth-brand-panel">
                    <Link to="/" className="logo">Mismatched</Link>
                    <div className="auth-brand-content">
                        <div className="auth-brand-icon" style={{ background: 'rgba(255,46,99,0.15)', border: '1px solid rgba(255,46,99,0.4)' }}>
                            <XCircle size={48} color="var(--primary)" />
                        </div>
                        <h2>Registration Closed</h2>
                        <p>All spots have been filled for this season. We'll be back soon!</p>

                        {/* Full counters */}
                        <div className="reg-counter-card">
                            <div className="reg-counter-title">
                                <Users size={16} />
                                <span>Final Registration Count</span>
                            </div>
                            <div className="reg-gender-row">
                                <div className="reg-gender-label">
                                    <span className="reg-gender-icon male-icon">♂</span>
                                    <span>Boys</span>
                                    <span className="reg-count full">{LIMIT}/{LIMIT}</span>
                                </div>
                                <div className="reg-progress-bar">
                                    <div className="reg-progress-fill male-fill full" style={{ width: '100%' }} />
                                </div>
                                <span className="reg-full-badge">FULL</span>
                            </div>
                            <div className="reg-gender-row">
                                <div className="reg-gender-label">
                                    <span className="reg-gender-icon female-icon">♀</span>
                                    <span>Girls</span>
                                    <span className="reg-count full">{LIMIT}/{LIMIT}</span>
                                </div>
                                <div className="reg-progress-bar">
                                    <div className="reg-progress-fill female-fill full" style={{ width: '100%' }} />
                                </div>
                                <span className="reg-full-badge">FULL</span>
                            </div>
                        </div>
                    </div>
                    <div className="auth-brand-footer">
                        <p>Already registered? <Link to="/login" className="auth-link">Sign in</Link></p>
                    </div>
                </div>

                <div className="auth-form-panel">
                    <div className="auth-form-inner animate-fade-in" style={{ textAlign: 'center' }}>
                        {/* Big closed icon */}
                        <div className="reg-closed-icon">
                            <XCircle size={80} color="var(--primary)" strokeWidth={1.5} />
                        </div>

                        <h1 className="auth-form-title" style={{ fontSize: '2.5rem' }}>
                            Registrations Full
                        </h1>
                        <p className="auth-form-subtitle" style={{ fontSize: '1.1rem', maxWidth: '380px', margin: '0 auto 2rem' }}>
                            We've reached our limit of <strong style={{ color: 'white' }}>50 boys</strong> and <strong style={{ color: 'white' }}>50 girls</strong> for this season.
                            Thank you for your interest in Mismatched! 💔
                        </p>

                        <div className="reg-closed-stats">
                            <div className="reg-closed-stat">
                                <span className="reg-closed-num male-icon">50</span>
                                <span className="reg-closed-label">Boys Registered</span>
                            </div>
                            <div className="reg-closed-divider" />
                            <div className="reg-closed-stat">
                                <span className="reg-closed-num female-icon">50</span>
                                <span className="reg-closed-label">Girls Registered</span>
                            </div>
                        </div>

                        <div className="alert" style={{ background: 'rgba(255,46,99,0.08)', border: '1px solid rgba(255,46,99,0.25)', borderRadius: '14px', padding: '1.1rem 1.5rem', marginBottom: '2rem' }}>
                            <AlertTriangle size={18} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle', color: 'var(--primary)' }} />
                            <span style={{ color: '#fda4af', fontSize: '0.95rem' }}>
                                Registration is currently closed. If you already have an account, you can still log in.
                            </span>
                        </div>

                        <Link to="/login" className="btn btn-primary full-width" style={{ justifyContent: 'center', display: 'flex' }}>
                            Sign In to Your Account <ArrowRight size={18} />
                        </Link>

                        <Link to="/" className="btn btn-secondary full-width" style={{ justifyContent: 'center', display: 'flex', marginTop: '0.75rem' }}>
                            ← Back to Home
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ── NORMAL SIGNUP FORM ────────────────────────────────────────────────────
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
                    <p>Meaningful connections start here. Limited spots — don't miss out.</p>

                    {/* Live Registration Counter */}
                    <div className="reg-counter-card">
                        <div className="reg-counter-title">
                            <Users size={16} />
                            <span>Live Registration Status</span>
                            {!countsLoading && <span className="live-dot" />}
                        </div>

                        {/* Boys counter */}
                        <div className="reg-gender-row">
                            <div className="reg-gender-label">
                                <span className="reg-gender-icon male-icon">♂</span>
                                <span>Boys</span>
                                <span className={`reg-count ${maleFull ? 'full' : ''}`}>
                                    {countsLoading ? '…' : `${counts.male_count}/${LIMIT}`}
                                </span>
                            </div>
                            <div className="reg-progress-bar">
                                <div
                                    className={`reg-progress-fill male-fill ${maleFull ? 'full' : ''}`}
                                    style={{ width: countsLoading ? '0%' : `${Math.min(malePercent, 100)}%` }}
                                />
                            </div>
                            {maleFull && <span className="reg-full-badge">FULL</span>}
                        </div>

                        {/* Girls counter */}
                        <div className="reg-gender-row">
                            <div className="reg-gender-label">
                                <span className="reg-gender-icon female-icon">♀</span>
                                <span>Girls</span>
                                <span className={`reg-count ${femaleFull ? 'full' : ''}`}>
                                    {countsLoading ? '…' : `${counts.female_count}/${LIMIT}`}
                                </span>
                            </div>
                            <div className="reg-progress-bar">
                                <div
                                    className={`reg-progress-fill female-fill ${femaleFull ? 'full' : ''}`}
                                    style={{ width: countsLoading ? '0%' : `${Math.min(femalePercent, 100)}%` }}
                                />
                            </div>
                            {femaleFull && <span className="reg-full-badge">FULL</span>}
                        </div>

                        <p className="reg-counter-note">🔄 Updates every 10 seconds</p>
                    </div>
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

                    {/* Selected gender is full – show clear blocked banner */}
                    {selectedGenderFull && (
                        <div className="reg-blocked-banner animate-fade-in">
                            <XCircle size={32} color="var(--primary)" />
                            <div>
                                <strong>No spots left for {gender === 'male' ? 'Boys 👦' : 'Girls 👧'}</strong>
                                <p>All {LIMIT} {gender === 'male' ? 'boy' : 'girl'} registrations have been filled.
                                {gender === 'male' && !femaleFull ? ' Girl spots are still available!' : gender === 'female' && !maleFull ? ' Boy spots are still available!' : ''}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="auth-form">
                        {/* Gender Selection */}
                        <div className="form-group">
                            <label className="form-label">I am a...</label>
                            <div className="gender-toggle">
                                <button
                                    type="button"
                                    className={`gender-toggle-btn ${gender === 'male' ? 'active male' : ''} ${maleFull ? 'full-disabled' : ''}`}
                                    onClick={() => !maleFull && setGender('male')}
                                >
                                    <User size={20} />
                                    <span>Boy</span>
                                    {!countsLoading && (
                                        <span className="gender-toggle-count">{counts.male_count}/{LIMIT}</span>
                                    )}
                                    {maleFull && <span className="gender-full-tag">FULL</span>}
                                </button>
                                <button
                                    type="button"
                                    className={`gender-toggle-btn ${gender === 'female' ? 'active female' : ''} ${femaleFull ? 'full-disabled' : ''}`}
                                    onClick={() => !femaleFull && setGender('female')}
                                >
                                    <User size={20} />
                                    <span>Girl</span>
                                    {!countsLoading && (
                                        <span className="gender-toggle-count">{counts.female_count}/{LIMIT}</span>
                                    )}
                                    {femaleFull && <span className="gender-full-tag">FULL</span>}
                                </button>
                            </div>
                        </div>

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
                                    disabled={selectedGenderFull}
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
                                    disabled={selectedGenderFull}
                                />
                            </div>
                            <p className="form-hint">Use at least 6 characters for a secure password</p>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary full-width auth-submit-btn"
                            disabled={loading || selectedGenderFull}
                            style={selectedGenderFull ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        >
                            {loading ? (
                                <>
                                    <span className="btn-spinner"></span>
                                    Creating account...
                                </>
                            ) : selectedGenderFull ? (
                                <><XCircle size={18} /> Registration Full — No Spots Left</>
                            ) : (
                                <>
                                    Create Account
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="auth-mobile-link text-center mt-4">
                        Already have an account? <Link to="/login" style={{ color: 'var(--primary)' }}>Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
