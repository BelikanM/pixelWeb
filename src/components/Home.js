import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { Button, Form, Alert, Card } from 'react-bootstrap';
import './Home.css';

const API_URL = 'http://localhost:5000';
const socket = io(API_URL, { autoConnect: false });

const Home = () => {
  const [feed, setFeed] = useState([]);
  const [message, setMessage] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newCommentMedia, setNewCommentMedia] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const videoRefs = useRef(new Map());
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Récupérer le fil des médias
    axios
      .get(`${API_URL}/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setFeed(response.data);
      })
      .catch((error) => {
        console.error('Erreur chargement feed:', error);
        setMessage(error.response?.data.message || 'Erreur lors du chargement du fil');
      });

    // Connexion WebSocket
    socket.auth = { token };
    socket.connect();

    // Événements WebSocket
    socket.on('newMedia', ({ media }) => {
      setFeed((prev) => [media, ...prev]);
    });

    socket.on('likeUpdate', ({ mediaId, likesCount, dislikesCount, userId }) => {
      setFeed((prev) =>
        prev.map((m) =>
          m._id === mediaId
            ? {
                ...m,
                likesCount,
                dislikesCount,
                isLiked: userId === localStorage.getItem('userId') ? true : m.isLiked,
                isDisliked: userId === localStorage.getItem('userId') ? false : m.isDisliked,
              }
            : m
        )
      );
    });

    socket.on('unlikeUpdate', ({ mediaId, likesCount, dislikesCount, userId }) => {
      setFeed((prev) =>
        prev.map((m) =>
          m._id === mediaId
            ? {
                ...m,
                likesCount,
                dislikesCount,
                isLiked: userId === localStorage.getItem('userId') ? false : m.isLiked,
              }
            : m
        )
      );
    });

    socket.on('dislikeUpdate', ({ mediaId, likesCount, dislikesCount, userId }) => {
      setFeed((prev) =>
        prev.map((m) =>
          m._id === mediaId
            ? {
                ...m,
                likesCount,
                dislikesCount,
                isDisliked: userId === localStorage.getItem('userId') ? true : m.isDisliked,
                isLiked: userId === localStorage.getItem('userId') ? false : m.isLiked,
              }
            : m
        )
      );
    });

    socket.on('undislikeUpdate', ({ mediaId, likesCount, dislikesCount, userId }) => {
      setFeed((prev) =>
        prev.map((m) =>
          m._id === mediaId
            ? {
                ...m,
                likesCount,
                dislikesCount,
                isDisliked: userId === localStorage.getItem('userId') ? false : m.isDisliked,
              }
            : m
        )
      );
    });

    socket.on('commentUpdate', ({ mediaId, comment }) => {
      setFeed((prev) =>
        prev.map((m) => (m._id === mediaId ? { ...m, comments: [...m.comments, comment] } : m))
      );
    });

    socket.on('commentDeleted', ({ mediaId, commentId }) => {
      setFeed((prev) =>
        prev.map((m) =>
          m._id === mediaId ? { ...m, comments: m.comments.filter((c) => c._id !== commentId) } : m
        )
      );
    });

    socket.on('mediaDeleted', ({ mediaId }) => {
      setFeed((prev) => prev.filter((m) => m._id !== mediaId));
    });

    // Gestion de l'intersection pour jouer les vidéos visibles
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target;
          if (entry.isIntersecting) {
            video.play();
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observer les vidéos
    videoRefs.current.forEach((video) => {
      observer.observe(video);
    });

    return () => {
      socket.disconnect();
      videoRefs.current.forEach((video) => observer.unobserve(video));
    };
  }, [navigate]);

  const handleLike = async (mediaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/like/${mediaId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMessage(response.data.message);
    } catch (error) {
      console.error('Erreur like:', error);
      setMessage(error.response?.data.message || 'Erreur lors du like');
    }
  };

  const handleUnlike = async (mediaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_URL}/like/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
    } catch (error) {
      console.error('Erreur unlike:', error);
      setMessage(error.response?.data.message || 'Erreur lors du retrait du like');
    }
  };

  const handleDislike = async (mediaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/dislike/${mediaId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMessage(response.data.message);
    } catch (error) {
      console.error('Erreur dislike:', error);
      setMessage(error.response?.data.message || 'Erreur lors du dislike');
    }
  };

  const handleUndislike = async (mediaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_URL}/dislike/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
    } catch (error) {
      console.error('Erreur undislike:', error);
      setMessage(error.response?.data.message || 'Erreur lors du retrait du dislike');
    }
  };

  const handleComment = async (mediaId) => {
    if (!newComment && !newCommentMedia) {
      setMessage('Le commentaire ou le média ne peut pas être vide');
      return;
    }

    const formData = new FormData();
    if (newComment) formData.append('content', newComment);
    if (newCommentMedia) formData.append('media', newCommentMedia);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/comment/${mediaId}`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setMessage(response.data.message);
      setNewComment('');
      setNewCommentMedia(null);
    } catch (error) {
      console.error('Erreur commentaire:', error);
      setMessage(error.response?.data.message || 'Erreur lors de l’ajout du commentaire');
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    videoRefs.current.forEach((video) => {
      video.muted = !isMuted;
    });
  };

  return (
    <div className="container mt-4">
      <h2>Fil d'actualités</h2>
      {message && <Alert variant="info">{message}</Alert>}
      <Button variant="secondary" onClick={toggleMute} className="mb-3">
        {isMuted ? 'Activer le son' : 'Désactiver le son'}
      </Button>
      <div className="row">
        {feed.map((media) => (
          <div key={media._id} className="col-md-4 mb-3">
            <Card>
              {media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                <img
                  src={media.filename}
                  className="card-img-top"
                  alt={media.originalname}
                  style={{ objectFit: 'cover', height: '180px' }}
                />
              ) : (
                <video
                  ref={(el) => {
                    if (el) videoRefs.current.set(media._id, el);
                    else videoRefs.current.delete(media._id);
                  }}
                  src={media.filename}
                  controls
                  muted={isMuted}
                  className="card-img-top"
                  style={{ height: '180px', objectFit: 'cover' }}
                />
              )}
              <Card.Body>
                <Card.Title>{media.originalname}</Card.Title>
                <Card.Text>
                  Par: {media.owner?.username || media.owner?.email}<br />
                  Likes: {media.likesCount} | Dislikes: {media.dislikesCount}
                </Card.Text>
                <Button
                  variant={media.isLiked ? 'success' : 'outline-success'}
                  onClick={() => (media.isLiked ? handleUnlike(media._id) : handleLike(media._id))}
                >
                  {media.isLiked ? 'Unlike' : 'Like'}
                </Button>
                <Button
                  variant={media.isDisliked ? 'warning' : 'outline-warning'}
                  onClick={() => (media.isDisliked ? handleUndislike(media._id) : handleDislike(media._id))}
                  className="ms-2"
                >
                  {media.isDisliked ? 'Undislike' : 'Dislike'}
                </Button>
                {media.owner.whatsappNumber && (
                  <Button
                    variant="info"
                    className="ms-2"
                    onClick={() =>
                      window.open(
                        `https://wa.me/${media.owner.whatsappNumber}?text=${encodeURIComponent(
                          media.owner.whatsappMessage || 'Salut !'
                        )}`
                      )
                    }
                  >
                    Contacter via WhatsApp
                  </Button>
                )}
                <div className="mt-3">
                  {media.comments.map((comment) => (
                    <div key={comment._id} className="border-top pt-2">
                      <p>
                        <strong>{comment.author.username || comment.author.email}</strong>: {comment.content}
                      </p>
                      {comment.media && (
                        <div>
                          {comment.media.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                            <img src={comment.media} alt="Comment media" style={{ maxWidth: '100px' }} />
                          ) : (
                            <video src={comment.media} controls style={{ maxWidth: '100px' }} />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <Form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleComment(media._id);
                    }}
                  >
                    <Form.Group controlId={`comment-${media._id}`} className="mb-2">
                      <Form.Control
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Ajouter un commentaire"
                      />
                    </Form.Group>
                    <Form.Group controlId={`comment-media-${media._id}`} className="mb-2">
                      <Form.Control
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => setNewCommentMedia(e.target.files[0])}
                      />
                    </Form.Group>
                    <Button variant="primary" type="submit">
                      Commenter
                    </Button>
                  </Form>
                </div>
              </Card.Body>
            </Card>
          </div>
        ))}
      </div>
      <Link to="/profile">Aller au profil</Link>
    </div>
  );
};

export default Home;
