// src/Profile.js
import React, { useState, useEffect, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaTrash, FaEdit, FaUserPlus, FaUserCheck, FaSignOutAlt, FaUpload, FaSave, FaTimes, FaUser, FaPaperPlane } from 'react-icons/fa';
import './Profile.css';

const API_URL = 'http://localhost:5000';

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

  // Charger profil utilisateur
  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setEmail(data.email || '');
        setUsername(data.username || '');
        setEditUsername(data.username || '');
        setIsVerified(data.isVerified || false);
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

  // Demander un nouveau code de vérification
  const requestVerificationCode = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/request-verification`, {
        method: 'POST',
        headers: { authorization: token },
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
        headers: { 'Content-Type': 'application/json', authorization: token },
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
        headers: { authorization: token },
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
      const res = await fetch(`${API_URL}/follows`, { headers: { authorization: token } });
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
      const res = await fetch(`${API_URL}/feed`, { headers: { authorization: token } });
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
      const res = await fetch(`${API_URL}/my-medias`, { headers: { authorization: token } });
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
        headers: { 'Content-Type': 'application/json', authorization: token },
        body: JSON.stringify({ followingId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
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
        headers: { 'Content-Type': 'application/json', authorization: token },
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
        headers: { authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        loadMyMedias();
        loadFeed();
      } else {
        setMessage(data.message || 'Erreur suppression');
      }
    } catch {
      setMessage('Erreur réseau lors de la suppression');
    } finally {
      setLoading(false);
    }
  }, [token, loadMyMedias, loadFeed, isVerified]);

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
          headers: { 'Content-Type': 'application/json', authorization: token },
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
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: token },
        body: JSON.stringify({ username: editUsername }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setUsername(data.user.username);
        setEditUsername(data.user.username);
        setIsVerified(data.user.isVerified);
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
  }, [token, editUsername, isVerified]);

  // Upload média
  const handleUpload = useCallback(
    async (e) => {
      e.preventDefault();
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant d’uploader des fichiers');
        return;
      }
      if (!file) {
        setMessage('Choisis un fichier');
        return;
      }
      const formData = new FormData();
      formData.append('media', file);
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          headers: { authorization: token },
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setFile(null);
          loadFeed();
          loadMyMedias();
        } else {
          setMessage(data.message || 'Erreur upload');
        }
      } catch {
        setMessage('Erreur réseau lors de l’upload');
      } finally {
        setLoading(false);
      }
    },
    [token, file, loadFeed, loadMyMedias, isVerified]
  );

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
          : { email, password, username: editUsername || email.split('@')[0] };
        if (!isLogin && body.username) {
          const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
          if (!usernameRegex.test(body.username)) {
            setMessage('Nom d’utilisateur invalide (3-20 caractères, lettres, chiffres, -, _)');
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
          setEmail(data.user?.email || '');
          setUsername(data.user?.username || '');
          setEditUsername(data.user?.username || '');
          setIsVerified(data.user?.isVerified || false);
          setMessage('Connecté avec succès !');
        } else {
          setMessage('Inscription réussie. Vérifiez votre email pour activer votre compte.');
          setIsLogin(true);
          setEmail('');
          setPassword('');
          setEditUsername('');
        }
      } catch (err) {
        setMessage(`Erreur : ${err.message}`);
      } finally {
        setLoading(false);
      }
    },
    [email, password, isLogin, editUsername]
  );

  // Déconnexion
  const handleLogout = useCallback(() => {
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
    setIsVerified(false);
    setVerificationCode('');
    setMessage('Déconnecté');
  }, []);

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
      setIsLogin(true);
      loadProfile();
      if (isVerified) {
        loadFollows();
        loadFeed();
        loadMyMedias();
        loadUsers('');
      }
    }
  }, [token, loadProfile, loadFollows, loadFeed, loadMyMedias, loadUsers, isVerified]);

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
            <h3 className="text-dark">
              <FaUser className="me-2" /> Bonjour, {username || email || 'Utilisateur'}
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
              <h4 className="text-center mb-3">Vérifiez votre email</h4>
              <p className="text-center text-muted">
                Un code de vérification a été envoyé à votre email ({email}). Entrez le code ci-dessous pour activer votre compte.
              </p>
              <div className="input-group mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Entrez le code à 6 chiffres"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength="6"
                  aria-label="Code de vérification"
                />
                <button
                  className="btn btn-primary"
                  onClick={verifyCode}
                  disabled={loading || !verificationCode.trim()}
                  aria-label="Vérifier le code"
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : (
                    <>
                      <FaPaperPlane className="me-1" /> Vérifier
                    </>
                  )}
                </button>
              </div>
              <button
                className="btn btn-link w-100"
                onClick={requestVerificationCode}
                disabled={loading}
                aria-label="Renvoyer un code"
              >
                Renvoyer un nouveau code
              </button>
            </div>
          )}

          <div className="card p-4 mb-4 bg-light text-dark rounded shadow-sm">
            <h4 className="text-center mb-3">Mon Profil</h4>
            <div className="mb-3">
              <label htmlFor="profile-email" className="form-label">Email</label>
              <input
                type="text"
                id="profile-email"
                className="form-control"
                value={email}
                disabled
                aria-label="Adresse e-mail"
              />
            </div>
            <div className="mb-3">
              <label htmlFor="profile-username" className="form-label">Nom d’utilisateur</label>
              <input
                type="text"
                id="profile-username"
                className="form-control"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                disabled={!isVerified}
                aria-label="Nom d’utilisateur"
              />
            </div>
            <button
              className="btn btn-primary w-100"
              onClick={updateProfile}
              disabled={loading || !editUsername.trim() || !isVerified}
              aria-label="Mettre à jour le profil"
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : 'Mettre à jour'}
            </button>
          </div>

          {isVerified && (
            <>
              <form onSubmit={handleUpload} className="mb-4">
                <div className="input-group">
                  <input
                    type="file"
                    accept="image/*,video/*,audio/*"
                    className="form-control"
                    onChange={(e) => setFile(e.target.files[0])}
                    disabled={!isVerified}
                    aria-label="Sélectionner un fichier"
                  />
                  <button
                    className="btn btn-success"
                    type="submit"
                    disabled={loading || !isVerified}
                    aria-label="Uploader le fichier"
                  >
                    <FaUpload className="me-1" /> {loading ? 'Upload...' : 'Upload'}
                  </button>
                </div>
              </form>

              <h4 className="mb-3">Médias personnels</h4>
              <div className="row">
                {myMedias.length === 0 && <p className="text-muted">Aucun média uploadé.</p>}
                {myMedias.map((media) => (
                  <div key={media._id} className="col-md-4 mb-3">
                    <div className="card h-100 shadow-sm hover-card">
                      {media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                        <img
                          src={`${API_URL}/uploads/${media.filename}`}
                          className="card-img-top"
                          alt={media.originalname}
                          style={{ objectFit: 'cover', height: '180px' }}
                        />
                      ) : (
                        <video
                          src={`${API_URL}/uploads/${media.filename}`}
                          controls
                          className="card-img-top"
                          style={{ height: '180px', objectFit: 'cover' }}
                        />
                      )}
                      <div className="card-body d-flex flex-column">
                        {editMediaId === media._id ? (
                          <>
                            <input
                              type="text"
                              className="form-control mb-2"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              aria-label="Nouveau nom du média"
                            />
                            <div className="d-flex justify-content-between">
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => saveNewName(media._id)}
                                disabled={loading || !isVerified}
                                type="button"
                                aria-label="Sauvegarder le nouveau nom"
                              >
                                <FaSave className="me-1" /> Sauvegarder
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={cancelEdit}
                                disabled={loading}
                                type="button"
                                aria-label="Annuler l’édition"
                              >
                                <FaTimes className="me-1" /> Annuler
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <h5 className="card-title text-truncate">{media.originalname}</h5>
                            <p className="card-text text-muted small">
                              Uploadé le : {new Date(media.uploadedAt).toLocaleString()}
                            </p>
                            <div className="mt-auto d-flex justify-content-between">
                              <button
                                className="btn btn-outline-warning btn-sm"
                                onClick={() => startEditMedia(media)}
                                disabled={loading || !isVerified}
                                type="button"
                                aria-label="Modifier le nom du média"
                              >
                                <FaEdit className="me-1" /> Modifier
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => deleteMedia(media._id)}
                                disabled={loading || !isVerified}
                                type="button"
                                aria-label="Supprimer le média"
                              >
                                <FaTrash className="me-1" /> Supprimer
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h4 className="mt-5 mb-3">Fil d’actualité</h4>
              <div className="row">
                {feed.length === 0 && <p className="text-muted">Aucun média dans votre fil.</p>}
                {Array.isArray(feed) && feed.map((media) => (
                  <div key={media._id} className="col-md-4 mb-3">
                    <div className="card h-100 shadow-sm hover-card">
                      {media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                        <img
                          src={`${API_URL}/uploads/${media.filename}`}
                          className="card-img-top"
                          alt={media.originalname}
                          style={{ objectFit: 'cover', height: '180px' }}
                        />
                      ) : (
                        <video
                          src={`${API_URL}/uploads/${media.filename}`}
                          controls
                          className="card-img-top"
                          style={{ height: '180px', objectFit: 'cover' }}
                        />
                      )}
                      <div className="card-body">
                        <h5 className="card-title text-truncate">{media.originalname}</h5>
                        <p className="card-text text-muted small">
                          Uploadé le : {new Date(media.uploadedAt).toLocaleString()}
                        </p>
                        <p className="text-muted small">
                          Par : {media.owner?.username || media.owner?.email || 'Utilisateur inconnu'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h4 className="mt-5 mb-3">Utilisateurs</h4>
              <input
                type="search"
                className="form-control mb-3"
                placeholder="Rechercher par email ou nom d’utilisateur"
                value={search}
                onChange={handleSearchChange}
                disabled={!isVerified}
                aria-label="Rechercher un utilisateur"
              />
              <div className="list-group mb-5" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {users.length === 0 && <p className="text-muted">Aucun utilisateur trouvé.</p>}
                {users.map((user) => {
                  const isFollowing = follows.includes(user._id);
                  return (
                    <div
                      key={user._id}
                      className="list-group-item d-flex justify-content-between align-items-center hover-list-item"
                    >
                      <span>
                        {user.username ? `${user.username} (${user.email})` : user.email}
                      </span>
                      {isFollowing ? (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => unfollowUser(user._id)}
                          disabled={loading || !isVerified}
                          aria-label={`Ne plus suivre ${user.username || user.email}`}
                        >
                          <FaUserCheck className="me-1" /> Ne plus suivre
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => followUser(user._id)}
                          disabled={loading || !isVerified}
                          aria-label={`Suivre ${user.username || user.email}`}
                        >
                          <FaUserPlus className="me-1" /> Suivre
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
