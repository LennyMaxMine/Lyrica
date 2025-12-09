import { useState, useEffect, useRef } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.PROD 
  ? '' 
  : (import.meta.env.VITE_API_URL || 'http://localhost:5000');

function App() {
  const [accessToken, setAccessToken] = useState('');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [lyricsData, setLyricsData] = useState(null);
  const [error, setError] = useState('');
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [dominantColor, setDominantColor] = useState('rgba(20, 20, 30, 0.9)');
  const lyricsContainerRef = useRef(null);

  // Extract dominant color from album art
  useEffect(() => {
    if (!currentTrack?.albumArt) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = currentTrack.albumArt;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Sample colors from the image
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0, count = 0;

        // Sample every 10th pixel for performance
        for (let i = 0; i < imageData.length; i += 40) {
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        // Darken the color for background
        const darkR = Math.floor(r * 0.3);
        const darkG = Math.floor(g * 0.3);
        const darkB = Math.floor(b * 0.3);

        setDominantColor(`rgba(${darkR}, ${darkG}, ${darkB}, 0.95)`);
      } catch (err) {
        console.error('Error extracting color:', err);
      }
    };
  }, [currentTrack?.albumArt]);

  // Parse LRC format lyrics
  const parseLyrics = (lrcString) => {
    if (!lrcString) return null;
    
    const lines = lrcString.split('\n');
    const parsed = [];
    
    lines.forEach(line => {
      // Match [mm:ss.xx] or [mm:ss] format
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3].padEnd(3, '0'));
        const time = (minutes * 60 + seconds) * 1000 + milliseconds;
        const text = match[4].trim();
        
        if (text) {
          parsed.push({ time, text });
        }
      }
    });
    
    return parsed.length > 0 ? parsed : null;
  };

  // Update current line based on progress
  useEffect(() => {
    if (!lyricsData || !lyricsData.synced || !currentTrack) {
      return;
    }

    const progress = currentTrack.progress;
    
    // Find the current line based on progress
    let lineIndex = -1;
    for (let i = lyricsData.lines.length - 1; i >= 0; i--) {
      if (progress >= lyricsData.lines[i].time) {
        lineIndex = i;
        break;
      }
    }
    
    if (lineIndex !== currentLineIndex) {
      setCurrentLineIndex(lineIndex);
      
      // Auto-scroll to current line
      if (lyricsContainerRef.current && lineIndex >= 0) {
        const lineElement = lyricsContainerRef.current.querySelector(`[data-line="${lineIndex}"]`);
        if (lineElement) {
          lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentTrack?.progress, lyricsData, currentLineIndex]);

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    const authError = params.get('error');

    if (token) {
      setAccessToken(token);
      // Clean URL
      window.history.replaceState({}, document.title, '/');
    }

    if (authError) {
      setError('Authentication failed. Please try again.');
    }
  }, []);

  // Poll current track
  useEffect(() => {
    if (!accessToken) return;

    const fetchCurrentTrack = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/current-track?access_token=${accessToken}`);
        const data = await response.json();
        
        // Handle authentication errors
        if (response.status === 403 || response.status === 401) {
          console.log('Token expired or invalid, clearing session');
          setAccessToken('');
          setCurrentTrack(null);
          setLyricsData(null);
          setError('Session expired. Please log in again.');
          return;
        }
        
        if (!response.ok) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        if (data.isPlaying) {
          setCurrentTrack(data.track);
          setError('');
        } else {
          setCurrentTrack(null);
          setLyricsData(null);
        }
      } catch (err) {
        console.error('Error fetching track:', err);
        setError('Failed to fetch current track');
      }
    };

    fetchCurrentTrack();
    const interval = setInterval(fetchCurrentTrack, 1000); // Update every second

    return () => clearInterval(interval);
  }, [accessToken]);

  // Fetch lyrics when track changes
  useEffect(() => {
    if (!currentTrack) {
      setLyricsData(null);
      setCurrentLineIndex(-1);
      return;
    }

    const fetchLyrics = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/lyrics?track=${encodeURIComponent(currentTrack.name)}&artist=${encodeURIComponent(currentTrack.artist)}`
        );
        const data = await response.json();
        
        if (data.lyrics) {
          const parsed = parseLyrics(data.lyrics);
          
          setLyricsData({
            raw: data.lyrics,
            synced: data.synced && parsed !== null,
            lines: parsed || []
          });
          setCurrentLineIndex(-1);
          
          // Scroll to top when new lyrics are loaded
          if (lyricsContainerRef.current) {
            lyricsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } else {
          setLyricsData({ raw: 'Lyrics not available for this track', synced: false, lines: [] });
          
          // Scroll to top even when no lyrics are available
          if (lyricsContainerRef.current) {
            lyricsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      } catch (err) {
        console.error('Error fetching lyrics:', err);
        setLyricsData({ raw: 'Failed to load lyrics', synced: false, lines: [] });
        
        // Scroll to top even on error
        if (lyricsContainerRef.current) {
          lyricsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    };

    fetchLyrics();
  }, [currentTrack?.name, currentTrack?.artist]);

  const handleLogin = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`);
      const data = await response.json();
      window.location.href = data.url;
    } catch (err) {
      setError('Failed to initiate login');
    }
  };

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="App">
      {currentTrack?.albumArt && (
        <div 
          className="background-container"
          style={{
            backgroundImage: `url(${currentTrack.albumArt})`,
          }}
        />
      )}

      {!accessToken ? (
        <div className="login-view">
          <h1>Lyrica</h1>
          <p><a href="https://github.com/LennyMaxMine/Lyrica" target="_blank" rel="noopener noreferrer">Click this to view this Project on Github and help improve it</a></p>
          <button className="login-btn" onClick={handleLogin}>
            Connect Spotify
          </button>
        </div>
      ) : (
        <div className="BeautifulLyricsPage Fullscreen">
          <div className="Content">
            {currentTrack && (
              <div className="PlayPanel">
                <div className="MediaSpace">
                  <div className="CoverArt">
                    <img src={currentTrack.albumArt} alt="Album Art" />
                  </div>
                </div>
                <div className="TrackInfo">
                  <div className="TrackName">{currentTrack.name}</div>
                  <div className="ArtistName">{currentTrack.artist}</div>
                  <div className="AlbumName">{currentTrack.album}</div>
                </div>
                <div className="ProgressSection">
                  <div className="ProgressBar">
                    <div 
                      className="ProgressFill" 
                      style={{width: `${(currentTrack.progress / currentTrack.duration) * 100}%`}}
                    />
                  </div>
                  <div className="TimeDisplay">
                    <span className="CurrentTime">{formatTime(currentTrack.progress)}</span>
                    <span className="Duration">{formatTime(currentTrack.duration)}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="LyricsScrollContainer" ref={lyricsContainerRef}>
              {lyricsData ? (
                lyricsData.synced ? (
                  <div className="Lyrics">
                    {lyricsData.lines.map((line, index) => (
                      <div
                        key={index}
                        className="VocalsGroup"
                      >
                        <div
                          data-line={index}
                          className={`Vocals Lead ${index === currentLineIndex ? 'Active' : ''} ${index < currentLineIndex ? 'Sung' : ''}`}
                        >
                          <div className="Lyric Line">
                            {line.text}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="Lyrics">
                    <div className="VocalsGroup">
                      <div className="Vocals Lead">
                        <div className="Lyric Static">
                          {lyricsData.raw}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ) : currentTrack ? (
                <div className="NoLyrics">Loading lyrics...</div>
              ) : (
                <div className="NoLyrics">No track playing</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <footer className="AppFooter">
        <div className="FooterContent">
          Proof of Concept      Early Alpha - Expect & Report bugs to <a href="https://bugs.lny.tf" z-ind target="_blank" rel="noopener noreferrer">bugs.lny.tf</a>      Not affiliated with Spotify      Built by <a href="https://github.com/lennymaxmine" target="_blank" rel="noopener noreferrer">Lenny</a>  
        </div>
      </footer>
    </div>
  )
}

export default App
