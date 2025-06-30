// src/pages/Profile.js
import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_URL = 'http://localhost:5000'; // à adapter si nécessaire

export default function Profile() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLogin, setIsLogin] = useState(false); // toggle entre inscription / connexion

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
        setMessage('✅ Connecté avec succès !');
      } else {
        setMessage('✅ Inscription réussie ! Connecte-toi maintenant.');
        setIsLogin(true);
      }
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: '500px' }}>
      <div className="card shadow-lg p-4 bg-dark text-light rounded-4">
        <h2 className="text-center mb-4">{isLogin ? 'Connexion' : 'Inscription'}</h2>

        {message && (
          <div className="alert alert-info text-center">{message}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group mb-3">
            <input
              type="email"
              className="form-control"
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group mb-4">
            <input
              type="password"
              className="form-control"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-100 mb-3">
            {isLogin ? 'Se connecter' : "S'inscrire"}
          </button>

          <p className="text-center">
            {isLogin ? "Pas encore de compte ?" : 'Déjà inscrit ?'}{' '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="btn btn-link text-info"
            >
              {isLogin ? "S'inscrire" : 'Connexion'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
