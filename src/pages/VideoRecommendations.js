import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa'; // Add these imports
import './VideoRecommendations.css';

const API_URL = 'http://localhost:5000';

const VideoRecommendations = ({ userId }) => {
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const token = localStorage.getItem('token');

        // Étape 1 : Récupérer les vidéos des utilisateurs suivis
        const feedResponse = await fetch(`${API_URL}/feed`, {
          headers: { authorization: token },
        });
        const feedData = await feedResponse.json();
        let videos = Array.isArray(feedData)
          ? feedData.filter(media => media.filename.match(/\.(mp4|mov|avi)$/i))
          : [];

        // Étape 2 : Récupérer d'autres utilisateurs pour diversifier les recommandations
        const usersResponse = await fetch(`${API_URL}/users`, {
          headers: { authorization: token },
        });
        const usersData = await usersResponse.json();
        const otherUsers = Array.isArray(usersData) ? usersData.filter(user => user._id !== userId) : [];

        // Étape 3 : Récupérer les médias des utilisateurs non suivis
        for (const user of otherUsers) {
          const userMediasResponse = await fetch(`${API_URL}/user-medias/${user._id}`, {
            headers: { authorization: token },
          });
          const userMedias = await userMediasResponse.json();
          if (Array.isArray(userMedias)) {
            videos = [
              ...videos,
              ...userMedias.filter(media => media.filename.match(/\.(mp4|mov|avi)$/i)),
            ];
          }
        }

        // Étape 4 : Trier par popularité (likesCount) et limiter à 5 recommandations
        videos.sort((a, b) => b.likesCount - a.likesCount);
        setRecommendedVideos(videos.slice(0, 5));
        setLoading(false);
      } catch (err) {
        setError('Erreur lors du chargement des recommandations');
        setLoading(false);
        console.error('Erreur:', err);
      }
    };
    if (userId) {
      fetchRecommendations();
    }
  }, [userId]);

  const handleLike = async (mediaId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/like/${mediaId}`, {
        method: 'POST',
        headers: { authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setRecommendedVideos(recommendedVideos.map(video =>
          video._id === mediaId
            ? { ...video, isLiked: true, likesCount: video.likesCount + 1, isDisliked: false, dislikesCount: video.dislikesCount - (video.isDisliked ? 1 : 0) }
            : video
        ));
      }
    } catch (err) {
      console.error('Erreur lors du like:', err);
    }
  };

  const handleDislike = async (mediaId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/dislike/${mediaId}`, {
        method: 'POST',
        headers: { authorization: token },
      });
      const data = await res.json();
      if (res.ok) {
        setRecommendedVideos(recommendedVideos.map(video =>
          video._id === mediaId
            ? { ...video, isDisliked: true, dislikesCount: video.dislikesCount + 1, isLiked: false, likesCount: video.likesCount - (video.isLiked ? 1 : 0) }
            : video
        ));
      }
    } catch (err) {
      console.error('Erreur lors du dislike:', err);
    }
  };

  if (loading) return <div className="recommendations-loading">Chargement des recommandations...</div>;
  if (error) return <div className="recommendations-error">{error}</div>;

  return (
    <div className="recommendations-container">
      <h2>Vidéos recommandées</h2>
      {recommendedVideos.length === 0 ? (
        <p className="text-muted">Aucune vidéo recommandée pour le moment.</p>
      ) : (
        <div className="recommendations-grid">
          {recommendedVideos.map(video => (
            <div key={video._id} className="recommendation-card">
              <Link to={`/media/${video._id}`}>
                <video
                  className="recommendation-video"
                  controls
                  poster={`${API_URL}/uploads/${video.filename.replace(/\.(mp4|mov|avi)$/i, '.jpg')}`} // Supposons une miniature
                >
                  <source src={`${API_URL}/uploads/${video.filename}`} type="video/mp4" />
                  Votre navigateur ne prend pas en charge la lecture de vidéos.
                </video>
              </Link>
              <div className="recommendation-info">
                <h3 className="text-truncate">
                  <Link to={`/media/${video._id}`} className="text-decoration-none text-dark">
                    {video.originalname}
                  </Link>
                </h3>
                <p className="small">Par : {video.owner?.username || video.owner?.email}</p>
                <div className="recommendation-actions">
                  <button
                    className={`btn btn-sm ${video.isLiked ? 'btn-primary' : 'btn-outline-primary'} me-2`}
                    onClick={() => handleLike(video._id)}
                    disabled={video.isLiked}
                  >
                    <FaThumbsUp /> {video.likesCount}
                  </button>
                  <button
                    className={`btn btn-sm ${video.isDisliked ? 'btn-danger' : 'btn-outline-danger'}`}
                    onClick={() => handleDislike(video._id)}
                    disabled={video.isDisliked}
                  >
                    <FaThumbsDown /> {video.dislikesCount}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideoRecommendations;
