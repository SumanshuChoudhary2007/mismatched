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

      if (adminOnly) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();

        if (!profile?.is_admin) {
          await supabase.auth.signOut();
          setRedirect('/admin');
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
