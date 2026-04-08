import { supabase } from './supabase';

export const fetchStats = async () => {
    // Uses a SECURITY DEFINER RPC so stats are visible to unauthenticated visitors too
    const { data, error } = await supabase.rpc('get_public_stats');
    if (error || !data) {
        console.error('fetchStats error:', error);
        return { users: 0, matches: 0 };
    }
    return { users: Number(data.users) || 0, matches: Number(data.matches) || 0 };
};

export const getProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const updateProfile = async (profileUpdate: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const updates = { ...profileUpdate, id: user.id, email: user.email };
    const { data, error } = await supabase
        .from('profiles')
        .upsert(updates)
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const getMyMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (error) throw new Error(error.message);

    const enriched = await Promise.all((matches || []).map(async (m) => {
        const otherId = m.user1_id === user.id ? m.user2_id : m.user1_id;
        const { data: otherProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', otherId)
            .single();
        return { ...m, match_profile: otherProfile };
    }));

    return enriched;
};

export const getAdminUsers = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_admin', false);
    if (error) throw new Error(error.message);
    return data || [];
};

export const getAdminMatches = async () => {
    const { data: matches, error } = await supabase
        .from('matches')
        .select('*');
    if (error) throw new Error(error.message);

    const enriched = await Promise.all((matches || []).map(async (m) => {
        const { data: u1 } = await supabase.from('profiles').select('*').eq('id', m.user1_id).single();
        const { data: u2 } = await supabase.from('profiles').select('*').eq('id', m.user2_id).single();
        return { ...m, user1: u1, user2: u2 };
    }));

    return enriched;
};

export const createMatch = async (user1_id: string, user2_id: string) => {
    if (user1_id === user2_id) throw new Error('Cannot match user with themselves');

    const { data: u1 } = await supabase.from('profiles').select('full_name').eq('id', user1_id).single();
    const { data: u2 } = await supabase.from('profiles').select('full_name').eq('id', user2_id).single();

    const { data, error } = await supabase.from('matches').insert([{
        user1_id,
        user2_id,
        user1_name: u1?.full_name || 'Unknown',
        user2_name: u2?.full_name || 'Unknown'
    }]).select();

    if (error) throw new Error(error.message);
    return data;
};

export const deleteMatch = async (match_id: string) => {
    const { data, error } = await supabase
        .from('matches')
        .delete()
        .eq('id', match_id)
        .select();
    if (error) throw new Error(error.message);
    return data;
};

export const getMessages = async (match_id: string) => {
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*, sender:profiles(full_name)')
        .eq('match_id', match_id)
        .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return messages || [];
};

export const markLocationShared = async (match_id: string, location: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if location already shared for this match
    const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('location_shared')
        .eq('id', match_id)
        .single();

    if (matchError) throw new Error('Could not verify match: ' + matchError.message);
    if (!match) throw new Error('Match not found.');
    if (match.location_shared === true) throw new Error('Location has already been shared for this match.');

    // Mark as shared — requires UPDATE RLS policy
    const { data: updated, error: updateError } = await supabase
        .from('matches')
        .update({ location_shared: true })
        .eq('id', match_id)
        .select('location_shared')
        .single();

    if (updateError) throw new Error('Failed to mark location as shared: ' + updateError.message);
    if (!updated || updated.location_shared !== true) throw new Error('Could not lock location sharing. Please try again.');

    // Insert location as a special message (bypasses the 6-message limit)
    const { data, error } = await supabase
        .from('messages')
        .insert([{ match_id, sender_id: user.id, content: `📍 Meet me here: ${location}` }])
        .select('*, sender:profiles(full_name)')
        .single();
    if (error) throw new Error(error.message);
    return data;
};

export const getRegistrationCounts = async (): Promise<{ male_count: number; female_count: number }> => {
    const { data, error } = await supabase.rpc('get_registration_counts');
    if (error) {
        console.error('getRegistrationCounts error:', error);
        return { male_count: 0, female_count: 0 };
    }
    if (data && data.length > 0) {
        return { male_count: Number(data[0].male_count) || 0, female_count: Number(data[0].female_count) || 0 };
    }
    return { male_count: 0, female_count: 0 };
};

export const uploadProfilePhoto = async (file: Blob, userId: string): Promise<string> => {
    const fileName = `${userId}/profile.jpg`;
    const { error } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw new Error('Photo upload failed: ' + error.message);
    const { data } = supabase.storage.from('profile-photos').getPublicUrl(fileName);
    return data.publicUrl;
};

export const sendMessage = async (match_id: string, content: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check message limit
    const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', match_id);

    if ((count || 0) >= 6) throw new Error('Message limit reached for this match (Maximum 6)');

    const { data, error } = await supabase
        .from('messages')
        .insert([{ match_id, sender_id: user.id, content }])
        .select('*, sender:profiles(full_name)')
        .single();

    if (error) throw new Error(error.message);
    return data;
};
