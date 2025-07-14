import React, { useState, useEffect, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaTrash, FaEdit, FaUserPlus, FaUserCheck, FaSignOutAlt, FaUpload, FaSave, FaTimes, FaUser, FaPaperPlane, FaWhatsapp, FaCamera, FaChartPie, FaThumbsUp, FaThumbsDown, FaComment, FaFileUpload, FaYoutube, FaTiktok, FaFacebook } from 'react-icons/fa';
import io from 'socket.io-client';
import './Profile.css';

const API_URL = 'http://localhost:5000';
const socket = io(API_URL, { auth: { token: localStorage.getItem('token') } });

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
  const [activeTab, setActiveTab] = useState('profile');
  const [profilePicture, setProfilePicture] = useState('');
  const [selectedProfilePicture, setSelectedProfilePicture] = useState(null);
  const [diskUsage, setDiskUsage] = useState({ used: 0, total: 5 * 1024 * 1024 * 1024, remaining: 0 });
  const [points, setPoints] = useState(0);
  const [mediaName, setMediaName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUserData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setEmail(data.email);
        setUsername(data.username);
        setWhatsappNumber(data.whatsappNumber);
        setWhatsappMessage(data.whatsappMessage);
        setIsVerified(data.isVerified);
        setProfilePicture(data.profilePicture);
        setPoints(data.points);
        const parsed = parseJwt(token);
        setUserId(parsed?.userId);
      } else {
        setError(data.message);
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          setToken(null);
        }
      }
    } catch (err) {
      setError('Erreur lors du chargement des données utilisateur.');
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/users?q=${search}`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) setUsers(data);
      else setError(data.message);
    } catch (err) {
      setError('Erreur lors du chargement des utilisateurs.');
    }
  }, [search, token]);

  const loadFollows = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/follows`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) setFollows(data);
      else setError(data.message);
    } catch (err) {
      setError('Erreur lors du chargement des abonnements.');
    }
  }, [token]);

  const loadFeed = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/feed`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) setFeed(data);
      else setError(data.message);
    } catch (err) {
      setError('Erreur lors du chargement du fil.');
    }
  }, [token]);

  const loadMyMedias = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/my-medias`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) setMyMedias(data);
      else setError(data.message);
    } catch (err) {
      setError('Erreur lors du chargement de mes médias.');
    }
  }, [token]);

  const loadDiskUsage = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/disk-usage`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        const total = 5 * 1024 * 1024 * 1024; // 5 GB
        setDiskUsage({ used: data.used, total, remaining: total - data.used });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors du calcul de l’espace disque.');
    }
  }, [token]);

  useEffect(() => {
    loadUserData();
    loadUsers();
    loadFollows();
    loadFeed();
    loadMyMedias();
    loadDiskUsage();

    socket.on('newMedia', ({ media }) => {
      setFeed(prev => [media, ...prev]);
    });
    socket.on('mediaDeleted', ({ mediaId }) => {
      setFeed(prev => prev.filter(m => m._id !== mediaId));
      setMyMedias(prev => prev.filter(m => m._id !== mediaId));
    });
    socket.on('profilePictureUpdate', ({ userId: updatedUserId, profilePicture }) => {
      setFeed(prev =>
        prev.map(media =>
          media.owner._id === updatedUserId ? { ...media, owner: { ...media.owner, profilePicture } } : media
        )
      );
      setUsers(prev =>
        prev.map(user => (user._id === updatedUserId ? { ...user, profilePicture } : user))
      );
      setFollows(prev =>
        prev.map(user => (user._id === updatedUserId ? { ...user, profilePicture } : user))
      );
      if (userId === updatedUserId) setProfilePicture(profilePicture);
    });
    socket.on('pointsUpdate', ({ points }) => {
      setPoints(points);
    });

    return () => {
      socket.off('newMedia');
      socket.off('mediaDeleted');
      socket.off('profilePictureUpdate');
      socket.off('pointsUpdate');
    };
  }, [loadUserData, loadUsers, loadFollows, loadFeed, loadMyMedias, loadDiskUsage, userId]);

  const handleAuth = async e => {
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
          setUsername(data.user.username);
          setWhatsappNumber(data.user.whatsappNumber);
          setWhatsappMessage(data.user.whatsappMessage);
          setIsVerified(data.user.isVerified);
          setProfilePicture(data.user.profilePicture);
          setPoints(data.user.points);
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
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async e => {
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
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
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
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async e => {
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
        setUsername(data.user.username);
        setProfilePicture(data.user.profilePicture);
        setSuccess('Profil mis à jour !');
        setSelectedProfilePicture(null);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async e => {
    e.preventDefault();
    if (!file && !youtubeUrl && !tiktokUrl && !facebookUrl) {
      setError('Veuillez sélectionner un fichier ou entrer une URL.');
      return;
    }
    if (!mediaName.trim()) {
      setError('Le nom du média est requis.');
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

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: token },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMyMedias(prev => [data.media, ...prev]);
        setSuccess('Média uploadé avec succès !');
        setFile(null);
        setMediaName('');
        setYoutubeUrl('');
        setTiktokUrl('');
        setFacebookUrl('');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMedia = async (mediaId, name, youtubeUrl, tiktokUrl, facebookUrl) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/media/${mediaId}`, {
        method: 'PUT',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalname: name, youtubeUrl, tiktokUrl, facebookUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setMyMedias(prev => prev.map(m => (m._id === mediaId ? data.media : m)));
        setFeed(prev => prev.map(m => (m._id === mediaId ? data.media : m)));
        setSuccess('Média mis à jour !');
        setEditMediaId(null);
        setNewName('');
        setYoutubeUrl('');
        setTiktokUrl('');
        setFacebookUrl('');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedia = async mediaId => {
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
        setMyMedias(prev => prev.filter(m => m._id !== mediaId));
        setFeed(prev => prev.filter(m => m._id !== mediaId));
        setSuccess('Média supprimé !');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async userId => {
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
        setFollows(prev => [...prev, users.find(u => u._id === userId)]);
        setPoints(data.points);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async userId => {
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
        setFollows(prev => prev.filter(u => u._id !== userId));
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
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
          // Simuler la validation après un délai (par exemple, 60s pour une vue)
          setTimeout(async () => {
            try {
              const validateRes = await fetch(`${API_URL}/validate-action/${actionUrl.split('actionToken=')[1]}`, {
                method: 'POST',
                headers: { Authorization: token },
              });
              const validateData = await validateRes.json();
              if (validateRes.ok) {
                setPoints(validateData.points);
                setSuccess(`Action ${actionType} validée ! +${actionType === 'follow' ? 100 : 50} points`);
              } else {
                setError(validateData.message);
              }
            } catch (err) {
              setError('Erreur lors de la validation de l’action.');
            }
          }, actionType === 'view' ? 60000 : 5000); // 60s pour view, 5s pour like/follow
        } else {
          setError('Veuillez autoriser les pop-ups pour effectuer cette action.');
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
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
  };

  const formatSize = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const renderMedia = (media, isMyMedia = false) => {
    const isImage = media.filename?.match(/\.(jpg|jpeg|png|gif)$/i);
    return (
      <div key={media._id} className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{media.originalname}</h5>
          <p className="card-text">Par : {media.owner?.username || media.owner?.email}</p>
          {media.filename && (
            isImage ? (
              <img src={media.filename} alt={media.originalname} className="img-fluid" />
            ) : (
              <video controls className="w-100">
                <source src={media.filename} type="video/mp4" />
                Votre navigateur ne supporte pas la lecture de vidéos.
              </video>
            )
          )}
          {media.youtubeUrl && (
            <div>
              <a
                href="#"
                onClick={() => handleAction(media._id, 'view', 'youtube')}
                className="btn btn-danger btn-sm mr-2"
              >
                <FaYoutube /> Voir sur YouTube
              </a>
              <button
                onClick={() => handleAction(media._id, 'like', 'youtube')}
                className="btn btn-primary btn-sm mr-2"
              >
                <FaThumbsUp /> Like (50 points)
              </button>
              <button
                onClick={() => handleAction(media._id, 'follow', 'youtube')}
                className="btn btn-success btn-sm"
              >
                <FaUserPlus /> S’abonner (100 points)
              </button>
            </div>
          )}
          {media.tiktokUrl && (
            <div>
              <a
                href="#"
                onClick={() => handleAction(media._id, 'view', 'tiktok')}
                className="btn btn-dark btn-sm mr-2"
              >
                <FaTiktok /> Voir sur TikTok
              </a>
              <button
                onClick={() => handleAction(media._id, 'like', 'tiktok')}
                className="btn btn-primary btn-sm mr-2"
              >
                <FaThumbsUp /> Like (50 points)
              </button>
              <button
                onClick={() => handleAction(media._id, 'follow', 'tiktok')}
                className="btn btn-success btn-sm"
              >
                <FaUserPlus /> S’abonner (100 points)
              </button>
            </div>
          )}
          {media.facebookUrl && (
            <div>
              <a
                href="#"
                onClick={() => handleAction(media._id, 'view', 'facebook')}
                className="btn btn-primary btn-sm mr-2"
              >
                <FaFacebook /> Voir sur Facebook
              </a>
              <button
                onClick={() => handleAction(media._id, 'like', 'facebook')}
                className="btn btn-primary btn-sm mr-2"
              >
                <FaThumbsUp /> Like (50 points)
              </button>
              <button
                onClick={() => handleAction(media._id, 'follow', 'facebook')}
                className="btn btn-success btn-sm"
              >
                <FaUserPlus /> S’abonner (100 points)
              </button>
            </div>
          )}
          {isMyMedia && (
            <div className="mt-2">
              <button
                className="btn btn-warning btn-sm mr-2"
                onClick={() => {
                  setEditMediaId(media._id);
                  setNewName(media.originalname);
                  setYoutubeUrl(media.youtubeUrl || '');
                  setTiktokUrl(media.tiktokUrl || '');
                  setFacebookUrl(media.facebookUrl || '');
                }}
              >
                <FaEdit /> Modifier
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDeleteMedia(media._id)}
              >
                <FaTrash /> Supprimer
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!token) {
    return (
      <div className="container mt-5">
        <h2>{isLogin ? 'Connexion' : 'Inscription'}</h2>
        <form onSubmit={handleAuth}>
          <div className="mb-3">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Mot de passe</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {!isLogin && (
            <>
              <div className="mb-3">
                <label className="form-label">Nom d'utilisateur</label>
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Numéro WhatsApp</label>
                <input
                  type="text"
                  className="form-control"
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Message WhatsApp par défaut</label>
                <input
                  type="text"
                  className="form-control"
                  value={whatsappMessage}
                  onChange={e => setWhatsappMessage(e.target.value)}
                />
              </div>
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'S’inscrire'}
          </button>
          <button
            type="button"
            className="btn btn-link"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Pas de compte ? Inscrivez-vous' : 'Déjà un compte ? Connectez-vous'}
          </button>
        </form>
        {error && <div className="alert alert-danger mt-3">{error}</div>}
        {success && <div className="alert alert-success mt-3">{success}</div>}
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="container mt-5">
        <h2>Vérification de compte</h2>
        <form onSubmit={handleVerifyCode}>
          <div className="mb-3">
            <label className="form-label">Code de vérification</label>
            <input
              type="text"
              className="form-control"
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Chargement...' : 'Vérifier'}
          </button>
          <button
            type="button"
            className="btn btn-link"
            onClick={handleRequestVerification}
            disabled={loading}
          >
            Renvoyer le code
          </button>
        </form>
        {error && <div className="alert alert-danger mt-3">{error}</div>}
        {success && <div className="alert alert-success mt-3">{success}</div>}
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>
          <FaUser /> {username} ({points} points = {points} FCFA)
        </h2>
        <button className="btn btn-danger" onClick={handleLogout}>
          <FaSignOutAlt /> Déconnexion
        </button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <ul className="nav nav-tabs mb-4">
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
            className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Utilisateurs
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
            className={`nav-link ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            Fil
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'myMedias' ? 'active' : ''}`}
            onClick={() => setActiveTab('myMedias')}
          >
            Mes médias
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'disk' ? 'active' : ''}`}
            onClick={() => setActiveTab('disk')}
          >
            Espace disque
          </button>
        </li>
      </ul>

      {activeTab === 'profile' && (
        <div>
          <h3>Modifier le profil</h3>
          <form onSubmit={handleUpdateProfile}>
            <div className="mb-3">
              <label className="form-label">Nom d'utilisateur</label>
              <input
                type="text"
                className="form-control"
                value={editUsername}
                onChange={e => setEditUsername(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Numéro WhatsApp</label>
              <input
                type="text"
                className="form-control"
                value={whatsappNumber}
                onChange={e => setWhatsappNumber(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Message WhatsApp par défaut</label>
              <input
                type="text"
                className="form-control"
                value={whatsappMessage}
                onChange={e => setWhatsappMessage(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Photo de profil</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={e => setSelectedProfilePicture(e.target.files[0])}
              />
              {profilePicture && (
                <img
                  src={profilePicture}
                  alt="Profil"
                  className="img-fluid mt-2"
                  style={{ maxWidth: '100px' }}
                />
              )}
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Chargement...' : 'Mettre à jour'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <h3>Rechercher des utilisateurs</h3>
          <input
            type="text"
            className="form-control mb-3"
            placeholder="Rechercher par email ou nom d'utilisateur"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <ul className="list-group">
            {users.map(user => (
              <li key={user._id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  {user.profilePicture && (
                    <img
                      src={user.profilePicture}
                      alt={user.username}
                      className="rounded-circle mr-2"
                      style={{ width: '40px', height: '40px' }}
                    />
                  )}
                  {user.username} ({user.email})
                </div>
                {follows.some(f => f._id === user._id) ? (
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => handleUnfollow(user._id)}
                    disabled={loading}
                  >
                    <FaUserCheck /> Se désabonner
                  </button>
                ) : (
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => handleFollow(user._id)}
                    disabled={loading}
                  >
                    <FaUserPlus /> S’abonner
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === 'follows' && (
        <div>
          <h3>Mes abonnements</h3>
          <ul className="list-group">
            {follows.map(user => (
              <li key={user._id} className="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  {user.profilePicture && (
                    <img
                      src={user.profilePicture}
                      alt={user.username}
                      className="rounded-circle mr-2"
                      style={{ width: '40px', height: '40px' }}
                    />
                  )}
                  {user.username} ({user.email})
                </div>
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => handleUnfollow(user._id)}
                  disabled={loading}
                >
                  <FaUserCheck /> Se désabonner
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeTab === 'feed' && (
        <div>
          <h3>Fil des abonnements</h3>
          {feed.map(media => renderMedia(media))}
        </div>
      )}

      {activeTab === 'myMedias' && (
        <div>
          <h3>Mes médias</h3>
          <form onSubmit={handleUpload}>
            <div className="mb-3">
              <label className="form-label">Nom du média</label>
              <input
                type="text"
                className="form-control"
                value={mediaName}
                onChange={e => setMediaName(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Fichier média</label>
              <input
                type="file"
                className="form-control"
                accept="image/*,video/*"
                onChange={e => setFile(e.target.files[0])}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">URL YouTube</label>
              <input
                type="text"
                className="form-control"
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <div className="mb-3">
              <label className="form-label">URL TikTok</label>
              <input
                type="text"
                className="form-control"
                value={tiktokUrl}
                onChange={e => setTiktokUrl(e.target.value)}
                placeholder="https://www.tiktok.com/..."
              />
            </div>
            <div className="mb-3">
              <label className="form-label">URL Facebook</label>
              <input
                type="text"
                className="form-control"
                value={facebookUrl}
                onChange={e => setFacebookUrl(e.target.value)}
                placeholder="https://www.facebook.com/..."
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <FaUpload /> {loading ? 'Chargement...' : 'Uploader'}
            </button>
          </form>
          {myMedias.map(media => (
            editMediaId === media._id ? (
              <div key={media._id} className="card mb-3">
                <div className="card-body">
                  <input
                    type="text"
                    className="form-control mb-2"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Nouveau nom"
                  />
                  <input
                    type="text"
                    className="form-control mb-2"
                    value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)}
                    placeholder="URL YouTube"
                  />
                  <input
                    type="text"
                    className="form-control mb-2"
                    value={tiktokUrl}
                    onChange={e => setTiktokUrl(e.target.value)}
                    placeholder="URL TikTok"
                  />
                  <input
                    type="text"
                    className="form-control mb-2"
                    value={facebookUrl}
                    onChange={e => setFacebookUrl(e.target.value)}
                    placeholder="URL Facebook"
                  />
                  <button
                    className="btn btn-success btn-sm mr-2"
                    onClick={() => handleEditMedia(media._id, newName, youtubeUrl, tiktokUrl, facebookUrl)}
                    disabled={loading}
                  >
                    <FaSave /> Enregistrer
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setEditMediaId(null);
                      setNewName('');
                      setYoutubeUrl('');
                      setTiktokUrl('');
                      setFacebookUrl('');
                    }}
                  >
                    <FaTimes /> Annuler
                  </button>
                </div>
              </div>
            ) : (
              renderMedia(media, true)
            )
          ))}
        </div>
      )}

      {activeTab === 'disk' && (
        <div>
          <h3>Espace disque</h3>
          <p>Utilisé : {formatSize(diskUsage.used)}</p>
          <p>Restant : {formatSize(diskUsage.remaining)}</p>
          <p>Total : {formatSize(diskUsage.total)}</p>
        </div>
      )}
    </div>
  );
}
