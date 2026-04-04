import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getAdminUsers, getAdminMatches, createMatch, deleteMatch } from '../lib/api';
import { LogOut, Heart, User as UserIcon, CheckCircle, XCircle } from 'lucide-react';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                navigate('/admin');
                return;
            }
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
        } catch(e: any) {
            setMessage('Error creating match: ' + e.message);
        }
    };

    const handleDeleteMatch = async (match_id: string) => {
        if (!window.confirm('Are you sure you want to delete this match?')) return;
        try {
            await deleteMatch(match_id);
            setMessage('Match deleted successfully. Users are back in the pool.');
            fetchData();
        } catch(e: any) {
            setMessage('Error deleting match: ' + e.message);
        }
    };

    const getPotentialMatches = () => {
        if (!selectedUser) return [];

        // Build a set of all user IDs who already have any match
        const matchedUserIds = new Set<string>();
        matches.forEach(m => {
            matchedUserIds.add(m.user1_id);
            matchedUserIds.add(m.user2_id);
        });

        return users.filter(u => {
            if (u.id === selectedUser.id) return false;

            // Exclude anyone who is already matched with someone
            if (matchedUserIds.has(u.id)) return false;

            if (selectedUser.interested_in === 'male' && u.gender !== 'male') return false;
            if (selectedUser.interested_in === 'female' && u.gender !== 'female') return false;
            
            if (u.interested_in === 'male' && selectedUser.gender !== 'male') return false;
            if (u.interested_in === 'female' && selectedUser.gender !== 'female') return false;
            
            return true;
        });
    };

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

    const isMatched = (userId: string) => matches.some(m => m.user1_id === userId || m.user2_id === userId);
    const unmatchedUsers = users.filter(u => !isMatched(u.id));

    const potentialMatches = getPotentialMatches();

    return (
        <div className="app-container">
            <nav className="nav-header">
                <div className="logo cursor-pointer" onClick={() => setSelectedUser(null)}>Mismatched <span style={{fontSize:'1rem',opacity:0.8}}>| Admin</span></div>
                <div className="flex-gap-4">
                    <button onClick={handleLogout} className="btn btn-secondary"><LogOut size={18}/> Logout</button>
                </div>
            </nav>
            <main className="dashboard-container">
                {message && <div className={message.startsWith('Error') ? "alert alert-error" : "alert alert-success"}>{message}</div>}
                
                {!selectedUser ? (
                    <>
                        <div className="dashboard-header">
                            <div>
                                <h1>Admin Portal</h1>
                                <p>Select a user to find them a match.</p>
                            </div>
                        </div>
                        <div className="grid-cards animate-fade-in">
                            {unmatchedUsers.map(u => (
                                <div key={u.id} className="user-card" style={{cursor: 'pointer'}} onClick={() => setSelectedUser(u)}>
                                    {u.profile_photo ? 
                                        <img src={u.profile_photo} alt={u.full_name} className="user-card-img"/> :
                                        <div className="user-card-img" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>
                                            <UserIcon size={48} color="var(--text-secondary)"/>
                                        </div>
                                    }
                                    <div className="user-card-body">
                                        <div className="user-card-title">
                                            {u.full_name || 'Incomplete Profile'}
                                            <span className="user-badge">{u.gender}</span>
                                        </div>
                                        <p style={{fontSize:'0.9rem', color:'var(--text-secondary)', marginBottom: '0.5rem'}}>
                                            Interested in: {u.interested_in}
                                        </p>
                                        <p className="user-card-desc">{u.about_me || 'No description provided.'}</p>
                                        <button className="btn btn-outline full-width mt-4" onClick={(e) => { e.stopPropagation(); setSelectedUser(u); }}>
                                            Find Match
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {unmatchedUsers.length === 0 && <p className="text-center" style={{gridColumn:'1/-1', padding: '2rem', background: 'var(--surface)', borderRadius: '16px'}}>All users have been successfully matched or no users are registered yet.</p>}
                        </div>

                        <div className="dashboard-header mt-4" style={{marginTop:'4rem'}}>
                            <div>
                                <h2>Matched Users</h2>
                                <p>These pairs have already been perfectly matched by you.</p>
                            </div>
                        </div>
                        <div className="glass-panel text-left animate-fade-in">
                            {matches.length === 0 ? <p>No matches yet.</p> : (
                                <div style={{display:'grid', gap:'1rem'}}>
                                    {matches.map(m => (
                                        <div key={m.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1rem', background:'var(--surface-light)', borderRadius:'12px'}}>
                                            <div className="flex-gap-4">
                                                <div style={{fontWeight:'600'}}>{m.user1?.full_name || 'User 1'}</div>
                                                <Heart size={16} color="var(--primary)" />
                                                <div style={{fontWeight:'600'}}>{m.user2?.full_name || 'User 2'}</div>
                                            </div>
                                            <div className="flex-gap-4">
                                                <div style={{display:'flex', alignItems:'center', gap:'0.5rem', color:'var(--success)', fontSize:'0.9rem'}}>
                                                    <CheckCircle size={16}/> Matched
                                                </div>
                                                <button className="btn btn-secondary" style={{padding: '0.4rem 0.8rem', background: 'rgba(255, 46, 99, 0.1)', color: 'var(--primary)', borderColor: 'rgba(255, 46, 99, 0.2)'}} onClick={() => handleDeleteMatch(m.id)}>
                                                    <XCircle size={14}/> Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="animate-fade-in">
                        <button className="btn btn-secondary mb-4" onClick={() => setSelectedUser(null)}>
                            &larr; Back to all users
                        </button>
                        <div className="dashboard-header">
                            <div>
                                <h1>Matching for {selectedUser.full_name}</h1>
                                <p>Showing compatible profiles based on preferences.</p>
                            </div>
                        </div>
                        
                        <div className="grid-cards">
                            {potentialMatches.map(u => (
                                <div key={u.id} className="user-card">
                                    {u.profile_photo ? 
                                        <img src={u.profile_photo} alt={u.full_name} className="user-card-img" style={{height:'300px'}}/> :
                                        <div className="user-card-img" style={{display:'flex', alignItems:'center', justifyContent:'center', height:'300px'}}>
                                            <UserIcon size={48} color="var(--text-secondary)"/>
                                        </div>
                                    }
                                    <div className="user-card-body">
                                        <div className="user-card-title">
                                            {u.full_name}
                                            <span className="user-badge">{u.age} • {u.city}</span>
                                        </div>
                                        <p style={{marginTop:'1rem', minHeight:'60px'}}>{u.about_me}</p>
                                        <button className="btn full-width mt-4" style={{background: 'linear-gradient(135deg, var(--primary), var(--secondary))', color:'white'}} onClick={() => handleMatch(u.id)}>
                                            <Heart size={18}/> Match with {selectedUser.full_name.split(' ')[0]}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {potentialMatches.length === 0 && (
                                <div className="glass-panel text-center" style={{gridColumn:'1/-1'}}>
                                    <p>No compatible users found matching preferences.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
