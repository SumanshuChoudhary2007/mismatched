import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Users, Sparkles, ShieldCheck } from 'lucide-react';
import { fetchStats } from '../lib/api';

const SECRET_TAPS = 5;       // tap logo 5 times within 3 seconds → admin
const TAP_WINDOW_MS = 3000;

export default function Home() {
    const [stats, setStats] = useState({ users: 0, matches: 0 });
    const [tapCount, setTapCount] = useState(0);
    const [showHint, setShowHint] = useState(false);   // brief visual hint
    const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchStats().then(setStats).catch(console.error);
    }, []);

    // ── Secret 5-tap admin easter egg ────────────────────────────────────────
    const handleLogoTap = useCallback(() => {
        // Reset the decay timer each tap
        if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

        setTapCount(prev => {
            const next = prev + 1;

            if (next >= SECRET_TAPS) {
                // Navigate to admin login silently
                setTimeout(() => navigate('/admin'), 200);
                return 0;
            }

            // Show a brief visual indicator (only after 2nd tap so it's subtle)
            if (next >= 2) {
                setShowHint(true);
                setTimeout(() => setShowHint(false), 600);
            }

            // Reset count if user stops tapping within the window
            tapTimerRef.current = setTimeout(() => setTapCount(0), TAP_WINDOW_MS);
            return next;
        });
    }, [navigate]);

    // Clean up on unmount
    useEffect(() => () => { if (tapTimerRef.current) clearTimeout(tapTimerRef.current); }, []);
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="app-container">
            <nav className="nav-header">
                {/* Logo: tappable 5× for admin access */}
                <span
                    className="logo"
                    onClick={handleLogoTap}
                    style={{
                        cursor: 'default',
                        userSelect: 'none',
                        transition: 'opacity 0.15s ease',
                        opacity: showHint ? 0.6 : 1,
                    }}
                    title=""
                    aria-label="Mismatched"
                >
                    Mismatched
                </span>
                <div className="flex-gap-4">
                    <Link to="/login" className="btn btn-secondary">Login</Link>
                    <Link to="/signup" className="btn btn-primary">Sign Up</Link>
                </div>
            </nav>

            <main className="hero">
                <div className="hero-bg-glow"></div>

                {/* Badge */}
                <div className="hero-badge animate-fade-in">
                    <Sparkles size={14} />
                    <span>Premium Blind Dating Experience</span>
                </div>

                <h1 className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    Find The One<br />
                    <span className="gradient-text">Without Searching</span>
                </h1>

                <p className="hero-subtitle animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    A premium blind dating experience where meaningful connections
                    are made by experts, not algorithms. Your perfect match awaits.
                </p>

                <div className="flex-gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                    <Link to="/signup" className="btn btn-primary">
                        <Heart size={18} />
                        Get Started — It's Free
                    </Link>
                </div>

                {/* Trust indicators */}
                <div className="trust-row animate-fade-in" style={{ animationDelay: '0.55s' }}>
                    <span><ShieldCheck size={15} /> Verified profiles</span>
                    <span><Sparkles size={15} /> Expert-curated matches</span>
                    <span><Heart size={15} /> Real connections</span>
                </div>

                {/* Stats */}
                <div className="stats-container animate-fade-in" style={{ animationDelay: '0.6s' }}>
                    <div className="stat-card">
                        <Users size={28} className="mb-4" color="var(--primary)" />
                        <div className="stat-number">{stats.users}+</div>
                        <div className="stat-label">Active Members</div>
                    </div>
                    <div className="stat-card">
                        <Heart size={28} className="mb-4" color="var(--secondary)" />
                        <div className="stat-number">{stats.matches}+</div>
                        <div className="stat-label">Successful Matches</div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="site-footer">
                <p>© {new Date().getFullYear()} Mismatched. All rights reserved.</p>
                <p className="footer-tagline">Where unexpected connections become perfect matches.</p>
            </footer>
        </div>
    );
}
