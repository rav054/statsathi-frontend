import { API_URL, apiFetch } from './apiFetch';

// Client for the /workspace API: projects, stored datasets and saved analysis results.
export const workspaceApi = (token) => {
  const request = async (path, { method = 'GET', json, formData } = {}) => {
    const headers = { Authorization: `Bearer ${token}` };
    let body;
    if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (formData) {
      body = formData;
    }

    const res = await apiFetch(`${API_URL}/workspace${path}`, { method, headers, body });
    if (res.status === 204) return null;
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail || detail;
      } catch {
        // error response was not JSON
      }
      throw new Error(detail);
    }
    const type = res.headers.get('content-type') || '';
    return type.includes('application/json') ? res.json() : res.blob();
  };

  return {
    listProjects: () => request('/projects'),
    createProject: (project) => request('/projects', { method: 'POST', json: project }),
    getProject: (id) => request(`/projects/${id}`),
    updateProject: (id, changes) => request(`/projects/${id}`, { method: 'PATCH', json: changes }),
    deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
    importProjects: (projects) => request('/import', { method: 'POST', json: { projects } }),
    storage: () => request('/storage'),
    uploadDataset: (projectId, file) => {
      const formData = new FormData();
      formData.append('file', file);
      return request(`/projects/${projectId}/datasets`, { method: 'POST', formData });
    },
    downloadDataset: (id) => request(`/datasets/${id}/download`),
    deleteDataset: (id) => request(`/datasets/${id}`, { method: 'DELETE' }),
    saveResult: (projectId, result) => request(`/projects/${projectId}/results`, { method: 'POST', json: result }),
    getResult: (id) => request(`/results/${id}`),
    deleteResult: (id) => request(`/results/${id}`, { method: 'DELETE' }),
    // Data-preparation recipes ({ name, description, source_dataset, steps })
    listRecipes: () => request('/recipes'),
    saveRecipe: (projectId, recipe) => request(`/projects/${projectId}/recipes`, { method: 'POST', json: recipe }),
    getRecipe: (id) => request(`/recipes/${id}`),
    replaceRecipe: (id, recipe) => request(`/recipes/${id}`, { method: 'PUT', json: recipe }),
    deleteRecipe: (id) => request(`/recipes/${id}`, { method: 'DELETE' }),
    // Project reports: the combined Word document (a Blob) and the methods text with references
    projectReport: (projectId, options) => request(`/projects/${projectId}/report`, { method: 'POST', json: options }),
    projectMethods: (projectId) => request(`/projects/${projectId}/methods`),
    // Sharing: the owner invites people as viewers or editors; invitees accept or decline
    inviteMember: (projectId, email, role) => request(`/projects/${projectId}/members`, { method: 'POST', json: { email, role } }),
    changeMemberRole: (projectId, memberId, role) => request(`/projects/${projectId}/members/${memberId}`, { method: 'PATCH', json: { role } }),
    removeMember: (projectId, memberId) => request(`/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),
    invitations: () => request('/invitations'),
    acceptInvitation: (id) => request(`/invitations/${id}/accept`, { method: 'POST' }),
    declineInvitation: (id) => request(`/invitations/${id}/decline`, { method: 'POST' })
  };
};

// Projects the user may add work to (their own, and those shared with them as an editor)
export const writableProjects = (projects) => (projects || []).filter(p => p.role !== 'viewer');

// How a project is named in pickers: shared projects say whose they are
export const projectLabel = (project) => (project.role && project.role !== 'owner' && project.owner
  ? `${project.name} (shared by ${project.owner.full_name || project.owner.email})`
  : project.name);

export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
