import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getProfile, updateProfile, getMyMatches } from '../lib/api';
import { LogOut, Save, User as UserIcon, Heart } from 'lucide-react';

export default function UserDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [isEditing, setIsEditing] = useState(true);
    const [profile, setProfile] = useState({
        full_name: '', age: '', city: '', gender: 'male', interested_in: 'both', about_me: '', profile_photo: ''
    });
    const [matches, setMatches] = useState<any[]>([]);

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                navigate('/login');
                return;
            }
            try {
                const profileData = await getProfile();
                if (profileData) {
                    setProfile({
                        full_name: profileData.full_name || '',
                        age: profileData.age || '',
                        city: profileData.city || '',
                        gender: profileData.gender || 'male',
                        interested_in: profileData.interested_in || 'both',
                        about_me: profileData.about_me || '',
                        profile_photo: profileData.profile_photo || ''
                    });
                    if (profileData.full_name) {
                        setIsEditing(false);
                    }
                }
                const matchesData = await getMyMatches();
                setMatches(matchesData);
            } catch(e) { console.error(e); }
            setLoading(false);
        };
        checkAuthAndFetch();
    }, [navigate]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            await updateProfile(profile);
            setMessage('');
            setIsEditing(false);
        } catch (err: any) {
            setMessage('Error: ' + err.message);
        }
        setSaving(false);
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile({...profile, profile_photo: reader.result as string});
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    if (loading) return (
        <div className="app-container">
            <div className="loader-container">
                <div className="spinner"></div>
                <div className="loading-text">Loading Profile...</div>
            </div>
        </div>
    );

    return (
        <div className="app-container">
            <nav className="nav-header">
                <div className="logo">Mismatched</div>
                <button onClick={handleLogout} className="btn btn-secondary"><LogOut size={18}/> Logout</button>
            </nav>
            <main className="dashboard-container">
                <div className="dashboard-header">
                    <div>
                        <h1>Your Profile</h1>
                        <p>Complete your profile to get matched by our experts.</p>
                    </div>
                </div>

                {matches.length > 0 ? (
                    <div className="match-status-banner animate-fade-in">
                        <Heart size={48} color="var(--primary)" style={{margin: '0 auto 1rem'}} />
                        <h3>You have a match!</h3>
                        <p>Our experts have found someone for you.</p>
                        <div className="grid-cards mt-4" style={{justifyContent: 'center'}}>
                            {matches.map(m => (
                                <div key={m.id} className="user-card" style={{maxWidth: '300px', margin: '0 auto'}}>
                                    {m.match_profile?.profile_photo ? 
                                        <img src={m.match_profile.profile_photo} alt={m.match_profile.full_name} className="user-card-img" style={{height: '250px'}}/> :
                                        <div className="user-card-img" style={{display:'flex', alignItems:'center', justifyContent:'center'}}>
                                            <UserIcon size={48} color="var(--text-secondary)"/>
                                        </div>
                                    }
                                    <div className="user-card-body text-left">
                                        <div className="user-card-title">{m.match_profile?.full_name || 'Anonymous User'}</div>
                                        <p style={{fontSize:'0.9rem', color:'var(--text-secondary)'}}>
                                            {m.match_profile?.age} • {m.match_profile?.city}
                                        </p>
                                        <p style={{marginTop:'0.5rem', fontSize:'0.9rem'}}>{m.match_profile?.about_me}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : !isEditing ? (
                    <div className="match-status-banner animate-fade-in" style={{background: 'transparent', border: 'none'}}>
                        <div className="radar-container">
                            <div className="radar-ring"></div>
                            <div className="radar-ring"></div>
                            <div className="radar-ring"></div>
                            <Heart className="radar-heart" size={48} />
                        </div>
                        <div className="searching-text">Searching the universe for your perfect match...</div>
                        <p style={{marginTop: '0.5rem', color: 'var(--text-secondary)'}}>Our experts are currently analyzing your profile.</p>
                        <button className="btn btn-secondary mt-4" onClick={() => setIsEditing(true)}>Edit Profile</button>
                    </div>
                ) : null}

                {isEditing && (
                <div className="glass-panel animate-fade-in">
                    {message && <div className={message.startsWith('Error') ? "alert alert-error" : "alert alert-success"}>{message}</div>}
                    <form onSubmit={handleSave} style={{display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr'}}>
                        <div className="form-group" style={{gridColumn: '1 / -1'}}>
                            <label className="form-label">Profile Photo</label>
                            <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                                {profile.profile_photo && <img src={profile.profile_photo} alt="Preview" style={{width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover'}}/>}
                                <input type="file" accept="image/*" className="form-input" onChange={handlePhotoUpload} style={{flex: 1}} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <input type="text" className="form-input" value={profile.full_name} onChange={e => setProfile({...profile, full_name: e.target.value})} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Age</label>
                            <input type="number" className="form-input" value={profile.age} onChange={e => setProfile({...profile, age: e.target.value})} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">City</label>
                            <input type="text" className="form-input" value={profile.city} onChange={e => setProfile({...profile, city: e.target.value})} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Gender</label>
                            <select className="form-select" value={profile.gender} onChange={e => setProfile({...profile, gender: e.target.value})}>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>
                        <div className="form-group" style={{gridColumn: '1 / -1'}}>
                            <label className="form-label">I'm interested in</label>
                            <select className="form-select" value={profile.interested_in} onChange={e => setProfile({...profile, interested_in: e.target.value})}>
                                <option value="male">Men</option>
                                <option value="female">Women</option>
                                <option value="both">Both/Anyone</option>
                            </select>
                        </div>
                        <div className="form-group" style={{gridColumn: '1 / -1'}}>
                            <label className="form-label">About Me</label>
                            <textarea className="form-textarea" value={profile.about_me} onChange={e => setProfile({...profile, about_me: e.target.value})} placeholder="Tell us about your hobbies, ideal date, what you're looking for..." required />
                        </div>
                        <div style={{gridColumn: '1 / -1'}}>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                <Save size={18}/> {saving ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </form>
                </div>
                )}
            </main>
        </div>
    );
}
