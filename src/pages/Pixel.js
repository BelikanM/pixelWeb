import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import './Pixel.css';

const Pixel = ({ media, isVisible, isMuted, mediaId }) => {
  const mediaRef = useRef(null);
  const [zoomState, setZoomState] = useState({ scale: 1, x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Fonction pour détecter les zones d'intérêt avec TensorFlow.js
  const detectInterestPoints = async (element) => {
    try {
      // Simuler une détection de zones d'intérêt (ex. visages, objets)
      // Note : Utilisation d'un modèle simplifié pour la démo (peut être remplacé par MobileNet ou un modèle de détection de visages)
      await tf.ready();
      const imgTensor = tf.browser.fromPixels(element);
      const resized = tf.image.resizeBilinear(imgTensor, [224, 224]);
      const normalized = resized.div(255.0);
      const batched = normalized.expandDims(0);

      // Placeholder : Analyse simple basée sur la variance des pixels
      const gray = batched.mean(2);
      const variance = tf.sub(gray, gray.mean()).square().mean();
      const varianceValue = await variance.data();

      // Simuler des zones d'intérêt (exemple : centre, coins)
      const interestPoints = [
        { x: 0.2, y: 0.2 }, // Coin supérieur gauche
        { x: 0.8, y: 0.2 }, // Coin supérieur droit
        { x: 0.5, y: 0.5 }, // Centre
        { x: 0.2, y: 0.8 }, // Coin inférieur gauche
        { x: 0.8, y: 0.8 }, // Coin inférieur droit
      ];

      tf.dispose([imgTensor, resized, normalized, batched, gray, variance]);
      return interestPoints;
    } catch (error) {
      console.error('Erreur lors de l’analyse avec TensorFlow.js:', error);
      return [
        { x: 0.5, y: 0.5 }, // Fallback au centre
      ];
    }
  };

  // Animation de zoom
  const animateZoom = async () => {
    if (!mediaRef.current || !isVisible || isProcessing) return;
    setIsProcessing(true);

    const element = mediaRef.current;
    const points = await detectInterestPoints(element);

    for (const point of points) {
      // Zoom vers le point
      setZoomState({
        scale: 1.5, // Zoom à 150%
        x: -point.x * 100 + 50, // Déplacer vers le point en pourcentage
        y: -point.y * 100 + 50,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Attendre 2 secondes

      // Dézoomer
      setZoomState({ scale: 1, x: 0, y: 0 });
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Attendre 1 seconde
    }

    setIsProcessing(false);
  };

  useEffect(() => {
    let animationInterval;
    if (isVisible && !isProcessing) {
      // Lancer l'animation toutes les 10 secondes si le média est visible
      animationInterval = setInterval(animateZoom, 10000);
      animateZoom(); // Lancer immédiatement
    }

    return () => {
      clearInterval(animationInterval);
    };
  }, [isVisible, isProcessing]);

  // Appliquer le volume/mute pour les vidéos
  useEffect(() => {
    if (mediaRef.current && media.type === 'video') {
      mediaRef.current.muted = isMuted;
    }
  }, [isMuted, media.type]);

  return (
    <div className="pixel-container">
      {media.type === 'image' ? (
        <img
          ref={mediaRef}
          src={media.src}
          alt={media.alt}
          className="pixel-media"
          style={{
            transform: `scale(${zoomState.scale}) translate(${zoomState.x}%, ${zoomState.y}%)`,
            transition: 'transform 1s ease-in-out',
          }}
          onError={() => console.error(`Erreur de chargement de l’image ${mediaId}`)}
        />
      ) : (
        <video
          ref={mediaRef}
          src={media.src}
          className="pixel-media"
          loop
          playsInline
          preload="metadata"
          muted={isMuted}
          style={{
            transform: `scale(${zoomState.scale}) translate(${zoomState.x}%, ${zoomState.y}%)`,
            transition: 'transform 1s ease-in-out',
          }}
          onError={() => console.error(`Erreur de chargement de la vidéo ${mediaId}`)}
        />
      )}
    </div>
  );
};

export default Pixel;
