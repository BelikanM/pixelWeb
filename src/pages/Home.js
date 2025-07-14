import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import {
  FaTrash,
  FaEdit,
  FaUserPlus,
  FaUserCheck,
  FaSignOutAlt,
  FaUpload,
  FaSave,
  FaTimes,
  FaUser,
  FaWhatsapp,
  FaYoutube,
  FaTiktok,
  FaFacebook,
  FaVolumeUp,
  FaVolumeMute,
} from 'react-icons/fa';
import io from 'socket.io-client';
import './Profile.css';

const API_URL = 'http://localhost:5000';
const socket = io(API_URL, { autoConnect: false });

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function Profile() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [points, setPoints] = useState(0);
  const videoRefs = useRef(new Map());
  const navigate = useNavigate();

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      let videoId = null;
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        if (urlObj.pathname.includes('/watch')) {
          videoId = urlObj.searchParams.get('v');
        } else if (urlObj.pathname.includes('/embed/')) {
          videoId = urlObj.pathname.split('/embed/')[1]?.split('/')[0];
        } else if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.split('/')[1];
        }
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1` : null;
    } catch (error) {
      console.error('Invalid YouTube URL:', url, error);
      return null;
    }
  };

  const loadUserData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setEmail(data.email || '');
        setUsername(data.username || data.email || 'Utilisateur');
        setWhatsappNumber(data.whatsappNumber || '');
        setWhatsappMessage(data.whatsappMessage || '');
        setIsVerified(data.isVerified || false);
        setPoints(data.points || 0);
        const parsed = parseJwt(token);
        setUserId(parsed?.userId);
      } else {
        setError(data.message || 'Erreur lors du chargement du profil');
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          setToken(null);
          navigate('/login');
        }
      }
    } catch {
      setError('Erreur réseau lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  const loadFeed = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/feed`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) setFeed(data);
      else setError(data.message || 'Erreur lors du chargement du fil');
    } catch {
      setError('Erreur réseau lors du chargement du fil');
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  useEffect(() => {
    if (token) {
      socket.auth = { token };
      socket.connect();

      socket.on('connect', () => {
        console.log('Connecté à WebSocket');
      });

      socket.on('newMedia', ({ media }) => {
        setFeed((prev) => [media, ...prev]);
      });

      socket.on('mediaDeleted', ({ mediaId }) => {
        setFeed((prev) => prev.filter((m) => m._id !== mediaId));
        videoRefs.current.delete(mediaId);
      });

      socket.on('pointsUpdate', ({ points }) => {
        setPoints(points || 0);
      });

      socket.on('connect_error', (err) => {
        console.error('Erreur WebSocket:', err.message);
        setError('Erreur de connexion WebSocket');
      });

      return () => {
        socket.off('connect');
        socket.off('newMedia');
        socket.off('mediaDeleted');
        socket.off('pointsUpdate');
        socket.disconnect();
      };
    }
  }, [token, userId]);

  useEffect(() => {
    if (token) {
      loadUserData();
      if (isVerified) loadFeed();
    } else {
      navigate('/login');
    }
  }, [token, isVerified, loadUserData, loadFeed, navigate]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const url = isLogin ? '/login' : '/register';
      const res = await fetch(`${API_URL}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username, whatsappNumber, whatsappMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        if (isLogin) {
          localStorage.setItem('token', data.token);
          setToken(data.token);
          setUsername(data.user.username || data.user.email || 'Utilisateur');
          setWhatsappNumber(data.user.whatsappNumber || '');
          setWhatsappMessage(data.user.whatsappMessage || '');
          setIsVerified(data.user.isVerified || false);
          setPoints(data.user.points || 0);
          setSuccess('Connexion réussie !');
        } else {
          setSuccess('Inscription réussie ! Vérifiez votre email.');
        }
        setEmail('');
        setPassword('');
        setUsername('');
        setWhatsappNumber('');
        setWhatsappMessage('');
      } else {
        setError(data.message || 'Erreur lors de l’authentification');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/verify-code`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsVerified(true);
        setSuccess('Compte vérifié !');
        setVerificationCode('');
      } else {
        setError(data.message || 'Code de vérification invalide');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestVerification = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/request-verification`, {
        method: 'POST',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Nouveau code de vérification envoyé !');
      } else {
        setError(data.message || 'Erreur lors de l’envoi du code');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedia = async (mediaId) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/media/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setFeed((prev) => prev.filter((m) => m._id !== mediaId));
        setSuccess('Média supprimé !');
        if (data.hasActions) {
          setError(
            'Avertissement : La suppression de médias ayant reçu des actions peut entraîner un bannissement de la plateforme.'
          );
        }
        // Réinitialiser les points du profil
        setPoints(0);
        await fetch(`${API_URL}/profile/points`, {
          method: 'PUT',
          headers: { Authorization: token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: 0 }),
        });
      } else {
        setError(data.message || 'Erreur lors de la suppression du média');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (mediaId, actionType, platform) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/action/${mediaId}/${actionType}/${platform}`, {
        method: 'POST',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        const actionUrl = data.actionUrl;
        const newWindow = window.open(actionUrl, '_blank');
        if (newWindow) {
          setTimeout(async () => {
            try {
              const validateRes = await fetch(
                `${API_URL}/validate-action/${actionUrl.split('actionToken=')[1]}`,
                {
                  method: 'POST',
                  headers: { Authorization: token },
                }
              );
              const validateData = await validateRes.json();
              if (validateRes.ok) {
                setPoints(validateData.points);
                setSuccess(`Action ${actionType} validée ! +${actionType === 'follow' ? 100 : 50} FCFA`);
              } else {
                setError(validateData.message || 'Erreur lors de la validation');
              }
            } catch {
              setError('Erreur réseau lors de la validation');
            }
          }, actionType === 'view' ? 60000 : 5000);
        } else {
          setError('Veuillez autoriser les pop-ups pour effectuer cette action');
        }
      } else {
        setError(data.message || 'Erreur lors de l’initiation de l’action');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUserId(null);
    setIsVerified(false);
    setPoints(0);
    setFeed([]);
    socket.disconnect();
    navigate('/login');
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const newMutedState = !prev;
      videoRefs.current.forEach((video) => {
        if (video) video.muted = newMutedState;
      });
      return newMutedState;
    });
  };

  const renderMedia = (media) => {
    const youtubeEmbedUrl = getYouTubeEmbedUrl(media.youtubeUrl);
    return (
      <div key={media._id} className="tiktok-media fade-in">
        <div className="media-wrapper">
          {youtubeEmbedUrl ? (
            <div className="ratio ratio-16x9">
              <iframe
                src={`${youtubeEmbedUrl}${isMuted ? '&mute=1' : ''}&autoplay=0`}
                title={media.originalname}
                frameBorder="0"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="tiktok-media-content"
                onError={() => setError(`Erreur de chargement de la vidéo YouTube ${media.originalname}`)}
              ></iframe>
            </div>
          ) : media.youtubeUrl ? (
            <div className="ratio ratio-16x9">
              <a
                href={media.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tiktok-media-content d-flex align-items-center justify-content-center bg-dark text-white"
              >
                <p className="text-center">
                  Vidéo YouTube non intégrable. <br />
                  <button
                    className="btn btn-danger btn-sm mt-2"
                    onClick={() => handleAction(media._id, 'view', 'youtube')}
                    disabled={loading}
                    aria-label="Voir sur YouTube"
                  >
                    {loading ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    ) : (
                      <FaYoutube />
                    )}
                    Voir sur YouTube
                  </button>
                </p>
              </a>
            </div>
          ) : media.filename?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
            <Link to={`/media/${media._id}`} className="media-link">
              <img
                src={media.filename}
                alt={media.originalname}
                className="tiktok-media-content"
                onError={() => setError(`Erreur de chargement de l'image ${media.originalname}`)}
              />
            </Link>
          ) : (
            <video
              ref={(el) => {
                if (el) {
                  videoRefs.current.set(media._id, el);
                  el.dataset.mediaId = media._id;
                } else {
                  videoRefs.current.delete(media._id);
                }
              }}
              className="tiktok-media-content"
              loop
              playsInline
              preload="metadata"
              muted={isMuted}
              onClick={() => {
                const video = videoRefs.current.get(media._id);
                if (video) {
                  if (video.paused) {
                    video.play().catch(() => setError(`Impossible de lire la vidéo ${media.originalname}`));
                  } else {
                    video.pause();
                  }
                }
              }}
              onError={() => setError(`Erreur de chargement de la vidéo ${media.originalname}`)}
            >
              <source
                src={media.filename}
                type={
                  media.filename?.endsWith('.webm')
                    ? 'video/webm'
                    : media.filename?.endsWith('.mov')
                    ? 'video/quicktime'
                    : 'video/mp4'
                }
              />
              Votre navigateur ne supporte pas la lecture de vidéos.
            </video>
          )}
        </div>
        <div className="tiktok-overlay">
          <div className="tiktok-info">
            <h5 className="text-white text-truncate">
              <Link to={`/media/${media._id}`} className="text-white text-decoration-none">
                {media.originalname}
              </Link>
            </h5>
            <p className="text-white small d-flex align-items-center">
              {media.owner?.profilePicture ? (
                <img
                  src={media.owner.profilePicture}
                  alt={`Photo de profil de ${media.owner?.username || media.owner?.email}`}
                  className="rounded-circle me-2"
                  style={{ width: '30px', height: '30px', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'inline';
                  }}
                />
              ) : (
                <FaUser className="me-2" style={{ fontSize: '30px' }} />
              )}
              Par : {media.owner?.username || media.owner?.email || 'Utilisateur inconnu'}
            </p>
            {media.owner?.whatsappNumber && (
              <p className="text-white small">
                <a
                  href={`https://wa.me/${media.owner.whatsappNumber}?text=${encodeURIComponent(
                    `${media.owner.whatsappMessage || 'Découvrez ce contenu sur Pixels Media !'} ${
                      window.location.origin
                    }/media/${media._id}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white"
                  aria-label={`Contacter ${media.owner?.username || media.owner?.email} sur WhatsApp`}
                >
                  <FaWhatsapp className="me-1" /> Contacter via WhatsApp
                </a>
              </p>
            )}
            <p className="text-white small">Uploadé le : {new Date(media.uploadedAt).toLocaleString()}</p>
            {media.owner._id === userId && (
              <div className="action-buttons">
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDeleteMedia(media._id)}
                  disabled={loading}
                  aria-label="Supprimer le média"
                >
                  <FaTrash /> Supprimer
                </button>
              </div>
            )}
            {(media.youtubeUrl || media.tiktokUrl || media.facebookUrl) && (
              <div className="social-actions mt-2">
                {media.youtubeUrl && (
                  <div className="mb-2">
                    <button
                      className="btn btn-sm btn-danger me-2"
                      onClick={() => handleAction(media._id, 'view', 'youtube')}
                      disabled={loading}
                      aria-label="Voir sur YouTube"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaYoutube />
                      )}
                      Voir (50 FCFA)
                    </button>
                    <button
                      className="btn btn-sm btn-primary me-2"
                      onClick={() => handleAction(media._id, 'like', 'youtube')}
                      disabled={loading}
                      aria-label="Liker sur YouTube"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaUserPlus />
                      )}
                      Like (50 FCFA)
                    </button>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleAction(media._id, 'follow', 'youtube')}
                      disabled={loading}
                      aria-label="S’abonner sur YouTube"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaUserCheck />
                      )}
                      S’abonner (100 FCFA)
                    </button>
                  </div>
                )}
                {media.tiktokUrl && (
                  <div className="mb-2">
                    <button
                      className="btn btn-sm btn-dark me-2"
                      onClick={() => handleAction(media._id, 'view', 'tiktok')}
                      disabled={loading}
                      aria-label="Voir sur TikTok"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaTiktok />
                      )}
                      Voir (50 FCFA)
                    </button>
                    <button
                      className="btn btn-sm btn-primary me-2"
                      onClick={() => handleAction(media._id, 'like', 'tiktok')}
                      disabled={loading}
                      aria-label="Liker sur TikTok"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaUserPlus />
                      )}
                      Like (50 FCFA)
                    </button>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleAction(media._id, 'follow', 'tiktok')}
                      disabled={loading}
                      aria-label="S’abonner sur TikTok"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaUserCheck />
                      )}
                      S’abonner (100 FCFA)
                    </button>
                  </div>
                )}
                {media.facebookUrl && (
                  <div className="mb-2">
                    <button
                      className="btn btn-sm btn-primary me-2"
                      onClick={() => handleAction(media._id, 'view', 'facebook')}
                      disabled={loading}
                      aria-label="Voir sur Facebook"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaFacebook />
                      )}
                      Voir (50 FCFA)
                    </button>
                    <button
                      className="btn btn-sm btn-primary me-2"
                      onClick={() => handleAction(media._id, 'like', 'facebook')}
                      disabled={loading}
                      aria-label="Liker sur Facebook"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaUserPlus />
                      )}
                      Like (50 FCFA)
                    </button>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleAction(media._id, 'follow', 'facebook')}
                      disabled={loading}
                      aria-label="S’abonner sur Facebook"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaUserCheck />
                      )}
                      S’abonner (100 FCFA)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let currentPlayingVideo = null;
        entries.forEach((entry) => {
          const video = entry.target;
          const mediaId = video.dataset.mediaId;
          if (entry.isIntersecting) {
            if (currentPlayingVideo && currentPlayingVideo !== video) {
              currentPlayingVideo.pause();
            }
            video.muted = isMuted;
            video.play().catch(() => setError(`Impossible de lire la vidéo ${mediaId}. Cliquez pour réessayer.`));
            currentPlayingVideo = video;
          } else {
            video.pause();
            if (currentPlayingVideo === video) {
              currentPlayingVideo = null;
            }
          }
        });
      },
      { threshold: 0.7, rootMargin: '0px' }
    );

    videoRefs.current.forEach((video) => {
      if (video) {
        observer.observe(video);
        video.muted = isMuted;
        video.addEventListener('error', () => {
          setError('Erreur de chargement de la vidéo. Vérifiez votre connexion.');
        });
      }
    });

    return () => {
      videoRefs.current.forEach((video) => {
        if (video) {
          observer.unobserve(video);
          video.removeEventListener('error', () => {});
        }
      });
      observer.disconnect();
    };
  }, [feed, isMuted]);

  if (!token) {
    return (
      <div className="container mt-5 text-center">
        <h2 className="text-white">{isLogin ? 'Connexion' : 'Inscription'}</h2>
        <form onSubmit={handleAuth}>
          <div className="mb-3">
            <label className="form-label text-white" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <div className="mb-3">
            <label className="form-label text-white" htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-required="true"
            />
          </div>
          {!isLogin && (
            <>
              <div className="mb-3">
                <label className="form-label text-white" htmlFor="username">Nom d'utilisateur</label>
                <input
                  id="username"
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-white" htmlFor="whatsappNumber">Numéro WhatsApp</label>
                <input
                  id="whatsappNumber"
                  type="text"
                  className="form-control"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-white" htmlFor="whatsappMessage">Message WhatsApp par défaut</label>
                <input
                  id="whatsappMessage"
                  type="text"
                  className="form-control"
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                />
              </div>
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading} aria-busy={loading}>
            {loading ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : isLogin ? (
              'Se connecter'
            ) : (
              'S’inscrire'
            )}
          </button>
          <button
            type="button"
            className="btn btn-link text-white"
            onClick={() => setIsLogin(!isLogin)}
            aria-label={isLogin ? 'Passer à l’inscription' : 'Passer à la connexion'}
          >
            {isLogin ? 'Pas de compte ? Inscrivez-vous' : 'Déjà un compte ? Connectez-vous'}
          </button>
        </form>
        {(error || success) && (
          <div
            className={`alert ${error ? 'alert-danger' : 'alert-success'} mt-3`}
            role="alert"
          >
            {error || success}
          </div>
        )}
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="container mt-5 text-center">
        <h2 className="text-white">Vérification de compte</h2>
        <form onSubmit={handleVerifyCode}>
          <div className="mb-3">
            <label className="form-label text-white" htmlFor="verificationCode">Code de vérification</label>
            <input
              id="verificationCode"
              type="text"
              className="form-control"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
              aria-required="true"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} aria-busy={loading}>
            {loading ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              'Vérifier'
            )}
          </button>
          <button
            type="button"
            className="btn btn-link text-white"
            onClick={handleRequestVerification}
            disabled={loading}
            aria-label="Renvoyer le code de vérification"
          >
            Renvoyer le code
          </button>
        </form>
        {(error || success) && (
          <div
            className={`alert ${error ? 'alert-danger' : 'alert-success'} mt-3`}
            role="alert"
          >
            {error || success}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="profile-container">
      <button
        className="btn btn-outline-light btn-sm position-fixed top-0 end-0 m-2 mute-button"
        onClick={toggleMute}
        aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
      >
        {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
      </button>
      {(error || success) && (
        <div
          className={`alert ${
            error ? 'alert-danger' : 'alert-success'
          } alert-dismissible fade show position-fixed top-0 w-100`}
          role="alert"
        >
          {error || success}
          <button
            type="button"
            className="btn-close"
            onClick={() => {
              setError('');
              setSuccess('');
            }}
            aria-label="Fermer l’alerte"
          ></button>
        </div>
      )}
      <div className="d-flex justify-content-end align-items-center p-2">
        <span className="text-white me-3">{points} FCFA</span>
        <button
          className="btn btn-danger btn-sm"
          onClick={handleLogout}
          aria-label="Se déconnecter"
        >
          <FaSignOutAlt /> Déconnexion
        </button>
      </div>
      <ul className="nav nav-tabs mt-5">
        <li className="nav-item">
          <button className="nav-link active" aria-current="page">
            Fil
          </button>
        </li>
      </ul>
      <div className="tiktok-feed">
        {feed.length === 0 ? (
          <div className="no-content">
            <p className="text-muted">
              Aucun média dans votre fil. Suivez des utilisateurs pour voir leur contenu !
            </p>
          </div>
        ) : (
          feed.map((media) => renderMedia(media))
        )}
      </div>
    </div>
  );
}
