import React, { useState, useEffect, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaTrash, FaEdit, FaUserPlus, FaUserCheck, FaSignOutAlt, FaUpload, FaSave, FaTimes, FaUser, FaPaperPlane, FaWhatsapp, FaCamera, FaChartPie, FaThumbsUp, FaThumbsDown, FaComment } from 'react-icons/fa';
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
  const [message, setMessage] = useState('');
  const [isLogin, setIsLogin] = useState(false);
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
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeOptions, setYoutubeOptions] = useState({ autoplay: false, muted: false, subtitles: false });
  const [mediaName, setMediaName] = useState(''); // Nouveau champ pour le nom du média
  const [commentText, setCommentText] = useState({}); // Commentaires par média

  // Charger profil utilisateur
  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setEmail(data.email || '');
        setUsername(data.username || '');
        setEditUsername(data.username || '');
        setWhatsappNumber(data.whatsappNumber || '');
        setIsVerified(data.isVerified || false);
        setProfilePicture(data.profilePicture || '');
        setPoints(data.points || 0);
      } else {
        setMessage(data.message || 'Erreur chargement profil');
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          setToken(null);
          setIsLogin(false);
          setMessage('Session invalide, veuillez vous reconnecter');
        }
      }
    } catch {
      setMessage('Erreur réseau lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Charger les informations d'utilisation du disque
  const loadDiskUsage = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/disk-usage`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setDiskUsage({
          used: data.used,
          total: 5 * 1024 * 1024 * 1024,
          remaining: 5 * 1024 * 1024 * 1024 - data.used,
        });
      } else {
        setMessage(data.message || 'Erreur lors du chargement des données d’espace disque');
      }
    } catch {
      setMessage('Erreur réseau lors du chargement des données d’espace disque');
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  // Demander un nouveau code de vérification
  const requestVerificationCode = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/request-verification`, {
        method: 'POST',
        headers: { Authorization: token },
      });
      const data = await res.json();
      setMessage(data.message || 'Erreur lors de la demande de code');
    } catch {
      setMessage('Erreur réseau lors de la demande de code');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Valider le code
  const verifyCode = useCallback(async () => {
    if (!token || !verificationCode.trim()) {
      setMessage('Veuillez entrer un code');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ code: verificationCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsVerified(true);
        setVerificationCode('');
        setMessage(data.message);
        loadProfile();
      } else {
        setMessage(data.message || 'Erreur lors de la vérification');
      }
    } catch {
      setMessage('Erreur réseau lors de la vérification');
    } finally {
      setLoading(false);
    }
  }, [token, verificationCode, loadProfile]);

  // Chargement utilisateurs
  const loadUsers = useCallback(async (q) => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/users?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data.filter((u) => u._id !== userId) : []);
    } catch {
      setMessage('Erreur chargement utilisateurs');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token, userId, isVerified]);

  // Chargement suivis
  const loadFollows = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/follows`, { headers: { Authorization: token } });
      const data = await res.json();
      setFollows(Array.isArray(data) ? data.map((u) => u._id) : []);
    } catch {
      setMessage('Erreur chargement abonnements');
      setFollows([]);
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  // Charger feed
  const loadFeed = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/feed`, { headers: { Authorization: token } });
      const data = await res.json();
      setFeed(Array.isArray(data) ? data : []);
    } catch {
      setMessage('Erreur chargement fil');
      setFeed([]);
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  // Charger médias personnels
  const loadMyMedias = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/my-medias`, { headers: { Authorization: token } });
      const data = await res.json();
      setMyMedias(Array.isArray(data) ? data : []);
    } catch {
      setMessage('Erreur chargement médias');
      setMyMedias([]);
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  // Suivre utilisateur
  const followUser = useCallback(async (id) => {
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant de suivre des utilisateurs');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ followingId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setPoints(data.points);
        loadFollows();
        loadFeed();
      } else {
        setMessage(data.message || 'Erreur follow');
      }
    } catch {
      setMessage('Erreur réseau lors de l’abonnement');
    } finally {
      setLoading(false);
    }
  }, [token, loadFollows, loadFeed, isVerified]);

  // Ne plus suivre
  const unfollowUser = useCallback(async (id) => {
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant de modifier vos abonnements');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/follow`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ followingId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        loadFollows();
        loadFeed();
      } else {
        setMessage(data.message || 'Erreur unfollow');
      }
    } catch {
      setMessage('Erreur réseau lors du désabonnement');
    } finally {
      setLoading(false);
    }
  }, [token, loadFollows, loadFeed, isVerified]);

  // Supprimer média
  const deleteMedia = useCallback(async (id) => {
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant de supprimer des médias');
      return;
    }
    if (!window.confirm('Supprimer ce média ?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/media/${id}`, {
        method: 'DELETE',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        loadMyMedias();
        loadFeed();
        loadDiskUsage();
      } else {
        setMessage(data.message || 'Erreur suppression');
      }
    } catch {
      setMessage('Erreur réseau lors de la suppression');
    } finally {
      setLoading(false);
    }
  }, [token, loadMyMedias, loadFeed, loadDiskUsage, isVerified]);

  // Début édition nom média
  const startEditMedia = useCallback((media) => {
    setEditMediaId(media._id);
    setNewName(media.originalname);
  }, []);

  // Annuler édition nom média
  const cancelEdit = useCallback(() => {
    setEditMediaId(null);
    setNewName('');
  }, []);

  // Sauvegarder nouveau nom média
  const saveNewName = useCallback(
    async (id) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de modifier des médias');
        return;
      }
      if (!newName.trim()) {
        setMessage('Le nom ne peut pas être vide');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/media/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({ originalname: newName }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setEditMediaId(null);
          setNewName('');
          loadMyMedias();
          loadFeed();
        } else {
          setMessage(data.message || 'Erreur mise à jour');
        }
      } catch {
        setMessage('Erreur réseau lors de la mise à jour');
      } finally {
        setLoading(false);
      }
    },
    [token, newName, loadMyMedias, loadFeed, isVerified]
  );

  // Mettre à jour le profil
  const updateProfile = useCallback(async () => {
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant de modifier votre profil');
      return;
    }
    if (!editUsername.trim()) {
      setMessage('Le nom d’utilisateur ne peut pas être vide');
      return;
    }
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(editUsername)) {
      setMessage('Nom d’utilisateur invalide (3-20 caractères, lettres, chiffres, -, _)');
      return;
    }
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (whatsappNumber && !phoneRegex.test(whatsappNumber)) {
      setMessage('Numéro WhatsApp invalide (format international requis, ex: +1234567890)');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('username', editUsername);
      formData.append('whatsappNumber', whatsappNumber);
      if (selectedProfilePicture) {
        formData.append('profilePicture', selectedProfilePicture);
      }

      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { Authorization: token },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setUsername(data.user.username);
        setEditUsername(data.user.username);
        setWhatsappNumber(data.user.whatsappNumber || '');
        setIsVerified(data.user.isVerified);
        setProfilePicture(data.user.profilePicture ? `${API_URL}/uploads/profiles/${data.user.profilePicture}` : '');
        setSelectedProfilePicture(null);
        setPoints(data.user.points || 0);
        loadProfile();
        loadDiskUsage();
      } else {
        setMessage(data.message || 'Erreur mise à jour profil');
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          setToken(null);
          setIsLogin(false);
          setMessage('Session invalide, veuillez vous reconnecter');
        }
      }
    } catch {
      setMessage('Erreur réseau lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  }, [token, editUsername, whatsappNumber, selectedProfilePicture, isVerified, loadProfile, loadDiskUsage]);

  // Upload média ou URL YouTube
  const handleUpload = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant d’uploader des fichiers');
        return;
      }
      if (!file && !youtubeUrl) {
        setMessage('Veuillez choisir un fichier ou entrer une URL YouTube');
        return;
      }
      if (!mediaName.trim()) {
        setMessage('Le nom du média est requis');
        return;
      }
      if (youtubeUrl) {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        if (!youtubeRegex.test(youtubeUrl)) {
          setMessage('URL YouTube invalide');
          return;
        }
      }
      setLoading(true);
      try {
        const formData = new FormData();
        if (file) {
          formData.append('media', file);
        }
        formData.append('originalname', mediaName);
        if (youtubeUrl) {
          formData.append('youtubeUrl', youtubeUrl);
          formData.append('youtubeOptions', JSON.stringify(youtubeOptions));
        }
        const res = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          headers: { Authorization: token },
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setFile(null);
          setMediaName('');
          setYoutubeUrl('');
          setYoutubeOptions({ autoplay: false, muted: false, subtitles: false });
          loadFeed();
          loadMyMedias();
          loadDiskUsage();
        } else {
          setMessage(data.message || 'Erreur upload');
        }
      } catch {
        setMessage('Erreur réseau lors de l’upload');
      } finally {
        setLoading(false);
      }
    },
    [token, file, youtubeUrl, youtubeOptions, mediaName, loadFeed, loadMyMedias, loadDiskUsage, isVerified]
  );

  // Liker un média
  const likeMedia = useCallback(async (id) => {
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant d’interagir');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/media/${id}/like`, {
        method: 'POST',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setPoints(data.points);
        loadFeed();
      } else {
        setMessage(data.message || 'Erreur lors du like');
      }
    } catch {
      setMessage('Erreur réseau lors du like');
    } finally {
      setLoading(false);
    }
  }, [token, loadFeed, isVerified]);

  // Dé-liker un média
  const dislikeMedia = useCallback(async (id) => {
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant d’interagir');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/media/${id}/dislike`, {
        method: 'POST',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setPoints(data.points);
        loadFeed();
      } else {
        setMessage(data.message || 'Erreur lors du dislike');
      }
    } catch {
      setMessage('Erreur réseau lors du dislike');
    } finally {
      setLoading(false);
    }
  }, [token, loadFeed, isVerified]);

  // Ajouter un commentaire
  const addComment = useCallback(async (mediaId) => {
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant de commenter');
      return;
    }
    const content = commentText[mediaId]?.trim();
    if (!content) {
      setMessage('Le commentaire ne peut pas être vide');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/media/${mediaId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setPoints(data.points);
        setCommentText((prev) => ({ ...prev, [mediaId]: '' }));
        loadFeed();
      } else {
        setMessage(data.message || 'Erreur lors de l’ajout du commentaire');
      }
    } catch {
      setMessage('Erreur réseau lors de l’ajout du commentaire');
    } finally {
      setLoading(false);
    }
  }, [token, commentText, loadFeed, isVerified]);

  // Recherche utilisateurs
  const handleSearchChange = useCallback(
    (e) => {
      setSearch(e.target.value);
      if (isVerified) {
        loadUsers(e.target.value);
      } else {
        setMessage('Veuillez vérifier votre email pour rechercher des utilisateurs');
      }
    },
    [loadUsers, isVerified]
  );

  // Formulaire inscription / connexion
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const endpoint = isLogin ? '/login' : '/register';
      setLoading(true);
      try {
        const body = isLogin
          ? { email, password }
          : { email, password, username: editUsername || email.split('@')[0], whatsappNumber };
        if (!isLogin && body.username) {
          const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
          if (!usernameRegex.test(body.username)) {
            setMessage('Nom d’utilisateur invalide (3-20 caractères, lettres, chiffres, -, _)');
            return;
          }
        }
        if (!isLogin && body.whatsappNumber) {
          const phoneRegex = /^\+?[1-9]\d{1,14}$/;
          if (!phoneRegex.test(body.whatsappNumber)) {
            setMessage('Numéro WhatsApp invalide (format international requis, ex: +1234567890)');
            return;
          }
        }
        const res = await fetch(`${API_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Erreur');
        if (isLogin) {
          localStorage.setItem('token', data.token);
          setToken(data.token);
          socket.auth = { token: data.token };
          socket.connect();
          setEmail(data.user?.email || '');
          setUsername(data.user?.username || '');
          setEditUsername(data.user?.username || '');
          setWhatsappNumber(data.user?.whatsappNumber || '');
          setIsVerified(data.user?.isVerified || false);
          setProfilePicture(data.user?.profilePicture ? `${API_URL}/uploads/profiles/${data.user.profilePicture}` : '');
          setPoints(data.user.points || 0);
          setMessage('Connecté avec succès !');
        } else {
          setMessage('Inscription réussie. Vérifiez votre email pour activer votre compte.');
          setIsLogin(true);
          setEmail('');
          setPassword('');
          setEditUsername('');
          setWhatsappNumber('');
          setProfilePicture('');
          setPoints(0);
        }
      } catch (err) {
        setMessage(`Erreur : ${err.message}`);
      } finally {
        setLoading(false);
      }
    },
    [email, password, isLogin, editUsername, whatsappNumber]
  );

  // Déconnexion
  const handleLogout = useCallback(() => {
    socket.disconnect();
    localStorage.removeItem('token');
    setToken(null);
    setIsLogin(false);
    setUsers([]);
    setFollows([]);
    setFeed([]);
    setMyMedias([]);
    setEmail('');
    setUsername('');
    setEditUsername('');
    setWhatsappNumber('');
    setIsVerified(false);
    setVerificationCode('');
    setProfilePicture('');
    setDiskUsage({ used: 0, total: 5 * 1024 * 1024 * 1024, remaining: 0 });
    setPoints(0);
    setMessage('Déconnecté');
  }, []);

  // Gestion du changement de la photo de profil
  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedProfilePicture(file);
    }
  };

  // Convertir octets en unité lisible
  const formatBytes = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`;
  };

  // WebSocket listeners
  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connecté à WebSocket');
      socket.emit('join', userId);
    });

    socket.on('updateMedia', (updatedMedia) => {
      setFeed((prev) =>
        prev.map((media) =>
          media._id === updatedMedia._id
            ? { ...media, likes: updatedMedia.likes, dislikes: updatedMedia.dislikes, comments: updatedMedia.comments }
            : media
        )
      );
      setMyMedias((prev) =>
        prev.map((media) =>
          media._id === updatedMedia._id
            ? { ...media, likes: updatedMedia.likes, dislikes: updatedMedia.dislikes, comments: updatedMedia.comments }
            : media
        )
      );
    });

    socket.on('updatePoints', (newPoints) => {
      setPoints(newPoints);
    });

    socket.on('updateFollows', (newFollows) => {
      setFollows(newFollows);
      loadFeed();
    });

    socket.on('profilePictureUpdate', ({ userId: updatedUserId, profilePicture }) => {
      setUsers((prev) =>
        prev.map((user) =>
          user._id === updatedUserId ? { ...user, profilePicture } : user
        )
      );
      setFeed((prev) =>
        prev.map((media) =>
          media.owner._id === updatedUserId
            ? { ...media, owner: { ...media.owner, profilePicture } }
            : media
        )
      );
      if (updatedUserId === userId) {
        setProfilePicture(profilePicture);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('updateMedia');
      socket.off('updatePoints');
      socket.off('updateFollows');
      socket.off('profilePictureUpdate');
    };
  }, [userId, loadFeed]);

  // Chargement initial
  useEffect(() => {
    if (token) {
      const decoded = parseJwt(token);
      setUserId(decoded?.userId || null);
      setMessage('');
      setEmail('');
      setPassword('');
      setUsername('');
      setEditUsername('');
      setWhatsappNumber('');
      setProfilePicture('');
      setPoints(0);
      setIsLogin(true);
      loadProfile();
      if (isVerified) {
        socket.auth = { token };
        socket.connect();
        loadFollows();
        loadFeed();
        loadMyMedias();
        loadUsers('');
        loadDiskUsage();
      }
    }
    return () => {
      socket.disconnect();
    };
  }, [token, loadProfile, loadFollows, loadFeed, loadMyMedias, loadUsers, loadDiskUsage, isVerified]);

  return (
    <div className="container mt-4" style={{ maxWidth: 900 }}>
      <h1 className="mb-4 text-center text-primary">Pixels Media</h1>

      {!token ? (
        <div className="card p-4 bg-light text-dark rounded shadow-sm">
          <h2 className="text-center">{isLogin ? 'Connexion' : 'Inscription'}</h2>
          {message && (
            <div className={`alert ${message.includes('Erreur') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
              {message}
              <button type="button" className="btn-close" onClick={() => setMessage('')} aria-label="Fermer"></button>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                type="email"
                id="email"
                placeholder="Email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Adresse e-mail"
              />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Mot de passe</label>
              <input
                type="password"
                id="password"
                placeholder="Mot de passe"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="Mot de passe"
              />
            </div>
            {!isLogin && (
              <>
                <div className="mb-3">
                  <label htmlFor="username" className="form-label">Nom d’utilisateur (optionnel)</label>
                  <input
                    type="text"
                    id="username"
                    placeholder="Nom d’utilisateur"
                    className="form-control"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    aria-label="Nom d’utilisateur"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="whatsappNumber" className="form-label">Numéro WhatsApp (optionnel, ex: +1234567890)</label>
                  <input
                    type="text"
                    id="whatsappNumber"
                    placeholder="Numéro WhatsApp"
                    className="form-control"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    aria-label="Numéro WhatsApp"
                  />
                </div>
              </>
            )}
            <button
              className="btn btn-primary w-100 mb-3"
              type="submit"
              disabled={loading}
              aria-label={isLogin ? 'Se connecter' : "S'inscrire"}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : isLogin ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>
          <button
            className="btn btn-link w-100"
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage('');
            }}
            aria-label={isLogin ? 'Passer à l’inscription' : 'Passer à la connexion'}
          >
            {isLogin ? "Pas encore de compte ? S'inscrire" : 'Déjà inscrit ? Se connecter'}
          </button>
        </div>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 className="text-dark d-flex align-items-center">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt="Photo de profil"
                  className="rounded-circle me-2"
                  style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                />
              ) : (
                <FaUser className="me-2" />
              )}
              Bonjour, {username || email || 'Utilisateur'} (Points: {points} FCFA)
            </h3>
            <button
              className="btn btn-outline-danger"
              onClick={handleLogout}
              disabled={loading}
              aria-label="Se déconnecter"
            >
              <FaSignOutAlt className="me-1" /> Déconnexion
            </button>
          </div>

          {message && (
            <div className={`alert ${message.includes('Erreur') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
              {message}
              <button type="button" className="btn-close" onClick={() => setMessage('')} aria-label="Fermer"></button>
            </div>
          )}

          {!isVerified && (
            <div className="card p-4 mb-4 bg-light text-dark rounded shadow-sm">
              <h4>Vérification de l'email</h4>
              <p>Veuillez entrer le code de vérification reçu par email.</p>
              <div className="input-group mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Code de vérification"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  aria-label="Code de vérification"
                />
                <button
                  className="btn btn-primary"
                  onClick={verifyCode}
                  disabled={loading}
                  aria-label="Vérifier le code"
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    'Vérifier'
                  )}
                </button>
              </div>
              <button
                className="btn btn-link"
                onClick={requestVerificationCode}
                disabled={loading}
                aria-label="Demander un nouveau code"
              >
                Demander un nouveau code
              </button>
            </div>
          )}

          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
                aria-label="Profil"
              >
                Profil
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
                disabled={!isVerified}
                aria-label="Uploader"
              >
                Uploader
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
                disabled={!isVerified}
                aria-label="Utilisateurs"
              >
                Utilisateurs
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'feed' ? 'active' : ''}`}
                onClick={() => setActiveTab('feed')}
                disabled={!isVerified}
                aria-label="Fil"
              >
                Fil
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'my-medias' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-medias')}
                disabled={!isVerified}
                aria-label="Mes médias"
              >
                Mes médias
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
                disabled={!isVerified}
                aria-label="Tableau de bord"
              >
                Tableau de bord
              </button>
            </li>
          </ul>

          {activeTab === 'profile' && (
            <div className="card p-4 bg-light text-dark rounded shadow-sm">
              <h4>Profil</h4>
              <div className="mb-3 text-center">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt="Photo de profil"
                    className="rounded-circle mb-3"
                    style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                  />
                ) : (
                  <FaUser size={100} className="text-muted mb-3" />
                )}
                <div>
                  <label htmlFor="profilePicture" className="btn btn-outline-primary">
                    <FaCamera className="me-1" /> Changer la photo
                    <input
                      type="file"
                      id="profilePicture"
                      accept="image/jpeg,image/jpg,image/png"
                      style={{ display: 'none' }}
                      onChange={handleProfilePictureChange}
                      aria-label="Changer la photo de profil"
                    />
                  </label>
                </div>
              </div>
              <div className="mb-3">
                <label htmlFor="editUsername" className="form-label">Nom d’utilisateur</label>
                <input
                  type="text"
                  id="editUsername"
                  className="form-control"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  disabled={!isVerified}
                  aria-label="Nom d’utilisateur"
                />
              </div>
              <div className="mb-3">
                <label htmlFor="editWhatsappNumber" className="form-label">Numéro WhatsApp (optionnel)</label>
                <input
                  type="text"
                  id="editWhatsappNumber"
                  className="form-control"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  disabled={!isVerified}
                  aria-label="Numéro WhatsApp"
                />
              </div>
              <button
                className="btn btn-primary w-100"
                onClick={updateProfile}
                disabled={loading || !isVerified}
                aria-label="Mettre à jour le profil"
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  'Mettre à jour'
                )}
              </button>
            </div>
          )}

          {activeTab === 'upload' && isVerified && (
            <div className="card p-4 bg-light text-dark rounded shadow-sm">
              <h4>Uploader un média ou une vidéo YouTube</h4>
              <form onSubmit={handleUpload}>
                <div className="mb-3">
                  <label htmlFor="mediaName" className="form-label">Nom du média</label>
                  <input
                    type="text"
                    id="mediaName"
                    className="form-control"
                    placeholder="Entrez le nom du média"
                    value={mediaName}
                    onChange={(e) => setMediaName(e.target.value)}
                    required
                    aria-label="Nom du média"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="file" className="form-label">Choisir un fichier (image/vidéo)</label>
                  <input
                    type="file"
                    id="file"
                    className="form-control"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      setFile(e.target.files[0]);
                      setYoutubeUrl('');
                    }}
                    aria-label="Choisir un fichier"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="youtubeUrl" className="form-label">Ou coller une URL YouTube</label>
                  <input
                    type="text"
                    id="youtubeUrl"
                    className="form-control"
                    placeholder="Ex: https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value);
                      setFile(null);
                    }}
                    aria-label="URL YouTube"
                  />
                </div>
                {youtubeUrl && (
                  <div className="mb-3">
                    <h5>Options de lecture YouTube</h5>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        id="autoplay"
                        className="form-check-input"
                        checked={youtubeOptions.autoplay}
                        onChange={(e) => setYoutubeOptions({ ...youtubeOptions, autoplay: e.target.checked })}
                        aria-label="Lecture automatique"
                      />
                      <label htmlFor="autoplay" className="form-check-label">Lecture automatique</label>
                    </div>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        id="muted"
                        className="form-check-input"
                        checked={youtubeOptions.muted}
                        onChange={(e) => setYoutubeOptions({ ...youtubeOptions, muted: e.target.checked })}
                        aria-label="Son désactivé"
                      />
                      <label htmlFor="muted" className="form-check-label">Son désactivé</label>
                    </div>
                    <div className="form-check">
                      <input
                        type="checkbox"
                        id="subtitles"
                        className="form-check-input"
                        checked={youtubeOptions.subtitles}
                        onChange={(e) => setYoutubeOptions({ ...youtubeOptions, subtitles: e.target.checked })}
                        aria-label="Sous-titres"
                      />
                      <label htmlFor="subtitles" className="form-check-label">Sous-titres</label>
                    </div>
                  </div>
                )}
                <button
                  className="btn btn-primary w-100"
                  type="submit"
                  disabled={loading}
                  aria-label="Uploader le fichier ou l’URL YouTube"
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    <><FaUpload className="me-1" /> Uploader</>
                  )}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'users' && isVerified && (
            <div className="card p-4 bg-light text-dark rounded shadow-sm">
              <h4>Utilisateurs</h4>
              <input
                type="text"
                className="form-control mb-3"
                placeholder="Rechercher un utilisateur"
                value={search}
                onChange={handleSearchChange}
                aria-label="Rechercher un utilisateur"
              />
              <ul className="list-group">
                {users.map((user) => (
                  <li key={user._id} className="list-group-item d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      {user.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={`Photo de profil de ${user.username}`}
                          className="rounded-circle me-2"
                          style={{ width: '30px', height: '30px', objectFit: 'cover' }}
                        />
                      ) : (
                        <FaUser className="me-2 text-muted" />
                      )}
                      {user.username || user.email}
                    </div>
                    <button
                      className={`btn btn-sm ${follows.includes(user._id) ? 'btn-outline-secondary' : 'btn-primary'}`}
                      onClick={() => (follows.includes(user._id) ? unfollowUser(user._id) : followUser(user._id))}
                      disabled={loading}
                      aria-label={follows.includes(user._id) ? `Ne plus suivre ${user.username || user.email}` : `Suivre ${user.username || user.email}`}
                    >
                      {follows.includes(user._id) ? <><FaUserCheck className="me-1" /> Ne plus suivre</> : <><FaUserPlus className="me-1" /> Suivre</>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'feed' && isVerified && (
            <div className="card p-4 bg-light text-dark rounded shadow-sm">
              <h4>Fil</h4>
              {feed.length === 0 ? (
                <p>Aucun média à afficher. Suivez des utilisateurs pour voir leur contenu.</p>
              ) : (
                feed.map((media) => (
                  <div key={media._id} className="card mb-3">
                    <div className="card-body">
                      <div className="d-flex align-items-center mb-2">
                        {media.owner?.profilePicture ? (
                          <img
                            src={media.owner.profilePicture}
                            alt={`Photo de profil de ${media.owner.username}`}
                            className="rounded-circle me-2"
                            style={{ width: '30px', height: '30px', objectFit: 'cover' }}
                          />
                        ) : (
                          <FaUser className="me-2 text-muted" />
                        )}
                        <h5 className="card-title mb-0">{media.owner?.username || media.owner?.email}</h5>
                      </div>
                      {media.youtubeUrl ? (
                        <div className="ratio ratio-16x9">
                          <iframe
                            src={`${media.youtubeUrl}${media.youtubeOptions?.autoplay ? '&autoplay=1' : ''}${media.youtubeOptions?.muted ? '&mute=1' : ''}${media.youtubeOptions?.subtitles ? '&cc_load_policy=1' : ''}`}
                            title={media.originalname}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          ></iframe>
                        </div>
                      ) : media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                        <img
                          src={`${API_URL}/uploads/${media.filename}`}
                          alt={media.originalname}
                          className="img-fluid rounded"
                          style={{ maxHeight: '300px', objectFit: 'cover' }}
                        />
                      ) : (
                        <video
                          src={`${API_URL}/uploads/${media.filename}`}
                          controls
                          loop
                          className="img-fluid rounded"
                          style={{ maxHeight: '300px' }}
                        />
                      )}
                      <p className="card-text mt-2">{media.originalname}</p>
                      <div className="d-flex justify-content-between mb-2">
                        <div>
                          <button
                            className={`btn btn-sm ${media.likes.includes(userId) ? 'btn-primary' : 'btn-outline-primary'} me-2`}
                            onClick={() => likeMedia(media._id)}
                            disabled={loading || media.dislikes.includes(userId)}
                            aria-label={`Liker le média ${media.originalname}`}
                          >
                            <FaThumbsUp className="me-1" /> {media.likes.length}
                          </button>
                          <button
                            className={`btn btn-sm ${media.dislikes.includes(userId) ? 'btn-danger' : 'btn-outline-danger'}`}
                            onClick={() => dislikeMedia(media._id)}
                            disabled={loading || media.likes.includes(userId)}
                            aria-label={`Ne pas liker le média ${media.originalname}`}
                          >
                            <FaThumbsDown className="me-1" /> {media.dislikes.length}
                          </button>
                        </div>
                        {media.owner?.whatsappNumber && (
                          <a
                            href={`https://wa.me/${media.owner.whatsappNumber}?text=${encodeURIComponent(
                              `${media.owner.whatsappMessage || 'Découvrez ce contenu sur Pixels Media !'} ${window.location.origin}/media/${media._id}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-success"
                            aria-label="Partager sur WhatsApp"
                          >
                            <FaWhatsapp className="me-1" /> Partager
                          </a>
                        )}
                      </div>
                      <div className="mb-3">
                        <h6>Commentaires</h6>
                        {media.comments.length === 0 ? (
                          <p>Aucun commentaire.</p>
                        ) : (
                          <ul className="list-group mb-2">
                            {media.comments.map((comment) => (
                              <li key={comment._id} className="list-group-item">
                                <strong>{comment.author.username || comment.author.email}</strong>: {comment.content}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="input-group">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Ajouter un commentaire"
                            value={commentText[media._id] || ''}
                            onChange={(e) =>
                              setCommentText((prev) => ({ ...prev, [media._id]: e.target.value }))
                            }
                            aria-label={`Commenter le média ${media.originalname}`}
                          />
                          <button
                            className="btn btn-primary"
                            onClick={() => addComment(media._id)}
                            disabled={loading}
                            aria-label="Envoyer le commentaire"
                          >
                            <FaPaperPlane />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'my-medias' && isVerified && (
            <div className="card p-4 bg-light text-dark rounded shadow-sm">
              <h4>Mes médias</h4>
              {myMedias.length === 0 ? (
                <p>Aucun média à afficher.</p>
              ) : (
                myMedias.map((media) => (
                  <div key={media._id} className="card mb-3">
                    <div className="card-body d-flex align-items-center">
                      {editMediaId === media._id ? (
                        <div className="w-100">
                          <div className="input-group">
                            <input
                              type="text"
                              className="form-control"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              aria-label="Nouveau nom du média"
                            />
                            <button
                              className="btn btn-success"
                              onClick={() => saveNewName(media._id)}
                              disabled={loading}
                              aria-label="Sauvegarder le nouveau nom"
                            >
                              <FaSave />
                            </button>
                            <button
                              className="btn btn-secondary"
                              onClick={cancelEdit}
                              disabled={loading}
                              aria-label="Annuler l'édition"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {media.youtubeUrl ? (
                            <div className="ratio ratio-16x9 me-3">
                              <iframe
                                src={`${media.youtubeUrl}${media.youtubeOptions?.autoplay ? '&autoplay=1' : ''}${media.youtubeOptions?.muted ? '&mute=1' : ''}${media.youtubeOptions?.subtitles ? '&cc_load_policy=1' : ''}`}
                                title={media.originalname}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                style={{ width: '100px', height: '100px' }}
                              ></iframe>
                            </div>
                          ) : media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                            <img
                              src={`${API_URL}/uploads/${media.filename}`}
                              alt={media.originalname}
                              className="me-3 rounded"
                              style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                            />
                          ) : (
                            <video
                              src={`${API_URL}/uploads/${media.filename}`}
                              className="me-3 rounded"
                              style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                            />
                          )}
                          <div className="flex-grow-1">
                            <p className="card-text mb-1">{media.originalname}</p>
                            <button
                              className="btn btn-sm btn-outline-primary me-2"
                              onClick={() => startEditMedia(media)}
                              disabled={loading}
                              aria-label="Modifier le nom du média"
                            >
                              <FaEdit className="me-1" /> Modifier
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => deleteMedia(media._id)}
                              disabled={loading}
                              aria-label="Supprimer le média"
                            >
                              <FaTrash className="me-1" /> Supprimer
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'dashboard' && isVerified && (
            <div className="card p-4 bg-light text-dark rounded shadow-sm">
              <h4>Tableau de bord</h4>
              <div className="mb-3">
                <h5>Espace disque</h5>
                <p>Espace utilisé : {formatBytes(diskUsage.used)}</p>
                <p>Espace total alloué : {formatBytes(diskUsage.total)}</p>
                <p>Espace restant : {formatBytes(diskUsage.remaining)}</p>
                <div className="progress">
                  <div
                    className="progress-bar"
                    role="progressbar"
                    style={{ width: `${(diskUsage.used / diskUsage.total) * 100}%` }}
                    aria-valuenow={(diskUsage.used / diskUsage.total) * 100}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    {((diskUsage.used / diskUsage.total) * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="mb-3">
                <h5>Solde de points</h5>
                <p>Points : {points} FCFA</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={loadDiskUsage}
                disabled={loading}
                aria-label="Rafraîchir les données d’espace disque"
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  <><FaChartPie className="me-1" /> Rafraîchir</>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
