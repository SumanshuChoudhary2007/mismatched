import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getAdminUsers, getAdminMatches, createMatch, deleteMatch } from '../lib/api';
import {
    LogOut, Heart, User as UserIcon, CheckCircle, XCircle, Zap, Star,
    BarChart2, Settings, Shield, FileText, AlertTriangle, Eye,
    Sliders, RefreshCw, Trash2, Save, PlusCircle, ToggleLeft, ToggleRight,
    Clock, Users, TrendingUp, Database, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface AlgoWeights { age: number; city: number; bio: number; prompts: number; }
interface DynamicPrompt { id: string; question: string; placeholder: string; active: boolean; }

// ─── Compatibility Engine ────────────────────────────────────────────────────
const isCompatible = (u1: any, u2: any): boolean => {
    const u1WantsU2 = u1.interested_in === 'both' || u1.interested_in === u2.gender;
    const u2WantsU1 = u2.interested_in === 'both' || u2.interested_in === u1.gender;
    return u1WantsU2 && u2WantsU1;
};

const calculateScore = (u1: any, u2: any, w: AlgoWeights): number => {
    let score = 0;
    const age1 = parseInt(u1.age), age2 = parseInt(u2.age);
    if (age1 && age2) {
        const diff = Math.abs(age1 - age2);
        const ratio = diff === 0 ? 1 : diff <= 2 ? 0.85 : diff <= 5 ? 0.6 : diff <= 8 ? 0.35 : diff <= 12 ? 0.17 : 0.03;
        score += w.age * ratio;
    }
    if (u1.city && u2.city && u1.city.trim().toLowerCase() === u2.city.trim().toLowerCase()) score += w.city;
    if (u1.about_me && u2.about_me) {
        const words1 = new Set<string>(u1.about_me.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3));
        const words2 = new Set<string>(u2.about_me.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3));
        const inter = [...words1].filter(w => words2.has(w)).length;
        const union = new Set([...words1, ...words2]).size;
        if (union > 0) score += w.bio * (inter / union);
    }
    const p1 = (u1.prompts || []).map((p: any) => p.answer || '').join(' ');
    const p2 = (u2.prompts || []).map((p: any) => p.answer || '').join(' ');
    if (p1.trim() && p2.trim()) {
        const pw1 = new Set<string>(p1.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3));
        const pw2 = new Set<string>(p2.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3));
        const pI = [...pw1].filter(w => pw2.has(w)).length;
        const pU = new Set([...pw1, ...pw2]).size;
        if (pU > 0) score += w.prompts * (pI / pU);
    }
    return Math.min(Math.round(score), 100);
};

const getScoreLabel = (score: number) => {
    if (score >= 70) return { label: 'Perfect', color: '#00E676' };
    if (score >= 50) return { label: 'Great', color: 'var(--secondary)' };
    if (score >= 30) return { label: 'Good', color: '#FF8A00' };
    return { label: 'Fair', color: 'var(--text-secondary)' };
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatTile = ({ icon, label, value, sub, color = 'var(--primary)' }: any) => (
    <div className="admin-stat-tile">
        <div className="admin-stat-icon" style={{ background: `${color}18`, borderColor: `${color}40` }}>
            {icon}
        </div>
        <div>
            <div className="admin-stat-value">{value}</div>
            <div className="admin-stat-label">{label}</div>
            {sub && <div className="admin-stat-sub">{sub}</div>}
        </div>
    </div>
);

// ─── Tab Button ──────────────────────────────────────────────────────────────
const TabBtn = ({ id, active, icon, label, badge, onClick }: any) => (
    <button className={`admin-tab-btn ${active ? 'active' : ''}`} onClick={() => onClick(id)}>
        {icon} <span>{label}</span>
        {badge > 0 && <span className="admin-tab-badge">{badge}</span>}
    </button>
);

// ────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'matches' | 'analytics' | 'algorithm' | 'moderation' | 'prompts'>('matches');
    const [users, setUsers] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [autoMatching, setAutoMatching] = useState(false);

    // Algorithm weights
    const [weights, setWeights] = useState<AlgoWeights>({ age: 30, city: 20, bio: 30, prompts: 20 });
    const [regLimit, setRegLimit] = useState(20);
    const [savingWeights, setSavingWeights] = useState(false);

    // Analytics
    const [analytics, setAnalytics] = useState<any>({});
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // Moderation
    const [reports, setReports] = useState<any[]>([]);
    const [quarantined, setQuarantined] = useState<any[]>([]);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);
    const [reportMessages, setReportMessages] = useState<Record<string, any[]>>({});

    // Prompts
    const [dynamicPrompts, setDynamicPrompts] = useState<DynamicPrompt[]>([]);
    const [savingPrompts, setSavingPrompts] = useState(false);
    const [newPromptQ, setNewPromptQ] = useState('');

    // ── Auth & initial load ──────────────────────────────────────────────────
    useEffect(() => {
        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) { navigate('/admin'); return; }
            fetchData();
            loadSettings();
        };
        checkAuth();
    }, [navigate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [u, m] = await Promise.all([getAdminUsers(), getAdminMatches()]);
            setUsers(u);
            setMatches(m);
            // Quarantined users
            const { data: qData } = await supabase.from('profiles').select('*').eq('is_quarantined', true).eq('is_admin', false);
            setQuarantined(qData || []);
            // Reports
            const { data: rData } = await supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(full_name, email), reported:profiles!reports_reported_id_fkey(full_name, email)').order('created_at', { ascending: false });
            setReports(rData || []);
        } catch (e: any) { setMessage('Error: ' + e.message); }
        setLoading(false);
    };

    const loadSettings = async () => {
        const { data } = await supabase.from('app_settings').select('*').in('key', ['algo_weights', 'registration_limit', 'dynamic_prompts']);
        if (!data) return;
        data.forEach(row => {
            if (row.key === 'algo_weights') setWeights(row.value);
            if (row.key === 'registration_limit') setRegLimit(Number(row.value));
            if (row.key === 'dynamic_prompts') setDynamicPrompts(row.value);
        });
    };

    // ── Analytics ────────────────────────────────────────────────────────────
    const loadAnalytics = useCallback(async () => {
        setAnalyticsLoading(true);
        const start = performance.now();

        const [
            { count: totalUsers },
            { count: totalMatches },
            { count: maleCount },
            { count: femaleCount },
            { count: verifiedCount },
            { count: pendingReports },
            { data: recentUsers },
        ] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false),
            supabase.from('matches').select('*', { count: 'exact', head: true }),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('gender', 'male').eq('is_admin', false),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('gender', 'female').eq('is_admin', false),
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('face_verified', true),
            supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('profiles').select('created_at').eq('is_admin', false).order('created_at', { ascending: false }).limit(10),
        ]);

        const dbMs = Math.round(performance.now() - start);

        const matchRate = totalUsers && totalUsers > 0 ? Math.round(((totalMatches || 0) * 2 / totalUsers) * 100) : 0;
        const unmatchedCount = (totalUsers || 0) - (totalMatches || 0) * 2;

        // Signups in last 24h
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        const recent24h = (recentUsers || []).filter((u: any) => u.created_at > yesterday).length;

        setAnalytics({
            totalUsers, totalMatches, maleCount, femaleCount, verifiedCount, pendingReports,
            matchRate, unmatchedCount, dbMs, recent24h,
            maleLimit: regLimit, femaleLimit: regLimit,
            maleSlots: regLimit - (maleCount || 0),
            femaleSlots: regLimit - (femaleCount || 0),
        });
        setAnalyticsLoading(false);
    }, [regLimit]);

    useEffect(() => {
        if (activeTab === 'analytics') loadAnalytics();
    }, [activeTab, loadAnalytics]);

    // ── Save algorithm weights ────────────────────────────────────────────────
    const saveWeights = async () => {
        setSavingWeights(true);
        const total = weights.age + weights.city + weights.bio + weights.prompts;
        await supabase.from('app_settings').upsert([
            { key: 'algo_weights', value: weights },
            { key: 'registration_limit', value: regLimit },
        ]);
        setMessage(total === 100 ? '✅ Settings saved!' : `⚠️ Saved, but weights total ${total}/100. Consider adjusting.`);
        setSavingWeights(false);
    };

    // ── Save prompts ─────────────────────────────────────────────────────────
    const savePrompts = async () => {
        setSavingPrompts(true);
        await supabase.from('app_settings').upsert([{ key: 'dynamic_prompts', value: dynamicPrompts }]);
        setMessage('✅ Prompts updated!');
        setSavingPrompts(false);
    };

    const addPrompt = () => {
        if (!newPromptQ.trim()) return;
        setDynamicPrompts(prev => [...prev, { id: `custom_${Date.now()}`, question: newPromptQ.trim(), placeholder: 'Your answer...', active: true }]);
        setNewPromptQ('');
    };

    // ── Moderation ───────────────────────────────────────────────────────────
    const approveUser = async (userId: string) => {
        await supabase.from('profiles').update({ is_quarantined: false, quarantine_reason: null }).eq('id', userId);
        setMessage('✅ User approved and moved to active pool.');
        fetchData();
    };

    const banUser = async (userId: string, reason = 'Banned by admin') => {
        if (!window.confirm('Ban this user? They will be permanently removed from the platform.')) return;
        await supabase.from('profiles').update({ is_banned: true, ban_reason: reason }).eq('id', userId);
        setMessage('🚫 User banned.');
        fetchData();
    };

    const quarantineUser = async (userId: string, reason = 'Manually quarantined by admin') => {
        if (!window.confirm('Move this user to Quarantine? They will be hidden from matching.')) return;
        await supabase.from('profiles').update({ is_quarantined: true, quarantine_reason: reason }).eq('id', userId);
        setMessage('⚠️ User quarantined.');
        if (selectedUser?.id === userId) setSelectedUser(null);
        fetchData();
    };

    const updateReportStatus = async (reportId: string, status: string) => {
        await supabase.from('reports').update({ status }).eq('id', reportId);
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
    };

    const loadReportMessages = async (matchId: string) => {
        if (reportMessages[matchId]) return;
        const { data } = await supabase.from('messages').select('*, sender:profiles(full_name)').eq('match_id', matchId).order('created_at');
        setReportMessages(prev => ({ ...prev, [matchId]: data || [] }));
    };

    // ── Match handlers ────────────────────────────────────────────────────────
    const handleMatch = async (user2_id: string, score = 0) => {
        if (!selectedUser) return;
        try {
            await createMatch(selectedUser.id, user2_id, score);
            setMessage('Match created!');
            setSelectedUser(null);
            fetchData();
        } catch (e: any) { setMessage('Error: ' + e.message); }
    };

    const handleDeleteMatch = async (match_id: string) => {
        if (!window.confirm('Delete this match?')) return;
        await deleteMatch(match_id);
        setMessage('Match deleted.');
        fetchData();
    };

    const handleAutoMatch = async () => {
        if (!window.confirm(`Auto-match all ${unmatchedUsers.length} unmatched users? This will create up to ${Math.floor(unmatchedUsers.length / 2)} matches.`)) return;
        setAutoMatching(true);
        setMessage('');
        try {
            const pool = [...unmatchedUsers];
            const matched = new Set<string>();
            let created = 0;
            const pairs: { u1: any; u2: any; score: number }[] = [];
            for (let i = 0; i < pool.length; i++)
                for (let j = i + 1; j < pool.length; j++)
                    if (isCompatible(pool[i], pool[j]))
                        pairs.push({ u1: pool[i], u2: pool[j], score: calculateScore(pool[i], pool[j], weights) });
            pairs.sort((a, b) => b.score - a.score);
            for (const pair of pairs) {
                if (!matched.has(pair.u1.id) && !matched.has(pair.u2.id)) {
                    await createMatch(pair.u1.id, pair.u2.id, pair.score);
                    matched.add(pair.u1.id); matched.add(pair.u2.id); created++;
                }
            }
            setMessage(created === 0 ? 'No compatible pairs found.' : `✨ ${created} match${created !== 1 ? 'es' : ''} created!`);
            fetchData();
        } catch (e: any) { setMessage('Error: ' + e.message); }
        setAutoMatching(false);
    };

    const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };

    if (loading) return (
        <div className="app-container">
            <div className="loader-container"><div className="spinner" /><div className="loading-text">Loading Admin Portal...</div></div>
        </div>
    );

    const matchedUserIds = new Set<string>(matches.flatMap(m => [m.user1_id, m.user2_id]));
    const unmatchedUsers = users.filter(u => !matchedUserIds.has(u.id));
    const potentialMatches = selectedUser
        ? users.filter(u => u.id !== selectedUser.id && !matchedUserIds.has(u.id) && isCompatible(selectedUser, u))
            .map(u => ({ ...u, _score: calculateScore(selectedUser, u, weights) }))
            .sort((a, b) => b._score - a._score)
        : [];
    const pendingReportsCount = reports.filter(r => r.status === 'pending').length;

    return (
        <div className="app-container" style={{ minHeight: '100vh' }}>
            {/* ── NAV ── */}
            <nav className="nav-header">
                <Link to="/" className="logo">Mismatched <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>| Admin</span></Link>
                <div className="flex-gap-4">
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Limit: <strong style={{ color: 'var(--primary)' }}>{regLimit}/gender</strong></span>
                    <button onClick={() => fetchData()} className="btn btn-secondary" style={{ padding: '0.6rem 0.9rem' }}><RefreshCw size={16} /></button>
                    <button onClick={handleLogout} className="btn btn-secondary"><LogOut size={18} /> Logout</button>
                </div>
            </nav>

            {/* ── TABS ── */}
            <div className="admin-tabs-bar">
                <TabBtn id="matches"    active={activeTab === 'matches'}    icon={<Heart size={16} />}    label="Matches"    badge={unmatchedUsers.length} onClick={setActiveTab} />
                <TabBtn id="analytics"  active={activeTab === 'analytics'}  icon={<BarChart2 size={16} />} label="Analytics"  badge={0}                    onClick={setActiveTab} />
                <TabBtn id="algorithm"  active={activeTab === 'algorithm'}  icon={<Sliders size={16} />}  label="Algorithm"  badge={0}                    onClick={setActiveTab} />
                <TabBtn id="moderation" active={activeTab === 'moderation'} icon={<Shield size={16} />}   label="Moderation" badge={pendingReportsCount + quarantined.length} onClick={setActiveTab} />
                <TabBtn id="prompts"    active={activeTab === 'prompts'}    icon={<FileText size={16} />} label="Prompts"    badge={0}                    onClick={setActiveTab} />
            </div>

            <main className="dashboard-container">
                {message && (
                    <div className={`alert ${message.startsWith('Error') || message.startsWith('⚠️') ? 'alert-error' : 'alert-success'} animate-fade-in`} style={{ marginBottom: '1.5rem' }}>
                        {message}
                        <button onClick={() => setMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '1rem' }}>✕</button>
                    </div>
                )}

                {/* ════════════════════════════════════════
                    TAB: MATCHES
                ════════════════════════════════════════ */}
                {activeTab === 'matches' && (
                    <div className="animate-fade-in">
                        {!selectedUser ? (
                            <>
                                <div className="dashboard-header">
                                    <div>
                                        <h1>Matchmaking Hub</h1>
                                        <p>{unmatchedUsers.length} unmatched · {matches.length} active pairs · weights: age {weights.age}pt / city {weights.city}pt / bio {weights.bio}pt / prompts {weights.prompts}pt</p>
                                    </div>
                                    <button className="btn btn-primary" onClick={handleAutoMatch} disabled={autoMatching || unmatchedUsers.length < 2}
                                        style={{ background: 'linear-gradient(135deg,#8B5CF6,#FF2E63)', boxShadow: '0 8px 20px -6px rgba(139,92,246,0.6)' }}>
                                        <Zap size={20} /> {autoMatching ? 'Matching...' : 'Auto Match All'}
                                    </button>
                                </div>

                                <div className="grid-cards animate-fade-in">
                                    {unmatchedUsers.map(u => (
                                        <div key={u.id} className="user-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedUser(u)}>
                                            {u.profile_photo
                                                ? <img src={u.profile_photo} alt={u.full_name} className="user-card-img" />
                                                : <div className="user-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={48} color="var(--text-secondary)" /></div>}
                                            {u.face_verified && <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,230,118,0.2)', border: '1px solid #00E676', borderRadius: '999px', padding: '2px 8px', fontSize: '0.7rem', color: '#00E676', fontWeight: 700 }}>✓ Verified</span>}
                                            <div className="user-card-body">
                                                <div className="user-card-title">{u.full_name || 'Incomplete'}<span className="user-badge">{u.gender}</span></div>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.3rem 0' }}>{u.age && `${u.age} yrs`} {u.city && `· ${u.city}`}</p>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Wants: {u.interested_in}</p>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                                    <button className="btn btn-outline" style={{ flex: 2 }} onClick={e => { e.stopPropagation(); setSelectedUser(u); }}>Find Match</button>
                                                    <button className="btn" style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,138,0,0.1)', color: '#FF8A00', border: '1px solid rgba(255,138,0,0.3)', fontSize: '0.82rem' }} onClick={(e) => { e.stopPropagation(); quarantineUser(u.id); }} title="Quarantine User"><AlertTriangle size={14} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {unmatchedUsers.length === 0 && <p className="text-center" style={{ gridColumn: '1/-1', padding: '3rem', background: 'var(--surface)', borderRadius: '16px' }}>🎉 All users are matched!</p>}
                                </div>

                                <div className="dashboard-header" style={{ marginTop: '3rem' }}><div><h2>Active Pairs</h2><p>Remove a match to return users to the pool.</p></div></div>
                                <div className="glass-panel animate-fade-in">
                                    {matches.length === 0 ? <p>No matches yet.</p> : (
                                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                                            {matches.map(m => {
                                                const sl = getScoreLabel(m.compatibility_score || 0);
                                                return (
                                                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.1rem', background: 'var(--surface-light)', borderRadius: '12px', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        <div className="flex-gap-4">
                                                            <span style={{ fontWeight: 600 }}>{m.user1?.full_name || m.user1_name}</span>
                                                            <Heart size={14} color="var(--primary)" />
                                                            <span style={{ fontWeight: 600 }}>{m.user2?.full_name || m.user2_name}</span>
                                                            {m.compatibility_score > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: sl.color, background: `${sl.color}18`, padding: '2px 8px', borderRadius: '999px' }}>{m.compatibility_score}% · {sl.label}</span>}
                                                        </div>
                                                        <div className="flex-gap-4">
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', fontSize: '0.85rem' }}><CheckCircle size={14} /> Matched</span>
                                                            <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', background: 'rgba(255,46,99,0.1)', color: 'var(--primary)', borderColor: 'rgba(255,46,99,0.2)', fontSize: '0.82rem' }} onClick={() => handleDeleteMatch(m.id)}>
                                                                <XCircle size={14} /> Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="animate-fade-in">
                                <button className="btn btn-secondary mb-4" onClick={() => setSelectedUser(null)}>← Back</button>
                                <div className="dashboard-header">
                                    <div><h1>Matching: {selectedUser.full_name}</h1><p>Sorted by compatibility · highest first</p></div>
                                </div>
                                <div className="grid-cards">
                                    {potentialMatches.map(u => {
                                        const { label, color } = getScoreLabel(u._score);
                                        return (
                                            <div key={u.id} className="user-card">
                                                {u.profile_photo
                                                    ? <img src={u.profile_photo} alt={u.full_name} className="user-card-img" style={{ height: '260px' }} />
                                                    : <div className="user-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '260px' }}><UserIcon size={48} color="var(--text-secondary)" /></div>}
                                                <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', border: `1px solid ${color}`, borderRadius: '999px', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', fontWeight: 700, color }}>
                                                    <Star size={12} fill={color} />{u._score}% · {label}
                                                </div>
                                                <div className="user-card-body">
                                                    <div className="user-card-title">{u.full_name}<span className="user-badge">{u.age} · {u.city}</span></div>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0', minHeight: 42 }}>{u.about_me}</p>
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                                        <button className="btn" style={{ flex: 3, background: 'linear-gradient(135deg,var(--primary),var(--secondary))', color: 'white' }} onClick={() => handleMatch(u.id, u._score)}>
                                                            <Heart size={18} /> Match
                                                        </button>
                                                        <button className="btn" style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,138,0,0.1)', color: '#FF8A00', border: '1px solid rgba(255,138,0,0.3)', fontSize: '0.82rem' }} onClick={(e) => { e.stopPropagation(); quarantineUser(u.id); }} title="Quarantine User"><AlertTriangle size={14} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {potentialMatches.length === 0 && <div className="glass-panel text-center" style={{ gridColumn: '1/-1' }}><p>No compatible users found.</p></div>}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ════════════════════════════════════════
                    TAB: ANALYTICS
                ════════════════════════════════════════ */}
                {activeTab === 'analytics' && (
                    <div className="animate-fade-in">
                        <div className="dashboard-header">
                            <div><h1>Analytics</h1><p>Real-time metrics from Supabase</p></div>
                            <button className="btn btn-secondary" onClick={loadAnalytics} disabled={analyticsLoading}>
                                <RefreshCw size={16} className={analyticsLoading ? 'spin' : ''} /> Refresh
                            </button>
                        </div>

                        {analyticsLoading ? <div className="loader-container" style={{ height: '30vh' }}><div className="spinner" /></div> : (
                            <>
                                <div className="admin-stats-grid">
                                    <StatTile icon={<Users size={22} color="var(--primary)" />}    label="Total Users"     value={analytics.totalUsers || 0}    sub={`+${analytics.recent24h || 0} in last 24h`} color="var(--primary)" />
                                    <StatTile icon={<Heart size={22} color="#00E676" />}            label="Active Matches"  value={analytics.totalMatches || 0}  sub={`${analytics.matchRate || 0}% match rate`}  color="#00E676" />
                                    <StatTile icon={<TrendingUp size={22} color="var(--secondary)" />} label="Unmatched Users" value={analytics.unmatchedCount || 0} sub="waiting for a match"               color="var(--secondary)" />
                                    <StatTile icon={<Database size={22} color="#FF8A00" />}         label="DB Query Time"   value={`${analytics.dbMs || 0}ms`}  sub="Supabase response"                      color="#FF8A00" />
                                    <StatTile icon={<CheckCircle size={22} color="#00E676" />}      label="Face-Verified"   value={analytics.verifiedCount || 0} sub={`of ${analytics.totalUsers || 0} users`}  color="#00E676" />
                                    <StatTile icon={<AlertTriangle size={22} color="var(--primary)" />} label="Pending Reports" value={analytics.pendingReports || 0} sub="need review"                    color="var(--primary)" />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
                                    {/* Gender split */}
                                    <div className="glass-panel">
                                        <h3 style={{ marginBottom: '1.2rem', fontWeight: 700 }}>Registration Slots</h3>
                                        {['male', 'female'].map(g => {
                                            const count = g === 'male' ? analytics.maleCount : analytics.femaleCount;
                                            const pct = Math.round(((count || 0) / regLimit) * 100);
                                            return (
                                                <div key={g} style={{ marginBottom: '1rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.4rem' }}>
                                                        <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{g === 'male' ? '♂ Boys' : '♀ Girls'}</span>
                                                        <span style={{ color: 'var(--text-secondary)' }}>{count || 0} / {regLimit} ({g === 'male' ? analytics.maleSlots : analytics.femaleSlots} slots left)</span>
                                                    </div>
                                                    <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
                                                        <div style={{ height: '100%', width: `${pct}%`, background: g === 'male' ? 'linear-gradient(90deg,#38BDF8,#0EA5E9)' : 'linear-gradient(90deg,var(--primary),#FF8A00)', borderRadius: 999, transition: 'width 0.8s ease' }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Current limit: {regLimit} per gender. Edit in Algorithm tab.</p>
                                    </div>

                                    {/* System health */}
                                    <div className="glass-panel">
                                        <h3 style={{ marginBottom: '1.2rem', fontWeight: 700 }}>System Health</h3>
                                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                                            {[
                                                { label: 'Database Status', value: 'Healthy ✅', color: '#00E676' },
                                                { label: 'Supabase Realtime', value: 'Connected ✅', color: '#00E676' },
                                                { label: 'Auth Service', value: 'Operational ✅', color: '#00E676' },
                                                { label: 'Query Latency', value: `${analytics.dbMs}ms ${analytics.dbMs < 200 ? '⚡' : analytics.dbMs < 500 ? '🟡' : '🔴'}`, color: analytics.dbMs < 200 ? '#00E676' : analytics.dbMs < 500 ? '#FF8A00' : 'var(--primary)' },
                                            ].map(item => (
                                                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'var(--surface-light)', borderRadius: '10px' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{item.label}</span>
                                                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: item.color }}>{item.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ════════════════════════════════════════
                    TAB: ALGORITHM CONTROL
                ════════════════════════════════════════ */}
                {activeTab === 'algorithm' && (
                    <div className="animate-fade-in">
                        <div className="dashboard-header">
                            <div><h1>Algorithm Control Centre</h1><p>Adjust matching weights &amp; platform limits in real-time. No deploy needed.</p></div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            {/* Weight sliders */}
                            <div className="glass-panel">
                                <h3 style={{ marginBottom: '0.4rem', fontWeight: 700 }}>Compatibility Weights</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Total should equal 100 pts for best results. Currently: <strong style={{ color: weights.age + weights.city + weights.bio + weights.prompts === 100 ? '#00E676' : 'var(--primary)' }}>{weights.age + weights.city + weights.bio + weights.prompts} pts</strong></p>

                                {([
                                    { key: 'age', label: '🎂 Age Proximity', desc: 'How much age similarity matters' },
                                    { key: 'city', label: '📍 Same City', desc: 'Bonus for users in the same city' },
                                    { key: 'bio', label: '📝 Bio Keyword Overlap', desc: 'Shared interests in bio text' },
                                    { key: 'prompts', label: '💬 Prompt Compatibility', desc: 'Personality prompt answer match' },
                                ] as const).map(({ key, label, desc }) => (
                                    <div key={key} className="algo-slider-group">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{label}</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{desc}</div>
                                            </div>
                                            <span className="algo-slider-val">{weights[key]} pts</span>
                                        </div>
                                        <input type="range" min={0} max={100} step={1} value={weights[key]}
                                            onChange={e => setWeights(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                                            className="algo-slider" />
                                    </div>
                                ))}
                            </div>

                            {/* Platform limits */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="glass-panel">
                                    <h3 style={{ marginBottom: '0.4rem', fontWeight: 700 }}>Registration Limit</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>Set the max users per gender. Change for events without redeploying.</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                        {[10, 20, 30, 50, 100].map(n => (
                                            <button key={n} className={`btn ${regLimit === n ? 'btn-primary' : 'btn-secondary'}`}
                                                style={{ padding: '0.5rem 1.1rem', fontSize: '0.9rem' }} onClick={() => setRegLimit(n)}>
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                    <input type="number" className="form-input" value={regLimit} min={1} max={500}
                                        onChange={e => setRegLimit(Number(e.target.value))}
                                        style={{ marginTop: '1rem', maxWidth: '120px' }} />
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Custom value: type above</p>
                                </div>

                                <div className="glass-panel">
                                    <h3 style={{ marginBottom: '0.4rem', fontWeight: 700 }}>Score Preview</h3>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Given current weights, how labels are assigned:</p>
                                    {[{ min: 70, max: 100, label: 'Perfect Match', color: '#00E676' }, { min: 50, max: 69, label: 'Great Match', color: 'var(--secondary)' }, { min: 30, max: 49, label: 'Good Match', color: '#FF8A00' }, { min: 0, max: 29, label: 'Fair Match', color: 'var(--text-secondary)' }].map(r => (
                                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', marginBottom: '0.4rem', background: `${r.color}10`, borderRadius: 10, border: `1px solid ${r.color}30` }}>
                                            <span style={{ fontWeight: 600, color: r.color, fontSize: '0.9rem' }}>{r.label}</span>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.min}–{r.max} pts</span>
                                        </div>
                                    ))}
                                </div>

                                <button className="btn btn-primary" onClick={saveWeights} disabled={savingWeights} style={{ fontSize: '1rem' }}>
                                    <Save size={18} /> {savingWeights ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════
                    TAB: MODERATION
                ════════════════════════════════════════ */}
                {activeTab === 'moderation' && (
                    <div className="animate-fade-in">
                        <div className="dashboard-header"><div><h1>Trust &amp; Safety Hub</h1><p>Review flagged users and reports. Keep the platform clean.</p></div></div>

                        {/* Quarantine Zone */}
                        <div style={{ marginBottom: '2.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <AlertTriangle size={20} color="#FF8A00" />
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Quarantine Zone</h2>
                                {quarantined.length > 0 && <span className="admin-tab-badge" style={{ background: '#FF8A00' }}>{quarantined.length}</span>}
                            </div>
                            {quarantined.length === 0 ? (
                                <div className="glass-panel text-center"><p style={{ color: 'var(--text-secondary)' }}>✅ No users in quarantine.</p></div>
                            ) : (
                                <div className="grid-cards">
                                    {quarantined.map(u => (
                                        <div key={u.id} className="user-card" style={{ borderColor: 'rgba(255,138,0,0.4)' }}>
                                            {u.profile_photo ? <img src={u.profile_photo} alt={u.full_name} className="user-card-img" /> : <div className="user-card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserIcon size={40} color="var(--text-secondary)" /></div>}
                                            <div className="user-card-body">
                                                <div className="user-card-title">{u.full_name || u.email}<span className="user-badge" style={{ background: 'rgba(255,138,0,0.2)', color: '#FF8A00' }}>Quarantined</span></div>
                                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.3rem 0' }}>{u.quarantine_reason || 'Flagged by system'}</p>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.email}</p>
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.82rem', padding: '0.5rem' }} onClick={() => approveUser(u.id)}><CheckCircle size={14} /> Approve</button>
                                                    <button className="btn" style={{ flex: 1, fontSize: '0.82rem', padding: '0.5rem', background: 'rgba(255,46,99,0.1)', color: 'var(--primary)', border: '1px solid rgba(255,46,99,0.3)' }} onClick={() => banUser(u.id, 'Quarantine review — banned')}><Trash2 size={14} /> Ban</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Reports */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                                <Shield size={20} color="var(--primary)" />
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>User Reports</h2>
                                {pendingReportsCount > 0 && <span className="admin-tab-badge">{pendingReportsCount} pending</span>}
                            </div>
                            {reports.length === 0 ? (
                                <div className="glass-panel text-center"><p style={{ color: 'var(--text-secondary)' }}>✅ No reports filed.</p></div>
                            ) : (
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    {reports.map(r => (
                                        <div key={r.id} className="glass-panel" style={{ padding: '1.25rem', borderColor: r.status === 'pending' ? 'rgba(255,46,99,0.3)' : 'var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                                        <span style={{ color: 'var(--secondary)' }}>{r.reporter?.full_name || 'Unknown'}</span>
                                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> reported </span>
                                                        <span style={{ color: 'var(--primary)' }}>{r.reported?.full_name || 'Unknown'}</span>
                                                    </div>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Reason: {r.reason}</p>
                                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{new Date(r.created_at).toLocaleString()}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                    <span className={`report-status-badge report-status-${r.status}`}>{r.status}</span>
                                                    {r.status === 'pending' && <>
                                                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => updateReportStatus(r.id, 'reviewed')}><Eye size={13} /> Review</button>
                                                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem', background: 'rgba(255,46,99,0.1)', color: 'var(--primary)' }} onClick={() => { banUser(r.reported_id); updateReportStatus(r.id, 'banned'); }}><XCircle size={13} /> Ban User</button>
                                                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.7rem' }} onClick={() => updateReportStatus(r.id, 'dismissed')}><CheckCircle size={13} /> Dismiss</button>
                                                    </>}
                                                </div>
                                            </div>
                                            {/* Chat Log Viewer */}
                                            {r.match_id && (
                                                <div style={{ marginTop: '0.75rem' }}>
                                                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                                                        onClick={() => { setExpandedReport(expandedReport === r.id ? null : r.id); if (expandedReport !== r.id) loadReportMessages(r.match_id); }}>
                                                        {expandedReport === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} View Chat Log
                                                    </button>
                                                    {expandedReport === r.id && (
                                                        <div style={{ marginTop: '0.75rem', background: 'var(--surface-light)', borderRadius: '12px', padding: '1rem', maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            {(reportMessages[r.match_id] || []).length === 0
                                                                ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No messages found.</p>
                                                                : (reportMessages[r.match_id] || []).map((msg: any) => (
                                                                    <div key={msg.id} style={{ fontSize: '0.85rem' }}>
                                                                        <span style={{ fontWeight: 700, color: 'var(--secondary)' }}>{msg.sender?.full_name}: </span>
                                                                        <span>{msg.content}</span>
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════
                    TAB: PROMPTS
                ════════════════════════════════════════ */}
                {activeTab === 'prompts' && (
                    <div className="animate-fade-in">
                        <div className="dashboard-header">
                            <div><h1>Dynamic Prompt Manager</h1><p>Add, edit, or disable personality prompts. Updates apply immediately — no redeploy needed.</p></div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                            {dynamicPrompts.map((p, i) => (
                                <div key={p.id} className="glass-panel" style={{ padding: '1.1rem 1.3rem', borderColor: p.active ? 'rgba(8,217,214,0.25)' : 'var(--border)', display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={p.question}
                                            onChange={e => setDynamicPrompts(prev => prev.map((x, j) => j === i ? { ...x, question: e.target.value } : x))}
                                            style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}
                                        />
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={p.placeholder}
                                            placeholder="Placeholder hint..."
                                            onChange={e => setDynamicPrompts(prev => prev.map((x, j) => j === i ? { ...x, placeholder: e.target.value } : x))}
                                            style={{ fontSize: '0.85rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingTop: '0.25rem' }}>
                                        <button className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}
                                            onClick={() => setDynamicPrompts(prev => prev.map((x, j) => j === i ? { ...x, active: !x.active } : x))}>
                                            {p.active ? <><ToggleRight size={16} color="var(--secondary)" /> Active</> : <><ToggleLeft size={16} /> Disabled</>}
                                        </button>
                                        <button className="btn" style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,46,99,0.1)', color: 'var(--primary)', border: '1px solid rgba(255,46,99,0.3)', fontSize: '0.82rem' }}
                                            onClick={() => setDynamicPrompts(prev => prev.filter((_, j) => j !== i))}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add new prompt */}
                        <div className="glass-panel" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <label className="form-label"><PlusCircle size={15} style={{ display: 'inline', marginRight: '0.4rem' }} />Add New Question</label>
                                <input type="text" className="form-input" placeholder="e.g. My ideal first date is..." value={newPromptQ} onChange={e => setNewPromptQ(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addPrompt()} />
                            </div>
                            <button className="btn btn-outline" onClick={addPrompt} disabled={!newPromptQ.trim()} style={{ marginBottom: '0.05rem' }}><PlusCircle size={16} /> Add</button>
                            <button className="btn btn-primary" onClick={savePrompts} disabled={savingPrompts}><Save size={16} /> {savingPrompts ? 'Saving...' : 'Publish Changes'}</button>
                        </div>

                        <div className="glass-panel" style={{ marginTop: '1.5rem', background: 'rgba(8,217,214,0.05)', borderColor: 'rgba(8,217,214,0.2)' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                💡 <strong style={{ color: 'var(--secondary)' }}>Pro tip:</strong> Disabled prompts are hidden from the signup form but still counted in old user profiles. Active prompts appear in order shown above.
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
