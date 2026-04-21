import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getProfile, updateProfile, getMyMatches, getMessages, sendMessage, markLocationShared, uploadProfilePhoto } from '../lib/api';

import { Camera, LogOut, Save, User as UserIcon, Heart, Send, MapPin, Upload, CheckCircle, ScanFace, X, MessageSquare } from 'lucide-react';

// ── Prompt definitions ────────────────────────────────────────────────────────
const PROMPTS = [
    { id: 'love_language', question: 'My love language is...', placeholder: 'e.g. Quality time, Acts of service' },
    { id: 'heart_way',    question: 'The way to my heart is...', placeholder: 'e.g. Cooking for me, surprise plans' },
    { id: 'red_flag',     question: 'I know it\'s a red flag, but I love...', placeholder: 'Be honest & fun! 😄' },
];

// ── Progressive blur helper ───────────────────────────────────────────────────
// 6 messages max → blur decreases linearly from 22px → 0px
const getBlurStyle = (messageCount: number): React.CSSProperties => {
    const MAX_MSGS = 20;  // 10 per user each × 2 = 20 total for full reveal
    const MAX_BLUR = 22;
    const ratio = Math.min(messageCount / MAX_MSGS, 1);
    const blurPx = MAX_BLUR * (1 - ratio);
    const grayPct = 80 * (1 - ratio);
    return {
        filter: `blur(${blurPx.toFixed(1)}px) grayscale(${grayPct.toFixed(0)}%)`,
        transition: 'filter 0.8s ease',
    };
};

// ── Energy hearts ─────────────────────────────────────────────────────────────
const EnergyMeter = ({ used, total = 6 }: { used: number; total?: number }) => {
    const remaining = total - used;
    return (
        <div className="energy-meter">
            <div className="energy-label">
                <span className="energy-icon">⚡</span>
                <span>Sparks Remaining: <strong>{remaining}</strong> / {total}</span>
            </div>
            <div className="energy-hearts">
                {Array.from({ length: total }).map((_, i) => (
                    <span
                        key={i}
                        className={`energy-heart ${i < used ? 'energy-heart--used' : 'energy-heart--active'}`}
                    >
                        {i < used ? '🖤' : '❤️'}
                    </span>
                ))}
            </div>
            {remaining === 0 && (
                <p className="energy-limit-msg">All sparks used — time to meet IRL! 🎉</p>
            )}
        </div>
    );
};

// ── Prompt answers display ────────────────────────────────────────────────────
const PromptCard = ({ prompts }: { prompts: any[] }) => {
    if (!prompts || prompts.length === 0) return null;
    return (
        <div className="prompt-cards">
            {prompts.map((p: any, i: number) => {
                const def = PROMPTS.find(d => d.id === p.id);
                if (!def || !p.answer?.trim()) return null;
                return (
                    <div key={i} className="prompt-pill">
                        <span className="prompt-pill-q">{def.question}</span>
                        <span className="prompt-pill-a">"{p.answer}"</span>
                    </div>
                );
            })}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────

export default function UserDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [isEditing, setIsEditing] = useState(true);
    const [profile, setProfile] = useState({
        full_name: '', age: '', city: '', gender: 'male', interested_in: 'both', about_me: '', profile_photo: '',
        prompts: PROMPTS.map(p => ({ id: p.id, answer: '' }))
    });
    const [matches, setMatches] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [userId, setUserId] = useState('');
    const [sending, setSending] = useState(false);

    // Camera / Face auth states
    const [cameraMode, setCameraMode] = useState<null | 'face_auth' | 'photo_capture'>(null);
    const [faceVerified, setFaceVerified] = useState(false);
    const [faceAuthStep, setFaceAuthStep] = useState<'idle' | 'scanning' | 'verified' | 'failed'>('idle');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoPreview, setPhotoPreview] = useState('');



    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Clean up camera on unmount
    useEffect(() => {
        return () => { stopCamera(); };
    }, []);

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) { navigate('/login'); return; }
            setUserId(data.session.user.id);
            try {
                const profileData = await getProfile();
                if (profileData) {
                    const savedPrompts = (profileData.prompts && profileData.prompts.length > 0)
                        ? profileData.prompts
                        : PROMPTS.map(p => ({ id: p.id, answer: '' }));
                    setProfile({
                        full_name: profileData.full_name || '',
                        age: profileData.age || '',
                        city: profileData.city || '',
                        gender: profileData.gender || 'male',
                        interested_in: profileData.interested_in || 'both',
                        about_me: profileData.about_me || '',
                        profile_photo: profileData.profile_photo || '',
                        prompts: savedPrompts,
                    });
                    setPhotoPreview(profileData.profile_photo || '');
                    setFaceVerified(!!profileData.face_verified);
                    if (profileData.face_verified) setFaceAuthStep('verified');
                    if (profileData.full_name) setIsEditing(false);
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

    // Real-time messages subscription
    useEffect(() => {
        if (!matches.length) return;
        const matchId = matches[0].id;
        const channel = supabase
            .channel(`messages:${matchId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `match_id=eq.${matchId}`
            }, async () => {
                const msgs = await getMessages(matchId);
                setMessages(msgs);
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [matches]);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!faceVerified) { setMessage('Error: Face verification is required before saving your profile.'); return; }
        if (!photoPreview) { setMessage('Error: Profile photo is required. Please take or upload a photo.'); return; }
        setSaving(true);
        setMessage('');
        try {
            await updateProfile({ ...profile, profile_photo: photoPreview, face_verified: true });
            setMessage('');
            setIsEditing(false);
        } catch (err: any) {
            setMessage('Error: ' + err.message);
        }
        setSaving(false);
    };

    const handleSendMessage = async (e: React.FormEvent, match_id: string) => {
        e.preventDefault();
        if (!chatInput.trim() || sending) return;
        setSending(true);
        const optimistic = {
            id: `temp-${Date.now()}`,
            match_id,
            sender_id: userId,
            content: chatInput.trim(),
            created_at: new Date().toISOString(),
            sender: { full_name: 'You' },
        };
        setMessages(prev => [...prev, optimistic]);
        const typed = chatInput.trim();
        setChatInput('');
        try {
            await sendMessage(match_id, typed);
        } catch(err: any) {
            setMessages(prev => prev.filter(m => m.id !== optimistic.id));
            alert('Error sending message: ' + err.message);
        }
        setSending(false);
    };

    const handleDropLocation = async (e: React.MouseEvent, match_id: string) => {
        e.preventDefault();
        const location = window.prompt('Suggest a precise meeting location (e.g. Starbeans Cafe on 5th Ave):');
        if (!location) return;
        try {
            await sendMessage(match_id, `📍 Let\'s meet here: ${location}`);
            const msgData = await getMessages(match_id);
            setMessages(msgData);
        } catch(err: any) { alert('Error sending location: ' + err.message); }
    };

    const handleShareFinalLocation = async (match_id: string) => {
        const location = window.prompt('📍 Share your meeting spot (e.g. Blue Tokai Coffee, Sector 43):\n\nThis can only be shared ONCE.');
        if (!location?.trim()) return;
        try {
            await markLocationShared(match_id, location.trim());
            const msgData = await getMessages(match_id);
            setMessages(msgData);
            const matchesData = await getMyMatches();
            setMatches(matchesData);
        } catch(err: any) { alert(err.message); }
    };

    // ─── Camera helpers ───────────────────────────────────────────────────────
    const startCamera = async (mode: 'face_auth' | 'photo_capture') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            streamRef.current = stream;
            setCameraMode(mode);
        } catch (err: any) { alert('Could not access camera: ' + err.message); }
    };

    useEffect(() => {
        if (cameraMode && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [cameraMode]);

    const stopCamera = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        setCameraMode(null);
    };

    const runFaceAuth = async () => {
        if (!videoRef.current) return;
        setFaceAuthStep('scanning');
        await new Promise(r => setTimeout(r, 2000));
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        const ctx = canvas.getContext('2d')!;
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imgData.data.some((v, i) => i % 4 !== 3 && v > 30);
        if (!hasContent) { setFaceAuthStep('failed'); stopCamera(); return; }
        setFaceAuthStep('verified');
        setFaceVerified(true);
        stopCamera();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) await supabase.from('profiles').update({ face_verified: true }).eq('id', user.id);
        } catch (e) { /* non-blocking */ }
    };

    const capturePhotoFromCamera = async () => {
        if (!videoRef.current || !userId) return;
        setUploadingPhoto(true);
        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            stopCamera();
            canvas.toBlob(async (blob) => {
                if (!blob) { setUploadingPhoto(false); return; }
                try {
                    const url = await uploadProfilePhoto(blob, userId);
                    setPhotoPreview(url);
                    setProfile(p => ({ ...p, profile_photo: url }));
                } catch {
                    const dataUrl = canvas.toDataURL('image/jpeg');
                    setPhotoPreview(dataUrl);
                    setProfile(p => ({ ...p, profile_photo: dataUrl }));
                }
                setUploadingPhoto(false);
            }, 'image/jpeg', 0.85);
        } catch (err: any) { alert('Error capturing photo: ' + err.message); setUploadingPhoto(false); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;
        setUploadingPhoto(true);
        try {
            const url = await uploadProfilePhoto(file, userId);
            setPhotoPreview(url);
            setProfile(p => ({ ...p, profile_photo: url }));
        } catch {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                setPhotoPreview(dataUrl);
                setProfile(p => ({ ...p, profile_photo: dataUrl }));
            };
            reader.readAsDataURL(file);
        }
        setUploadingPhoto(false);
    };



    const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };

    const updatePromptAnswer = (id: string, answer: string) => {
        setProfile(p => ({
            ...p,
            prompts: p.prompts.map(pr => pr.id === id ? { ...pr, answer } : pr)
        }));
    };

    if (loading) return (
        <div className="app-container">
            <div className="loader-container">
                <div className="spinner"></div>
                <div className="loading-text">Loading Profile...</div>
            </div>
        </div>
    );

    const currentMatch = matches[0] || null;
    const msgCount   = messages.length;                                           // total messages (both users)
    const myMsgCount = messages.filter((m: any) => m.sender_id === userId).length; // MY sent messages only (limit = 10)

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

                {/* ── MATCH FOUND STATE ──────────────────────────────────────── */}
                {currentMatch && (
                    <div className="match-status-banner animate-fade-in">
                        <div className="match-banner-top">
                            <div className="match-sparkle">✨</div>
                            <h3>You've been matched!</h3>
                            <p>Our experts found someone special for you. Chat to reveal their photo.</p>
                        </div>

                        <div className="match-reveal-layout">
                            {/* Blurred photo card */}
                            <div className="blur-card">
                                <div className="blur-card-photo-wrap">
                                    {currentMatch.match_profile?.profile_photo ? (
                                        <img
                                            src={currentMatch.match_profile.profile_photo}
                                            alt="Your Match"
                                            className="blur-card-img"
                                            style={getBlurStyle(msgCount)}
                                        />
                                    ) : (
                                        <div className="blur-card-placeholder">
                                            <UserIcon size={48} color="rgba(255,255,255,0.3)" />
                                        </div>
                                    )}
                                    {/* Unlock progress overlay */}
                                    <div className="blur-unlock-overlay">
                                        {msgCount < 20 ? (
                                            <span className="blur-unlock-badge">
                                                🔓 {20 - msgCount} more message{20 - msgCount !== 1 ? 's' : ''} to reveal
                                            </span>
                                        ) : (
                                            <span className="blur-unlock-badge unlocked">
                                                ✅ Photo Revealed!
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Compatibility score */}
                                {currentMatch.compatibility_score > 0 && (
                                    <div className="compat-score-bar">
                                        <div
                                            className="compat-score-fill"
                                            style={{ width: `${currentMatch.compatibility_score}%` }}
                                        />
                                        <span className="compat-score-label">
                                            {currentMatch.compatibility_score}% Compatibility
                                        </span>
                                    </div>
                                )}

                                {/* Basic info (always visible) */}
                                <div className="blur-card-info">
                                    <div className="blur-name">
                                        {msgCount < 3
                                            ? (currentMatch.match_profile?.full_name?.split(' ')[0] || 'Someone') + ' ✨'
                                            : currentMatch.match_profile?.full_name || 'Anonymous'}
                                    </div>
                                    <div className="blur-meta">
                                        {currentMatch.match_profile?.age && `${currentMatch.match_profile.age} yrs`}
                                        {currentMatch.match_profile?.city && ` · ${currentMatch.match_profile.city}`}
                                    </div>
                                </div>

                                {/* Prompt answers — shown before photo */}
                                <PromptCard prompts={currentMatch.match_profile?.prompts || []} />


                            </div>

                            {/* Chat panel */}
                            <div className="chat-panel animate-fade-in">
                                <EnergyMeter used={myMsgCount} total={10} />

                                <div className="chat-container" style={{ background: 'var(--surface)' }}>
                                    <div className="chat-history">
                                        {messages.length === 0 && (
                                            <p className="text-center text-secondary" style={{ padding: '2rem 1rem' }}>
                                                💬 Say hello! Your message will reveal a little more of their photo.
                                            </p>
                                        )}
                                        {messages.map(msg => (
                                            <div key={msg.id} className={`chat-message ${msg.sender_id === userId ? 'mine' : 'theirs'}`}>
                                                <div>{msg.content}</div>
                                                <div className="chat-message-meta">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        ))}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {myMsgCount >= 10 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div className="chat-limit-warning">
                                                All sparks used! Time to meet in person 😉
                                            </div>
                                            <div style={{ textAlign: 'center', padding: '0 1rem 1rem' }}>
                                                {currentMatch.location_shared ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600, fontSize: '0.95rem' }}>
                                                        <MapPin size={18} />
                                                        Location shared! Check messages above.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                                            Share your meeting spot <strong>once</strong> even after the chat limit.
                                                        </p>
                                                        <button
                                                            className="btn btn-primary"
                                                            onClick={() => handleShareFinalLocation(currentMatch.id)}
                                                            style={{ gap: '0.5rem', display: 'inline-flex', alignItems: 'center' }}
                                                        >
                                                            <MapPin size={18} /> Share Meeting Location
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <form className="chat-input-area" onSubmit={(e) => handleSendMessage(e, currentMatch.id)}>
                                            <button type="button" className="btn btn-secondary" style={{ padding: '0.75rem', borderRadius: '50%' }} onClick={(e) => handleDropLocation(e, currentMatch.id)} title="Drop Location">
                                                <MapPin size={18} />
                                            </button>
                                            <input
                                                type="text"
                                                placeholder={`Say something... (${10 - myMsgCount} left)`}
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                maxLength={150}
                                                disabled={sending}
                                            />
                                            <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }} disabled={sending || !chatInput.trim()}>
                                                <Send size={18} />
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── WAITING STATE (profile complete, no match yet) ─────────── */}
                {!currentMatch && !isEditing && (
                    <div className="profile-submitted-card animate-fade-in">
                        <div className="profile-submitted-icon">✅</div>
                        <h2 className="profile-submitted-title">Profile Submitted!</h2>
                        <p className="profile-submitted-sub">
                            Your profile is under review by our team.<br />
                            We'll find your best match and notify you soon.
                        </p>
                        <div className="profile-submitted-steps">
                            <div className="ps-step done">
                                <span className="ps-step-icon">✓</span>
                                <span>Profile completed</span>
                            </div>
                            <div className="ps-step done">
                                <span className="ps-step-icon">✓</span>
                                <span>Face verified</span>
                            </div>
                            <div className="ps-step pending">
                                <span className="ps-step-icon">⏳</span>
                                <span>Waiting for match assignment</span>
                            </div>
                        </div>
                        <button className="btn btn-secondary" style={{ marginTop: '1.5rem' }} onClick={() => setIsEditing(true)}>
                            Edit Profile
                        </button>
                    </div>
                )}

                {/* ── PROFILE EDIT FORM ─────────────────────────────────────── */}
                {isEditing && (
                    <div className="glass-panel animate-fade-in">
                        {message && <div className={message.startsWith('Error') ? 'alert alert-error' : 'alert alert-success'}>{message}</div>}
                        <form onSubmit={handleSave} style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>

                            {/* ── FACE VERIFICATION ── */}
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label required-label">
                                    <ScanFace size={18} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                    Face Verification <span className="required-star">*</span>
                                </label>
                                {cameraMode === 'face_auth' ? (
                                    <div className="face-auth-container">
                                        <div className="face-scan-wrapper">
                                            <video ref={videoRef} autoPlay playsInline className="face-video" />
                                            {faceAuthStep === 'scanning' && (
                                                <div className="face-scan-overlay">
                                                    <div className="scan-line" />
                                                    <div className="scan-corners"><span /><span /><span /><span /></div>
                                                    <p className="scan-label">Scanning face...</p>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                                            {faceAuthStep === 'idle' && <button type="button" className="btn btn-primary" onClick={runFaceAuth}><ScanFace size={18} /> Verify My Face</button>}
                                            {faceAuthStep === 'scanning' && <button type="button" className="btn btn-secondary" disabled><span className="btn-spinner" /> Scanning...</button>}
                                            <button type="button" className="btn btn-secondary" onClick={() => { stopCamera(); setFaceAuthStep('idle'); }}><X size={18} /> Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="face-auth-status">
                                        {faceAuthStep === 'verified' || faceVerified ? (
                                            <div className="face-verified-badge"><CheckCircle size={22} color="var(--success)" /><span>Face Verified ✓</span></div>
                                        ) : faceAuthStep === 'failed' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
                                                <div className="alert alert-error" style={{ margin: 0 }}>⚠️ Verification failed. Make sure your face is clearly visible and try again.</div>
                                                <button type="button" className="btn btn-outline" onClick={() => { setFaceAuthStep('idle'); startCamera('face_auth'); }}><ScanFace size={18} /> Retry</button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div className="face-placeholder"><UserIcon size={32} color="var(--text-secondary)" /></div>
                                                <button type="button" className="btn btn-outline" onClick={() => startCamera('face_auth')}><ScanFace size={18} /> Start Face Verification</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── PROFILE PHOTO ── */}
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label required-label">
                                    <Camera size={18} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                    Profile Photo <span className="required-star">*</span>
                                </label>
                                {cameraMode === 'photo_capture' ? (
                                    <div className="face-auth-container">
                                        <video ref={videoRef} autoPlay playsInline className="face-video" />
                                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                                            <button type="button" className="btn btn-primary" onClick={capturePhotoFromCamera} disabled={uploadingPhoto}><Camera size={18} /> {uploadingPhoto ? 'Saving...' : 'Snap Photo'}</button>
                                            <button type="button" className="btn btn-secondary" onClick={stopCamera}><X size={18} /> Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="photo-upload-area">
                                        {photoPreview ? <img src={photoPreview} alt="Profile Preview" className="photo-preview-img" /> : (
                                            <div className="photo-placeholder"><UserIcon size={40} color="var(--text-secondary)" /><span>No photo yet</span></div>
                                        )}
                                        <div className="photo-action-btns">
                                            <button type="button" className="btn btn-outline" onClick={() => startCamera('photo_capture')} disabled={uploadingPhoto}><Camera size={18} /> {photoPreview ? 'Retake' : 'Take Photo'}</button>
                                            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}><Upload size={18} /> Upload Photo</button>
                                        </div>
                                        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                                        {uploadingPhoto && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Uploading photo...</p>}
                                    </div>
                                )}
                            </div>



                            {/* ── PROFILE FIELDS ── */}
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input type="text" className="form-input" value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Age</label>
                                <input type="number" className="form-input" value={profile.age} onChange={e => setProfile({ ...profile, age: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">City</label>
                                <input type="text" className="form-input" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Gender</label>
                                <select className="form-select" value={profile.gender} onChange={e => setProfile({ ...profile, gender: e.target.value })}>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label">I'm interested in</label>
                                <select className="form-select" value={profile.interested_in} onChange={e => setProfile({ ...profile, interested_in: e.target.value })}>
                                    <option value="male">Men</option>
                                    <option value="female">Women</option>
                                    <option value="both">Both/Anyone</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label">About Me</label>
                                <textarea className="form-textarea" value={profile.about_me} onChange={e => setProfile({ ...profile, about_me: e.target.value })} placeholder="Tell us about your hobbies, ideal date, what you're looking for..." required />
                            </div>

                            {/* ── COMPATIBILITY PROMPTS ── */}
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label" style={{ marginBottom: '1rem' }}>
                                    <MessageSquare size={18} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
                                    Personality Prompts <span style={{ fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 400 }}>— shown to your match first!</span>
                                </label>
                                <div className="prompts-form-grid">
                                    {PROMPTS.map(def => {
                                        const val = profile.prompts.find(p => p.id === def.id)?.answer || '';
                                        return (
                                            <div key={def.id} className="prompt-form-item">
                                                <label className="prompt-form-label">{def.question}</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder={def.placeholder}
                                                    value={val}
                                                    onChange={e => updatePromptAnswer(def.id, e.target.value)}
                                                    maxLength={80}
                                                />
                                                <span className="prompt-char-hint">{val.length}/80</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <button type="submit" className="btn btn-primary" disabled={saving || !faceVerified || !photoPreview}>
                                    <Save size={18} /> {saving ? 'Saving...' : !faceVerified ? '🔍 Complete Face Verification First' : !photoPreview ? '📸 Add Profile Photo First' : 'Save Profile'}
                                </button>
                                {(!faceVerified || !photoPreview) && (
                                    <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                        {!faceVerified && <p style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>⚠️ Face verification is required <span className="required-star">*</span></p>}
                                        {!photoPreview && <p style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>⚠️ Profile photo is required <span className="required-star">*</span></p>}
                                    </div>
                                )}
                            </div>
                        </form>
                    </div>
                )}
            </main>
        </div>
    );
}
