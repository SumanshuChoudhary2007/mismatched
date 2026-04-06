import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Users, Sparkles, ShieldCheck, Star } from 'lucide-react';
import { fetchStats } from '../lib/api';

export default function Home() {
    const [stats, setStats] = useState({ users: 0, matches: 0 });

    useEffect(() => {
        fetchStats().then(setStats).catch(console.error);
    }, []);

    return (
        <div className="app-container">
            <nav className="nav-header">
                <Link to="/" className="logo">Mismatched</Link>
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
                    <span><Star size={15} /> Expert-curated matches</span>
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
                    <div className="stat-card">
                        <Star size={28} className="mb-4" color="#FF8A00" />
                        <div className="stat-number">4.9</div>
                        <div className="stat-label">Average Rating</div>
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
