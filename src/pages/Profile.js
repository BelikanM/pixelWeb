import React, { useState, useEffect, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaTrash, FaEdit, FaUserPlus, FaUserCheck, FaSignOutAlt, FaUpload, FaSave, FaTimes, FaUser, FaPaperPlane, FaWhatsapp, FaCamera, FaChartPie, FaThumbsUp, FaThumbsDown, FaComment, FaVideo, FaFileUpload } from 'react-icons/fa';
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
  const [mediaName, setMediaName] = useState(''); // Nom pour fichier local
  const [youtubeMediaName, setYoutubeMediaName] = useState(''); // Nom pour URL YouTube
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
        setProfilePicture(data.user.profilePicture || '');
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

  // Upload fichier local
  const handleLocalUpload = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant d’uploader des fichiers');
        return;
      }
      if (!file) {
        setMessage('Veuillez choisir un fichier');
        return;
      }
      if (!mediaName.trim()) {
        setMessage('Le nom du média est requis');
        return;
      }
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('media', file);
        formData.append('originalname', mediaName);
        const res = await fetch(`${API_URL}/upload/local`, {
          method: 'POST',
          headers: { Authorization: token },
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setFile(null);
          setMediaName('');
          loadFeed();
          loadMyMedias();
          loadDiskUsage();
        } else {
          setMessage(data.message || 'Erreur upload fichier local');
        }
      } catch {
        setMessage('Erreur réseau lors de l’upload du fichier');
      } finally {
        setLoading(false);
      }
    },
    [token, file, mediaName, loadFeed, loadMyMedias, loadDiskUsage, isVerified]
  );

  // Upload URL YouTube
  const handleYoutubeUpload = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant d’uploader une URL YouTube');
        return;
      }
      if (!youtubeUrl) {
        setMessage('Veuillez entrer une URL YouTube');
        return;
      }
      if (!youtubeMediaName.trim()) {
        setMessage('Le nom du média est requis');
        return;
      }
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
      if (!youtubeRegex.test(youtubeUrl)) {
        setMessage('URL YouTube invalide');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/upload/youtube`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({
            youtubeUrl,
            originalname: youtubeMediaName,
            autoplay: youtubeOptions.autoplay,
            muted: youtubeOptions.muted,
            subtitles: youtubeOptions.subtitles,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setYoutubeUrl('');
          setYoutubeMediaName('');
          setYoutubeOptions({ autoplay: false, muted: false, subtitles: false });
          loadFeed();
          loadMyMedias();
          loadDiskUsage();
        } else {
          setMessage(data.message || 'Erreur upload URL YouTube');
        }
      } catch {
        setMessage('Erreur réseau lors de l’upload de l’URL YouTube');
      } finally {
        setLoading(false);
      }
    },
    [token, youtubeUrl, youtubeMediaName, youtubeOptions, loadFeed, loadMyMedias, loadDiskUsage, isVerified]
  );

  // Liker un média
  const likeMedia = useCallback(async (id) => {
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant d’interagir');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/like/${id}`, {
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
      const res = await fetch(`${API_URL}/dislike/${id}`, {
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
      const res = await fetch(`${API_URL}/comment/${mediaId}`, {
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
          setProfilePicture(data.user?.profilePicture || '');
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

    socket.on('newMedia', ({ media }) => {
      setFeed((prev) => [media, ...prev]);
      if (media.owner._id === userId) {
        setMyMedias((prev) => [media, ...prev]);
      }
    });

    socket.on('mediaDeleted', ({ mediaId }) => {
      setFeed((prev) => prev.filter((media) => media._id !== mediaId));
      setMyMedias((prev) => prev.filter((media) => media._id !== mediaId));
    });

    socket.on('likeUpdate', ({ mediaId, likesCount, dislikesCount, userId: likerId, points }) => {
      setFeed((prev) =>
        prev.map((media) =>
          media._id === mediaId
            ? {
                ...media,
                likesCount,
                dislikesCount,
                isLiked: likerId === userId ? true : media.isLiked,
                isDisliked: likerId === userId ? false : media.isDisliked,
              }
            : media
        )
      );
      setMyMedias((prev) =>
        prev.map((media) =>
          media._id === mediaId
            ? {
                ...media,
                likesCount,
                dislikesCount,
                isLiked: likerId === userId ? true : media.isLiked,
                isDisliked: likerId === userId ? false : media.isDisliked,
              }
            : media
        )
      );
      if (likerId === userId) setPoints(points);
    });

    socket.on('dislikeUpdate', ({ mediaId, likesCount, dislikesCount, userId: dislikerId }) => {
      setFeed((prev) =>
        prev.map((media) =>
          media._id === mediaId
            ? {
                ...media,
                likesCount,
                dislikesCount,
                isLiked: dislikerId === userId ? false : media.isLiked,
                isDisliked: dislikerId === userId ? true : media.isDisliked,
              }
            : media
        )
      );
      setMyMedias((prev) =>
        prev.map((media) =>
          media._id === mediaId
            ? {
                ...media,
                likesCount,
                dislikesCount,
                isLiked: dislikerId === userId ? false : media.isLiked,
                isDisliked: dislikerId === userId ? true : media.isDisliked,
              }
            : media
        )
      );
    });

    socket.on('commentUpdate', ({ mediaId, comment }) => {
      setFeed((prev) =>
        prev.map((media) =>
          media._id === mediaId
            ? { ...media, comments: [...media.comments, comment] }
            : media
        )
      );
      setMyMedias((prev) =>
        prev.map((media) =>
          media._id === mediaId
            ? { ...media, comments: [...media.comments, comment] }
            : media
        )
      );
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
      socket.off('newMedia');
      socket.off('mediaDeleted');
      socket.off('likeUpdate');
      socket.off('dislikeUpdate');
      socket.off('commentUpdate');
      socket.off('profilePictureUpdate');
    };
  }, [userId]);

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
    <div className="container mt-4">
      {loading && <div className="alert alert-info">Chargement...</div>}
      {message && (
        <div className={`alert ${message.includes('Erreur') ? 'alert-danger' : 'alert-success'}`}>
          {message}
        </div>
      )}

      {!token ? (
        <div className="card p-4">
          <h2>{isLogin ? 'Connexion' : 'Inscription'}</h2>
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div className="mb-3">
                  <label className="form-label">Nom d’utilisateur</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required={!isLogin}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Numéro WhatsApp (optionnel, format: +1234567890)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Mot de passe</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              {isLogin ? 'Se connecter' : 'S’inscrire'}
            </button>
            <button
              type="button"
              className="btn btn-link"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Créer un compte' : 'J’ai déjà un compte'}
            </button>
          </form>
        </div>
      ) : !isVerified ? (
        <div className="card p-4">
          <h2>Vérification de l’email</h2>
          <p>Veuillez entrer le code de vérification reçu par email.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyCode();
            }}
          >
            <div className="mb-3">
              <label className="form-label">Code de vérification</label>
              <input
                type="text"
                className="form-control"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Vérifier
            </button>
            <button
              type="button"
              className="btn btn-link"
              onClick={requestVerificationCode}
            >
              Renvoyer le code
            </button>
          </form>
          <button className="btn btn-danger mt-3" onClick={handleLogout}>
            <FaSignOutAlt /> Déconnexion
          </button>
        </div>
      ) : (
        <>
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
                className={`nav-link ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                Uploader
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
                className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                Utilisateurs
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

          {activeTab === 'profile' && (
            <div className="card p-4">
              <h2>Profil</h2>
              <div className="mb-3">
                <label className="form-label">Photo de profil</label>
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt="Photo de profil"
                    className="img-thumbnail mb-2"
                    style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                  />
                ) : (
                  <FaUser size={100} className="mb-2" />
                )}
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Nom d’utilisateur</label>
                <input
                  type="text"
                  className="form-control"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  disabled
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Numéro WhatsApp (optionnel)</label>
                <input
                  type="text"
                  className="form-control"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Points</label>
                <input
                  type="text"
                  className="form-control"
                  value={points}
                  disabled
                />
              </div>
              <button className="btn btn-primary" onClick={updateProfile}>
                <FaSave /> Mettre à jour
              </button>
              <button className="btn btn-danger ms-2" onClick={handleLogout}>
                <FaSignOutAlt /> Déconnexion
              </button>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="card p-4">
              <h2>Uploader un média</h2>
              <h3>Uploader un fichier local</h3>
              <form onSubmit={handleLocalUpload}>
                <div className="mb-3">
                  <label className="form-label">Nom du média</label>
                  <input
                    type="text"
                    className="form-control"
                    value={mediaName}
                    onChange={(e) => setMediaName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Fichier (image ou vidéo)</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*,video/*"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  <FaFileUpload /> Uploader fichier
                </button>
              </form>
              <hr />
              <h3>Uploader une URL YouTube</h3>
              <form onSubmit={handleYoutubeUpload}>
                <div className="mb-3">
                  <label className="form-label">Nom du média</label>
                  <input
                    type="text"
                    className="form-control"
                    value={youtubeMediaName}
                    onChange={(e) => setYoutubeMediaName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">URL YouTube</label>
                  <input
                    type="text"
                    className="form-control"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Options YouTube</label>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={youtubeOptions.autoplay}
                      onChange={() => setYoutubeOptions((prev) => ({ ...prev, autoplay: !prev.autoplay }))}
                    />
                    <label className="form-check-label">Lecture automatique</label>
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={youtubeOptions.muted}
                      onChange={() => setYoutubeOptions((prev) => ({ ...prev, muted: !prev.muted }))}
                    />
                    <label className="form-check-label">Muet</label>
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={youtubeOptions.subtitles}
                      onChange={() => setYoutubeOptions((prev) => ({ ...prev, subtitles: !prev.subtitles }))}
                    />
                    <label className="form-check-label">Sous-titres</label>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">
                  <FaVideo /> Uploader YouTube
                </button>
              </form>
            </div>
          )}

          {activeTab === 'feed' && (
            <div className="card p-4">
              <h2>Fil d’actualité</h2>
              {feed.length === 0 ? (
                <p>Aucun média à afficher. Suivez des utilisateurs pour voir leur contenu.</p>
              ) : (
                feed.map((media) => (
                  <div key={media._id} className="card mb-3">
                    <div className="card-body">
                      <h5>{media.originalname}</h5>
                      <p>Par : {media.owner?.username || media.owner?.email}</p>
                      {media.youtubeUrl ? (
                        <iframe
                          src={`${media.youtubeUrl}${media.youtubeOptions?.autoplay ? '&autoplay=1' : ''}${media.youtubeOptions?.muted ? '&mute=1' : ''}${media.youtubeOptions?.subtitles ? '&cc_load_policy=1' : ''}`}
                          title={media.originalname}
                          className="w-100"
                          style={{ aspectRatio: '16/9' }}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      ) : (
                        media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <img src={media.filename} alt={media.originalname} className="img-fluid" />
                        ) : (
                          <video controls className="w-100">
                            <source src={media.filename} type="video/mp4" />
                          </video>
                        )
                      )}
                      <div className="mt-2">
                        <button
                          className={`btn btn-sm ${media.isLiked ? 'btn-success' : 'btn-outline-success'}`}
                          onClick={() => likeMedia(media._id)}
                        >
                          <FaThumbsUp /> {media.likesCount}
                        </button>
                        <button
                          className={`btn btn-sm ms-2 ${media.isDisliked ? 'btn-danger' : 'btn-outline-danger'}`}
                          onClick={() => dislikeMedia(media._id)}
                        >
                          <FaThumbsDown /> {media.dislikesCount}
                        </button>
                      </div>
                      <div className="mt-3">
                        <h6>Commentaires</h6>
                        {media.comments.map((comment) => (
                          <div key={comment._id} className="border-top pt-2">
                            <p>
                              <strong>{comment.author?.username || 'Anonyme'}</strong>: {comment.content}
                            </p>
                          </div>
                        ))}
                        <div className="input-group mt-2">
                          <input
                            type="text"
                            className="form-control"
                            value={commentText[media._id] || ''}
                            onChange={(e) =>
                              setCommentText((prev) => ({ ...prev, [media._id]: e.target.value }))
                            }
                            placeholder="Ajouter un commentaire..."
                          />
                          <button
                            className="btn btn-primary"
                            onClick={() => addComment(media._id)}
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

          {activeTab === 'myMedias' && (
            <div className="card p-4">
              <h2>Mes médias</h2>
              {myMedias.length === 0 ? (
                <p>Aucun média uploadé.</p>
              ) : (
                myMedias.map((media) => (
                  <div key={media._id} className="card mb-3">
                    <div className="card-body">
                      {editMediaId === media._id ? (
                        <div className="input-group mb-3">
                          <input
                            type="text"
                            className="form-control"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                          />
                          <button
                            className="btn btn-success"
                            onClick={() => saveNewName(media._id)}
                          >
                            <FaSave />
                          </button>
                          <button className="btn btn-secondary" onClick={cancelEdit}>
                            <FaTimes />
                          </button>
                        </div>
                      ) : (
                        <h5>{media.originalname}</h5>
                      )}
                      {media.youtubeUrl ? (
                        <iframe
                          src={`${media.youtubeUrl}${media.youtubeOptions?.autoplay ? '&autoplay=1' : ''}${media.youtubeOptions?.muted ? '&mute=1' : ''}${media.youtubeOptions?.subtitles ? '&cc_load_policy=1' : ''}`}
                          title={media.originalname}
                          className="w-100"
                          style={{ aspectRatio: '16/9' }}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        ></iframe>
                      ) : (
                        media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <img src={media.filename} alt={media.originalname} className="img-fluid" />
                        ) : (
                          <video controls className="w-100">
                            <source src={media.filename} type="video/mp4" />
                          </video>
                        )
                      )}
                      <div className="mt-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => startEditMedia(media)}
                        >
                          <FaEdit /> Modifier
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger ms-2"
                          onClick={() => deleteMedia(media._id)}
                        >
                          <FaTrash /> Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="card p-4">
              <h2>Utilisateurs</h2>
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Rechercher un utilisateur..."
                  value={search}
                  onChange={handleSearchChange}
                />
              </div>
              {users.length === 0 ? (
                <p>Aucun utilisateur trouvé.</p>
              ) : (
                users.map((user) => (
                  <div key={user._id} className="card mb-3">
                    <div className="card-body d-flex align-items-center">
                      {user.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={user.username}
                          className="rounded-circle me-3"
                          style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                        />
                      ) : (
                        <FaUser className="me-3" size={50} />
                      )}
                      <div>
                        <h5>{user.username || user.email}</h5>
                        <p>{user.email}</p>
                        {user.whatsappNumber && (
                          <p>
                            <FaWhatsapp /> {user.whatsappNumber}
                          </p>
                        )}
                      </div>
                      <div className="ms-auto">
                        {follows.includes(user._id) ? (
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => unfollowUser(user._id)}
                          >
                            <FaUserCheck /> Ne plus suivre
                          </button>
                        ) : (
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => followUser(user._id)}
                          >
                            <FaUserPlus /> Suivre
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="card p-4">
              <h2>Statistiques</h2>
              <p>Espace disque utilisé : {formatBytes(diskUsage.used)}</p>
              <p>Espace disque restant : {formatBytes(diskUsage.remaining)}</p>
              <p>Points : {points} FCFA</p>
              <div className="progress mb-3">
                <div
                  className="progress-bar"
                  style={{ width: `${(diskUsage.used / diskUsage.total) * 100}%` }}
                >
                  {(diskUsage.used / diskUsage.total) * 100}%
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
