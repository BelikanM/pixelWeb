import React, { useEffect, useState } from 'react';
const FeedPub = ({ token }) => {
  const [ads, setAds] = useState([]);
  useEffect(() => {
    fetch('http://localhost:5050/api/feed').then(res => res.json()).then(setAds);
  }, []);
  return (
    <div>
      <h2 className='text-xl font-bold mb-4'>Feed Publicitaire</h2>
      {ads.map(ad => (
        <div key={ad._id} className='border mb-2 p-2'>
          <p><strong>URL:</strong> {ad.url}</p>
          <progress value={ad.amountCFA - ad.remainingBudget} max={ad.amountCFA} className='w-full' />
        </div>
      ))}
    </div>
  );
};
export default FeedPub;
