import React, { useState } from 'react';
const FormulairePub = ({ token }) => {
  const [url, setUrl] = useState('');
  const [amountCFA, setAmountCFA] = useState('');
  const envoyer = async () => {
    await fetch('http://localhost:5050/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, url, amountCFA: parseInt(amountCFA) })
    });
    alert('Publicité créée !');
  };
  return (
    <div>
      <h2>Créer une publicité</h2>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder='URL YouTube' />
      <input type='number' value={amountCFA} onChange={e => setAmountCFA(e.target.value)} placeholder='Montant CFA' />
      <button onClick={envoyer}>Envoyer</button>
    </div>
  );
};
export default FormulairePub;
