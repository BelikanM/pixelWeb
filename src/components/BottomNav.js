import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AiFillHome, AiFillPicture, AiOutlineUser, AiOutlineMenu } from 'react-icons/ai';
import './BottomNav.css';

export default function BottomNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="nav-container">
      <button
        className="nav-toggle-button"
        onClick={toggleMenu}
        aria-label="Ouvrir le menu de navigation"
      >
        <AiOutlineMenu size={24} />
      </button>
      {isMenuOpen && (
        <nav className="nav-menu">
          <NavLink
            to="/"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            end
            aria-label="Accueil"
            onClick={toggleMenu}
          >
            <AiFillHome size={20} />
          </NavLink>
          <NavLink
            to="/gallery"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            aria-label="Galerie"
            onClick={toggleMenu}
          >
            <AiFillPicture size={20} />
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            aria-label="Profil"
            onClick={toggleMenu}
          >
            <AiOutlineUser size={20} />
          </NavLink>
        </nav>
      )}
    </div>
  );
}
