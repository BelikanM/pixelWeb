import React, { useState, useEffect, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaThumbsUp, FaThumbsDown, FaComment, FaShare, FaPaperPlane, FaFileUpload, FaYoutube, FaTiktok, FaFacebook } from 'react-icons/fa';
import io from 'socket.io-client';

const API_URL = 'http://localhost:5000';
const socket = io(API_URL, { auth: { token: localStorage.getItem('token') } });

export default function Home() {
  const [feed, setFeed] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [points, setPoints] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [commentMedia, setCommentMedia] = useState(null);
  const [editCommentId, setEditCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [editCommentMedia, setEditCommentMedia] = useState(null);

  const loadFeed = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/feed`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setFeed(data);
        const userRes = await fetch(`${API_URL}/profile`, {
          headers: { Authorization: token },
        });
        const userData = await userRes.json();
        if (userRes.ok) setPoints(userData.points);
        else setError(userData.message);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur lors du chargement du fil.');
    }
  }, [token]);

  useEffect(() => {
    loadFeed();

    socket.on('newMedia', ({ media }) => {
      setFeed(prev => [media, ...prev]);
    });
    socket.on('mediaDeleted', ({ mediaId }) => {
      setFeed(prev => prev.filter(m => m._id !== mediaId));
    });
    socket.on('likeUpdate', ({ mediaId, likesCount, dislikesCount, userId }) => {
      setFeed(prev =>
        prev.map(media =>
          media._id === mediaId
            ? { ...media, likesCount, dislikesCount, isLiked: userId === parseJwt(token)?.userId }
            : media
        )
      );
    });
    socket.on('dislikeUpdate', ({ mediaId, likesCount, dislikesCount, userId }) => {
      setFeed(prev =>
        prev.map(media =>
          media._id === mediaId
            ? { ...media, likesCount, dislikesCount, isDisliked: userId === parseJwt(token)?.userId }
            : media
        )
      );
    });
    socket.on('commentUpdate', ({ mediaId, comment }) => {
      setFeed(prev =>
        prev.map(media =>
          media._id === mediaId ? { ...media, comments: [...media.comments, comment] } : media
        )
      );
    });
    socket.on('commentDeleted', ({ mediaId, commentId }) => {
      setFeed(prev =>
        prev.map(media =>
          media._id === mediaId
            ? { ...media, comments: media.comments.filter(c => c._id !== commentId) }
            : media
        )
      );
    });
    socket.on('pointsUpdate', ({ points }) => {
      setPoints(points);
    });

    return () => {
      socket.off('newMedia');
      socket.off('mediaDeleted');
      socket.off('likeUpdate');
      socket.off('dislikeUpdate');
      socket.off('commentUpdate');
      socket.off('commentDeleted');
      socket.off('pointsUpdate');
    };
  }, [loadFeed]);

  const parseJwt = token => {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch {
      return null;
    }
  };

  const handleLike = async mediaId => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/like/${mediaId}`, {
        method: 'POST',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setFeed(prev =>
          prev.map(media =>
            media._id === mediaId
              ? { ...media, likesCount: data.likesCount, dislikesCount: data.dislikesCount, isLiked: true }
              : media
          )
        );
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlike = async mediaId => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/like/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setFeed(prev =>
          prev.map(media =>
            media._id === mediaId
              ? { ...media, likesCount: data.likesCount, dislikesCount: data.dislikesCount, isLiked: false }
              : media
          )
        );
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleDislike = async mediaId => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/dislike/${mediaId}`, {
        method: 'POST',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setFeed(prev =>
          prev.map(media =>
            media._id === mediaId
              ? { ...media, likesCount: data.likesCount, dislikesCount: data.dislikesCount, isDisliked: true }
              : media
          )
        );
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleUndislike = async mediaId => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/dislike/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setFeed(prev =>
          prev.map(media =>
            media._id === mediaId
              ? { ...media, likesCount: data.likesCount, dislikesCount: data.dislikesCount, isDisliked: false }
              : media
          )
        );
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleComment = async (mediaId, e) => {
    e.preventDefault();
    if (!commentText.trim() && !commentMedia) {
      setError('Le commentaire doit contenir du texte ou un média.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    const formData = new FormData();
    if (commentText.trim()) formData.append('content', commentText);
    if (commentMedia) formData.append('media', commentMedia);

    try {
      const res = await fetch(`${API_URL}/comment/${mediaId}`, {
        method: 'POST',
        headers: { Authorization: token },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setFeed(prev =>
          prev.map(media =>
            media._id === mediaId ? { ...media, comments: data.comments } : media
          )
        );
        setCommentText('');
        setCommentMedia(null);
        setPoints(data.points);
        setSuccess('Commentaire ajouté !');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditComment = async (mediaId, commentId) => {
    if (!editCommentText.trim() && !editCommentMedia) {
      setError('Le commentaire doit contenir du texte ou un média.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    const formData = new FormData();
    if (editCommentText.trim()) formData.append('content', editCommentText);
    if (editCommentMedia) formData.append('media', editCommentMedia);

    try {
      const res = await fetch(`${API_URL}/comment/${mediaId}/${commentId}`, {
        method: 'PUT',
        headers: { Authorization: token },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setFeed(prev =>
          prev.map(media =>
            media._id === mediaId ? { ...media, comments: data.comments } : media
          )
        );
        setEditCommentId(null);
        setEditCommentText('');
        setEditCommentMedia(null);
        setSuccess('Commentaire modifié !');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (mediaId, commentId) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/comment/${mediaId}/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setFeed(prev =>
          prev.map(media =>
            media._id === mediaId
              ? { ...media, comments: data.comments }
              : media
          )
        );
        setSuccess('Commentaire supprimé !');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = media => {
    const shareUrl = `${API_URL}/media/${media._id}`;
    const message = encodeURIComponent(`${media.owner?.whatsappMessage || 'Découvrez ce contenu sur Pixels Media !'} ${shareUrl}`);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleAction = async (mediaId, actionType, platform) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/action/${mediaId}/${actionType}/${platform}`, {
        method: 'POST',
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        const actionUrl = data.actionUrl;
        const newWindow = window.open(actionUrl, '_blank');
        if (newWindow) {
          setTimeout(async () => {
            try {
              const validateRes = await fetch(`${API_URL}/validate-action/${actionUrl.split('actionToken=')[1]}`, {
                method: 'POST',
                headers: { Authorization: token },
              });
              const validateData = await validateRes.json();
              if (validateRes.ok) {
                setPoints(validateData.points);
                setSuccess(`Action ${actionType} validée ! +${actionType === 'follow' ? 100 : 50} points`);
              } else {
                setError(validateData.message);
              }
            } catch (err) {
              setError('Erreur lors de la validation de l’action.');
            }
          }, actionType === 'view' ? 60000 : 5000); // 60s pour view, 5s pour like/follow
        } else {
          setError('Veuillez autoriser les pop-ups pour effectuer cette action.');
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const renderMedia = media => {
    const isImage = media.filename?.match(/\.(jpg|jpeg|png|gif)$/i);
    const userId = parseJwt(token)?.userId;
    return (
      <div key={media._id} className="card mb-3">
        <div className="card-body">
          <h5 className="card-title">{media.originalname}</h5>
          <p className="card-text">
            Par : {media.owner?.username || media.owner?.email}
            {media.owner?.profilePicture && (
              <img
                src={media.owner.profilePicture}
                alt={media.owner?.username}
                className="rounded-circle ml-2"
                style={{ width: '30px', height: '30px' }}
              />
            )}
          </p>
          {media.filename && (
            isImage ? (
              <img src={media.filename} alt={media.originalname} className="img-fluid" />
            ) : (
              <video controls className="w-100">
                <source src={media.filename} type="video/mp4" />
                Votre navigateur ne supporte pas la lecture de vidéos.
              </video>
            )
          )}
          {media.youtubeUrl && (
            <div className="mt-2">
              <a
                href="#"
                onClick={() => handleAction(media._id, 'view', 'youtube')}
                className="btn btn-danger btn-sm mr-2"
              >
                <FaYoutube /> Voir sur YouTube
              </a>
              <button
                onClick={() => handleAction(media._id, 'like', 'youtube')}
                className="btn btn-primary btn-sm mr-2"
              >
                <FaThumbsUp /> Like (50 points)
              </button>
              <button
                onClick={() => handleAction(media._id, 'follow', 'youtube')}
                className="btn btn-success btn-sm"
              >
                <FaUserPlus /> S’abonner (100 points)
              </button>
            </div>
          )}
          {media.tiktokUrl && (
            <div className="mt-2">
              <a
                href="#"
                onClick={() => handleAction(media._id, 'view', 'tiktok')}
                className="btn btn-dark btn-sm mr-2"
              >
                <FaTiktok /> Voir sur TikTok
              </a>
              <button
                onClick={() => handleAction(media._id, 'like', 'tiktok')}
                className="btn btn-primary btn-sm mr-2"
              >
                <FaThumbsUp /> Like (50 points)
              </button>
              <button
                onClick={() => handleAction(media._id, 'follow', 'tiktok')}
                className="btn btn-success btn-sm"
              >
                <FaUserPlus /> S’abonner (100 points)
              </button>
            </div>
          )}
          {media.facebookUrl && (
            <div className="mt-2">
              <a
                href="#"
                onClick={() => handleAction(media._id, 'view', 'facebook')}
                className="btn btn-primary btn-sm mr-2"
              >
                <FaFacebook /> Voir sur Facebook
              </a>
              <button
                onClick={() => handleAction(media._id, 'like', 'facebook')}
                className="btn btn-primary btn-sm mr-2"
              >
                <FaThumbsUp /> Like (50 points)
              </button>
              <button
                onClick={() => handleAction(media._id, 'follow', 'facebook')}
                className="btn btn-success btn-sm"
              >
                <FaUserPlus /> S’abonner (100 points)
              </button>
            </div>
          )}
          <div className="mt-2">
            <button
              className={`btn btn-sm mr-2 ${media.isLiked ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => (media.isLiked ? handleUnlike(media._id) : handleLike(media._id))}
              disabled={loading}
            >
              <FaThumbsUp /> {media.likesCount || 0}
            </button>
            <button
              className={`btn btn-sm mr-2 ${media.isDisliked ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={() => (media.isDisliked ? handleUndislike(media._id) : handleDislike(media._id))}
              disabled={loading}
            >
              <FaThumbsDown /> {media.dislikesCount || 0}
            </button>
            <button
              className="btn btn-outline-primary btn-sm mr-2"
              onClick={() => setEditCommentId(`new-${media._id}`)}
              disabled={loading}
            >
              <FaComment /> Commenter
            </button>
            <button
              className="btn btn-outline-info btn-sm"
              onClick={() => handleShare(media)}
            >
              <FaShare /> Partager
            </button>
          </div>
          {editCommentId === `new-${media._id}` && (
            <form onSubmit={e => handleComment(media._id, e)} className="mt-3">
              <div className="mb-3">
                <textarea
                  className="form-control"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Votre commentaire..."
                ></textarea>
              </div>
              <div className="mb-3">
                <input
                  type="file"
                  className="form-control"
                  accept="image/*,video/*"
                  onChange={e => setCommentMedia(e.target.files[0])}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm mr-2" disabled={loading}>
                <FaPaperPlane /> Envoyer
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEditCommentId(null);
                  setCommentText('');
                  setCommentMedia(null);
                }}
              >
                Annuler
              </button>
            </form>
          )}
          <div className="mt-3">
            <h6>Commentaires :</h6>
            {media.comments?.map(comment => (
              <div key={comment._id} className="border-top pt-2">
                <p>
                  <strong>{comment.author?.username || 'Anonyme'}</strong> ({new Date(comment.createdAt).toLocaleString()}):
                </p>
                {comment.content && <p>{comment.content}</p>}
                {comment.media && (
                  comment.media.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                    <img src={comment.media} alt="Comment media" className="img-fluid" style={{ maxWidth: '200px' }} />
                  ) : (
                    <video controls className="w-100" style={{ maxWidth: '200px' }}>
                      <source src={comment.media} type="video/mp4" />
                      Votre navigateur ne supporte pas la lecture de vidéos.
                    </video>
                  )
                )}
                {comment.author?._id === userId && (
                  <div>
                    <button
                      className="btn btn-warning btn-sm mr-2"
                      onClick={() => {
                        setEditCommentId(comment._id);
                        setEditCommentText(comment.content || '');
                        setEditCommentMedia(null);
                      }}
                    >
                      Modifier
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteComment(media._id, comment._id)}
                    >
                      Supprimer
                    </button>
                  </div>
                )}
                {editCommentId === comment._id && (
                  <form onSubmit={() => handleEditComment(media._id, comment._id)} className="mt-2">
                    <div className="mb-3">
                      <textarea
                        className="form-control"
                        value={editCommentText}
                        onChange={e => setEditCommentText(e.target.value)}
                        placeholder="Modifier votre commentaire..."
                      ></textarea>
                    </div>
                    <div className="mb-3">
                      <input
                        type="file"
                        className="form-control"
                        accept="image/*,video/*"
                        onChange={e => setEditCommentMedia(e.target.files[0])}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm mr-2" disabled={loading}>
                      <FaPaperPlane /> Enregistrer
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditCommentId(null);
                        setEditCommentText('');
                        setEditCommentMedia(null);
                      }}
                    >
                      Annuler
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (!token) {
    return (
      <div className="container mt-5">
        <h2>Veuillez vous connecter</h2>
        <p>Vous devez être connecté pour voir le fil.</p>
        <a href="/login" className="btn btn-primary">Se connecter</a>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <h2>Fil des abonnements ({points} points = {points} FCFA)</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {feed.length === 0 ? (
        <p>Aucun contenu à afficher. Abonnez-vous à des utilisateurs pour voir leur contenu.</p>
      ) : (
        feed.map(renderMedia)
      )}
    </div>
  );
}
