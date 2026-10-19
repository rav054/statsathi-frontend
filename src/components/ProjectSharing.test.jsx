import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectSharingPanel from './ProjectSharingPanel';
import ProjectInvitations from './ProjectInvitations';
import { projectLabel, writableProjects } from '../utils/workspaceApi';

vi.mock('../context/AuthContext', () => ({ API_URL: 'http://api.test' }));

const owner = { id: 1, full_name: 'Ravi', email: 'ravi@example.com' };
const project = (overrides) => ({
  id: 7, name: 'Rice N trial', role: 'owner', owner, member_count: 1,
  members: [{ id: 3, email: 'asha@example.com', full_name: 'Asha', role: 'viewer', status: 'active', invited_at: '2026-09-14T10:00:00' }],
  ...overrides,
});

describe('sharing a project', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lets the owner invite, change roles and see the outcome', async () => {
    const api = {
      inviteMember: vi.fn(async () => ({ email: 'meera@example.com', email_sent: true })),
      changeMemberRole: vi.fn(async () => ({})),
    };
    const onChanged = vi.fn(async () => {});
    render(<ProjectSharingPanel api={api} detail={project()} currentUserEmail="ravi@example.com" onChanged={onChanged} onLeft={vi.fn()} onError={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Invite by email'), { target: { value: 'meera@example.com' } });
    fireEvent.change(screen.getByLabelText('Role for the invitation'), { target: { value: 'editor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    await waitFor(() => expect(api.inviteMember).toHaveBeenCalledWith(7, 'meera@example.com', 'editor'));
    expect((await screen.findByRole('status')).textContent).toContain('Invitation sent to meera@example.com');

    fireEvent.change(screen.getByLabelText('Role of asha@example.com'), { target: { value: 'editor' } });
    await waitFor(() => expect(api.changeMemberRole).toHaveBeenCalledWith(7, 3, 'editor'));
    expect(onChanged).toHaveBeenCalledTimes(2);
  });

  it('shows a member who shared it and lets them leave', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = { removeMember: vi.fn(async () => null) };
    const onLeft = vi.fn();
    render(<ProjectSharingPanel api={api} detail={project({ role: 'viewer' })} currentUserEmail="Asha@example.com" onChanged={vi.fn()} onLeft={onLeft} onError={vi.fn()} />);

    expect(screen.getByText(/Shared with you by/).textContent).toContain('as a viewer');
    expect(screen.queryByLabelText('Invite by email')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Leave this project' }));
    await waitFor(() => expect(onLeft).toHaveBeenCalled());
    expect(api.removeMember).toHaveBeenCalledWith(7, 3);
  });

  it('lists invitations and opens the project once accepted', async () => {
    const api = {
      invitations: vi.fn(async () => ({
        invitations: [{ id: 9, project_id: 7, project_name: 'Rice N trial', role: 'editor', invited_by: owner }],
        pending_count: 1, needs_verification: false,
      })),
      acceptInvitation: vi.fn(async () => ({ project_id: 7, role: 'editor' })),
    };
    const onAccepted = vi.fn();
    render(<ProjectInvitations api={api} onAccepted={onAccepted} onError={vi.fn()} />);

    expect((await screen.findByText(/invited you to/)).textContent).toContain('as an editor');
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(7));
    expect(screen.queryByText(/invited you to/)).toBeNull();
  });

  it('asks unconfirmed accounts to confirm their address first', async () => {
    const api = { invitations: vi.fn(async () => ({ invitations: [], pending_count: 2, needs_verification: true })) };
    render(<ProjectInvitations api={api} />);
    expect((await screen.findByRole('status')).textContent).toMatch(/2 people have shared a project with you.*Confirm your email/);
  });

  it('keeps viewer-only projects out of save pickers and names shared ones', () => {
    const projects = [project(), project({ id: 8, role: 'viewer' }), project({ id: 9, name: 'Wheat', role: 'editor' })];
    expect(writableProjects(projects).map(p => p.id)).toEqual([7, 9]);
    expect(projectLabel(projects[0])).toBe('Rice N trial');
    expect(projectLabel(projects[2])).toBe('Wheat (shared by Ravi)');
  });
});
