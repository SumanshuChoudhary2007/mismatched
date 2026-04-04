import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
    };
};

export const fetchStats = async () => {
    const res = await fetch(`${API_URL}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
};

export const getProfile = async () => {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/profile`, { headers });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
};

export const updateProfile = async (profileUpdate: any) => {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/profile`, { method: 'POST', headers, body: JSON.stringify(profileUpdate) });
    if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || 'Failed to update profile');
    }
    return res.json();
};

export const getMyMatches = async () => {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/matches`, { headers });
    if (!res.ok) throw new Error('Failed to fetch matches');
    return res.json();
};

export const getAdminUsers = async () => {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/users`, { headers });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
};

export const getAdminMatches = async () => {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/all-matches`, { headers });
    if (!res.ok) throw new Error('Failed to fetch all matches');
    return res.json();
};

export const createMatch = async (user1_id: string, user2_id: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/match`, { 
        method: 'POST', 
        headers, 
        body: JSON.stringify({ user1_id, user2_id }) 
    });
    if (!res.ok) throw new Error('Failed to create match');
    return res.json();
};

export const deleteMatch = async (match_id: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/admin/match/${match_id}`, { method: 'DELETE', headers });
    if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || 'Failed to delete match');
    }
    return res.json();
};

export const getMessages = async (match_id: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/matches/${match_id}/messages`, { headers });
    if (!res.ok) throw new Error('Failed to fetch messages');
    return res.json();
};

export const sendMessage = async (match_id: string, content: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${API_URL}/matches/${match_id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content })
    });
    if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj.error || 'Failed to send message');
    }
    return res.json();
};
