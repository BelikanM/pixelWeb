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
  FaPaperPlane,
  FaWhatsapp,
  FaCamera,
  FaChartPie,
  FaThumbsUp,
  FaThumbsDown,
  FaComment,
  FaFileUpload,
  FaYoutube,
  FaTiktok,
  FaFacebook,
  FaVolumeUp,
  FaVolumeMute,
  FaShare,
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
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [follows, setFollows] = useState([]);
  const [feed, setFeed] = useState([]);
  const [myMedias, setMyMedias] = useState([]);
  const [file, setFile] = useState(null);
  const [editMediaId, setEditMediaId] = useState(null);
  const [newName, setNewName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [activeTab, setActiveTab] = useState('feed');
  const [profilePicture, setProfilePicture] = useState('');
  const [selectedProfilePicture, setSelectedProfilePicture] = useState(null);
  const [diskUsage, setDiskUsage] = useState({ used: 0, total: 5 * 1024 * 1024 * 1024, remaining: 0 });
  const [points, setPoints] = useState(0);
  const [mediaName, setMediaName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [mediaPoints, setMediaPoints] = useState(''); // État pour les points lors de l'upload/édition
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isMuted, setIsMuted] = useState(true);
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
      if (!videoId) return null;
      return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
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
        setProfilePicture(data.profilePicture || '');
        setPoints(data.points || 0);
        setEditUsername(data.username || data.email || '');
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

  const loadUsers = useCallback(async () => {
    if (!token || !search.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/users?q=${encodeURIComponent(search)}`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) setUsers(data);
      else setError(data.message || 'Erreur lors de la recherche');
    } catch {
      setError('Erreur réseau lors de la recherche');
    } finally {
      setLoading(false);
    }
  }, [search, token]);

  const loadFollows = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/follows`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) setFollows(data);
      else setError(data.message || 'Erreur lors du chargement des abonnements');
    } catch {
      setError('Erreur réseau lors du chargement des abonnements');
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

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

  const loadMyMedias = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/my-medias`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) setMyMedias(data);
      else setError(data.message || 'Erreur lors du chargement de mes médias');
    } catch {
      setError('Erreur réseau lors du chargement des médias');
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  const loadDiskUsage = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/disk-usage`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        const total = 5 * 1024 * 1024 * 1024;
        setDiskUsage({ used: data.used, total, remaining: total - data.used });
      } else {
        setError(data.message || 'Erreur lors du calcul de l’espace disque');
      }
    } catch {
      setError('Erreur réseau lors du calcul de l’espace disque');
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
        if (media.owner._id === userId) {
          setMyMedias((prev) => [media, ...prev]);
        }
      });

      socket.on('mediaDeleted', ({ mediaId }) => {
        setFeed((prev) => prev.filter((m) => m._id !== mediaId));
        setMyMedias((prev) => prev.filter((m) => m._id !== mediaId));
        videoRefs.current.delete(mediaId);
      });

      socket.on('profilePictureUpdate', ({ userId: updatedUserId, profilePicture }) => {
        setFeed((prev) =>
          prev.map((media) =>
            media.owner._id === updatedUserId
              ? { ...media, owner: { ...media.owner, profilePicture } }
              : media
          )
        );
        setUsers((prev) =>
          prev.map((user) =>
            user._id === updatedUserId ? { ...user, profilePicture } : user
          )
        );
        setFollows((prev) =>
          prev.map((user) =>
            user._id === updatedUserId ? { ...user, profilePicture } : user
          )
        );
        if (userId === updatedUserId) setProfilePicture(profilePicture);
      });

      socket.on('pointsUpdate', ({ points }) => {
        setPoints(points || 0);
      });

      socket.on('mediaPointsUpdate', ({ mediaId, points }) => {
        setFeed((prev) =>
          prev.map((media) =>
            media._id === mediaId ? { ...media, points } : media
          )
        );
        setMyMedias((prev) =>
          prev.map((media) =>
            media._id === mediaId ? { ...media, points } : media
          )
        );
      });

      socket.on('connect_error', (err) => {
        console.error('Erreur WebSocket:', err.message);
        setError('Erreur de connexion WebSocket');
      });

      return () => {
        socket.off('connect');
        socket.off('newMedia');
        socket.off('mediaDeleted');
        socket.off('profilePictureUpdate');
        socket.off('pointsUpdate');
        socket.off('mediaPointsUpdate');
        socket.disconnect();
      };
    }
  }, [token, userId]);

  useEffect(() => {
    if (token) {
      loadUserData();
      if (isVerified) {
        loadUsers();
        loadFollows();
        loadFeed();
        loadMyMedias();
        loadDiskUsage();
      }
    } else {
      navigate('/login');
    }
  }, [token, isVerified, loadUserData, loadUsers, loadFollows, loadFeed, loadMyMedias, loadDiskUsage, navigate]);

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
          setProfilePicture(data.user.profilePicture || '');
          setPoints(data.user.points || 0);
          setEditUsername(data.user.username || data.user.email || '');
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

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    const formData = new FormData();
    formData.append('username', editUsername);
    formData.append('whatsappNumber', whatsappNumber);
    formData.append('whatsappMessage', whatsappMessage);
    if (selectedProfilePicture) formData.append('profilePicture', selectedProfilePicture);

    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { Authorization: token },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUsername(data.user.username || data.user.email || 'Utilisateur');
        setProfilePicture(data.user.profilePicture || '');
        setSuccess('Profil mis à jour !');
        setSelectedProfilePicture(null);
      } else {
        setError(data.message || 'Erreur lors de la mise à jour du profil');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file && !youtubeUrl && !tiktokUrl && !facebookUrl) {
      setError('Veuillez sélectionner un fichier ou entrer une URL.');
      return;
    }
    if (!mediaName.trim()) {
      setError('Le nom du média est requis.');
      return;
    }
    if (mediaPoints && (isNaN(mediaPoints) || mediaPoints < 0)) {
      setError('Les points doivent être un nombre positif ou zéro.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    const formData = new FormData();
    if (file) formData.append('media', file);
    formData.append('originalname', mediaName);
    if (youtubeUrl) formData.append('youtubeUrl', youtubeUrl);
    if (tiktokUrl) formData.append('tiktokUrl', tiktokUrl);
    if (facebookUrl) formData.append('facebookUrl', facebookUrl);
    formData.append('points', mediaPoints || 0);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: token },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMyMedias((prev) => [data.media, ...prev]);
        setSuccess('Média uploadé avec succès !');
        setFile(null);
        setMediaName('');
        setYoutubeUrl('');
        setTiktokUrl('');
        setFacebookUrl('');
        setMediaPoints('');
        loadDiskUsage();
      } else {
        setError(data.message || 'Erreur lors de l’upload du média');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMedia = async (mediaId, name, youtubeUrl, tiktokUrl, facebookUrl, points) => {
    setLoading(true);
    setError('');
    setSuccess('');
    if (!name.trim()) {
      setError('Le nom du média est requis.');
      return;
    }
    if (points && (isNaN(points) || points < 0)) {
      setError('Les points doivent être un nombre positif ou zéro.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/media/${mediaId}`, {
        method: 'PUT',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalname: name, youtubeUrl, tiktokUrl, facebookUrl, points: points || 0 }),
      });
      const data = await res.json();
      if (res.ok) {
        setMyMedias((prev) => prev.map((m) => (m._id === mediaId ? data.media : m)));
        setFeed((prev) => prev.map((m) => (m._id === mediaId ? data.media : m)));
        setSuccess('Média mis à jour !');
        setEditMediaId(null);
        setNewName('');
        setYoutubeUrl('');
        setTiktokUrl('');
        setFacebookUrl('');
        setMediaPoints('');
      } else {
        setError(data.message || 'Erreur lors de la mise à jour du média');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetMediaPoints = async (mediaId) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/media/${mediaId}/points`, {
        method: 'PUT',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: 0 }),
      });
      const data = await res.json();
      if (res.ok) {
        setMyMedias((prev) => prev.map((m) => (m._id === mediaId ? data.media : m)));
        setFeed((prev) => prev.map((m) => (m._id === mediaId ? data.media : m)));
        setSuccess('Points du média réinitialisés !');
      } else {
        setError(data.message || 'Erreur lors de la réinitialisation des points');
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
        setMyMedias((prev) => prev.filter((m) => m._id !== mediaId));
        setFeed((prev) => prev.filter((m) => m._id !== mediaId));
        setSuccess('Média supprimé !');
        loadDiskUsage();
      } else {
        setError(data.message || 'Erreur lors de la suppression du média');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/follow`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFollows((prev) => [...prev, users.find((u) => u._id === userId)]);
        setPoints(data.points);
        setSuccess('Utilisateur suivi !');
        loadFeed();
      } else {
        setError(data.message || 'Erreur lors de l’abonnement');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (userId) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/follow`, {
        method: 'DELETE',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setFollows((prev) => prev.filter((u) => u._id !== userId));
        setSuccess('Utilisateur désabonné !');
      } else {
        setError(data.message || 'Erreur lors du désabonnement');
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
                setFeed((prev) =>
                  prev.map((m) =>
                    m._id === mediaId ? { ...m, points: validateData.mediaPoints } : m
                  )
                );
                setMyMedias((prev) =>
                  prev.map((m) =>
                    m._id === mediaId ? { ...m, points: validateData.mediaPoints } : m
                  )
                );
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
    setProfilePicture('');
    setPoints(0);
    setFeed([]);
    setMyMedias([]);
    setFollows([]);
    setUsers([]);
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

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const renderMedia = (media, isMyMedia = false) => {
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
          ) : media.tiktokUrl ? (
            <div className="ratio ratio-16x9">
              <a
                href={media.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tiktok-media-content d-flex align-items-center justify-content-center bg-dark text-white"
              >
                <p className="text-center">
                  Vidéo TikTok. <br />
                  <button
                    className="btn btn-dark btn-sm mt-2"
                    onClick={() => handleAction(media._id, 'view', 'tiktok')}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    ) : (
                      <FaTiktok />
                    )}
                    Voir sur TikTok
                  </button>
                </p>
              </a>
            </div>
          ) : media.facebookUrl ? (
            <div className="ratio ratio-16x9">
              <a
                href={media.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tiktok-media-content d-flex align-items-center justify-content-center bg-dark text-white"
              >
                <p className="text-center">
                  Vidéo Facebook. <br />
                  <button
                    className="btn btn-primary btn-sm mt-2"
                    onClick={() => handleAction(media._id, 'view', 'facebook')}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    ) : (
                      <FaFacebook />
                    )}
                    Voir sur Facebook
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
            <p className="text-white small">Points : {media.points} FCFA</p>
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
            {isMyMedia && (
              <div className="action-buttons">
                <button
                  className="btn btn-sm btn-warning me-2"
                  onClick={() => {
                    setEditMediaId(media._id);
                    setNewName(media.originalname);
                    setYoutubeUrl(media.youtubeUrl || '');
                    setTiktokUrl(media.tiktokUrl || '');
                    setFacebookUrl(media.facebookUrl || '');
                    setMediaPoints(media.points || '');
                  }}
                  disabled={loading}
                  aria-label="Modifier le média"
                >
                  <FaEdit /> Modifier
                </button>
                <button
                  className="btn btn-sm btn-info me-2"
                  onClick={() => handleResetMediaPoints(media._id)}
                  disabled={loading}
                  aria-label="Réinitialiser les points"
                >
                  <FaTimes /> Réinitialiser Points
                </button>
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
                      disabled={loading || media.points < 50}
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
                      disabled={loading || media.points < 50}
                      aria-label="Liker sur YouTube"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaThumbsUp />
                      )}
                      Like (50 FCFA)
                    </button>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleAction(media._id, 'follow', 'youtube')}
                      disabled={loading || media.points < 100}
                      aria-label="S’abonner sur YouTube"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaUserPlus />
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
                      disabled={loading || media.points < 50}
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
                      disabled={loading || media.points < 50}
                      aria-label="Liker sur TikTok"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaThumbsUp />
                      )}
                      Like (50 FCFA)
                    </button>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleAction(media._id, 'follow', 'tiktok')}
                      disabled={loading || media.points < 100}
                      aria-label="S’abonner sur TikTok"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaUserPlus />
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
                      disabled={loading || media.points < 50}
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
                      disabled={loading || media.points < 50}
                      aria-label="Liker sur Facebook"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaThumbsUp />
                      )}
                      Like (50 FCFA)
                    </button>
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleAction(media._id, 'follow', 'facebook')}
                      disabled={loading || media.points < 100}
                      aria-label="S’abonner sur Facebook"
                    >
                      {loading ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <FaUserPlus />
                      )}
                      S’abonner (100 FCFA)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {isMyMedia && editMediaId === media._id && (
          <div className="edit-form mt-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEditMedia(media._id, newName, youtubeUrl, tiktokUrl, facebookUrl, mediaPoints);
              }}
            >
              <div className="mb-3">
                <label className="form-label text-white">Nom du média</label>
                <input
                  type="text"
                  className="form-control"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-white">Points (FCFA)</label>
                <input
                  type="number"
                  className="form-control"
                  value={mediaPoints}
                  onChange={(e) => setMediaPoints(e.target.value)}
                  min="0"
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-white">URL YouTube</label>
                <input
                  type="text"
                  className="form-control"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-white">URL TikTok</label>
                <input
                  type="text"
                  className="form-control"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-white">URL Facebook</label>
                <input
                  type="text"
                  className="form-control"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-success me-2" disabled={loading}>
                <FaSave /> Enregistrer
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditMediaId(null);
                  setNewName('');
                  setYoutubeUrl('');
                  setTiktokUrl('');
                  setFacebookUrl('');
                  setMediaPoints('');
                }}
                disabled={loading}
              >
                <FaTimes /> Annuler
              </button>
            </form>
          </div>
        )}
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
            video.play().catch((error) => {
              console.error(`Erreur lors de la lecture automatique de la vidéo ${mediaId}:`, error);
              setError(`Impossible de lire la vidéo ${mediaId}. Cliquez pour réessayer.`);
            });
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

    videoRefs.current.forEach((video, mediaId) => {
      if (video) {
        observer.observe(video);
        video.muted = isMuted;
        video.addEventListener('error', () => {
          console.error(`Erreur de chargement de la vidéo ${mediaId}:`, video.error);
          setError(`Impossible de charger la vidéo ${mediaId}. Vérifiez votre connexion.`);
        });
        const source = video.querySelector('source');
        if (source && mediaId) {
          const extension = feed
            .find((m) => m._id === mediaId)
            ?.filename?.split('.')
            .pop()
            ?.toLowerCase();
          const mimeTypes = {
            mp4: 'video/mp4',
            webm: 'video/webm',
            mov: 'video/quicktime',
          };
          source.type = mimeTypes[extension] || 'video/mp4';
        }
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
  }, [feed, myMedias, isMuted]);

  if (!token) {
    return (
      <div className="container mt-5 text-center">
        <h2 className="text-white">{isLogin ? 'Connexion' : 'Inscription'}</h2>
        <form onSubmit={handleAuth}>
          <div className="mb-3">
            <label className="form-label text-white">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label text-white">Mot de passe</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {!isLogin && (
            <>
              <div className="mb-3">
                <label className="form-label text-white">Nom d'utilisateur</label>
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-white">Numéro WhatsApp</label>
                <input
                  type="text"
                  className="form-control"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label text-white">Message WhatsApp par défaut</label>
                <input
                  type="text"
                  className="form-control"
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                />
              </div>
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
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
            <label className="form-label text-white">Code de vérification</label>
            <input
              type="text"
              className="form-control"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
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
            aria-label="Fermer"
          ></button>
        </div>
      )}
      <div className="d-flex justify-content-end align-items-center p-2">
        <span className="text-white me-3">{points} FCFA</span>
        <button className="btn btn-danger btn-sm" onClick={handleLogout}>
          <FaSignOutAlt /> Déconnexion
        </button>
      </div>
      <ul className="nav nav-tabs mt-5">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            Fil
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'my-medias' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-medias')}
          >
            Mes Médias
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profil
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'follows' ? 'active' : ''}`}
            onClick={() => setActiveTab('follows')}
          >
            Abonnements
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Recherche
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Uploader
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Statistiques
          </button>
        </li>
      </ul>

      {activeTab === 'feed' && (
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
      )}

      {activeTab === 'my-medias' && (
        <div className="tiktok-feed">
          {myMedias.length === 0 ? (
            <div className="no-content">
              <p className="text-muted">Vous n’avez pas encore uploadé de médias.</p>
            </div>
          ) : (
            myMedias.map((media) => renderMedia(media, true))
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="container mt-5 text-center">
          <h2 className="text-white">Profil</h2>
          <form onSubmit={handleUpdateProfile}>
            <div className="mb-3">
              <label className="form-label text-white">Photo de profil</label>
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt="Photo de profil"
                  className="rounded-circle mb-2"
                  style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                />
              ) : (
                <FaUser style={{ fontSize: '100px', color: '#fff' }} />
              )}
              <input
                type="file"
                accept="image/*"
                className="form-control"
                onChange={(e) => setSelectedProfilePicture(e.target.files[0])}
              />
            </div>
            <div className="mb-3">
              <label className="form-label text-white">Nom d'utilisateur</label>
              <input
                type="text"
                className="form-control"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label text-white">Numéro WhatsApp</label>
              <input
                type="text"
                className="form-control"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label text-white">Message WhatsApp par défaut</label>
              <input
                type="text"
                className="form-control"
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                'Mettre à jour'
              )}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'follows' && (
        <div className="container mt-5">
          <h2 className="text-white text-center">Mes Abonnements</h2>
          {follows.length === 0 ? (
            <p className="text-muted text-center">Vous ne suivez aucun utilisateur.</p>
          ) : (
            <div className="row">
              {follows.map((user) => (
                <div key={user._id} className="col-md-4 mb-3">
                  <div className="card">
                    <div className="card-body d-flex align-items-center">
                      {user.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={`Photo de profil de ${user.username || user.email}`}
                          className="rounded-circle me-3"
                          style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                        />
                      ) : (
                        <FaUser className="me-3" style={{ fontSize: '50px' }} />
                      )}
                      <div>
                        <h5 className="card-title">{user.username || user.email}</h5>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleUnfollow(user._id)}
                          disabled={loading}
                        >
                          <FaUserCheck /> Se désabonner
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'search' && (
        <div className="container mt-5">
          <h2 className="text-white text-center">Rechercher des utilisateurs</h2>
          <div className="mb-3">
            <input
              type="text"
              className="form-control"
              placeholder="Rechercher par email ou nom d'utilisateur"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="row">
            {users.map((user) => (
              <div key={user._id} className="col-md-4 mb-3">
                <div className="card">
                  <div className="card-body d-flex align-items-center">
                    {user.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt={`Photo de profil de ${user.username || user.email}`}
                        className="rounded-circle me-3"
                        style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                      />
                    ) : (
                      <FaUser className="me-3" style={{ fontSize: '50px' }} />
                    )}
                    <div>
                      <h5 className="card-title">{user.username || user.email}</h5>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleFollow(user._id)}
                        disabled={loading || follows.some((f) => f._id === user._id)}
                      >
                        <FaUserPlus /> Suivre
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="container mt-5 text-center">
          <h2 className="text-white">Uploader un média</h2>
          <form onSubmit={handleUpload}>
            <div className="mb-3">
              <label className="form-label text-white">Fichier</label>
              <input
                type="file"
                accept="image/*,video/*"
                className="form-control"
                onChange={(e) => setFile(e.target.files[0])}
              />
            </div>
            <div className="mb-3">
              <label className="form-label text-white">Nom du média</label>
              <input
                type="text"
                className="form-control"
                value={mediaName}
                onChange={(e) => setMediaName(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label text-white">Points (FCFA)</label>
              <input
                type="number"
                className="form-control"
                value={mediaPoints}
                onChange={(e) => setMediaPoints(e.target.value)}
                min="0"
              />
            </div>
            <div className="mb-3">
              <label className="form-label text-white">URL YouTube</label>
              <input
                type="text"
                className="form-control"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label text-white">URL TikTok</label>
              <input
                type="text"
                className="form-control"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label text-white">URL Facebook</label>
              <input
                type="text"
                className="form-control"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                <>
                  <FaUpload /> Uploader
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="container mt-5 text-center">
          <h2 className="text-white">Statistiques</h2>
          <p className="text-white">Espace disque utilisé : {formatSize(diskUsage.used)}</p>
          <p className="text-white">Espace disque restant : {formatSize(diskUsage.remaining)}</p>
          <p className="text-white">Points totaux : {points} FCFA</p>
          <div className="progress mt-3">
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${(diskUsage.used / diskUsage.total) * 100}%` }}
              aria-valuenow={(diskUsage.used / diskUsage.total) * 100}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {(diskUsage.used / diskUsage.total) * 100}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
