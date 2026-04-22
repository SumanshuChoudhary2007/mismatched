import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [redirect, setRedirect] = useState('');

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setRedirect(adminOnly ? '/admin' : '/login');
        setLoading(false);
        return;
      }

      // Always fetch the profile to check admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (adminOnly) {
        // Admin route: must be admin, otherwise boot to /admin login
        if (!profile?.is_admin) {
          await supabase.auth.signOut();
          setRedirect('/admin');
          setLoading(false);
          return;
        }
      } else {
        // User route: if the person is an admin, boot them to admin dashboard
        if (profile?.is_admin) {
          setRedirect('/admin/dashboard');
          setLoading(false);
          return;
        }
      }

      setAuthorized(true);
      setLoading(false);
    };

    check();
  }, [adminOnly]);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="spinner"></div>
        <p className="loading-text">Verifying access...</p>
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}
