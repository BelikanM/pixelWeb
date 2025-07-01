import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaHeart, FaUser, FaPlay, FaPause } from 'react-icons/fa';
import './Home.css';

const API_URL = 'http://localhost:5000';

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function Home() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userId, setUserId] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [playingVideos, setPlayingVideos] = useState({});
  const navigate = useNavigate();
  const observer = useRef(null);

  // Charger le profil utilisateur
  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setIsVerified(data.isVerified || false);
      } else {
        console.error('Erreur chargement profil:', data.message);
        setMessage(data.message || 'Erreur chargement profil');
        if (res.status === 404 || res.status === 403) {
          localStorage.removeItem('token');
          setToken(null);
          navigate('/');
        }
      }
    } catch (err) {
      console.error('Erreur réseau profil:', err.message);
      setMessage('Erreur réseau lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  // Charger le fil d'actualité
  const loadFeed = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/feed`, { headers: { authorization: token } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setFeed(data);
        setPlayingVideos(data.reduce((acc, media) => ({ ...acc, [media._id]: false }), {}));
      } else {
        console.error('Erreur feed: Données non valides', data);
        setFeed([]);
      }
    } catch (err) {
      console.error('Erreur chargement feed:', err.message);
      setMessage('Erreur chargement fil');
      setFeed([]);
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  // Gérer les likes
  const toggleLike = useCallback(
    async (mediaId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email pour interagir avec le contenu');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/media/${mediaId}/like`, {
          method: 'POST',
          headers: { authorization: token },
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          loadFeed();
        } else {
          console.error('Erreur like:', data.message);
          setMessage(data.message || 'Erreur lors du like');
        }
      } catch (err) {
        console.error('Erreur réseau like:', err.message);
        setMessage('Erreur réseau lors du like');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified, loadFeed]
  );

  // Gérer lecture/pause des vidéos
  const togglePlayPause = useCallback((mediaId) => {
    setPlayingVideos((prev) => {
      const newState = { ...prev, [mediaId]: !prev[mediaId] };
      const videoElement = document.getElementById(`video-${mediaId}`);
      if (videoElement) {
        newState[mediaId] ? videoElement.play() : videoElement.pause();
      }
      return newState;
    });
  }, []);

  // Observer pour lecture automatique des vidéos visibles
  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          const mediaId = video.dataset.mediaId;
          if (entry.isIntersecting && isVerified) {
            setPlayingVideos((prev) => ({ ...prev, [mediaId]: true }));
            video.play().catch((err) => console.error('Erreur lecture auto:', err));
          } else {
            setPlayingVideos((prev) => ({ ...prev, [mediaId]: false }));
            video.pause();
          }
        });
      },
      { threshold: 0.7 }
    );

    return () => observer.current?.disconnect();
  }, [isVerified]);

  // Ajouter les vidéos à l’observer
  useEffect(() => {
    const videos = document.querySelectorAll('video[data-media-id]');
    videos.forEach((video) => observer.current?.observe(video));
    return () => videos.forEach((video) => observer.current?.unobserve(video));
  }, [feed]);

  // Chargement initial
  useEffect(() => {
    if (token) {
      const decoded = parseJwt(token);
      setUserId(decoded?.userId || null);
      loadProfile();
      if (isVerified) {
        loadFeed();
      }
    } else {
      navigate('/');
    }
  }, [token, isVerified, loadProfile, loadFeed, navigate]);

  return (
    <div className="home-container">
      <h1 className="mb-4 text-center text-primary">Pixels Media - Accueil</h1>

      {message && (
        <div className={`alert ${message.includes('Erreur') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
          {message}
          <button type="button" className="btn-close" onClick={() => setMessage('')} aria-label="Fermer"></button>
        </div>
      )}

      {!isVerified && (
        <div className="alert alert-warning alert-dismissible fade show" role="alert">
          Veuillez vérifier votre email pour accéder au contenu.
          <button type="button" className="btn-close" onClick={() => setMessage('')} aria-label="Fermer"></button>
        </div>
      )}

      {isVerified && (
        <div className="feed-container">
          {feed.length === 0 && <p className="text-muted text-center">Aucun média à afficher.</p>}
          {feed.map((media) => (
            <div key={media._id} className="media-card">
              <div className="media-container">
                {media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                  <img
                    src={`${API_URL}/uploads/${media.filename}`}
                    className="media-content"
                    alt={media.originalname}
                    onError={(e) => console.error('Erreur chargement image:', media.filename)}
                  />
                ) : (
                  <video
                    id={`video-${media._id}`}
                    data-media-id={media._id}
                    src={`${API_URL}/uploads/${media.filename}`}
                    className="media-content"
                    loop
                    muted
                    playsInline
                    onError={(e) => console.error('Erreur chargement vidéo:', media.filename)}
                  />
                )}
                <div className="media-overlay">
                  <div className="media-info">
                    <h5>
                      <FaUser className="me-2" />
                      {media.owner?.username || media.owner?.email || 'Utilisateur'}
                    </h5>
                    <h6 className="text-truncate">{media.originalname}</h6>
                    <div
                      className="media-description"
                      dangerouslySetInnerHTML={{ __html: media.description || 'Aucune description' }}
                    />
                    <p className="text-muted small">
                      Publié le : {new Date(media.uploadedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="media-actions">
                    <button
                      className={`btn btn-sm like-btn ${media.likedBy.includes(userId) ? 'liked' : ''}`}
                      onClick={() => toggleLike(media._id)}
                      disabled={loading}
                      aria-label={media.likedBy.includes(userId) ? 'Retirer le like' : 'Liker'}
                    >
                      <FaHeart />
                      <span>{media.likedBy.length}</span>
                    </button>
                    {media.filename.match(/\.(mp4|mov)$/i) && (
                      <button
                        className="btn btn-sm play-pause-btn"
                        onClick={() => togglePlayPause(media._id)}
                        aria-label={playingVideos[media._id] ? 'Mettre en pause' : 'Lire'}
                      >
                        {playingVideos[media._id] ? <FaPause /> : <FaPlay />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
