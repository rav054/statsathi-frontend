import { API_URL } from '../context/AuthContext';
import { saveBlob } from './workspaceApi';

// Generates a genuine Word (.docx) document on the server from structured report content.
// Report shape (see backend/app/reports.py):
//   { title, test_applied, dataset_name, filename,
//     sections: [{ heading, paragraphs: [], bullets: [], tables: [{ columns, rows, caption, note }],
//                  images: [{ data: base64 PNG/JPEG, caption }] }],
//     notes: [] }
export const downloadDocxReport = async (token, report) => {
  const res = await fetch(`${API_URL}/reports/docx`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(report)
  });
  if (!res.ok) {
    let detail = 'Word report generation failed.';
    try {
      const data = await res.json();
      detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail || detail;
    } catch {
      // error response was not JSON
    }
    throw new Error(detail);
  }
  const name = (report.filename || 'StatSathi_Report').replace(/[^\w.-]+/g, '_');
  saveBlob(await res.blob(), `${name}.docx`);
};

// Formats a p-value the way statistical reports usually print it
export const formatP = (p) => (p === null || p === undefined ? '–' : p < 0.001 ? '< 0.001' : p.toFixed(4));
