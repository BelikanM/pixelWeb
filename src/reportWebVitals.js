// src/reportWebVitals.js
const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && typeof onPerfEntry === 'function') {
    import('web-vitals')
      .then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        try {
          getCLS(onPerfEntry);
          getFID(onPerfEntry);
          getFCP(onPerfEntry);
          getLCP(onPerfEntry);
          getTTFB(onPerfEntry);
        } catch (error) {
          console.error('Error reporting web vitals:', error);
        }
      })
      .catch((error) => {
        console.error('Failed to load web-vitals module:', error);
      });
  }
};

export default reportWebVitals;
