import { useEffect, useState } from 'react';
import { Check, MailOpen, X } from 'lucide-react';

/** Invitations to other people's projects, shown at the top of the Projects page. */
const ProjectInvitations = ({ api, onAccepted, onError }) => {
  const [state, setState] = useState({ invitations: [], pending_count: 0, needs_verification: false });
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    api.invitations()
      .then(data => active && setState(data))
      .catch(() => {}); // invitations are an extra; the project list still works without them
    return () => { active = false; };
  }, [api]);

  const answer = async (invitation, accept) => {
    setBusyId(invitation.id);
    onError?.(null);
    try {
      const outcome = accept ? await api.acceptInvitation(invitation.id) : await api.declineInvitation(invitation.id);
      setState(prev => ({ ...prev, invitations: prev.invitations.filter(i => i.id !== invitation.id) }));
      if (accept) await onAccepted?.(outcome.project_id);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (state.needs_verification) {
    return (
      <div role="status" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-sans text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        {state.pending_count === 1 ? 'Someone has' : `${state.pending_count} people have`} shared a project with you.
        Confirm your email address with the link we sent you to see and accept {state.pending_count === 1 ? 'it' : 'them'}.
      </div>
    );
  }
  if (state.invitations.length === 0) return null;

  return (
    <section aria-label="Project invitations" className="mb-6 space-y-2">
      {state.invitations.map(invitation => (
        <div key={invitation.id} className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-900/50 dark:bg-indigo-950/30">
          <div className="flex items-start space-x-3">
            <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-brand-indigo dark:text-indigo-300" />
            <p className="font-sans text-xs text-slate-700 dark:text-slate-200">
              <strong>{invitation.invited_by?.full_name || invitation.invited_by?.email}</strong> invited you to
              {' '}<strong>{invitation.project_name}</strong> as {invitation.role === 'editor' ? 'an editor' : 'a viewer'}.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => answer(invitation, false)} disabled={busyId === invitation.id}
              className="flex items-center space-x-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-sans text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <X className="h-3 w-3" /><span>Decline</span>
            </button>
            <button type="button" onClick={() => answer(invitation, true)} disabled={busyId === invitation.id}
              className="flex items-center space-x-1 rounded-lg bg-brand-indigo px-3 py-1.5 font-sans text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer">
              <Check className="h-3 w-3" /><span>Accept</span>
            </button>
          </div>
        </div>
      ))}
    </section>
  );
};

export default ProjectInvitations;
