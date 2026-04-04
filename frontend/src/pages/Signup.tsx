import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }
        
        // Immediately create their profile in the database
        if (data.user) {
            await supabase.from('profiles').insert([
                { id: data.user.id, email: data.user.email }
            ]).select();
        }
        
        navigate('/dashboard');
    };

    return (
        <div className="app-container">
            <nav className="nav-header">
                <Link to="/" className="logo">Mismatched</Link>
            </nav>
            <div className="auth-container">
                <div className="glass-panel auth-card animate-fade-in">
                    <h2>Create Account</h2>
                    <p>Join Mismatched to find your perfect match</p>
                    {error && <div className="alert alert-error">{error}</div>}
                    <form onSubmit={handleSignup}>
                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <input 
                                type="email" 
                                className="form-input" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input 
                                type="password" 
                                className="form-input" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                required 
                                minLength={6}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary full-width" disabled={loading}>
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>
                    <p className="mt-4 text-center">
                        Already have an account? <Link to="/login" style={{ color: 'var(--primary)' }}>Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
