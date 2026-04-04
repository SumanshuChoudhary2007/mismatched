import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Users } from 'lucide-react';
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
                <h1 className="animate-fade-in">Find The One<br/>Without Searching</h1>
                <p className="hero-subtitle animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    A premium blind dating experience where meaningful connections are made by experts, not algorithms.
                </p>

                <div className="flex-gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                    <Link to="/signup" className="btn btn-primary">Get Started</Link>
                    <Link to="/admin" className="btn btn-outline">Admin Portal</Link>
                </div>

                <div className="stats-container animate-fade-in" style={{ animationDelay: '0.6s' }}>
                    <div className="stat-card">
                        <Users size={32} className="mb-4" color="var(--primary)" />
                        <div className="stat-number">{stats.users}</div>
                        <div className="stat-label">Active Users</div>
                    </div>
                    <div className="stat-card">
                        <Heart size={32} className="mb-4" color="var(--secondary)" />
                        <div className="stat-number">{stats.matches}</div>
                        <div className="stat-label">Successful Matches</div>
                    </div>
                </div>
            </main>
        </div>
    );
}
