// The module's Word-report content, kept with the saved result so a project report can reuse its tables and charts.
// Charts are dropped when they would make the saved result too large; a builder that fails leaves the report out.
const MAX_REPORT_CHARS = 3_000_000;
export const reportContent = (build) => {
  if (!build) return undefined;
  try {
    const built = build();
    if (!built?.sections?.length) return undefined;
    const content = { title: built.title, test_applied: built.test_applied, sections: built.sections, notes: built.notes || [] };
    if (JSON.stringify(content).length <= MAX_REPORT_CHARS) return content;
    const withoutImages = { ...content, sections: content.sections.map(section => ({ ...section, images: [] })),
      notes: [...content.notes, 'Charts were left out of this saved report to keep it small; export them from the module.'] };
    return JSON.stringify(withoutImages).length <= MAX_REPORT_CHARS ? withoutImages : undefined;
  } catch {
    return undefined;
  }
};

// Everything the methods panel shows, as plain text for pasting into a manuscript
export const methodsAsText = (methods) => [
  ...methods.preparation.map(p => `Data preparation (${p.name}): ${p.sentences.join(' ')}`),
  ...methods.analyses.map(a => a.paragraph),
  methods.software,
  '',
  'References',
  ...methods.references,
].join('\n\n');
