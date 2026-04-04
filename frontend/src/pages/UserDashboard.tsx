import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getProfile, updateProfile, getMyMatches, getMessages, sendMessage } from '../lib/api';
import { Camera, LogOut, Save, User as UserIcon, Heart, Send, MapPin } from 'lucide-react';

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
    const [messages, setMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [userId, setUserId] = useState('');

    const [cameraActive, setCameraActive] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Clean up camera on unmount
    useEffect(() => {
        return () => stopCamera();
    }, []);

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                navigate('/login');
                return;
            }
            setUserId(data.session.user.id);
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
                if (matchesData.length > 0) {
                    const msgData = await getMessages(matchesData[0].id);
                    setMessages(msgData);
                }
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

    const handleSendMessage = async (e: React.FormEvent, match_id: string) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        try {
            await sendMessage(match_id, chatInput.trim());
            setChatInput('');
            const msgData = await getMessages(match_id);
            setMessages(msgData);
        } catch(err: any) {
            alert('Error sending message: ' + err.message);
        }
    };

    const handleDropLocation = async (e: React.MouseEvent, match_id: string) => {
        e.preventDefault();
        const location = window.prompt("Suggest a precise meeting location (e.g. Starbeans Cafe on 5th Ave):");
        if (!location) return;
        
        try {
            await sendMessage(match_id, `📍 Let's meet here: ${location}`);
            const msgData = await getMessages(match_id);
            setMessages(msgData);
        } catch(err: any) {
            alert('Error sending location: ' + err.message);
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;
            setCameraActive(true);
            // videoRef assignment is handled in a useEffect
        } catch (err: any) {
            alert('Could not access camera: Ensure you have granted permission. ' + err.message);
        }
    };

    useEffect(() => {
        if (cameraActive && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [cameraActive]);

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg');
            setProfile({...profile, profile_photo: dataUrl});
            stopCamera();
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
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
                <Link to="/" className="logo">Mismatched</Link>
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
                        <div className="grid-cards mt-4" style={{justifyContent: 'center', gridTemplateColumns: '1fr', maxWidth: '800px', margin: '1rem auto'}}>
                            {matches.map(m => (
                                <div key={m.id} style={{width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                                    <div className="user-card" style={{maxWidth: '300px', margin: '0 auto', width: '100%'}}>
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
                                    
                                    <div className="chat-container animate-fade-in text-left" style={{background: 'var(--surface)'}}>
                                        <div className="chat-history">
                                            {messages.length === 0 && <p className="text-center text-secondary">No messages yet. Say hello!</p>}
                                            {messages.map(msg => (
                                                <div key={msg.id} className={`chat-message ${msg.sender_id === userId ? 'mine' : 'theirs'}`}>
                                                    <div>{msg.content}</div>
                                                    <div className="chat-message-meta">
                                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {messages.length >= 6 ? (
                                            <div className="chat-limit-warning">Message limit reached (6 max). Time to meet in person! 😉</div>
                                        ) : (
                                            <form className="chat-input-area" onSubmit={(e) => handleSendMessage(e, m.id)}>
                                                <button type="button" className="btn btn-secondary" style={{padding: '0.75rem', borderRadius: '50%'}} onClick={(e) => handleDropLocation(e, m.id)} title="Drop Meeting Location">
                                                    <MapPin size={18}/>
                                                </button>
                                                <input type="text" placeholder="Type a message..." value={chatInput} onChange={e => setChatInput(e.target.value)} maxLength={150} />
                                                <button type="submit" className="btn btn-primary" style={{padding: '0.75rem 1.25rem'}}><Send size={18}/></button>
                                            </form>
                                        )}
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
                            <label className="form-label">Live Photo Verification (Mandatory Anti-Fraud Measure)</label>
                            {cameraActive ? (
                                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center'}}>
                                    <video ref={videoRef} autoPlay playsInline style={{width: '100%', maxWidth: '400px', borderRadius: '16px', border: '2px solid var(--primary)'}} />
                                    <div style={{display: 'flex', gap: '1rem'}}>
                                        <button type="button" className="btn btn-primary" onClick={capturePhoto}><Camera size={18}/> Snap Photo</button>
                                        <button type="button" className="btn btn-secondary" onClick={stopCamera}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                                    {profile.profile_photo ? (
                                        <img src={profile.profile_photo} alt="Preview" style={{width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--success)'}}/>
                                    ) : (
                                        <div style={{width: '80px', height: '80px', borderRadius: '50%', background: 'var(--surface-light)', border: '2px dashed var(--border)', display: 'flex', alignItems:'center', justifyContent:'center'}}>
                                            <UserIcon size={32} color="var(--text-secondary)"/>
                                        </div>
                                    )}
                                    <button type="button" className="btn btn-outline" onClick={startCamera}>
                                        <Camera size={18}/> {profile.profile_photo ? 'Retake Live Photo' : 'Open Camera'}
                                    </button>
                                </div>
                            )}
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
