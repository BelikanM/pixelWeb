import React from 'react';
import { NavLink } from 'react-router-dom';
import { AiFillHome, AiFillPicture, AiOutlineUser } from 'react-icons/ai';
import './BottomNav.css';

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} end>
        <AiFillHome size={28} />
        <span>Accueil</span>
      </NavLink>
      <NavLink to="/gallery" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        <AiFillPicture size={28} />
        <span>Galerie</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
        <AiOutlineUser size={28} />
        <span>Profil</span>
      </NavLink>
    </nav>
  );
}
