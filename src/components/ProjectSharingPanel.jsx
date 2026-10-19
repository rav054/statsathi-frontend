import { useState } from 'react';
import { LogOut, Mail, UserMinus, Users } from 'lucide-react';

const ROLE_HELP = {
  viewer: 'Can open results, download datasets and build reports',
  editor: 'Can also add datasets, analyses and recipes',
};

/**
 * Who a project is shared with. The owner invites people by email, changes their role or removes them;
 * everyone else sees the members and can leave the project.
 */
const ProjectSharingPanel = ({ api, detail, currentUserEmail, onChanged, onLeft, onError }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const isOwner = detail.role === 'owner';
  const members = detail.members || [];

  const act = async (action) => {
    setBusy(true);
    setNotice(null);
    onError?.(null);
    try {
      await action();
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
    }
  };

  const invite = (event) => {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    act(async () => {
      const member = await api.inviteMember(detail.id, address, role);
      setEmail('');
      setNotice(member.email_sent
        ? `Invitation sent to ${member.email}. They will see it on their Projects page after signing in.`
        : `${member.email} is invited, but the email could not be sent. Ask them to sign in with that address to accept.`);
      await onChanged();
    });
  };

  const changeRole = (member, nextRole) => act(async () => {
    await api.changeMemberRole(detail.id, member.id, nextRole);
    await onChanged();
  });

  const remove = (member) => {
    const leaving = !isOwner;
    const question = leaving
      ? `Leave "${detail.name}"? You will lose access; what you added stays in the project with its owner.`
      : member.status === 'invited'
        ? `Cancel the invitation to ${member.email}?`
        : `Remove ${member.full_name || member.email} from "${detail.name}"? What they added stays in the project.`;
    if (!window.confirm(question)) return;
    act(async () => {
      await api.removeMember(detail.id, member.id);
      if (leaving) onLeft();
      else await onChanged();
    });
  };

  const me = members.find(m => m.email === currentUserEmail?.toLowerCase());


  const person = (name, tone) => (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-sans text-xs font-bold text-white ${tone}`}>
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  );
  const tones = ['bg-brand-emerald', 'bg-brand-orange', 'bg-brand-indigo', 'bg-[#0EA5E9]'];
  const selectClass = 'h-[30px] rounded-lg border border-line bg-surface px-2 font-sans text-[15.5px] text-ink-2 dark:border-night-line dark:bg-night-soft dark:text-night-ink';

  return (
    <div id="project-people" className="flex scroll-mt-24 flex-col gap-3 rounded-2xl border border-line bg-surface p-[18px] dark:border-night-line dark:bg-night-surface">
      <h3 className="flex items-center gap-2 font-display text-base font-bold">
        <Users className="h-4 w-4 text-muted" /><span>People</span>
      </h3>

      {!isOwner && (
        <p className="font-sans text-[15.5px] leading-[1.5] text-muted dark:text-night-muted">
          Shared with you by <strong className="text-ink dark:text-night-ink">{detail.owner?.full_name || detail.owner?.email}</strong> as {detail.role === 'editor' ? 'an editor' : 'a viewer'}.
          {' '}{ROLE_HELP[detail.role]}.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        <li className="flex items-center gap-2.5">
          {person(detail.owner?.full_name || detail.owner?.email, 'bg-brand-navy dark:bg-night-soft')}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-sans text-[16.5px] font-semibold">
              {detail.owner?.full_name || detail.owner?.email}{isOwner ? ' (you)' : ''}
            </span>
            <span className="font-sans text-xs text-muted dark:text-night-muted">Owner</span>
          </div>
        </li>
        {members.map((member, index) => (
          <li key={member.id} className="flex items-center gap-2.5">
            {member.status === 'invited'
              ? <span className="h-8 w-8 shrink-0 rounded-full border-[1.5px] border-dashed border-[#CBD5E1] bg-[#EEF0F5] dark:border-night-line dark:bg-night-soft" />
              : person(member.full_name || member.email, tones[index % tones.length])}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-sans text-[16.5px] font-semibold">
                {member.full_name || member.email}{member.email === currentUserEmail?.toLowerCase() ? ' (you)' : ''}
              </span>
              <span className="truncate font-sans text-xs text-muted dark:text-night-muted">
                {member.status === 'invited' ? `Invited ${new Date(member.invited_at).toLocaleDateString()} · not accepted yet` : ROLE_HELP[member.role]}
              </span>
            </div>
            {isOwner ? (
              <div className="flex shrink-0 items-center gap-1">
                <select aria-label={`Role of ${member.email}`} value={member.role} disabled={busy}
                  onChange={(e) => changeRole(member, e.target.value)} className={selectClass}>
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button type="button" onClick={() => remove(member)} disabled={busy}
                  title={member.status === 'invited' ? 'Cancel invitation' : 'Remove from project'}
                  aria-label={member.status === 'invited' ? `Cancel invitation to ${member.email}` : `Remove ${member.email}`}
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-faint hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 cursor-pointer"><UserMinus className="h-4 w-4" /></button>
              </div>
            ) : (
              <span className="rounded-lg border border-line px-2.5 py-1 font-sans text-[15px] capitalize text-ink-2 dark:border-night-line dark:text-night-muted">{member.role}</span>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={invite} className="flex flex-col gap-2 pt-1">
          <label htmlFor="share-email" className="sr-only">Invite by email</label>
          <div className="flex gap-2">
            <input id="share-email" type="email" required maxLength={320} placeholder="colleague@university.edu" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[38px] min-w-0 flex-1 rounded-[9px] border border-[#DDE1EA] bg-surface px-3 font-sans text-[16px] text-ink outline-hidden placeholder:text-faint focus:border-brand-indigo dark:border-night-line dark:bg-night dark:text-night-ink" />
            <select aria-label="Role for the invitation" value={role} onChange={(e) => setRole(e.target.value)} className={`${selectClass} h-[38px]`}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <p className="flex-1 font-sans text-[14.5px] leading-[1.4] text-faint">{ROLE_HELP[role]}. Only you can rename or delete the project.</p>
            <button type="submit" disabled={busy || !email.trim()}
              className="flex h-[38px] items-center gap-1.5 rounded-[9px] bg-brand-navy px-3.5 font-sans text-[16px] font-semibold text-white hover:bg-[#1E293B] disabled:opacity-50 dark:bg-night-ink dark:text-night cursor-pointer">
              <Mail className="h-3.5 w-3.5" /><span>Invite</span>
            </button>
          </div>
        </form>
      )}

      {notice && <p role="status" className="font-sans text-[15px] text-brand-emerald dark:text-emerald-400">{notice}</p>}

      {!isOwner && me && (
        <button type="button" onClick={() => remove(me)} disabled={busy}
          className="flex items-center gap-1.5 self-start font-sans text-[15.5px] font-semibold text-rose-600 hover:underline cursor-pointer">
          <LogOut className="h-3.5 w-3.5" /><span>Leave this project</span>
        </button>
      )}
    </div>
  );
};

export default ProjectSharingPanel;
