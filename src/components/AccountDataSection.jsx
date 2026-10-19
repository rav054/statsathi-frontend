import { useState } from 'react';
import { AlertTriangle, Download, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { deleteAccount, exportAccountData } from '../utils/accountApi';
import { saveBlob } from '../utils/workspaceApi';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 font-sans text-xs text-slate-700 outline-hidden focus:border-rose-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

/** Download everything the account holds, or delete the account for good. */
const AccountDataSection = ({ onDeleted }) => {
  const { token, logout } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(null);

  const download = async () => {
    setExporting(true);
    setError(null);
    try {
      const { blob, filename } = await exportAccountData(token);
      saveBlob(blob, filename);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const remove = async (event) => {
    event.preventDefault();
    if (confirmation !== 'DELETE' || !password) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(token, password, confirmation);
      logout();
      onDeleted?.();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="font-display text-xs font-bold text-slate-700 dark:text-slate-200">Your data</p>
      {error && <p role="alert" className="font-sans text-[14px] text-rose-600">{error}</p>}

      <button type="button" onClick={download} disabled={exporting}
        className="flex items-center space-x-1.5 font-sans text-xs font-semibold text-brand-indigo hover:underline disabled:opacity-60 dark:text-indigo-300 cursor-pointer">
        <Download className="h-3.5 w-3.5" /><span>{exporting ? 'Preparing your download…' : 'Download my data'}</span>
      </button>
      <p className="font-sans text-[13px] text-slate-400 -mt-2">
        A ZIP file with your profile, projects, datasets as uploaded, saved analyses and cleaning recipes.
      </p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="flex items-center space-x-1.5 font-sans text-xs font-semibold text-rose-600 hover:underline cursor-pointer">
          <Trash2 className="h-3.5 w-3.5" /><span>Delete account</span>
        </button>
      ) : (
        <form onSubmit={remove} className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/60 dark:bg-rose-950/30">
          <p className="flex items-start space-x-1.5 font-sans text-[14px] text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              This permanently deletes your account and the projects you own, with their datasets, saved analyses and
              recipes, for everyone they are shared with. What you added to other people's projects stays with them.
              It cannot be undone, so download your data first.
            </span>
          </p>
          <input type="password" aria-label="Your password" placeholder="Your password" autoComplete="current-password"
            className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <input type="text" aria-label="Type DELETE to confirm" placeholder="Type DELETE to confirm" autoComplete="off"
            className={inputClass} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setPassword(''); setConfirmation(''); setError(null); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-sans text-[14px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer">
              Keep my account
            </button>
            <button type="submit" disabled={deleting || confirmation !== 'DELETE' || !password}
              className="rounded-lg bg-rose-600 px-3 py-1.5 font-sans text-[14px] font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer">
              {deleting ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AccountDataSection;
