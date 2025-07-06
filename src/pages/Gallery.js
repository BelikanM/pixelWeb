import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaTrash, FaEdit, FaPlay, FaPause, FaPlus, FaChartBar } from 'react-icons/fa';
import io from 'socket.io-client';
import './AdsManager.css'; // Fichier CSS spécifique pour la page des publicités

const API_URL = 'http://localhost:5000';
const socket = io(API_URL, { autoConnect: false });

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function AdsManager() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [ads, setAds] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [newAd, setNewAd] = useState({
    title: '',
    description: '',
    media: null,
    link: '',
    cta: 'Learn More',
    budget: 0,
    dailyBudget: false,
    target: { age: '', location: '', interests: '' },
  });
  const [editingAdId, setEditingAdId] = useState(null);
  const [showAdForm, setShowAdForm] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Charger les annonces
  const loadAds = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/ads`, {
        headers: { authorization: token },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAds(data);
        if (data.length === 0) {
          setMessage('Aucune annonce à afficher. Créez une nouvelle annonce.');
        }
      } else {
        setAds([]);
        setMessage('Erreur: Données des annonces non valides');
      }
    } catch {
      setMessage('Erreur réseau lors du chargement des annonces');
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  // Charger le profil utilisateur
  const loadProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setUsername(data.username || data.email || 'Utilisateur');
        setIsVerified(data.isVerified || false);
      } else {
        setMessage(data.message || 'Erreur chargement profil');
        if (res.status === 404 || res.status === 403) {
          localStorage.removeItem('token');
          setToken(null);
          setMessage('Session invalide, veuillez vous reconnecter');
          navigate('/profile');
        }
      }
    } catch {
      setMessage('Erreur réseau lors du chargement du profil');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  // Créer ou modifier une annonce
  const saveAd = useCallback(
    async () => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de créer/modifier une annonce');
        return;
      }
      if (!newAd.title || !newAd.description || !newAd.budget) {
        setMessage('Veuillez remplir tous les champs obligatoires');
        return;
      }
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append('title', newAd.title);
        formData.append('description', newAd.description);
        formData.append('link', newAd.link);
        formData.append('cta', newAd.cta);
        formData.append('budget', newAd.budget);
        formData.append('dailyBudget', newAd.dailyBudget);
        formData.append('target', JSON.stringify(newAd.target));
        if (newAd.media) formData.append('media', newAd.media);

        const url = editingAdId ? `${API_URL}/ads/${editingAdId}` : `${API_URL}/ads`;
        const method = editingAdId ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { authorization: token },
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setNewAd({
            title: '',
            description: '',
            media: null,
            link: '',
            cta: 'Learn More',
            budget: 0,
            dailyBudget: false,
            target: { age: '', location: '', interests: '' },
          });
          setEditingAdId(null);
          setShowAdForm(false);
          loadAds();
        } else {
          setMessage(data.message || 'Erreur lors de la sauvegde de l’annonce');
        }
      } catch {
        setMessage('Erreur réseau lors de la sauvegarde de l’annonce');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified, newAd, editingAdId, loadAds]
  );

  // Supprimer une annonce
  const deleteAd = useCallback(
    async (adId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de supprimer une annonce');
        return;
      }
      if (!window.confirm('Supprimer cette annonce ?')) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/ads/${adId}`, {
          method: 'DELETE',
          headers: { authorization: token },
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setAds((prev) => prev.filter((ad) => ad._id !== adId));
        } else {
          setMessage(data.message || 'Erreur lors de la suppression');
        }
      } catch {
        setMessage('Erreur réseau lors de la suppression');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified]
  );

  // Mettre en pause/reprendre une annonce
  const toggleAdStatus = useCallback(
    async (adId, currentStatus) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de modifier le statut de l’annonce');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/ads/${adId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', authorization: token },
          body: JSON.stringify({ status: currentStatus === 'active' ? 'paused' : 'active' }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setAds((prev) =>
            prev.map((ad) =>
              ad._id === adId ? { ...ad, status: currentStatus === 'active' ? 'paused' : 'active' } : ad
            )
          );
        } else {
          setMessage(data.message || 'Erreur lors de la modification du statut');
        }
      } catch {
        setMessage('Erreur réseau lors de la modification du statut');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified]
  );

  // Gérer les événements WebSocket
  useEffect(() => {
    if (token && isVerified) {
      socket.auth = { token };
      socket.connect();

      socket.on('connect', () => {
        console.log('Connecté à WebSocket');
      });

      socket.on('adUpdate', ({ ad }) => {
        setAds((prev) =>
          prev.map((existingAd) => (existingAd._id === ad._id ? { ...existingAd, ...ad } : existingAd))
        );
      });

      socket.on('adDeleted', ({ adId }) => {
        setAds((prev) => prev.filter((ad) => ad._id !== adId));
      });

      socket.on('adStatsUpdate', ({ adId, stats }) => {
        setAds((prev) =>
          prev.map((ad) => (ad._id === adId ? { ...ad, stats: { ...ad.stats, ...stats } } : ad))
        );
      });

      socket.on('connect_error', (err) => {
        console.error('Erreur WebSocket:', err.message);
        setMessage('Erreur de connexion WebSocket');
      });

      return () => {
        socket.off('connect');
        socket.off('adUpdate');
        socket.off('adDeleted');
        socket.off('adStatsUpdate');
        socket.off('connect_error');
        socket.disconnect();
      };
    }
  }, [token, isVerified]);

  // Chargement initial
  useEffect(() => {
    if (token) {
      loadProfile();
      if (isVerified) {
        loadAds();
      }
    } else {
      navigate('/profile');
    }
  }, [token, isVerified, loadProfile, loadAds, navigate]);

  // Déconnexion
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUsername('');
    setIsVerified(false);
    setAds([]);
    setMessage('Déconnecté');
    socket.disconnect();
    navigate('/profile');
  }, [navigate]);

  // Gérer les changements dans le formulaire
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewAd((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleTargetChange = (e) => {
    const { name, value } = e.target;
    setNewAd((prev) => ({
      ...prev,
      target: { ...prev.target, [name]: value },
    }));
  };

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewAd((prev) => ({ ...prev, media: file }));
    }
  };

  return (
    <div className="ads-manager-container">
      <button
        className="btn btn-outline-light btn-sm position-fixed top-0 end-0 m-2"
        onClick={handleLogout}
        aria-label="Déconnexion"
      >
        Déconnexion
      </button>
      {message && (
        <div
          className={`alert ${message.includes('Erreur') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`}
          role="alert"
        >
          {message}
          <button type="button" className="btn-close" onClick={() => setMessage('')} aria-label="Fermer"></button>
        </div>
      )}
      <div className="container">
        <h2 className="text-white mb-4">Gestion des publicités</h2>
        <button
          className="btn btn-primary mb-4"
          onClick={() => {
            setShowAdForm(!showAdForm);
            setEditingAdId(null);
            setNewAd({
              title: '',
              description: '',
              media: null,
              link: '',
              cta: 'Learn More',
              budget: 0,
              dailyBudget: false,
              target: { age: '', location: '', interests: '' },
            });
          }}
        >
          <FaPlus /> {showAdForm ? 'Annuler' : 'Créer une nouvelle annonce'}
        </button>

        {showAdForm && (
          <div className="ad-form card p-4 mb-4">
            <h4>{editingAdId ? 'Modifier l’annonce' : 'Créer une nouvelle annonce'}</h4>
            <div className="row">
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label text-white">Titre</label>
                  <input
                    type="text"
                    className="form-control"
                    name="title"
                    value={newAd.title}
                    onChange={handleInputChange}
                    placeholder="Entrez le titre de l’annonce"
                    disabled={loading}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label text-white">Description</label>
                  <textarea
                    className="form-control"
                    name="description"
                    value={newAd.description}
                    onChange={handleInputChange}
                    placeholder="Entrez la description de l’annonce"
                    disabled={loading}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label text-white">Lien</label>
                  <input
                    type="url"
                    className="form-control"
                    name="link"
                    value={newAd.link}
                    onChange={handleInputChange}
                    placeholder="https://example.com"
                    disabled={loading}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label text-white">Appel à l’action</label>
                  <select
                    className="form-control"
                    name="cta"
                    value={newAd.cta}
                    onChange={handleInputChange}
                    disabled={loading}
                  >
                    <option value="Learn More">En savoir plus</option>
                    <option value="Shop Now">Acheter maintenant</option>
                    <option value="Sign Up">S’inscrire</option>
                    <option value="Contact Us">Nous contacter</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label text-white">Média (image/vidéo)</label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="form-control"
                    ref={fileInputRef}
                    onChange={handleMediaChange}
                    disabled={loading}
                  />
                  {newAd.media && (
                    <div className="media-preview mt-2">
                      <p className="text-white small">Média sélectionné : {newAd.media.name}</p>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setNewAd((prev) => ({ ...prev, media: null }))}
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-md-6">
                <div className="mb-3">
                  <label className="form-label text-white">Budget</label>
                  <input
                    type="number"
                    className="form-control"
                    name="budget"
                    value={newAd.budget}
                    onChange={handleInputChange}
                    placeholder="Entrez le budget"
                    disabled={loading}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-check-label text-white">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      name="dailyBudget"
                      checked={newAd.dailyBudget}
                      onChange={handleInputChange}
                      disabled={loading}
                    />
                    Budget quotidien
                  </label>
                </div>
                <h5 className="text-white">Ciblage</h5>
                <div className="mb-3">
                  <label className="form-label text-white">Âge (ex: 18-35)</label>
                  <input
                    type="text"
                    className="form-control"
                    name="age"
                    value={newAd.target.age}
                    onChange={handleTargetChange}
                    placeholder="ex: 18-35"
                    disabled={loading}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label text-white">Localisation</label>
                  <input
                    type="text"
                    className="form-control"
                    name="location"
                    value={newAd.target.location}
                    onChange={handleTargetChange}
                    placeholder="ex: France, Paris"
                    disabled={loading}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label text-white">Intérêts</label>
                  <input
                    type="text"
                    className="form-control"
                    name="interests"
                    value={newAd.target.interests}
                    onChange={handleTargetChange}
                    placeholder="ex: technologie, sport"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveAd} disabled={loading}>
              {editingAdId ? 'Modifier' : 'Créer'} l’annonce
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-screen">
            <div className="pixel-gabon-spinner">
              <svg width="50" height="50" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="40" stroke="#FFD700" strokeWidth="8" />
                <path
                  d="M50 10 A40 40 0 0 1 90 50 A40 40 0 0 1 50 90 A40 40 0 0 1 10 50 A40 40 0 0 1 50 10 Z"
                  fill="#008000"
                />
                <circle cx="50" cy="50" r="20" fill="#0000FF" />
              </svg>
              <span>Chargement...</span>
            </div>
          </div>
        ) : (
          <div className="ads-list">
            {ads.length === 0 ? (
              <p className="text-muted">Aucune annonce à afficher. Créez une nouvelle annonce.</p>
            ) : (
              ads.map((ad) => (
                <div key={ad._id} className="ad-item card mb-3">
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-4">
                        {ad.filename && ad.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <img src={`${API_URL}/uploads/${ad.filename}`} alt={ad.title} className="ad-media" />
                        ) : ad.filename ? (
                          <video src={`${API_URL}/uploads/${ad.filename}`} className="ad-media" controls />
                        ) : (
                          <div className="ad-media-placeholder">Aucun média</div>
                        )}
                      </div>
                      <div className="col-md-8">
                        <h5 className="text-white">{ad.title}</h5>
                        <p className="text-white">{ad.description}</p>
                        <p className="text-white small">
                          <strong>Lien :</strong>{' '}
                          <a href={ad.link} target="_blank" rel="noopener noreferrer">
                            {ad.link}
                          </a>
                        </p>
                        <p className="text-white small">
                          <strong>CTA :</strong> {ad.cta}
                        </p>
                        <p className="text-white small">
                          <strong>Budget :</strong> {ad.budget} {ad.dailyBudget ? 'par jour' : 'total'}
                        </p>
                        <p className="text-white small">
                          <strong>Ciblage :</strong> Âge: {ad.target.age || 'Non défini'}, Localisation:{' '}
                          {ad.target.location || 'Non défini'}, Intérêts: {ad.target.interests || 'Non défini'}
                        </p>
                        <p className="text-white small">
                          <strong>Statut :</strong> {ad.status === 'active' ? 'Actif' : 'En pause'}
                        </p>
                        <p className="text-white small">
                          <strong>Statistiques :</strong> Impressions: {ad.stats?.impressions || 0}, Clics:{' '}
                          {ad.stats?.clicks || 0}, Conversions: {ad.stats?.conversions || 0}
                        </p>
                        <div className="ad-actions">
                          <button
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => {
                              setEditingAdId(ad._id);
                              setNewAd({
                                title: ad.title,
                                description: ad.description,
                                media: null,
                                link: ad.link,
                                cta: ad.cta,
                                budget: ad.budget,
                                dailyBudget: ad.dailyBudget,
                                target: ad.target,
                              });
                              setShowAdForm(true);
                            }}
                            disabled={loading}
                          >
                            <FaEdit /> Modifier
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger me-1"
                            onClick={() => deleteAd(ad._id)}
                            disabled={loading}
                          >
                            <FaTrash /> Supprimer
                          </button>
                          <button
                            className={`btn btn-sm ${
                              ad.status === 'active' ? 'btn-outline-warning' : 'btn-outline-success'
                            }`}
                            onClick={() => toggleAdStatus(ad._id, ad.status)}
                            disabled={loading}
                          >
                            {ad.status === 'active' ? <FaPause /> : <FaPlay />} {ad.status === 'active' ? 'Mettre en pause' : 'Activer'}
                          </button>
                          <button
                            className="btn btn-sm btn-outline-info ms-1"
                            onClick={() => navigate(`/ads/${ad._id}/stats`)}
                            disabled={loading}
                          >
                            <FaChartBar /> Statistiques
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
