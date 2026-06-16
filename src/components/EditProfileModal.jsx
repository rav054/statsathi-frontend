import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, User, Building, Briefcase, AlertCircle, CheckCircle2 } from 'lucide-react';

const EditProfileModal = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [occupation, setOccupation] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Initialize fields with current user data when modal opens
  useEffect(() => {
    if (user && isOpen) {
      setFullName(user.full_name || '');
      setInstitution(user.institution || '');
      setOccupation(user.occupation || '');
      setFormError(null);
      setSuccess(false);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSuccess(false);

    if (!fullName.trim()) {
      setFormError("Full Name is required.");
      return;
    }

    setLoading(true);
    try {
      await updateProfile(fullName.trim(), institution.trim(), occupation);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200); // Close after showing success state
    } catch (err) {
      setFormError(err.message || "An error occurred while updating profile.");
    } finally {
      setLoading(false);
    }
  };

  const occupations = [
    { value: 'Student', label: 'Student' },
    { value: 'Researcher', label: 'Researcher' },
    { value: 'Educator', label: 'Educator' },
    { value: 'Scientist', label: 'Scientist' },
    { value: 'Other', label: 'Other' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-800">Edit Profile</h3>
            <p className="font-sans text-xs text-slate-400">Update your account details and affiliation.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {formError && (
            <div className="flex items-start space-x-2 rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs text-rose-600">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start space-x-2 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-600 animate-pulse">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Profile updated successfully! Closing...</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-bold text-slate-500 flex items-center space-x-1">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              disabled={loading || success}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          {/* Institution */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-bold text-slate-500 flex items-center space-x-1">
              <Building className="h-3.5 w-3.5 text-slate-400" />
              <span>Institution / Affiliation</span>
            </label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. ICAR-IISS Bhopal"
              disabled={loading || success}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          {/* Occupation */}
          <div className="space-y-1.5">
            <label className="font-sans text-xs font-bold text-slate-500 flex items-center space-x-1">
              <Briefcase className="h-3.5 w-3.5 text-slate-400" />
              <span>Occupation</span>
            </label>
            <select
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              disabled={loading || success}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 font-sans text-sm outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">-- Select Occupation --</option>
              {occupations.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || success}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex items-center justify-center rounded-xl bg-brand-indigo px-5 py-2.5 font-sans text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-colors disabled:bg-brand-indigo/60 disabled:shadow-none"
            >
              {loading ? (
                <div className="flex items-center space-x-1.5">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Saving...</span>
                </div>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
