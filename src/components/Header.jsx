import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Network, LogOut, User as UserIcon, LogIn } from 'lucide-react';
import EditProfileModal from './EditProfileModal';

const Header = ({ onAuthClick }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-8 shadow-xs">
      {/* Left section: Logo and Tagline */}
      <div className="flex items-center space-x-5">
        <div className="flex items-center space-x-3 cursor-pointer select-none">
          <img
            src="/logo.svg"
            alt="StatSathi Logo"
            className="h-9 w-auto object-contain"
          />
        </div>
        <div className="hidden h-5 w-px bg-slate-300 md:block"></div>
        <span className="hidden font-sans text-xs font-medium text-slate-500 md:block">
          Your Research Analytics Companion
        </span>
      </div>

      {/* Right section: Auth controls */}
      <div className="relative" ref={dropdownRef}>
        {user ? (
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2 rounded-full border border-slate-200 bg-slate-50 p-1.5 pr-3 hover:bg-slate-100 focus:outline-none transition-all duration-200"
            >
              {/* Profile Avatar with first letter of name */}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-indigo font-display text-sm font-bold text-white shadow-inner">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden font-sans text-sm font-semibold text-slate-700 md:block">
                {user.full_name.split(' ')[0]}
              </span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-12 w-64 origin-top-right rounded-2xl border border-slate-100 bg-white p-2 shadow-xl ring-1 ring-black/5 animate-fade-in">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="font-sans text-sm font-bold text-slate-800">{user.full_name}</p>
                  <p className="truncate font-sans text-xs text-slate-400">{user.email}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {user.institution && (
                      <span className="inline-block rounded bg-indigo-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-brand-indigo">
                        {user.institution}
                      </span>
                    )}
                    {user.occupation && (
                      <span className="inline-block rounded bg-orange-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-brand-orange">
                        {user.occupation}
                      </span>
                    )}
                  </div>
                </div>
                <div className="py-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setEditProfileOpen(true);
                    }}
                    className="flex w-full items-center space-x-2 rounded-xl px-4 py-2.5 text-left font-sans text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                  >
                    <UserIcon className="h-4 w-4 text-slate-400" />
                    <span>Edit Profile</span>
                  </button>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center space-x-2 rounded-xl px-4 py-2.5 text-left font-sans text-sm font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
            
            <EditProfileModal
              isOpen={editProfileOpen}
              onClose={() => setEditProfileOpen(false)}
            />
          </div>
        ) : (
          <button
            onClick={onAuthClick}
            className="flex items-center space-x-2 rounded-full bg-brand-indigo px-5 py-2 font-sans text-sm font-semibold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-indigo/20 transition-all duration-200"
          >
            <LogIn className="h-4 w-4" />
            <span>Log In</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
