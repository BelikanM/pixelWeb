import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaTrash, FaEdit, FaUserPlus, FaUserCheck, FaSignOutAlt, FaUpload, FaSave, FaTimes } from 'react-icons/fa';

const API_URL = 'http://localhost:5000';

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function Profile() {
  // États auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userId, setUserId] = useState(null);

  // États données utilisateurs et médias
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [follows, setFollows] = useState([]);
  const [feed, setFeed] = useState([]);
  const [myMedias, setMyMedias] = useState([]);

  // Upload
  const [file, setFile] = useState(null);

  // Pour modification nom média
  const [editMediaId, setEditMediaId] = useState(null);
  const [newName, setNewName] = useState('');

  // Décodage token + chargement initial
  useEffect(() => {
    if (token) {
      const decoded = parseJwt(token);
      setUserId(decoded?.userId || null);
      setMessage('');
      setEmail('');
      setPassword('');
      setIsLogin(true);
      loadFollows();
      loadFeed();
      loadMyMedias();
      loadUsers('');
    }
  }, [token]);

  // Chargement utilisateurs
  const loadUsers = async (q) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/users?q=${encodeURIComponent(q)}`, {
        headers: { authorization: token }
      });
      const data = await res.json();
      setUsers(data.filter(u => u._id !== userId));
    } catch {
      setMessage('Erreur chargement utilisateurs');
    }
  };

  // Chargement suivis
  const loadFollows = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/follows`, { headers: { authorization: token } });
      const data = await res.json();
      setFollows(data.map(u => u._id));
    } catch {
      setMessage('Erreur chargement abonnements');
    }
  };

  // Suivre utilisateur
  const followUser = async (id) => {
    try {
      const res = await fetch(`${API_URL}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: token },
        body: JSON.stringify({ followingId: id })
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
      setMessage('Erreur follow');
    }
  };

  // Ne plus suivre
  const unfollowUser = async (id) => {
    try {
      const res = await fetch(`${API_URL}/follow`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', authorization: token },
        body: JSON.stringify({ followingId: id })
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
      setMessage('Erreur unfollow');
    }
  };

  // Charger feed (médias abonnés)
  const loadFeed = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/feed`, { headers: { authorization: token } });
      const data = await res.json();
      setFeed(data);
    } catch {
      setMessage('Erreur chargement fil');
    }
  };

  // Charger médias personnels
  const loadMyMedias = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/my-medias`, { headers: { authorization: token } });
      const data = await res.json();
      setMyMedias(data);
    } catch {
      setMessage('Erreur chargement médias');
    }
  };

  // Supprimer média
  const deleteMedia = async (id) => {
    if (!window.confirm('Supprimer ce média ?')) return;
    try {
      const res = await fetch(`${API_URL}/media/${id}`, {
        method: 'DELETE',
        headers: { authorization: token }
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
      setMessage('Erreur suppression');
    }
  };

  // Début édition nom média
  const startEditMedia = (media) => {
    setEditMediaId(media._id);
    setNewName(media.originalname);
  };

  // Annuler édition nom média
  const cancelEdit = () => {
    setEditMediaId(null);
    setNewName('');
  };

  // Sauvegarder nouveau nom média
  const saveNewName = async (id) => {
    if (!newName.trim()) {
      setMessage('Le nom ne peut pas être vide');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/media/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', authorization: token },
        body: JSON.stringify({ originalname: newName })
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
      setMessage('Erreur mise à jour');
    }
  };

  // Upload média
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('Choisis un fichier');
      return;
    }
    const formData = new FormData();
    formData.append('media', file);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { authorization: token },
        body: formData
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
      setMessage('Erreur upload');
    }
  };

  // Recherche utilisateurs
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    loadUsers(e.target.value);
  };

  // Formulaire inscription / connexion
  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? '/login' : '/register';

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');

      if (isLogin) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setMessage('Connecté avec succès !');
      } else {
        setMessage('Inscription réussie, connecte-toi');
        setIsLogin(true);
      }
    } catch (err) {
      setMessage(`Erreur : ${err.message}`);
    }
  };

  // Déconnexion
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsLogin(false);
    setUsers([]);
    setFollows([]);
    setFeed([]);
    setMyMedias([]);
    setMessage('Déconnecté');
  };

  return (
    <div className="container mt-4" style={{ maxWidth: 900 }}>
      <h1 className="mb-4 text-center">Pixels Media - Profil</h1>

      {!token ? (
        <div className="card p-4 bg-light text-dark rounded">
          <h2>{isLogin ? 'Connexion' : 'Inscription'}</h2>
          {message && <div className="alert alert-info">{message}</div>}
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email"
              className="form-control mb-3"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Mot de passe"
              className="form-control mb-3"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button className="btn btn-primary w-100 mb-3" type="submit">
              {isLogin ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>
          <button
            className="btn btn-link w-100"
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage('');
            }}
          >
            {isLogin ? "Pas encore de compte ? S'inscrire" : 'Déjà inscrit ? Se connecter'}
          </button>
        </div>
      ) : (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h3>Bonjour, {email || 'Utilisateur'}</h3>
            <button className="btn btn-danger" onClick={handleLogout}>
              <FaSignOutAlt /> Déconnexion
            </button>
          </div>

          {message && <div className="alert alert-info">{message}</div>}

          {/* Upload média */}
          <form onSubmit={handleUpload} className="mb-4">
            <div className="input-group">
              <input
                type="file"
                accept="image/*,video/*,audio/*"
                className="form-control"
                onChange={e => setFile(e.target.files[0])}
              />
              <button className="btn btn-success" type="submit">
                <FaUpload /> Upload
              </button>
            </div>
          </form>

          {/* Médias personnels */}
          <h4>Médias personnels</h4>
          <div className="row">
            {myMedias.length === 0 && <p>Aucun média uploadé.</p>}
            {myMedias.map(media => (
              <div key={media._id} className="col-md-4 mb-3">
                <div className="card h-100 shadow-sm">
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
                          onChange={e => setNewName(e.target.value)}
                        />
                        <div className="d-flex justify-content-between">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => saveNewName(media._id)}
                            type="button"
                          >
                            <FaSave /> Sauvegarder
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={cancelEdit}
                            type="button"
                          >
                            <FaTimes /> Annuler
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <h5 className="card-title text-truncate">{media.originalname}</h5>
                        <p className="card-text">
                          Uploadé le : {new Date(media.uploadedAt).toLocaleString()}
                        </p>
                        <div className="mt-auto d-flex justify-content-between">
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => startEditMedia(media)}
                            type="button"
                          >
                            <FaEdit /> Modifier
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteMedia(media._id)}
                            type="button"
                          >
                            <FaTrash /> Supprimer
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Fil d'actualité médias suivis */}
          <h4 className="mt-5">Fil d’actualité</h4>
          <div className="row">
            {feed.length === 0 && <p>Aucun média dans votre fil.</p>}
            {feed.map(media => (
              <div key={media._id} className="col-md-4 mb-3">
                <div className="card h-100 shadow-sm">
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
                    <p className="card-text">
                      Uploadé le : {new Date(media.uploadedAt).toLocaleString()}
                    </p>
                    <p className="text-muted small">Par : {media.owner.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Liste utilisateurs avec recherche */}
          <h4 className="mt-5">Utilisateurs</h4>
          <input
            type="search"
            className="form-control mb-3"
            placeholder="Rechercher un utilisateur"
            value={search}
            onChange={handleSearchChange}
          />
          <div className="list-group mb-5" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            {users.length === 0 && <p>Aucun utilisateur trouvé.</p>}
            {users.map(user => {
              const isFollowing = follows.includes(user._id);
              return (
                <div
                  key={user._id}
                  className="list-group-item d-flex justify-content-between align-items-center"
                >
                  <span>{user.email}</span>
                  {isFollowing ? (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => unfollowUser(user._id)}
                    >
                      <FaUserCheck /> Ne plus suivre
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => followUser(user._id)}
                    >
                      <FaUserPlus /> Suivre
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
