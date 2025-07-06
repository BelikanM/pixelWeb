import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaTrash, FaThumbsUp, FaThumbsDown, FaComment, FaEdit, FaSmile, FaVolumeUp, FaVolumeMute, FaShare, FaWhatsapp } from 'react-icons/fa';
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
  const [actionLoading, setActionLoading] = useState({});
  const [commentInput, setCommentInput] = useState({});
  const [submittingComment, setSubmittingComment] = useState({});
  const [editingComment, setEditingComment] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(null);
  const videoRefs = useRef(new Map());
  const observerRef = useRef(null);
  const navigate = useNavigate();

  const emojis = ['😊', '👍', '❤️', '😂', '😍', '😢', '😎', '🙌'];

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

  const followUser = useCallback(
    async (id) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de suivre des utilisateurs');
        return;
      }
      setActionLoading((prev) => ({ ...prev, [`follow-${id}`]: true }));
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
        setActionLoading((prev) => ({ ...prev, [`follow-${id}`]: false }));
      }
    },
    [token, isVerified]
  );

  const unfollowUser = useCallback(
    async (id) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de modifier vos abonnements');
        return;
      }
      setActionLoading((prev) => ({ ...prev, [`unfollow-${id}`]: true }));
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
        setActionLoading((prev) => ({ ...prev, [`unfollow-${id}`]: false }));
      }
    },
    [token, isVerified]
  );

  const deleteMedia = useCallback(
    async (id) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de supprimer des médias');
        return;
      }
      if (!window.confirm('Supprimer ce média ?')) return;
      setActionLoading((prev) => ({ ...prev, [`delete-${id}`]: true }));
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
        setActionLoading((prev) => ({ ...prev, [`delete-${id}`]: false }));
      }
    },
    [token, isVerified]
  );

  const likeMedia = useCallback(
    async (mediaId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant d’aimer un média');
        return;
      }
      setActionLoading((prev) => ({ ...prev, [`like-${mediaId}`]: true }));
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
        setActionLoading((prev) => ({ ...prev, [`like-${mediaId}`]: false }));
      }
    },
    [token, isVerified]
  );

  const unlikeMedia = useCallback(
    async (mediaId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de retirer un like');
        return;
      }
      setActionLoading((prev) => ({ ...prev, [`unlike-${mediaId}`]: true }));
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
        setActionLoading((prev) => ({ ...prev, [`unlike-${mediaId}`]: false }));
      }
    },
    [token, isVerified]
  );

  const dislikeMedia = useCallback(
    async (mediaId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de marquer un média comme non apprécié');
        return;
      }
      setActionLoading((prev) => ({ ...prev, [`dislike-${mediaId}`]: true }));
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
        setActionLoading((prev) => ({ ...prev, [`dislike-${mediaId}`]: false }));
      }
    },
    [token, isVerified]
  );

  const undislikeMedia = useCallback(
    async (mediaId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de retirer un dislike');
        return;
      }
      setActionLoading((prev) => ({ ...prev, [`undislike-${mediaId}`]: true }));
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
        setActionLoading((prev) => ({ ...prev, [`undislike-${mediaId}`]: false }));
      }
    },
    [token, isVerified]
  );

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

  const deleteComment = useCallback(
    async (mediaId, commentId) => {
      if (!isVerified) {
        setMessage('Veuillez vérifier votre email avant de supprimer un commentaire');
        return;
      }
      if (!window.confirm('Supprimer ce commentaire ?')) return;
      setActionLoading((prev) => ({ ...prev, [`delete-comment-${mediaId}-${commentId}`]: true }));
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
        setActionLoading((prev) => ({ ...prev, [`delete-comment-${mediaId}-${commentId}`]: false }));
      }
    },
    [token, isVerified]
  );

  const addEmoji = (mediaId, emoji) => {
    setCommentInput((prev) => ({
      ...prev,
      [mediaId]: (prev[mediaId] || '') + emoji,
    }));
    setShowEmojiPicker(null);
  };

  const handleMediaChange = (mediaId, event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedMedia((prev) => ({ ...prev, [mediaId]: file }));
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    videoRefs.current.forEach((video) => {
      if (video) video.muted = !isMuted;
    });
  };

  const shareMedia = async (mediaId, mediaTitle) => {
    const media = feed.find((m) => m._id === mediaId);
    if (!media) return;
    const shareUrl = `${window.location.origin}/media/${mediaId}`;
    const shareData = {
      title: mediaTitle || media.originalname,
      text: media.owner?.whatsappMessage || 'Découvrez ce contenu sur Pixels Media !',
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setMessage('Contenu partagé avec succès !');
      } catch (error) {
        console.error('Erreur lors du partage:', error);
        setMessage('Erreur lors du partage');
      }
    } else {
      setShowShareMenu(showShareMenu === mediaId ? null : mediaId);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setMessage('Lien copié dans le presse-papiers !');
      setShowShareMenu(null);
    }).catch(() => {
      setMessage('Erreur lors de la copie du lien');
    });
  };

  const toggleVideoPlay = useCallback((mediaId) => {
    const video = videoRefs.current.get(mediaId);
    if (video) {
      if (video.paused) {
        video.play().catch((error) => {
          console.error(`Erreur lors de la lecture de la vidéo ${mediaId}:`, error);
          setMessage('Impossible de lire la vidéo. Veuillez réessayer.');
        });
      } else {
        video.pause();
      }
    }
  }, []);

  useEffect(() => {
    let currentPlayingVideo = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          const mediaId = video.dataset.mediaId;

          if (entry.isIntersecting && !isMuted) {
            if (currentPlayingVideo && currentPlayingVideo !== video) {
              currentPlayingVideo.pause();
            }
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
      { threshold: 0.6, rootMargin: '0px' }
    );

    observerRef.current = observer;

    videoRefs.current.forEach((video, mediaId) => {
      if (video) {
        observer.observe(video);
        video.muted = isMuted;
        video.addEventListener('error', () => {
          console.error(`Erreur de chargement de la vidéo ${mediaId}`);
          setMessage(`Impossible de charger la vidéo ${mediaId}. Vérifiez votre connexion ou le format du fichier.`);
        });
      }
    });

    return () => {
      videoRefs.current.forEach((video, mediaId) => {
        if (video) {
          observer.unobserve(video);
          video.removeEventListener('error', () => {});
        }
      });
      observer.disconnect();
    };
  }, [feed, isMuted]);

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
              owner: { ...owner, whatsappNumber: owner.whatsappNumber || '', whatsappMessage: owner.whatsappMessage || '' },
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
        className="btn btn-outline-light btn-sm position-fixed top-0 end-0 m-2 mute-button"
        onClick={toggleMute}
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
                <div className="media-wrapper">
                  {media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                    <Link to={`/media/${media._id}`} className="media-link">
                      <img
                        src={`${API_URL}/uploads/${media.filename}`}
                        alt={media.originalname}
                        className="tiktok-media-content"
                      />
                    </Link>
                  ) : (
                    <video
                      ref={(el) => {
                        if (el) {
                          videoRefs.current.set(media._id, el);
                          el.dataset.mediaId = media._id;
                        } else {
                          videoRefs.current.delete(media._id);
                        }
                      }}
                      src={`${API_URL}/uploads/${media.filename}`}
                      className="tiktok-media-content"
                      loop
                      playsInline
                      preload="metadata"
                      muted={isMuted}
                      onClick={() => toggleVideoPlay(media._id)}
                      onError={() => setMessage(`Erreur de chargement de la vidéo ${media._id}.`)}
                    />
                  )}
                </div>
                <div className="tiktok-overlay">
                  <div className="tiktok-info">
                    <h5 className="text-white text-truncate">
                      <Link to={`/media/${media._id}`} className="text-white text-decoration-none">
                        {media.originalname}
                      </Link>
                    </h5>
                    <p className="text-white small">
                      Par : {media.owner?.username || media.owner?.email || 'Utilisateur inconnu'}
                      {media.owner && media.owner._id.toString() !== parseJwt(token)?.userId && (
                        follows.includes(media.owner?._id.toString()) ? (
                          <button
                            className="btn btn-outline-warning btn-sm ms-2"
                            onClick={() => unfollowUser(media.owner._id)}
                            disabled={actionLoading[`unfollow-${media.owner._id}`]}
                            aria-label={`Se désabonner de ${media.owner?.username || media.owner?.email}`}
                          >
                            {actionLoading[`unfollow-${media.owner._id}`] ? (
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                                aria-hidden="true"
                              ></span>
                            ) : (
                              'Se désabonner'
                            )}
                          </button>
                        ) : (
                          <button
                            className="btn btn-outline-primary btn-sm ms-2"
                            onClick={() => followUser(media.owner._id)}
                            disabled={actionLoading[`follow-${media.owner._id}`]}
                            aria-label={`Suivre ${media.owner?.username || media.owner?.email}`}
                          >
                            {actionLoading[`follow-${media.owner._id}`] ? (
                              <span
                                className="spinner-border spinner-border-sm"
                                role="status"
                                aria-hidden="true"
                              ></span>
                            ) : (
                              'Suivre'
                            )}
                          </button>
                        )
                      )}
                    </p>
                    {media.owner?.whatsappNumber && (
                      <p className="text-white small">
                        <a
                          href={`https://wa.me/${media.owner.whatsappNumber}?text=${encodeURIComponent(
                            `${media.owner.whatsappMessage || 'Découvrez ce contenu sur Pixels Media !'} ${window.location.origin}/media/${media._id}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white"
                          aria-label={`Contacter ${media.owner?.username || media.owner?.email} sur WhatsApp`}
                        >
                          <FaWhatsapp className="me-1" /> Contacter via WhatsApp
                        </a>
                      </p>
                    )}
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
                                    disabled={actionLoading[`delete-comment-${media._id}-${comment._id}`]}
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
                            disabled={!isVerified || submittingComment[media._id]}
                          />
                          <button
                            className="btn btn-outline-light btn-sm"
                            onClick={() => setShowEmojiPicker(showEmojiPicker === media._id ? null : media._id)}
                            disabled={!isVerified || submittingComment[media._id]}
                            aria-label="Ajouter un emoji"
                          >
                            <FaSmile />
                          </button>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={(e) => handleMediaChange(media._id, e)}
                            disabled={!isVerified || submittingComment[media._id]}
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
                        className="btn btn-danger btn-sm rounded-circle mb-2 action-button"
                        onClick={() => deleteMedia(media._id)}
                        disabled={!isVerified || actionLoading[`delete-${media._id}`]}
                        aria-label="Supprimer le média"
                      >
                        <FaTrash />
                      </button>
                    )}
                    {media.owner && media.owner._id !== parseJwt(token)?.userId && (
                      <>
                        {media.isLiked ? (
                          <button
                            className="btn btn-danger btn-sm rounded-circle mb-2 action-button"
                            onClick={() => unlikeMedia(media._id)}
                            disabled={!isVerified || actionLoading[`unlike-${media._id}`]}
                            aria-label="Retirer le like"
                          >
                            <FaThumbsUp />
                          </button>
                        ) : (
                          <button
                            className="btn btn-outline-danger btn-sm rounded-circle mb-2 action-button"
                            onClick={() => likeMedia(media._id)}
                            disabled={!isVerified || actionLoading[`like-${media._id}`]}
                            aria-label="Aimer le média"
                          >
                            <FaThumbsUp />
                          </button>
                        )}
                        {media.isDisliked ? (
                          <button
                            className="btn btn-warning btn-sm rounded-circle mb-2 action-button"
                            onClick={() => undislikeMedia(media._id)}
                            disabled={!isVerified || actionLoading[`undislike-${media._id}`]}
                            aria-label="Retirer le dislike"
                          >
                            <FaThumbsDown />
                          </button>
                        ) : (
                          <button
                            className="btn btn-outline-warning btn-sm rounded-circle mb-2 action-button"
                            onClick={() => dislikeMedia(media._id)}
                            disabled={!isVerified || actionLoading[`dislike-${media._id}`]}
                            aria-label="Marquer comme non apprécié"
                          >
                            <FaThumbsDown />
                          </button>
                        )}
                        <div className="share-button-container position-relative">
                          <button
                            className="btn btn-outline-primary btn-sm rounded-circle mb-2 action-button"
                            onClick={() => shareMedia(media._id, media.originalname)}
                            disabled={!isVerified}
                            aria-label="Partager le média"
                          >
                            <FaShare />
                          </button>
                          {showShareMenu === media._id && (
                            <div className="share-menu position-absolute">
                              <button
                                className="btn btn-sm btn-outline-success w-100 mb-1"
                                onClick={() => {
                                  const shareUrl = `${window.location.origin}/media/${media._id}`;
                                  const message = `${media.owner?.whatsappMessage || 'Découvrez ce contenu sur Pixels Media !'} ${shareUrl}`;
                                  window.open(
                                    `https://wa.me/?text=${encodeURIComponent(message)}`,
                                    '_blank',
                                    'noopener,noreferrer'
                                  );
                                  setShowShareMenu(null);
                                }}
                              >
                                <FaWhatsapp /> WhatsApp
                              </button>
                              <button
                                className="btn btn-sm btn-outline-primary w-100 mb-1"
                                onClick={() => {
                                  const shareUrl = `${window.location.origin}/media/${media._id}`;
                                  window.open(
                                    `mailto:?subject=${encodeURIComponent(media.originalname)}&body=${encodeURIComponent(
                                      `${media.owner?.whatsappMessage || 'Découvrez ce contenu sur Pixels Media !'} ${shareUrl}`
                                    )}`,
                                    '_blank',
                                    'noopener,noreferrer'
                                  );
                                  setShowShareMenu(null);
                                }}
                              >
                                Email
                              </button>
                              <button
                                className="btn btn-sm btn-outline-secondary w-100"
                                onClick={() => copyToClipboard(`${window.location.origin}/media/${media._id}`)}
                              >
                                Copier le lien
                              </button>
                            </div>
                          )}
                        </div>
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
