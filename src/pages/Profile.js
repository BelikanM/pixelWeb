import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [role, setRole] = useState('user');
  const [verificationCode, setVerificationCode] = useState('');
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [follows, setFollows] = useState([]);
  const [myMedias, setMyMedias] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editMediaId, setEditMediaId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const navigate = useNavigate();

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
        setIsVerified(data.isVerified || false);
        setRole(data.role || 'user');
      } else {
        console.error('Erreur chargement profil:', data.message);
        setMessage(data.message || 'Erreur chargement profil');
        if (res.status === 404 || res.status === 403) {
          localStorage.removeItem('token');
          setToken(null);
          setIsLogin(false);
          setMessage('Session invalide, veuillez vous reconnecter');
        }
      }
    } catch (err) {
      console.error('Erreur réseau profil:', err.message);
      setMessage('Erreur réseau lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const requestVerificationCode = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/request-verification`, {
        method: 'POST',
        headers: { authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        console.error('Erreur demande code:', data.message);
        setMessage(data.message || 'Erreur lors de la demande de code');
      }
    } catch (err) {
      console.error('Erreur réseau demande code:', err.message);
      setMessage('Erreur réseau lors de la demande de code');
    } finally {
      setLoading(false);
    }
  }, [token]);

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
        setRole(data.user.role);
        loadProfile();
      } else {
        console.error('Erreur vérification code:', data.message);
        setMessage(data.message || 'Erreur lors de la vérification');
      }
    } catch (err) {
      console.error('Erreur réseau vérification:', err.message);
      setMessage('Erreur réseau lors de la vérification');
    } finally {
      setLoading(false);
    }
  }, [token, verificationCode, loadProfile]);

  const loadUsers = useCallback(async (q) => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/users?q=${encodeURIComponent(q)}`, {
        headers: { authorization: token },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data.filter((u) => u._id !== userId));
      } else {
        console.error('Erreur utilisateurs: Données non valides', data);
        setUsers([]);
      }
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err.message);
      setMessage('Erreur chargement utilisateurs');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token, userId, isVerified]);

  const loadFollows = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/follows`, { headers: { authorization: token } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setFollows(data);
      } else {
        console.error('Erreur suivis: Données non valides', data);
        setFollows([]);
      }
    } catch (err) {
      console.error('Erreur chargement suivis:', err.message);
      setMessage('Erreur chargement abonnements');
      setFollows([]);
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  const loadMyMedias = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/my-medias`, { headers: { authorization: token } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setMyMedias(data);
      } else {
        console.error('Erreur médias: Données non valides', data);
        setMyMedias([]);
      }
    } catch (err) {
      console.error('Erreur chargement médias:', err.message);
      setMessage('Erreur chargement médias');
      setMyMedias([]);
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

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
      } else {
        console.error('Erreur follow:', data.message);
        setMessage(data.message || 'Erreur follow');
      }
    } catch (err) {
      console.error('Erreur réseau follow:', err.message);
      setMessage('Erreur follow');
    } finally {
      setLoading(false);
    }
  }, [token, loadFollows, isVerified]);

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
      } else {
        console.error('Erreur unfollow:', data.message);
        setMessage(data.message || 'Erreur unfollow');
      }
    } catch (err) {
      console.error('Erreur réseau unfollow:', err.message);
      setMessage('Erreur unfollow');
    } finally {
      setLoading(false);
    }
  }, [token, loadFollows, isVerified]);

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
      } else {
        console.error('Erreur suppression média:', data.message);
        setMessage(data.message || 'Erreur suppression');
      }
    } catch (err) {
      console.error('Erreur réseau suppression:', err.message);
      setMessage('Erreur suppression');
    } finally {
      setLoading(false);
    }
  }, [token, loadMyMedias, isVerified]);

  const startEditMedia = useCallback((media) => {
    setEditMediaId(media._id);
    setEditTitle(media.originalname);
    setEditDescription(media.description || '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditMediaId(null);
    setEditTitle('');
    setEditDescription('');
  }, []);

  const saveMediaEdits = useCallback(async (id) => {
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant de modifier des médias');
      return;
    }
    if (!editTitle.trim()) {
      setMessage('Le titre ne peut pas être vide');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/media/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: token },
        body: JSON.stringify({ originalname: editTitle, description: editDescription }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setEditMediaId(null);
        setEditTitle('');
        setEditDescription('');
        loadMyMedias();
      } else {
        console.error('Erreur mise à jour média:', data.message);
        setMessage(data.message || 'Erreur mise à jour');
      }
    } catch (err) {
      console.error('Erreur réseau mise à jour:', err.message);
      setMessage('Erreur mise à jour');
    } finally {
      setLoading(false);
    }
  }, [token, editTitle, editDescription, loadMyMedias, isVerified]);

  const updateProfile = useCallback(async () => {
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant de modifier votre profil');
      return;
    }
    if (!username.trim()) {
      setMessage('Le nom d’utilisateur ne peut pas être vide');
      return;
    }
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(username)) {
      setMessage('Nom d’utilisateur invalide (3-20 caractères, lettres, chiffres, -, _)');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: token },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setUsername(data.user.username);
        setIsVerified(data.user.isVerified);
        setRole(data.user.role);
      } else {
        console.error('Erreur mise à jour profil:', data.message);
        setMessage(data.message || 'Erreur mise à jour profil');
        if (res.status === 404 || res.status === 403) {
          localStorage.removeItem('token');
          setToken(null);
          setIsLogin(false);
          setMessage('Session invalide, veuillez vous reconnecter');
        }
      }
    } catch (err) {
      console.error('Erreur réseau mise à jour profil:', err.message);
      setMessage('Erreur réseau lors de la mise à jour du profil');
    } finally {
      setLoading(false);
    }
  }, [token, username, isVerified]);

  const handleUpload = useCallback(async (e) => {
    e.preventDefault();
    if (!isVerified) {
      setMessage('Veuillez vérifier votre email avant d’uploader des fichiers');
      return;
    }
    if (!file) {
      setMessage('Choisis un fichier');
      return;
    }
    if (!title.trim()) {
      setMessage('Le titre ne peut pas être vide');
      return;
    }
    const formData = new FormData();
    formData.append('media', file);
    formData.append('description', description);
    formData.append('originalname', title);
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
        setTitle('');
        setDescription('');
        loadMyMedias();
      } else {
        console.error('Erreur upload:', data.message);
        setMessage(data.message || 'Erreur upload');
      }
    } catch (err) {
      console.error('Erreur réseau upload:', err.message);
      setMessage('Erreur upload');
    } finally {
      setLoading(false);
    }
  }, [token, file, title, description, loadMyMedias, isVerified]);

  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
    if (isVerified) {
      loadUsers(e.target.value);
    } else {
      setMessage('Veuillez vérifier votre email pour rechercher des utilisateurs');
    }
  }, [loadUsers, isVerified]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? '/login' : '/register';
    setLoading(true);
    try {
      const body = isLogin
        ? { email, password }
        : { email, password, username: username || email.split('@')[0], role: 'user' };
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
      if (!res.ok) {
        console.error(`Erreur ${isLogin ? 'connexion' : 'inscription'}:`, data.message);
        throw new Error(data.message || 'Erreur');
      }
      if (isLogin) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setEmail(data.user?.email || '');
        setUsername(data.user?.username || '');
        setIsVerified(data.user?.isVerified || false);
        setRole(data.user?.role || 'user');
        setMessage('Connecté avec succès !');
      } else {
        setMessage('Inscription réussie. Vérifiez votre email pour activer votre compte.');
        setIsLogin(true);
        setEmail('');
        setPassword('');
        setUsername('');
      }
    } catch (err) {
      console.error(`Erreur réseau ${isLogin ? 'connexion' : 'inscription'}:`, err.message);
      setMessage(`Erreur : ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [email, password, isLogin, username]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setIsLogin(false);
    setUsers([]);
    setFollows([]);
    setMyMedias([]);
    setEmail('');
    setUsername('');
    setIsVerified(false);
    setRole('user');
    setVerificationCode('');
    setMessage('Déconnecté');
    navigate('/');
  }, [navigate]);

  useEffect(() => {
    if (token) {
      const decoded = parseJwt(token);
      setUserId(decoded?.userId || null);
      setMessage('');
      setEmail('');
      setPassword('');
      setUsername('');
      setIsLogin(true);
      loadProfile();
      if (isVerified) {
        loadFollows();
        loadMyMedias();
        loadUsers('');
      }
    }
  }, [token, loadProfile, loadFollows, loadMyMedias, loadUsers, isVerified]);

  return (
    <div className="profile-container">
      <h1 className="mb-4 text-center text-primary">Pixels Media - Profil</h1>

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
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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
              <FaUser className="me-2" /> Bonjour, {username || email || 'Utilisateur'} ({role === 'admin' ? 'Administrateur' : 'Utilisateur'})
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
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!isVerified}
                aria-label="Nom d’utilisateur"
              />
            </div>
            <button
              className="btn btn-primary w-100"
              onClick={updateProfile}
              disabled={loading || !username.trim() || !isVerified}
              aria-label="Mettre à jour le profil"
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : 'Mettre à jour'}
            </button>
          </div>

          {isVerified && (
            <>
              <div className="card p-4 mb-4 bg-light text-dark rounded shadow-sm">
                <h4 className="text-center mb-3">Publier un contenu</h4>
                <form onSubmit={handleUpload}>
                  <div className="mb-3">
                    <label htmlFor="media-file" className="form-label">Sélectionner un fichier</label>
                    <input
                      type="file"
                      id="media-file"
                      accept="image/*,video/*,audio/*"
                      className="form-control"
                      onChange={(e) => {
                        setFile(e.target.files[0]);
                        setTitle(e.target.files[0]?.name || '');
                      }}
                      disabled={!isVerified}
                      aria-label="Sélectionner un fichier"
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="media-title" className="form-label">Titre</label>
                    <input
                      type="text"
                      id="media-title"
                      className="form-control"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Entrez un titre pour le média"
                      disabled={!isVerified}
                      aria-label="Titre du média"
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="description" className="form-label">Description (HTML autorisé)</label>
                    <textarea
                      id="description"
                      className="form-control"
                      rows="5"
                      placeholder="Ajoutez une description (vous pouvez utiliser du HTML simple)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!isVerified}
                      aria-label="Description du contenu"
                    />
                    <small className="text-muted">
                      Vous pouvez utiliser des balises HTML comme &lt;b&gt;, &lt;i&gt;, &lt;a href="..."&gt;, etc.
                    </small>
                  </div>
                  <button
                    className="btn btn-success w-100"
                    type="submit"
                    disabled={loading || !file || !title.trim() || !isVerified}
                    aria-label="Publier le contenu"
                  >
                    <FaUpload className="me-1" /> {loading ? 'Publication...' : 'Publier'}
                  </button>
                </form>
              </div>

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
                          onError={(e) => console.error('Erreur chargement image:', media.filename)}
                        />
                      ) : (
                        <video
                          src={`${API_URL}/uploads/${media.filename}`}
                          controls
                          className="card-img-top"
                          onError={(e) => console.error('Erreur chargement vidéo:', media.filename)}
                        />
                      )}
                      <div className="card-body">
                        {editMediaId === media._id ? (
                          <>
                            <input
                              type="text"
                              className="form-control mb-2"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder="Nouveau titre"
                              aria-label="Nouveau titre du média"
                            />
                            <textarea
                              className="form-control mb-2"
                              rows="3"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Nouvelle description"
                              aria-label="Nouvelle description du média"
                            />
                            <div className="d-flex justify-content-between">
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => saveMediaEdits(media._id)}
                                disabled={loading || !isVerified}
                                type="button"
                                aria-label="Sauvegarder les modifications"
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
                            <div
                              className="card-text"
                              dangerouslySetInnerHTML={{ __html: media.description || 'Aucune description' }}
                            />
                            <p className="text-muted small">
                              Publié le : {new Date(media.uploadedAt).toLocaleString()}
                            </p>
                            <div className="d-flex justify-content-between">
                              <button
                                className="btn btn-outline-warning btn-sm"
                                onClick={() => startEditMedia(media)}
                                disabled={loading || !isVerified}
                                type="button"
                                aria-label="Modifier le média"
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
                  const isFollowing = follows.some(f => f._id === user._id);
                  return (
                    <div
                      key={user._id}
                      className="list-group-item d-flex justify-content-between align-items-center hover-list-item"
                    >
                      <span>
                        {user.username ? `${user.username} (${user.email})` : user.email} {user.isVerified ? '(Vérifié)' : '(Non vérifié)'}
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
