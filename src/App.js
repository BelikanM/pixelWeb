import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import Gallery from './pages/Gallery';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';

function App() {
  return (
    <Router>
      <div style={{ paddingBottom: '60px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
      <BottomNav />
    </Router>
  );
}

export default App;
