import React, { useEffect, useState } from 'react';
const FeedPub = ({ token }) => {
  const [ads, setAds] = useState([]);
  useEffect(() => {
    fetch('http://localhost:5050/api/feed').then(res => res.json()).then(setAds);
  }, []);
  return (
    <div>
      <h2>Feed</h2>
      {ads.map(ad => (
        <div key={ad._id}>
          {ad.url}
          <progress value={ad.amountCFA - ad.remainingBudget} max={ad.amountCFA}></progress>
        </div>
      ))}
    </div>
  );
};
export default FeedPub;
