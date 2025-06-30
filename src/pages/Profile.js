import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

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
  const [message, setMessage] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [userId, setUserId] = useState(null);

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [follows, setFollows] = useState([]);
  const [feed, setFeed] = useState([]);

  const [file, setFile] = useState(null);

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
      loadUsers('');
    }
  }, [token]);

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

  const loadFollows = async () => {
    try {
      const res = await fetch(`${API_URL}/follows`, {
        headers: { authorization: token }
      });
      const data = await res.json();
      setFollows(data.map(u => u._id));
    } catch {
      setMessage('Erreur chargement abonnements');
    }
  };

  const followUser = async (id) => {
    try {
      const res = await fetch(`${API_URL}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: token
        },
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

  const unfollowUser = async (id) => {
    try {
      const res = await fetch(`${API_URL}/follow`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          authorization: token
        },
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

  const loadFeed = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/feed`, {
        headers: { authorization: token }
      });
      const data = await res.json();
      setFeed(data);
    } catch {
      setMessage('Erreur chargement fil');
    }
  };

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsLogin(false);
    setUsers([]);
    setFollows([]);
    setFeed([]);
    setMessage('Déconnecté');
  };

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
      } else {
        setMessage(data.message || 'Erreur upload');
      }
    } catch {
      setMessage('Erreur upload');
    }
  };

  return (
    <div className="container mt-4" style={{ maxWidth: 900 }}>
      <h1 className="mb-4 text-center">Pixels Media - Profile</h1>

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
            <h3>Bienvenue</h3>
            <button className="btn btn-danger" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>

          {message && <div className="alert alert-info">{message}</div>}

          <form className="mb-4" onSubmit={handleUpload}>
            <div className="mb-3">
              <label className="form-label">Uploader un fichier média</label>
              <input
                type="file"
                className="form-control"
                onChange={e => setFile(e.target.files[0])}
              />
            </div>
            <button className="btn btn-success" type="submit">Envoyer</button>
          </form>

          <div className="mb-4">
            <h4>🔍 Rechercher des utilisateurs</h4>
            <input
              type="text"
              className="form-control mb-2"
              placeholder="Recherche..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                loadUsers(e.target.value);
              }}
            />
            {users.map((user) => (
              <div key={user._id} className="d-flex justify-content-between align-items-center border p-2 rounded mb-2">
                <span>{user.email}</span>
                {follows.includes(user._id) ? (
                  <button className="btn btn-outline-danger btn-sm" onClick={() => unfollowUser(user._id)}>Ne plus suivre</button>
                ) : (
                  <button className="btn btn-outline-primary btn-sm" onClick={() => followUser(user._id)}>Suivre</button>
                )}
              </div>
            ))}
          </div>

          <div className="mb-5">
            <h4>📰 Fil d’actualité</h4>
            {feed.length === 0 && <p>Aucun média disponible pour le moment.</p>}
            {feed.map((media) => (
              <div key={media._id} className="card mb-3">
                <div className="card-body">
                  <h6 className="card-title">Posté par : {media.owner?.email || 'Utilisateur'}</h6>
                  <p className="card-text">
                    <strong>Nom original :</strong> {media.originalname}
                  </p>
                  <a
                    href={`http://localhost:5000/uploads/${media.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline-secondary btn-sm"
                  >
                    Ouvrir le fichier
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
