import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaTrash, FaThumbsUp, FaThumbsDown, FaUserCircle, FaSignOutAlt, FaComment, FaHome } from 'react-icons/fa';
import io from 'socket.io-client';
import './Home.css';

const API_URL = 'http://localhost:5000';
const socket = io(API_URL, { autoConnect: false });

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function Home() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [feed, setFeed] = useState([]);
  const [follows, setFollows] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [commentInput, setCommentInput] = useState({});
  const [submittingComment, setSubmittingComment] = useState({}); // État pour suivre les soumissions
  const videoRefs = useRef([]);
  const navigate = useNavigate();

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

  // Charger le feed
  const loadFeed = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/feed`, { headers: { authorization: token } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setFeed(data);
        if (data.length === 0) {
          setMessage('Aucun contenu à afficher. Suivez des utilisateurs pour voir leurs médias.');
        }
      } else {
        setFeed([]);
        setMessage('Erreur: Données du feed non valides');
      }
    } catch {
      setMessage('Erreur réseau lors du chargement du feed');
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  // Charger les suivis
  const loadFollows = useCallback(async () => {
    if (!token || !isVerified) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/follows`, { headers: { authorization: token } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setFollows(data.map((u) => u._id.toString()));
      } else {
        setFollows([]);
        setMessage('Erreur: Données des abonnements non valides');
      }
    } catch {
      setMessage('Erreur réseau lors du chargement des abonnements');
    } finally {
      setLoading(false);
    }
  }, [token, isVerified]);

  // Suivre un utilisateur
  const followUser = useCallback(
    async (id) => {
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
          setFollows((prev) => [...new Set([...prev, id.toString()])]);
        } else {
          setMessage(data.message || 'Erreur lors de l’abonnement');
        }
      } catch {
        setMessage('Erreur réseau lors de l’abonnement');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified]
  );

  // Ne plus suivre un utilisateur
  const unfollowUser = useCallback(
    async (id) => {
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
          setFollows((prev) => prev.filter((userId) => userId !== id.toString()));
          setFeed((prev) =>
            prev.filter((media) => media.owner?._id.toString() !== id.toString())
          );
        } else {
          setMessage(data.message || 'Erreur lors du désabonnement');
        }
      } catch {
        setMessage('Erreur réseau lors du désabonnement');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified]
  );

  // Supprimer un média
  const deleteMedia = useCallback(
    async (id) => {
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
          setFeed((prev) => prev.filter((media) => media._id !== id));
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

  // Aimer un média
  const likeMedia = useCallback(
    async (mediaId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant d’aimer un média');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/like/${mediaId}`, {
          method: 'POST',
          headers: { authorization: token },
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
        } else {
          setMessage(data.message || 'Erreur lors de l’ajout du like');
        }
      } catch {
        setMessage('Erreur réseau lors de l’ajout du like');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified]
  );

  // Retirer un like
  const unlikeMedia = useCallback(
    async (mediaId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de retirer un like');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/like/${mediaId}`, {
          method: 'DELETE',
          headers: { authorization: token },
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
        } else {
          setMessage(data.message || 'Erreur lors du retrait du like');
        }
      } catch {
        setMessage('Erreur réseau lors du retrait du like');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified]
  );

  // Ajouter un dislike
  const dislikeMedia = useCallback(
    async (mediaId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de marquer un média comme non apprécié');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/dislike/${mediaId}`, {
          method: 'POST',
          headers: { authorization: token },
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
        } else {
          setMessage(data.message || 'Erreur lors de l’ajout du dislike');
        }
      } catch {
        setMessage('Erreur réseau lors de l’ajout du dislike');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified]
  );

  // Retirer un dislike
  const undislikeMedia = useCallback(
    async (mediaId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de retirer un dislike');
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/dislike/${mediaId}`, {
          method: 'DELETE',
          headers: { authorization: token },
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
        } else {
          setMessage(data.message || 'Erreur lors du retrait du dislike');
        }
      } catch {
        setMessage('Erreur réseau lors du retrait du dislike');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified]
  );

  // Ajouter un commentaire
  const addComment = useCallback(
    async (mediaId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de commenter');
        return;
      }
      if (submittingComment[mediaId]) {
        console.log(`Soumission de commentaire déjà en cours pour média ${mediaId}`);
        return;
      }
      const content = commentInput[mediaId]?.trim();
      if (!content) {
        setMessage('Le commentaire ne peut pas être vide');
        return;
      }
      setSubmittingComment((prev) => ({ ...prev, [mediaId]: true }));
      try {
        console.log(`Envoi du commentaire pour média ${mediaId}: ${content}`);
        const res = await fetch(`${API_URL}/comment/${mediaId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: token },
          body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setCommentInput((prev) => ({ ...prev, [mediaId]: '' }));
        } else {
          setMessage(data.message || 'Erreur lors de l’ajout du commentaire');
        }
      } catch {
        setMessage('Erreur réseau lors de l’ajout du commentaire');
      } finally {
        setSubmittingComment((prev) => ({ ...prev, [mediaId]: false }));
      }
    },
    [token, isVerified, commentInput, submittingComment]
  );

  // Gérer les événements WebSocket
  useEffect(() => {
    if (token && isVerified) {
      socket.auth = { token };
      socket.connect();

      socket.on('connect', () => {
        console.log('Connecté à WebSocket');
      });

      socket.on('followUpdate', async ({ userId, followingId }) => {
        if (userId === parseJwt(token)?.userId) {
          setFollows((prev) => [...new Set([...prev, followingId.toString()])]);
          await loadFeed();
        }
      });

      socket.on('unfollowUpdate', ({ userId, unfollowedId }) => {
        if (userId === parseJwt(token)?.userId) {
          setFollows((prev) => prev.filter((id) => id !== unfollowedId.toString()));
          setFeed((prev) =>
            prev.filter((media) => media.owner?._id.toString() !== unfollowedId.toString())
          );
        }
      });

      socket.on('newMedia', ({ media, owner }) => {
        if (follows.includes(owner._id.toString())) {
          setFeed((prev) => [
            { ...media, owner, likesCount: media.likes.length, dislikesCount: media.dislikes.length, isLiked: false, isDisliked: false },
            ...prev,
          ]);
        }
      });

      socket.on('mediaDeleted', ({ mediaId }) => {
        setFeed((prev) => prev.filter((media) => media._id !== mediaId));
      });

      socket.on('likeUpdate', ({ mediaId, likesCount, dislikesCount, userId }) => {
        setFeed((prev) =>
          prev.map((media) =>
            media._id === mediaId
              ? {
                  ...media,
                  likesCount,
                  dislikesCount,
                  isLiked: userId === parseJwt(token)?.userId ? true : media.isLiked,
                  isDisliked: userId === parseJwt(token)?.userId ? false : media.isDisliked,
                }
              : media
          )
        );
      });

      socket.on('unlikeUpdate', ({ mediaId, likesCount, dislikesCount, userId }) => {
        setFeed((prev) =>
          prev.map((media) =>
            media._id === mediaId
              ? {
                  ...media,
                  likesCount,
                  dislikesCount,
                  isLiked: userId === parseJwt(token)?.userId ? false : media.isLiked,
                }
              : media
          )
        );
      });

      socket.on('dislikeUpdate', ({ mediaId, likesCount, dislikesCount, userId }) => {
        setFeed((prev) =>
          prev.map((media) =>
            media._id === mediaId
              ? {
                  ...media,
                  likesCount,
                  dislikesCount,
                  isDisliked: userId === parseJwt(token)?.userId ? true : media.isDisliked,
                  isLiked: userId === parseJwt(token)?.userId ? false : media.isLiked,
                }
              : media
          )
        );
      });

      socket.on('undislikeUpdate', ({ mediaId, likesCount, dislikesCount, userId }) => {
        setFeed((prev) =>
          prev.map((media) =>
            media._id === mediaId
              ? {
                  ...media,
                  likesCount,
                  dislikesCount,
                  isDisliked: userId === parseJwt(token)?.userId ? false : media.isDisliked,
                }
              : media
          )
        );
      });

      socket.on('commentUpdate', ({ mediaId, comment }) => {
        setFeed((prev) =>
          prev.map((media) =>
            media._id === mediaId
              ? {
                  ...media,
                  comments: [
                    ...(media.comments || []).filter(
                      (c) =>
                        !(
                          c.content === comment.content &&
                          c.author._id.toString() === comment.author._id.toString() &&
                          new Date(c.createdAt).getTime() === new Date(comment.createdAt).getTime()
                        )
                    ),
                    comment,
                  ],
                }
              : media
          )
        );
        console.log(`Commentaire reçu via WebSocket pour média ${mediaId}: ${comment.content}`);
      });

      socket.on('connect_error', (err) => {
        console.error('Erreur WebSocket:', err.message);
        setMessage('Erreur de connexion WebSocket');
      });

      return () => {
        socket.off('connect');
        socket.off('followUpdate');
        socket.off('unfollowUpdate');
        socket.off('newMedia');
        socket.off('mediaDeleted');
        socket.off('likeUpdate');
        socket.off('unlikeUpdate');
        socket.off('dislikeUpdate');
        socket.off('undislikeUpdate');
        socket.off('commentUpdate');
        socket.off('connect_error');
        socket.disconnect();
      };
    }
  }, [token, isVerified, follows]);

  // Gérer la lecture/pause automatique des vidéos
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.7 }
    );

    videoRefs.current.forEach((video) => {
      if (video) observer.observe(video);
    });

    return () => {
      videoRefs.current.forEach((video) => {
        if (video) observer.unobserve(video);
      });
    };
  }, [feed]);

  // Chargement initial
  useEffect(() => {
    if (token) {
      loadProfile();
      if (isVerified) {
        loadFeed();
        loadFollows();
      }
    } else {
      navigate('/profile');
    }
  }, [token, isVerified, loadProfile, loadFeed, loadFollows, navigate]);

  // Déconnexion
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUsername('');
    setIsVerified(false);
    setFeed([]);
    setFollows([]);
    setMessage('Déconnecté');
    socket.disconnect();
    navigate('/profile');
  }, [navigate]);

  return (
    <div className="home-container">
      {message && (
        <div className={`alert ${message.includes('Erreur') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
          {message}
          <button type="button" className="btn-close" onClick={() => setMessage('')} aria-label="Fermer"></button>
        </div>
      )}
      <nav className="navbar fixed-bottom navbar-dark bg-dark">
        <div className="container-fluid justify-content-center">
          <button
            className="btn btn-primary mx-2"
            onClick={() => navigate('/')}
            aria-label="Fil d’actualité"
          >
            <FaHome size={24} />
          </button>
          <button
            className="btn btn-outline-light mx-2"
            onClick={() => navigate('/profile')}
            aria-label="Profil"
          >
            <FaUserCircle size={24} />
          </button>
          <button
            className="btn btn-outline-danger mx-2"
            onClick={handleLogout}
            disabled={loading}
            aria-label="Se déconnecter"
          >
            <FaSignOutAlt size={24} />
          </button>
        </div>
      </nav>

      <div className="tiktok-feed">
        {feed.length === 0 ? (
          <div className="no-content">
            <p className="text-muted">Aucun média dans votre fil. Suivez des utilisateurs pour voir leurs contenus.</p>
          </div>
        ) : (
          feed.map((media, index) => (
            <div key={media._id} className="tiktok-media">
              {media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                <img
                  src={`${API_URL}/uploads/${media.filename}`}
                  alt={media.originalname}
                  className="tiktok-media-content"
                />
              ) : (
                <video
                  ref={(el) => (videoRefs.current[index] = el)}
                  src={`${API_URL}/uploads/${media.filename}`}
                  className="tiktok-media-content"
                  loop
                  muted
                  playsInline
                />
              )}
              <div className="tiktok-overlay">
                <div className="tiktok-info">
                  <h5 className="text-white text-truncate">{media.originalname}</h5>
                  <p className="text-white small">
                    Par : {media.owner?.username || media.owner?.email || 'Utilisateur inconnu'}
                  </p>
                  <p className="text-white small">
                    Uploadé le : {new Date(media.uploadedAt).toLocaleString()}
                  </p>
                  <p className="text-white small">
                    <FaThumbsUp className="me-1" /> {media.likesCount} Like{media.likesCount !== 1 ? 's' : ''}
                    <span className="ms-3">
                      <FaThumbsDown className="me-1" /> {media.dislikesCount} Dislike{media.dislikesCount !== 1 ? 's' : ''}
                    </span>
                  </p>
                  <div className="comments-section">
                    <h6 className="text-white small">Commentaires :</h6>
                    {media.comments && media.comments.length > 0 ? (
                      media.comments.map((comment, idx) => (
                        <p key={idx} className="text-white small mb-1">
                          <strong>{comment.author?.username || 'Utilisateur'} :</strong> {comment.content}
                          <br />
                          <small>{new Date(comment.createdAt).toLocaleString()}</small>
                        </p>
                      ))
                    ) : (
                      <p className="text-white small">Aucun commentaire</p>
                    )}
                    <div className="input-group mt-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Ajouter un commentaire..."
                        value={commentInput[media._id] || ''}
                        onChange={(e) =>
                          setCommentInput((prev) => ({ ...prev, [media._id]: e.target.value }))
                        }
                        disabled={!isVerified || loading || submittingComment[media._id]}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => addComment(media._id)}
                        disabled={!isVerified || loading || submittingComment[media._id] || !commentInput[media._id]?.trim()}
                        aria-label="Envoyer le commentaire"
                      >
                        <FaComment />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="tiktok-actions">
                  {media.owner?.username === username && (
                    <button
                      className="btn btn-danger btn-sm rounded-circle mb-2"
                      onClick={() => deleteMedia(media._id)}
                      disabled={!isVerified || loading}
                      aria-label="Supprimer le média"
                    >
                      <FaTrash />
                    </button>
                  )}
                  {media.owner && media.owner._id !== parseJwt(token)?.userId && (
                    <>
                      {media.isLiked ? (
                        <button
                          className="btn btn-danger btn-sm rounded-circle mb-2"
                          onClick={() => unlikeMedia(media._id)}
                          disabled={!isVerified || loading}
                          aria-label="Retirer le like"
                        >
                          <FaThumbsUp />
                        </button>
                      ) : (
                        <button
                          className="btn btn-outline-danger btn-sm rounded-circle mb-2"
                          onClick={() => likeMedia(media._id)}
                          disabled={!isVerified || loading}
                          aria-label="Aimer le média"
                        >
                          <FaThumbsUp />
                        </button>
                      )}
                      {media.isDisliked ? (
                        <button
                          className="btn btn-warning btn-sm rounded-circle mb-2"
                          onClick={() => undislikeMedia(media._id)}
                          disabled={!isVerified || loading}
                          aria-label="Retirer le dislike"
                        >
                          <FaThumbsDown />
                        </button>
                      ) : (
                        <button
                          className="btn btn-outline-warning btn-sm rounded-circle mb-2"
                          onClick={() => dislikeMedia(media._id)}
                          disabled={!isVerified || loading}
                          aria-label="Marquer comme non apprécié"
                        >
                          <FaThumbsDown />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
