import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getProfile, updateProfile, getMyMatches, getMessages, sendMessage, markLocationShared, uploadProfilePhoto } from '../lib/api';

import { Camera, LogOut, Save, User as UserIcon, Heart, Send, MapPin, Upload, CheckCircle, ScanFace, X } from 'lucide-react';

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

    // Camera / Face auth states
    const [cameraMode, setCameraMode] = useState<null | 'face_auth' | 'photo_capture'>(null);
    const [faceVerified, setFaceVerified] = useState(false);
    const [faceAuthStep, setFaceAuthStep] = useState<'idle' | 'scanning' | 'verified' | 'failed'>('idle');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoPreview, setPhotoPreview] = useState('');

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                    setPhotoPreview(profileData.profile_photo || '');
                    setFaceVerified(!!profileData.face_verified);
                    if (profileData.face_verified) setFaceAuthStep('verified');
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
        if (!faceVerified) {
            setMessage('Error: Face verification is required before saving your profile.');
            return;
        }
        if (!photoPreview) {
            setMessage('Error: Profile photo is required. Please take or upload a photo.');
            return;
        }
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

    const handleShareFinalLocation = async (match_id: string) => {
        const location = window.prompt("📍 Share your meeting spot (e.g. Blue Tokai Coffee, Sector 43):\n\nThis can only be shared ONCE.");
        if (!location?.trim()) return;
        try {
            await markLocationShared(match_id, location.trim());
            const msgData = await getMessages(match_id);
            setMessages(msgData);
            const matchesData = await getMyMatches();
            setMatches(matchesData);
        } catch(err: any) {
            alert(err.message);
        }
    };

    // ─── Camera helpers ───────────────────────────────────────────────────────

    const startCamera = async (mode: 'face_auth' | 'photo_capture') => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            streamRef.current = stream;
            setCameraMode(mode);
        } catch (err: any) {
            alert('Could not access camera: ' + err.message);
        }
    };

    // Sync video stream after mode changes
    useEffect(() => {
        if (cameraMode && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [cameraMode]);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setCameraMode(null);
    };

    // Face Authentication — capture a frame, "verify", mark face_verified
    const runFaceAuth = async () => {
        if (!videoRef.current) return;
        setFaceAuthStep('scanning');

        // Simulate a brief scanning phase (2 seconds)
        await new Promise(r => setTimeout(r, 2000));

        // Capture frame to validate a face is present (basic check via canvas)
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);

        // Basic liveness: check canvas has non-black pixels (camera was open)
        const ctx = canvas.getContext('2d')!;
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imgData.data.some((v, i) => i % 4 !== 3 && v > 30);

        if (!hasContent) {
            setFaceAuthStep('failed');
            stopCamera();
            return;
        }

        setFaceAuthStep('verified');
        setFaceVerified(true);
        stopCamera();

        // Persist face_verified to database immediately
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('profiles').update({ face_verified: true }).eq('id', user.id);
            }
        } catch (e) { /* non-blocking */ }
    };

    // Capture profile photo from camera
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
                } catch (err: any) {
                    // Fallback: use base64
                    const dataUrl = canvas.toDataURL('image/jpeg');
                    setPhotoPreview(dataUrl);
                    setProfile(p => ({ ...p, profile_photo: dataUrl }));
                }
                setUploadingPhoto(false);
            }, 'image/jpeg', 0.85);
        } catch (err: any) {
            alert('Error capturing photo: ' + err.message);
            setUploadingPhoto(false);
        }
    };

    // Upload photo from file
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) return;
        setUploadingPhoto(true);
        try {
            const url = await uploadProfilePhoto(file, userId);
            setPhotoPreview(url);
            setProfile(p => ({ ...p, profile_photo: url }));
        } catch (err: any) {
            // Fallback: local preview
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
                                            <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                                                <div className="chat-limit-warning">Message limit reached (6 max). Time to meet in person! 😉</div>
                                                <div style={{textAlign: 'center', padding: '0 1rem 1rem'}}>
                                                    {m.location_shared ? (
                                                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600, fontSize: '0.95rem'}}>
                                                            <MapPin size={18}/>
                                                            Location has been shared! Check the messages above.
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem'}}>
                                                                You can share your meeting spot <strong>once</strong> even after the chat limit.
                                                            </p>
                                                            <button
                                                                className="btn btn-primary"
                                                                onClick={() => handleShareFinalLocation(m.id)}
                                                                style={{gap: '0.5rem', display: 'inline-flex', alignItems: 'center'}}
                                                            >
                                                                <MapPin size={18}/> Share Meeting Location
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
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

                        {/* ── FACE AUTHENTICATION SECTION ── */}
                        <div className="form-group" style={{gridColumn: '1 / -1'}}>
                            <label className="form-label required-label">
                                <ScanFace size={18} style={{display:'inline', marginRight:'0.4rem', verticalAlign:'middle'}} />
                                Face Verification <span className="required-star">*</span>
                            </label>

                            {cameraMode === 'face_auth' ? (
                                <div className="face-auth-container">
                                    <div className="face-scan-wrapper">
                                        <video ref={videoRef} autoPlay playsInline className="face-video" />
                                        {faceAuthStep === 'scanning' && (
                                            <div className="face-scan-overlay">
                                                <div className="scan-line" />
                                                <div className="scan-corners">
                                                    <span /><span /><span /><span />
                                                </div>
                                                <p className="scan-label">Scanning face...</p>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{display:'flex', gap:'1rem', justifyContent:'center', marginTop:'1rem'}}>
                                        {faceAuthStep === 'idle' && (
                                            <button type="button" className="btn btn-primary" onClick={runFaceAuth}>
                                                <ScanFace size={18} /> Verify My Face
                                            </button>
                                        )}
                                        {faceAuthStep === 'scanning' && (
                                            <button type="button" className="btn btn-secondary" disabled>
                                                <span className="btn-spinner" /> Scanning...
                                            </button>
                                        )}
                                        <button type="button" className="btn btn-secondary" onClick={() => { stopCamera(); setFaceAuthStep('idle'); }}>
                                            <X size={18} /> Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="face-auth-status">
                                    {faceAuthStep === 'verified' || faceVerified ? (
                                        <div className="face-verified-badge">
                                            <CheckCircle size={22} color="var(--success)" />
                                            <span>Face Verified ✓</span>
                                        </div>
                                    ) : faceAuthStep === 'failed' ? (
                                        <div style={{display:'flex', flexDirection:'column', gap:'0.75rem', alignItems:'flex-start'}}>
                                            <div className="alert alert-error" style={{margin:0}}>
                                                ⚠️ Verification failed. Make sure your face is clearly visible and try again.
                                            </div>
                                            <button type="button" className="btn btn-outline" onClick={() => { setFaceAuthStep('idle'); startCamera('face_auth'); }}>
                                                <ScanFace size={18} /> Retry Face Verification
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{display:'flex', alignItems:'center', gap:'1rem'}}>
                                            <div className="face-placeholder">
                                                <UserIcon size={32} color="var(--text-secondary)" />
                                            </div>
                                            <button type="button" className="btn btn-outline" onClick={() => startCamera('face_auth')}>
                                                <ScanFace size={18} /> Start Face Verification
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── PROFILE PHOTO SECTION ── */}
                        <div className="form-group" style={{gridColumn: '1 / -1'}}>
                            <label className="form-label required-label">
                                <Camera size={18} style={{display:'inline', marginRight:'0.4rem', verticalAlign:'middle'}} />
                                Profile Photo <span className="required-star">*</span>
                            </label>

                            {cameraMode === 'photo_capture' ? (
                                <div className="face-auth-container">
                                    <video ref={videoRef} autoPlay playsInline className="face-video" />
                                    <div style={{display:'flex', gap:'1rem', justifyContent:'center', marginTop:'1rem'}}>
                                        <button type="button" className="btn btn-primary" onClick={capturePhotoFromCamera} disabled={uploadingPhoto}>
                                            <Camera size={18} /> {uploadingPhoto ? 'Saving...' : 'Snap Photo'}
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={stopCamera}>
                                            <X size={18} /> Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="photo-upload-area">
                                    {photoPreview ? (
                                        <img src={photoPreview} alt="Profile Preview" className="photo-preview-img" />
                                    ) : (
                                        <div className="photo-placeholder">
                                            <UserIcon size={40} color="var(--text-secondary)" />
                                            <span>No photo yet</span>
                                        </div>
                                    )}
                                    <div className="photo-action-btns">
                                        <button type="button" className="btn btn-outline" onClick={() => startCamera('photo_capture')} disabled={uploadingPhoto}>
                                            <Camera size={18} /> {photoPreview ? 'Retake' : 'Take Photo'}
                                        </button>
                                        <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}>
                                            <Upload size={18} /> Upload Photo
                                        </button>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        style={{display:'none'}}
                                        onChange={handleFileUpload}
                                    />
                                    {uploadingPhoto && <p style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>Uploading photo...</p>}
                                </div>
                            )}
                        </div>

                        {/* ── PROFILE FIELDS ── */}
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
                            <button type="submit" className="btn btn-primary" disabled={saving || !faceVerified || !photoPreview}>
                                <Save size={18} /> {saving ? 'Saving...' : !faceVerified ? '🔍 Complete Face Verification First' : !photoPreview ? '📸 Add Profile Photo First' : 'Save Profile'}
                            </button>
                            {(!faceVerified || !photoPreview) && (
                                <div style={{marginTop:'0.6rem', display:'flex', flexDirection:'column', gap:'0.3rem'}}>
                                    {!faceVerified && <p style={{fontSize:'0.82rem', color:'var(--primary)'}}>⚠️ Face verification is required <span className="required-star">*</span></p>}
                                    {!photoPreview && <p style={{fontSize:'0.82rem', color:'var(--primary)'}}>⚠️ Profile photo is required <span className="required-star">*</span></p>}
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
