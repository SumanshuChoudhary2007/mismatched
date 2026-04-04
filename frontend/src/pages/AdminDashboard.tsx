import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getAdminUsers, getAdminMatches, createMatch, deleteMatch } from '../lib/api';
import { LogOut, Heart, User as UserIcon, CheckCircle, XCircle, Zap, Star } from 'lucide-react';

// ─── Compatibility Engine ──────────────────────────────────────────────────

const isCompatible = (u1: any, u2: any): boolean => {
    const u1WantsU2 = u1.interested_in === 'both' || u1.interested_in === u2.gender;
    const u2WantsU1 = u2.interested_in === 'both' || u2.interested_in === u1.gender;
    return u1WantsU2 && u2WantsU1;
};

const calculateScore = (u1: any, u2: any): number => {
    let score = 0;

    // Age proximity — up to 30 pts
    const age1 = parseInt(u1.age);
    const age2 = parseInt(u2.age);
    if (age1 && age2) {
        const diff = Math.abs(age1 - age2);
        if (diff === 0)       score += 30;
        else if (diff <= 2)   score += 25;
        else if (diff <= 5)   score += 18;
        else if (diff <= 8)   score += 10;
        else if (diff <= 12)  score += 5;
        else                  score += 1;
    }

    // Same city — 20 pts
    if (u1.city && u2.city &&
        u1.city.trim().toLowerCase() === u2.city.trim().toLowerCase()) {
        score += 20;
    }

    // About me keyword overlap — up to 50 pts (Jaccard similarity)
    if (u1.about_me && u2.about_me) {
        const words1 = new Set<string>(
            u1.about_me.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3)
        );
        const words2 = new Set<string>(
            u2.about_me.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3)
        );
        const intersection = [...words1].filter(w => words2.has(w)).length;
        const union = new Set([...words1, ...words2]).size;
        if (union > 0) score += Math.round((intersection / union) * 50);
    }

    return score; // max 100
};

const getScoreLabel = (score: number) => {
    if (score >= 70) return { label: 'Perfect Match', color: '#00E676' };
    if (score >= 50) return { label: 'Great Match', color: 'var(--secondary)' };
    if (score >= 30) return { label: 'Good Match', color: '#FF8A00' };
    return { label: 'Possible Match', color: 'var(--text-secondary)' };
};

// ──────────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [autoMatching, setAutoMatching] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) { navigate('/admin'); return; }
            fetchData();
        };
        checkAuth();
    }, [navigate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const u = await getAdminUsers();
            const m = await getAdminMatches();
            setUsers(u);
            setMatches(m);
        } catch (e: any) {
            setMessage('Error fetching data: ' + e.message);
        }
        setLoading(false);
    };

    const handleMatch = async (user2_id: string) => {
        if (!selectedUser) return;
        try {
            await createMatch(selectedUser.id, user2_id);
            setMessage('Match created successfully!');
            setSelectedUser(null);
            fetchData();
        } catch (e: any) {
            setMessage('Error creating match: ' + e.message);
        }
    };

    const handleDeleteMatch = async (match_id: string) => {
        if (!window.confirm('Delete this match? Users will return to the unmatched pool.')) return;
        try {
            await deleteMatch(match_id);
            setMessage('Match deleted. Users are back in the pool.');
            fetchData();
        } catch (e: any) {
            setMessage('Error deleting match: ' + e.message);
        }
    };

    // ── Auto Match ──────────────────────────────────────────────────────────
    const handleAutoMatch = async () => {
        if (!window.confirm(
            `Auto-Match will pair all compatible unmatched users by highest compatibility score.\n\nThis will create ${Math.floor(unmatchedUsers.length / 2)} match(es). Proceed?`
        )) return;

        setAutoMatching(true);
        setMessage('');

        try {
            const pool = [...unmatchedUsers];
            const matched = new Set<string>();
            let created = 0;

            // Build all valid pairs with scores
            const pairs: { u1: any; u2: any; score: number }[] = [];
            for (let i = 0; i < pool.length; i++) {
                for (let j = i + 1; j < pool.length; j++) {
                    if (isCompatible(pool[i], pool[j])) {
                        pairs.push({
                            u1: pool[i],
                            u2: pool[j],
                            score: calculateScore(pool[i], pool[j])
                        });
                    }
                }
            }

            // Sort best matches first, then greedily assign
            pairs.sort((a, b) => b.score - a.score);

            for (const pair of pairs) {
                if (!matched.has(pair.u1.id) && !matched.has(pair.u2.id)) {
                    await createMatch(pair.u1.id, pair.u2.id);
                    matched.add(pair.u1.id);
                    matched.add(pair.u2.id);
                    created++;
                }
            }

            if (created === 0) {
                setMessage('No compatible pairs found among unmatched users.');
            } else {
                setMessage(`✨ Auto-match complete! ${created} match${created !== 1 ? 'es' : ''} created.`);
            }
            fetchData();
        } catch (e: any) {
            setMessage('Error during auto-match: ' + e.message);
        }

        setAutoMatching(false);
    };
    // ────────────────────────────────────────────────────────────────────────

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    if (loading) return (
        <div className="app-container">
            <div className="loader-container">
                <div className="spinner"></div>
                <div className="loading-text">Loading Dashboard...</div>
            </div>
        </div>
    );

    const matchedUserIds = new Set<string>(matches.flatMap(m => [m.user1_id, m.user2_id]));
    const unmatchedUsers = users.filter(u => !matchedUserIds.has(u.id));

    // Potential matches for selected user — excluding already-matched users
    const potentialMatches = selectedUser
        ? users
            .filter(u => u.id !== selectedUser.id && !matchedUserIds.has(u.id))
            .filter(u => isCompatible(selectedUser, u))
            .map(u => ({ ...u, _score: calculateScore(selectedUser, u) }))
            .sort((a, b) => b._score - a._score)
        : [];

    return (
        <div className="app-container">
            <nav className="nav-header">
                <Link to="/" className="logo">
                    Mismatched <span style={{ fontSize: '1rem', opacity: 0.8 }}>| Admin</span>
                </Link>
                <div className="flex-gap-4">
                    <button onClick={handleLogout} className="btn btn-secondary"><LogOut size={18} /> Logout</button>
                </div>
            </nav>

            <main className="dashboard-container">
                {message && (
                    <div className={message.startsWith('Error') ? 'alert alert-error' : 'alert alert-success'}>
                        {message}
                    </div>
                )}

                {!selectedUser ? (
                    <>
                        {/* Header with Auto Match button */}
                        <div className="dashboard-header">
                            <div>
                                <h1>Admin Portal</h1>
                                <p>
                                    {unmatchedUsers.length} user{unmatchedUsers.length !== 1 ? 's' : ''} waiting · Click a user to manually match them
                                </p>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleAutoMatch}
                                disabled={autoMatching || unmatchedUsers.length < 2}
                                style={{
                                    background: 'linear-gradient(135deg, #8B5CF6, #FF2E63)',
                                    boxShadow: '0 8px 20px -6px rgba(139,92,246,0.6)',
                                    gap: '0.6rem',
                                    padding: '1rem 1.75rem',
                                    fontSize: '1rem'
                                }}
                            >
                                <Zap size={20} />
                                {autoMatching ? 'Matching...' : 'Auto Match All'}
                            </button>
                        </div>

                        {/* Unmatched users grid */}
                        <div className="grid-cards animate-fade-in">
                            {unmatchedUsers.map(u => (
                                <div key={u.id} className="user-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedUser(u)}>
                                    {u.profile_photo
                                        ? <img src={u.profile_photo} alt={u.full_name} className="user-card-img" />
                                        : <div className="user-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <UserIcon size={48} color="var(--text-secondary)" />
                                          </div>
                                    }
                                    <div className="user-card-body">
                                        <div className="user-card-title">
                                            {u.full_name || 'Incomplete Profile'}
                                            <span className="user-badge">{u.gender}</span>
                                        </div>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                            {u.age && `${u.age} yrs`} {u.city && `· ${u.city}`}
                                        </p>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            Interested in: {u.interested_in}
                                        </p>
                                        <button
                                            className="btn btn-outline full-width mt-4"
                                            onClick={(e) => { e.stopPropagation(); setSelectedUser(u); }}
                                        >
                                            Find Match
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {unmatchedUsers.length === 0 && (
                                <p className="text-center" style={{ gridColumn: '1/-1', padding: '2rem', background: 'var(--surface)', borderRadius: '16px' }}>
                                    All users have been successfully matched! 🎉
                                </p>
                            )}
                        </div>

                        {/* Existing matches */}
                        <div className="dashboard-header mt-4" style={{ marginTop: '4rem' }}>
                            <div>
                                <h2>Matched Pairs</h2>
                                <p>These users have been matched. Remove a match to return them to the pool.</p>
                            </div>
                        </div>
                        <div className="glass-panel text-left animate-fade-in">
                            {matches.length === 0
                                ? <p>No matches yet.</p>
                                : (
                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                        {matches.map(m => (
                                            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--surface-light)', borderRadius: '12px' }}>
                                                <div className="flex-gap-4">
                                                    <div style={{ fontWeight: '600' }}>{m.user1?.full_name || 'User 1'}</div>
                                                    <Heart size={16} color="var(--primary)" />
                                                    <div style={{ fontWeight: '600' }}>{m.user2?.full_name || 'User 2'}</div>
                                                </div>
                                                <div className="flex-gap-4">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontSize: '0.9rem' }}>
                                                        <CheckCircle size={16} /> Matched
                                                    </div>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,46,99,0.1)', color: 'var(--primary)', borderColor: 'rgba(255,46,99,0.2)' }}
                                                        onClick={() => handleDeleteMatch(m.id)}
                                                    >
                                                        <XCircle size={14} /> Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            }
                        </div>
                    </>
                ) : (
                    // ── Manual match view ──────────────────────────────────────────────
                    <div className="animate-fade-in">
                        <button className="btn btn-secondary mb-4" onClick={() => setSelectedUser(null)}>
                            ← Back
                        </button>
                        <div className="dashboard-header">
                            <div>
                                <h1>Matching for {selectedUser.full_name}</h1>
                                <p>Sorted by compatibility score — highest first.</p>
                            </div>
                        </div>

                        <div className="grid-cards">
                            {potentialMatches.map(u => {
                                const { label, color } = getScoreLabel(u._score);
                                return (
                                    <div key={u.id} className="user-card">
                                        {u.profile_photo
                                            ? <img src={u.profile_photo} alt={u.full_name} className="user-card-img" style={{ height: '280px' }} />
                                            : <div className="user-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '280px' }}>
                                                <UserIcon size={48} color="var(--text-secondary)" />
                                              </div>
                                        }

                                        {/* Score badge */}
                                        <div style={{
                                            position: 'absolute',
                                            top: '12px',
                                            right: '12px',
                                            background: 'rgba(0,0,0,0.75)',
                                            backdropFilter: 'blur(8px)',
                                            border: `1px solid ${color}`,
                                            borderRadius: '999px',
                                            padding: '0.3rem 0.75rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            color
                                        }}>
                                            <Star size={13} fill={color} />
                                            {u._score}% · {label}
                                        </div>

                                        <div className="user-card-body">
                                            <div className="user-card-title">
                                                {u.full_name}
                                                <span className="user-badge">{u.age} · {u.city}</span>
                                            </div>
                                            <p style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', minHeight: '50px' }}>{u.about_me}</p>
                                            <button
                                                className="btn full-width mt-4"
                                                style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color: 'white' }}
                                                onClick={() => handleMatch(u.id)}
                                            >
                                                <Heart size={18} /> Match with {selectedUser.full_name.split(' ')[0]}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {potentialMatches.length === 0 && (
                                <div className="glass-panel text-center" style={{ gridColumn: '1/-1' }}>
                                    <p>No compatible users found for {selectedUser.full_name}.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
