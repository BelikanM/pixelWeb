import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Form, Tab, Tabs, Alert } from 'react-bootstrap';
import io from 'socket.io-client';
import './Profile.css';

const API_URL = 'http://localhost:5000';
const socket = io(API_URL, { autoConnect: false });

const Profile = () => {
  const [user, setUser] = useState(null);
  const [medias, setMedias] = useState([]);
  const [feed, setFeed] = useState([]);
  const [users, setUsers] = useState([]);
  const [follows, setFollows] = useState([]);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [username, setUsername] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [editComment, setEditComment] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [newCommentMedia, setNewCommentMedia] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Récupérer le profil utilisateur
    axios.get(`${API_URL}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(response => {
      setUser(response.data);
      setUsername(response.data.username);
      setWhatsappNumber(response.data.whatsappNumber);
      setWhatsappMessage(response.data.whatsappMessage);
    }).catch(error => {
      console.error('Erreur chargement profil:', error);
      setMessage('Erreur lors du chargement du profil');
    });

    // Récupérer les médias de l'utilisateur
    axios.get(`${API_URL}/my-medias`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(response => {
      setMedias(response.data);
    }).catch(error => {
      console.error('Erreur chargement médias:', error);
      setMessage('Erreur lors du chargement des médias');
    });

    // Récupérer le feed
    axios.get(`${API_URL}/feed`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(response => {
      setFeed(response.data);
    }).catch(error => {
      console.error('Erreur chargement feed:', error);
      setMessage('Erreur lors du chargement du fil');
    });

    // Récupérer la liste des utilisateurs
    axios.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(response => {
      setUsers(response.data);
    }).catch(error => {
      console.error('Erreur chargement utilisateurs:', error);
      setMessage('Erreur lors du chargement des utilisateurs');
    });

    // Récupérer la liste des followings
    axios.get(`${API_URL}/follows`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(response => {
      setFollows(response.data);
    }).catch(error => {
      console.error('Erreur chargement followings:', error);
      setMessage('Erreur lors du chargement des abonnements');
    });

    socket.auth = { token };
    socket.connect();

    socket.on('newMedia', ({ media }) => {
      setFeed(prev => [media, ...prev]);
    });

    socket.on('likeUpdate', ({ mediaId, likesCount, dislikesCount }) => {
      setMedias(prev => prev.map(m => m._id === mediaId ? { ...m, likesCount, dislikesCount } : m));
      setFeed(prev => prev.map(m => m._id === mediaId ? { ...m, likesCount, dislikesCount } : m));
    });

    socket.on('unlikeUpdate', ({ mediaId, likesCount, dislikesCount }) => {
      setMedias(prev => prev.map(m => m._id === mediaId ? { ...m, likesCount, dislikesCount } : m));
      setFeed(prev => prev.map(m => m._id === mediaId ? { ...m, likesCount, dislikesCount } : m));
    });

    socket.on('dislikeUpdate', ({ mediaId, likesCount, dislikesCount }) => {
      setMedias(prev => prev.map(m => m._id === mediaId ? { ...m, likesCount, dislikesCount } : m));
      setFeed(prev => prev.map(m => m._id === mediaId ? { ...m, likesCount, dislikesCount } : m));
    });

    socket.on('undislikeUpdate', ({ mediaId, likesCount, dislikesCount }) => {
      setMedias(prev => prev.map(m => m._id === mediaId ? { ...m, likesCount, dislikesCount } : m));
      setFeed(prev => prev.map(m => m._id === mediaId ? { ...m, likesCount, dislikesCount } : m));
    });

    socket.on('commentUpdate', ({ mediaId, comment }) => {
      setMedias(prev => prev.map(m => m._id === mediaId ? { ...m, comments: [...m.comments, comment] } : m));
      setFeed(prev => prev.map(m => m._id === mediaId ? { ...m, comments: [...m.comments, comment] } : m));
    });

    socket.on('commentDeleted', ({ mediaId, commentId }) => {
      setMedias(prev => prev.map(m => m._id === mediaId ? { ...m, comments: m.comments.filter(c => c._id !== commentId) } : m));
      setFeed(prev => prev.map(m => m._id === mediaId ? { ...m, comments: m.comments.filter(c => c._id !== commentId) } : m));
    });

    socket.on('mediaDeleted', ({ mediaId }) => {
      setMedias(prev => prev.filter(m => m._id !== mediaId));
      setFeed(prev => prev.filter(m => m._id !== mediaId));
    });

    socket.on('followUpdate', ({ followingId }) => {
      axios.get(`${API_URL}/follows`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(response => {
        setFollows(response.data);
      });
    });

    socket.on('unfollowUpdate', ({ unfollowedId }) => {
      axios.get(`${API_URL}/follows`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(response => {
        setFollows(response.data);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [navigate]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage('Veuillez sélectionner un fichier');
      return;
    }

    const formData = new FormData();
    formData.append('media', file);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setMessage(response.data.message);
      setMedias(prev => [response.data.media, ...prev]);
      setFile(null);
    } catch (error) {
      console.error('Erreur upload:', error);
      setMessage(error.response?.data.message || 'Erreur lors de l’upload');
    }
  };

  const handleDelete = async (mediaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_URL}/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
    } catch (error) {
      console.error('Erreur suppression:', error);
      setMessage(error.response?.data.message || 'Erreur lors de la suppression');
    }
  };

  const handleLike = async (mediaId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/like/${mediaId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      const response = await axios.post(`${API_URL}/dislike/${mediaId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  const handleEditComment = async (mediaId, commentId) => {
    if (!newComment && !newCommentMedia) {
      setMessage('Le commentaire ou le média ne peut pas être vide');
      return;
    }

    const formData = new FormData();
    if (newComment) formData.append('content', newComment);
    if (newCommentMedia) formData.append('media', newCommentMedia);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API_URL}/comment/${mediaId}/${commentId}`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setMessage(response.data.message);
      setEditComment(null);
      setNewComment('');
      setNewCommentMedia(null);
    } catch (error) {
      console.error('Erreur modification commentaire:', error);
      setMessage(error.response?.data.message || 'Erreur lors de la modification du commentaire');
    }
  };

  const handleDeleteComment = async (mediaId, commentId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_URL}/comment/${mediaId}/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
    } catch (error) {
      console.error('Erreur suppression commentaire:', error);
      setMessage(error.response?.data.message || 'Erreur lors de la suppression du commentaire');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API_URL}/profile`, {
        username,
        whatsappNumber,
        whatsappMessage,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
      setUser(response.data.user);
    } catch (error) {
      console.error('Erreur mise à jour profil:', error);
      setMessage(error.response?.data.message || 'Erreur lors de la mise à jour du profil');
    }
  };

  const handleFollow = async (followingId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/follow`, { followingId }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessage(response.data.message);
    } catch (error) {
      console.error('Erreur follow:', error);
      setMessage(error.response?.data.message || 'Erreur lors de l’abonnement');
    }
  };

  const handleUnfollow = async (followingId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_URL}/follow`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { followingId },
      });
      setMessage(response.data.message);
    } catch (error) {
      console.error('Erreur unfollow:', error);
      setMessage(error.response?.data.message || 'Erreur lors du désabonnement');
    }
  };

  return (
    <div className="container mt-4">
      {message && <Alert variant="info">{message}</Alert>}
      <Tabs defaultActiveKey="upload" id="profile-tabs" className="mb-3">
        <Tab eventKey="upload" title="Uploader">
          <Form onSubmit={handleUpload}>
            <Form.Group controlId="formFile" className="mb-3">
              <Form.Label>Sélectionner un fichier</Form.Label>
              <Form.Control type="file" accept="image/*,video/*" onChange={handleFileChange} />
            </Form.Group>
            <Button variant="primary" type="submit">Uploader</Button>
          </Form>
        </Tab>
        <Tab eventKey="myMedias" title="Mes Médias">
          <div className="row">
            {medias.map(media => (
              <div key={media._id} className="col-md-4 mb-3">
                <Card>
                  {media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                    <img src={media.filename} className="card-img-top" alt={media.originalname} style={{ objectFit: 'cover', height: '180px' }} />
                  ) : (
                    <video src={media.filename} controls className="card-img-top" style={{ height: '180px', objectFit: 'cover' }} />
                  )}
                  <Card.Body>
                    <Card.Title>{media.originalname}</Card.Title>
                    <Button variant="danger" onClick={() => handleDelete(media._id)}>Supprimer</Button>
                  </Card.Body>
                </Card>
              </div>
            ))}
          </div>
        </Tab>
        <Tab eventKey="feed" title="Fil">
          <div className="row">
            {feed.map(media => (
              <div key={media._id} className="col-md-4 mb-3">
                <Card>
                  {media.filename.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                    <img src={media.filename} className="card-img-top" alt={media.originalname} style={{ objectFit: 'cover', height: '180px' }} />
                  ) : (
                    <video src={media.filename} controls className="card-img-top" style={{ height: '180px', objectFit: 'cover' }} />
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
                        onClick={() => window.open(`https://wa.me/${media.owner.whatsappNumber}?text=${encodeURIComponent(media.owner.whatsappMessage || 'Salut !')}`)}
                      >
                        Contacter via WhatsApp
                      </Button>
                    )}
                    <div className="mt-3">
                      {media.comments.map(comment => (
                        <div key={comment._id} className="border-top pt-2">
                          <p><strong>{comment.author.username || comment.author.email}</strong>: {comment.content}</p>
                          {comment.media && (
                            <div>
                              {comment.media.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                                <img src={comment.media} alt="Comment media" style={{ maxWidth: '100px' }} />
                              ) : (
                                <video src={comment.media} controls style={{ maxWidth: '100px' }} />
                              )}
                            </div>
                          )}
                          {comment.author._id === user?._id && (
                            <>
                              <Button variant="link" onClick={() => setEditComment(comment._id)}>Modifier</Button>
                              <Button variant="link" onClick={() => handleDeleteComment(media._id, comment._id)}>Supprimer</Button>
                            </>
                          )}
                          {editComment === comment._id && (
                            <Form onSubmit={(e) => { e.preventDefault(); handleEditComment(media._id, comment._id); }}>
                              <Form.Group controlId="editCommentContent">
                                <Form.Control
                                  type="text"
                                  value={newComment}
                                  onChange={(e) => setNewComment(e.target.value)}
                                  placeholder="Modifier le commentaire"
                                />
                              </Form.Group>
                              <Form.Group controlId="editCommentMedia">
                                <Form.Control type="file" accept="image/*,video/*" onChange={(e) => setNewCommentMedia(e.target.files[0])} />
                              </Form.Group>
                              <Button variant="primary" type="submit">Enregistrer</Button>
                              <Button variant="secondary" onClick={() => setEditComment(null)}>Annuler</Button>
                            </Form>
                          )}
                        </div>
                      ))}
                      <Form onSubmit={(e) => { e.preventDefault(); handleComment(media._id); }}>
                        <Form.Group controlId={`comment-${media._id}`}>
                          <Form.Control
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Ajouter un commentaire"
                          />
                        </Form.Group>
                        <Form.Group controlId={`comment-media-${media._id}`}>
                          <Form.Control type="file" accept="image/*,video/*" onChange={(e) => setNewCommentMedia(e.target.files[0])} />
                        </Form.Group>
                        <Button variant="primary" type="submit">Commenter</Button>
                      </Form>
                    </div>
                  </Card.Body>
                </Card>
              </div>
            ))}
          </div>
        </Tab>
        <Tab eventKey="settings" title="Paramètres">
          <Form onSubmit={handleUpdateProfile}>
            <Form.Group controlId="username" className="mb-3">
              <Form.Label>Nom d'utilisateur</Form.Label>
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Entrez votre nom d'utilisateur"
              />
            </Form.Group>
            <Form.Group controlId="whatsappNumber" className="mb-3">
              <Form.Label>Numéro WhatsApp</Form.Label>
              <Form.Control
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="Entrez votre numéro WhatsApp"
              />
            </Form.Group>
            <Form.Group controlId="whatsappMessage" className="mb-3">
              <Form.Label>Message WhatsApp par défaut</Form.Label>
              <Form.Control
                type="text"
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                placeholder="Entrez votre message WhatsApp par défaut"
              />
            </Form.Group>
            <Button variant="primary" type="submit">Mettre à jour</Button>
          </Form>
        </Tab>
        <Tab eventKey="follow" title="Suivre">
          <h3>Utilisateurs</h3>
          <ul>
            {users.map(u => (
              <li key={u._id}>
                {u.username || u.email}
                {follows.some(f => f._id === u._id) ? (
                  <Button variant="danger" onClick={() => handleUnfollow(u._id)} className="ms-2">Ne plus suivre</Button>
                ) : (
                  <Button variant="primary" onClick={() => handleFollow(u._id)} className="ms-2">Suivre</Button>
                )}
              </li>
            ))}
          </ul>
        </Tab>
      </Tabs>
    </div>
  );
};

export default Profile;
