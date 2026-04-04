import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to verify user via Supabase
const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
  
  req.user = user;
  next();
};

const isAdmin = async (req, res, next) => {
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', req.user.id).single();
  if (!data?.is_admin) return res.status(403).json({ error: 'Forbidden' });
  next();
};

app.get('/api/stats', async (req, res) => {
  try {
    const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false);
    const { count: matchesCount } = await supabase.from('matches').select('*', { count: 'exact', head: true });
    res.json({ users: usersCount || 0, matches: matchesCount || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/profile', authenticateUser, async (req, res) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', req.user.id).single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/profile', authenticateUser, async (req, res) => {
  const updates = { ...req.body, id: req.user.id, email: req.user.email };
  const { data, error } = await supabase.from('profiles').upsert(updates).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/matches', authenticateUser, async (req, res) => {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .or(`user1_id.eq.${req.user.id},user2_id.eq.${req.user.id}`);
  
  if (error) return res.status(400).json({ error: error.message });

  const enriched = await Promise.all(matches.map(async (m) => {
    const otherId = m.user1_id === req.user.id ? m.user2_id : m.user1_id;
    const { data: otherProfile } = await supabase.from('profiles').select('*').eq('id', otherId).single();
    return { ...m, match_profile: otherProfile };
  }));

  res.json(enriched);
});

app.get('/api/admin/users', authenticateUser, isAdmin, async (req, res) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('is_admin', false);
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/admin/all-matches', authenticateUser, isAdmin, async (req, res) => {
  const { data: matches, error } = await supabase.from('matches').select('*');
  if (error) return res.status(400).json({ error: error.message });
  
  const enriched = await Promise.all(matches.map(async (m) => {
    const { data: u1 } = await supabase.from('profiles').select('*').eq('id', m.user1_id).single();
    const { data: u2 } = await supabase.from('profiles').select('*').eq('id', m.user2_id).single();
    return { ...m, user1: u1, user2: u2 };
  }));
  res.json(enriched);
});

app.post('/api/admin/match', authenticateUser, isAdmin, async (req, res) => {
  const { user1_id, user2_id } = req.body;
  if (user1_id === user2_id) return res.status(400).json({ error: 'Cannot match user with themselves' });
  
  const { data: u1 } = await supabase.from('profiles').select('full_name').eq('id', user1_id).single();
  const { data: u2 } = await supabase.from('profiles').select('full_name').eq('id', user2_id).single();

  const { data, error } = await supabase.from('matches').insert([{ 
    user1_id, 
    user2_id,
    user1_name: u1?.full_name || 'Unknown',
    user2_name: u2?.full_name || 'Unknown'
  }]).select();
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.delete('/api/admin/match/:id', authenticateUser, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('matches').delete().eq('id', id).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/matches/:match_id/messages', authenticateUser, async (req, res) => {
  const { match_id } = req.params;
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*, sender:profiles(full_name)')
    .eq('match_id', match_id)
    .order('created_at', { ascending: true });
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(messages);
});

app.post('/api/matches/:match_id/messages', authenticateUser, async (req, res) => {
  const { match_id } = req.params;
  const { content } = req.body;
  
  // Verify match exists and user is part of it
  const { data: match, error: matchError } = await supabase.from('matches').select('*').eq('id', match_id).single();
  if (matchError || (match.user1_id !== req.user.id && match.user2_id !== req.user.id)) return res.status(403).json({ error: 'Access denied' });

  // Check message limit
  const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('match_id', match_id);
  if (count >= 6) return res.status(400).json({ error: 'Message limit reached for this match (Maximum 6)' });

  const { data, error } = await supabase.from('messages').insert([{
    match_id,
    sender_id: req.user.id,
    content
  }]).select('*, sender:profiles(full_name)').single();
  
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Local dev: start the server normally
// Vercel: exports the app as a serverless function
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
