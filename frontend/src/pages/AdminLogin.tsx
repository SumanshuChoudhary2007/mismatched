import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }
        
        // Optionally check if user is admin before navigating
        const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', data.user?.id).single();
        if (profile && !profile.is_admin) {
            setError('Unauthorized: You are not an admin. Please contact support.');
            await supabase.auth.signOut();
            setLoading(false);
            return;
        }
        
        navigate('/admin/dashboard');
    };

    return (
        <div className="app-container">
            <nav className="nav-header">
                <Link to="/" className="logo">Mismatched <span style={{fontSize:'1rem',opacity:0.8}}>| Admin</span></Link>
            </nav>
            <div className="auth-container" style={{backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.15), transparent 40%)'}}>
                <div className="glass-panel auth-card animate-fade-in" style={{borderColor: 'rgba(139, 92, 246, 0.3)'}}>
                    <h2 style={{color: 'var(--secondary)'}}>Admin Portal</h2>
                    <p>Enter your credentials to access the admin portal</p>
                    {error && <div className="alert alert-error">{error}</div>}
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">Admin Email</label>
                            <div className="input-icon-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input 
                                    type="email" 
                                    className="form-input with-icon" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
                                    required 
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="input-icon-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    className="form-input with-icon" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    required 
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="btn full-width" style={{background: 'var(--secondary)', color: 'white'}} disabled={loading}>
                            {loading ? 'Authenticating...' : 'Access Portal'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
