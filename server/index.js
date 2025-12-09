require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CLIENT_URL = IS_PRODUCTION ? `http://localhost:${PORT}` : 'http://localhost:5173';

// Spotify API Setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Middleware
app.use(cors());
app.use(express.json());

// Spotify Auth Routes
app.get('/auth/login', (req, res) => {
  const scopes = ['user-read-playback-state', 'user-read-currently-playing'];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  res.json({ url: authorizeURL });
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token, expires_in } = data.body;
    
    // Redirect back to frontend with token
    res.redirect(`${CLIENT_URL}?access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}`);
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.redirect(`${CLIENT_URL}?error=auth_failed`);
  }
});

// Current Playback
app.get('/api/current-track', async (req, res) => {
  const { access_token } = req.query;
  
  if (!access_token) {
    return res.status(401).json({ error: 'No access token provided' });
  }

  try {
    spotifyApi.setAccessToken(access_token);
    const data = await spotifyApi.getMyCurrentPlaybackState();
    
    if (!data.body || !data.body.item) {
      return res.json({ isPlaying: false });
    }

    const track = data.body.item;
    const progress = data.body.progress_ms;
    
    res.json({
      isPlaying: data.body.is_playing,
      track: {
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        albumArt: track.album.images[0]?.url,
        duration: track.duration_ms,
        progress: progress
      }
    });
  } catch (error) {
    console.error('Error fetching current track:', error);
    res.status(500).json({ error: 'Failed to fetch current track' });
  }
});

// LRCLIB Lyrics (Free API)
app.get('/api/lyrics', async (req, res) => {
  const { track, artist } = req.query;
  
  if (!track || !artist) {
    return res.status(400).json({ error: 'Track and artist required' });
  }

  try {
    // Search for track on lrclib.net (free, no API key needed!)
    const searchResponse = await axios.get('https://lrclib.net/api/get', {
      params: {
        track_name: track,
        artist_name: artist
      }
    });

    const data = searchResponse.data;
    
    if (!data || (!data.syncedLyrics && !data.plainLyrics)) {
      return res.status(404).json({ error: 'Lyrics not found' });
    }

    // Prefer synced lyrics (with timestamps) over plain lyrics
    res.json({
      lyrics: data.syncedLyrics || data.plainLyrics,
      synced: !!data.syncedLyrics,
      duration: data.duration
    });
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({ error: 'Failed to fetch lyrics' });
  }
});

// Serve static files in production
if (IS_PRODUCTION) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Test route
app.get('/api', (req, res) => {
  res.json({ message: 'Lyrica Spotify Lyrics API' });
});

app.listen(PORT, () => {
  console.log(`🎵 Lyrica server running on port ${PORT}`);
  console.log(`Environment: ${IS_PRODUCTION ? 'production' : 'development'}`);
  console.log(`Client URL: ${CLIENT_URL}`);
  console.log(`Server running on http://localhost:${PORT}`);
});
