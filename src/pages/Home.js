import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaTrash, FaThumbsUp, FaThumbsDown, FaComment, FaEdit, FaSmile, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
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
  const [submittingComment, setSubmittingComment] = useState({});
  const [editingComment, setEditingComment] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [isMuted, setIsMuted] = useState(false); // Global mute state
  const videoRefs = useRef(new Map()); // Map to store video refs by media ID
  const observerRef = useRef(null); // Store IntersectionObserver
  const navigate = useNavigate();

  // Liste d'emojis prédéfinis
  const emojis = ['😊', '👍', '❤️', '😂', '😍', '😢', '😎', '🙌'];

  // Demander la permission pour les notifications push et enregistrer l'abonnement
  const subscribeToPush = useCallback(async () => {
    if (!token || !isVerified) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('Permission de notification refusée');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.REACT_APP_VAPID_PUBLIC_KEY,
      });

      await fetch(`${API_URL}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: token,
        },
        body: JSON.stringify(subscription),
      });
      console.log('Abonnement aux notifications push enregistré');
    } catch (error) {
      console.error('Erreur lors de l’abonnement aux notifications push:', error);
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
      const mediaFile = selectedMedia[mediaId];
      if (!content && !mediaFile) {
        setMessage('Le commentaire ou le média ne peut pas être vide');
        return;
      }
      setSubmittingComment((prev) => ({ ...prev, [mediaId]: true }));
      try {
        console.log(`Envoi du commentaire pour média ${mediaId}: ${content || 'Média'}`);
        const formData = new FormData();
        if (content) formData.append('content', content);
        if (mediaFile) formData.append('media', mediaFile);
        const res = await fetch(`${API_URL}/comment/${mediaId}`, {
          method: 'POST',
          headers: { authorization: token },
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setCommentInput((prev) => ({ ...prev, [mediaId]: '' }));
          setSelectedMedia((prev) => ({ ...prev, [mediaId]: null }));
        } else {
          setMessage(data.message || 'Erreur lors de l’ajout du commentaire');
        }
      } catch {
        setMessage('Erreur réseau lors de l’ajout du commentaire');
      } finally {
        setSubmittingComment((prev) => ({ ...prev, [mediaId]: false }));
      }
    },
    [token, isVerified, commentInput, submittingComment, selectedMedia]
  );

  // Modifier un commentaire
  const editComment = useCallback(
    async (mediaId, commentId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de modifier un commentaire');
        return;
      }
      if (submittingComment[mediaId]) {
        console.log(`Modification de commentaire déjà en cours pour média ${mediaId}`);
        return;
      }
      const content = commentInput[mediaId]?.trim();
      const mediaFile = selectedMedia[mediaId];
      if (!content && !mediaFile) {
        setMessage('Le commentaire ou le média ne peut pas être vide');
        return;
      }
      setSubmittingComment((prev) => ({ ...prev, [mediaId]: true }));
      try {
        console.log(`Modification du commentaire ${commentId} pour média ${mediaId}`);
        const formData = new FormData();
        if (content) formData.append('content', content);
        if (mediaFile) formData.append('media', mediaFile);
        const res = await fetch(`${API_URL}/comment/${mediaId}/${commentId}`, {
          method: 'PUT',
          headers: { authorization: token },
          body: formData,
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
          setCommentInput((prev) => ({ ...prev, [mediaId]: '' }));
          setSelectedMedia((prev) => ({ ...prev, [mediaId]: null }));
          setEditingComment(null);
        } else {
          setMessage(data.message || 'Erreur lors de la modification du commentaire');
        }
      } catch {
        setMessage('Erreur réseau lors de la modification du commentaire');
      } finally {
        setSubmittingComment((prev) => ({ ...prev, [mediaId]: false }));
      }
    },
    [token, isVerified, commentInput, selectedMedia, submittingComment]
  );

  // Supprimer un commentaire
  const deleteComment = useCallback(
    async (mediaId, commentId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de supprimer un commentaire');
        return;
      }
      if (!window.confirm('Supprimer ce commentaire ?')) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/comment/${mediaId}/${commentId}`, {
          method: 'DELETE',
          headers: { authorization: token },
        });
        const data = await res.json();
        if (res.ok) {
          setMessage(data.message);
        } else {
          setMessage(data.message || 'Erreur lors de la suppression du commentaire');
        }
      } catch {
        setMessage('Erreur réseau lors de la suppression du commentaire');
      } finally {
        setLoading(false);
      }
    },
    [token, isVerified]
  );

  // Gérer la sélection d’un emoji
  const addEmoji = (mediaId, emoji) => {
    setCommentInput((prev) => ({
      ...prev,
      [mediaId]: (prev[mediaId] || '') + emoji,
    }));
    setShowEmojiPicker(null);
  };

  // Gérer la sélection d’un fichier média
  const handleMediaChange = (mediaId, event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedMedia((prev) => ({ ...prev, [mediaId]: file }));
    }
  };

  // Toggle mute state
  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    videoRefs.current.forEach((video) => {
      if (video) video.muted = !isMuted;
    });
  };

  // Gérer la lecture/pause automatique des vidéos
  useEffect(() => {
    let currentPlayingVideo = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          const mediaId = video.dataset.mediaId;

          if (entry.isIntersecting && !isMuted) {
            // Pause any currently playing video
            if (currentPlayingVideo && currentPlayingVideo !== video) {
              currentPlayingVideo.pause();
            }
            // Play the current video
            video.play().catch((error) => {
              console.error(`Erreur lors de la lecture de la vidéo ${mediaId}:`, error);
              setMessage('Impossible de lire la vidéo. Veuillez réessayer.');
            });
            currentPlayingVideo = video;
          } else {
            video.pause();
            if (currentPlayingVideo === video) {
              currentPlayingVideo = null;
            }
          }
        });
      },
      { threshold: 0.6, rootMargin: '0px' } // Adjusted threshold for smoother transitions
    );

    observerRef.current = observer;

    // Observe all video elements
    videoRefs.current.forEach((video, mediaId) => {
      if (video) {
        observer.observe(video);
        // Set initial mute state
        video.muted = isMuted;
        // Add error handler
        video.addEventListener('error', () => {
          console.error(`Erreur de chargement de la vidéo ${mediaId}`);
          setMessage(`Impossible de charger la vidéo ${mediaId}. Vérifiez votre connexion ou le format du fichier.`);
        });
      }
    });

    return () => {
      // Cleanup observer and event listeners
      videoRefs.current.forEach((video, mediaId) => {
        if (video) {
          observer.unobserve(video);
          video.removeEventListener('error', () => {});
        }
      });
      observer.disconnect();
    };
  }, [feed, isMuted]);

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
            {
              ...media,
              owner,
              likesCount: media.likes.length,
              dislikesCount: media.dislikes.length,
              isLiked: false,
              isDisliked: false,
            },
            ...prev,
          ]);
        }
      });

      socket.on('mediaDeleted', ({ mediaId }) => {
        setFeed((prev) => prev.filter((media) => media._id !== mediaId));
        // Remove video ref for deleted media
        videoRefs.current.delete(mediaId);
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
                          c._id?.toString() === comment._id?.toString() ||
                          (c.content === comment.content &&
                            c.media === comment.media &&
                            c.author._id.toString() === comment.author._id.toString() &&
                            new Date(c.createdAt).getTime() === new Date(comment.createdAt).getTime())
                        )
                    ),
                    comment,
                  ],
                }
              : media
          )
        );
        console.log(`Commentaire reçu via WebSocket pour média ${mediaId}: ${comment.content || 'Média'}`);
      });

      socket.on('commentDeleted', ({ mediaId, commentId }) => {
        setFeed((prev) =>
          prev.map((media) =>
            media._id === mediaId
              ? {
                  ...media,
                  comments: media.comments.filter((c) => c._id.toString() !== commentId),
                }
              : media
          )
        );
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
        socket.off('commentDeleted');
        socket.off('connect_error');
        socket.disconnect();
      };
    }
  }, [token, isVerified, follows, loadFeed]);

  // Chargement initial
  useEffect(() => {
    if (token) {
      loadProfile();
      if (isVerified) {
        loadFeed();
        loadFollows();
        subscribeToPush();
      }
    } else {
      navigate('/profile');
    }
  }, [token, isVerified, loadProfile, loadFeed, loadFollows, navigate, subscribeToPush]);

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
      <button
        className="btn btn-outline-light btn-sm position-fixed top-0 end-0 m-2"
        on onClick={toggleMute}
        aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
      >
        {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
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
        <div className="tiktok-feed">
          {feed.length === 0 ? (
            <div className="no-content">
              <p className="text-muted">Aucun média dans votre fil. Suivez des utilisateurs pour voir leurs contenus.</p>
            </div>
          ) : (
            feed.map((media) => (
              <div key={media._id} className="tiktok-media fade-in">
                {media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                  <img src={`${API_URL}/uploads/${media.filename}`} alt={media.originalname} className="tiktok-media-content" />
                ) : (
                  <video
                    ref={(el) => {
                      if (el) {
                        videoRefs.current.set(media._id, el);
                        el.dataset.mediaId = media._id; // Store mediaId for reference
                      } else {
                        videoRefs.current.delete(media._id); // Clean up when unmounted
                      }
                    }}
                    src={`${API_URL}/uploads/${media.filename}`}
                    className="tiktok-media-content"
                    loop
                    playsInline
                    preload="metadata"
                    volume={0.5}
                    muted={isMuted}
                    // controls // Uncomment to enable browser video controls
                    onError={() => setMessage(`Erreur de chargement de la vidéo ${media._id}.`)}
                  />
                )}
                <div className="tiktok-overlay">
                  <div className="tiktok-info">
                    <h5 className="text-white text-truncate">{media.originalname}</h5>
                    <p className="text-white small">
                      Par : {media.owner?.username || media.owner?.email || 'Utilisateur inconnu'}
                    </p>
                    <p className="text-white small">Uploadé le : {new Date(media.uploadedAt).toLocaleString()}</p>
                    <p className="text-white small">
                      <FaThumbsUp className="me-1" /> {media.likesCount} Like{media.likesCount !== 1 ? 's' : ''}
                      <span className="ms-3">
                        <FaThumbsDown className="me-1" /> {media.dislikesCount} Dislike{media.dislikesCount !== 1 ? 's' : ''}
                      </span>
                    </p>
                    <div className="comments-section">
                      <h6 className="text-white small">Commentaires ({media.comments?.length || 0}) :</h6>
                      <div className="comments-list">
                        {media.comments && media.comments.length > 0 ? (
                          media.comments.map((comment, idx) => (
                            <div key={comment._id || idx} className="comment-item">
                              <p className="text-white small mb-1">
                                <strong>{comment.author?.username || 'Utilisateur'} :</strong> {comment.content || ''}
                                {comment.media && (
                                  <div className="comment-media">
                                    {comment.media.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                      <img
                                        src={`${API_URL}/uploads/${comment.media}`}
                                        alt="Comment media"
                                        className="comment-media-content"
                                      />
                                    ) : (
                                      <video src={`${API_URL}/uploads/${comment.media}`} className="comment-media-content" controls />
                                    )}
                                  </div>
                                )}
                                <br />
                                <small>{new Date(comment.createdAt).toLocaleString()}</small>
                              </p>
                              {comment.author?._id.toString() === parseJwt(token)?.userId && (
                                <div className="comment-actions">
                                  <button
                                    className="btn btn-sm btn-outline-primary me-1"
                                    onClick={() => {
                                      setEditingComment({ mediaId: media._id, commentId: comment._id });
                                      setCommentInput((prev) => ({
                                        ...prev,
                                        [media._id]: comment.content || '',
                                      }));
                                      setSelectedMedia((prev) => ({ ...prev, [media._id]: null }));
                                    }}
                                    aria-label="Modifier le commentaire"
                                  >
                                    <FaEdit />
                                  </button>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => deleteComment(media._id, comment._id)}
                                    aria-label="Supprimer le commentaire"
                                  >
                                    <FaTrash />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-white small">Aucun commentaire</p>
                        )}
                      </div>
                      <div className="comment-input">
                        <div className="input-group">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Ajouter un commentaire..."
                            value={commentInput[media._id] || ''}
                            onChange={(e) => setCommentInput((prev) => ({ ...prev, [media._id]: e.target.value }))}
                            disabled={!isVerified || loading || submittingComment[media._id]}
                          />
                          <button
                            className="btn btn-outline-light btn-sm"
                            onClick={() => setShowEmojiPicker(showEmojiPicker === media._id ? null : media._id)}
                            disabled={!isVerified || loading || submittingComment[media._id]}
                            aria-label="Ajouter un emoji"
                          >
                            <FaSmile />
                          </button>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={(e) => handleMediaChange(media._id, e)}
                            disabled={!isVerified || loading || submittingComment[media._id]}
                            className="form-control form-control-sm"
                            style={{ display: 'none' }}
                            id={`media-upload-${media._id}`}
                          />
                          <label htmlFor={`media-upload-${media._id}`} className="btn btn-outline-light btn-sm" style={{ cursor: 'pointer' }}>
                            📎
                          </label>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() =>
                              editingComment?.mediaId === media._id
                                ? editComment(media._id, editingComment.commentId)
                                : addComment(media._id)
                            }
                            disabled={
                              !isVerified ||
                              loading ||
                              submittingComment[media._id] ||
                              (!commentInput[media._id]?.trim() && !selectedMedia[media._id])
                            }
                            aria-label={editingComment?.mediaId === media._id ? 'Modifier le commentaire' : 'Envoyer le commentaire'}
                          >
                            <FaComment />
                          </button>
                        </div>
                        {showEmojiPicker === media._id && (
                          <div className="emoji-picker">
                            {emojis.map((emoji) => (
                              <span key={emoji} className="emoji" onClick={() => addEmoji(media._id, emoji)}>
                                {emoji}
                              </span>
                            ))}
                          </div>
                        )}
                        {selectedMedia[media._id] && (
                          <div className="media-preview">
                            <p className="text-white small mb-1">Média sélectionné : {selectedMedia[media._id].name}</p>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => setSelectedMedia((prev) => ({ ...prev, [media._id]: null }))}
                            >
                              Annuler
                            </button>
                          </div>
                        )}
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
      )}
    </div>
  );
}
