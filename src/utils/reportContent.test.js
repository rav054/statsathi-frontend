import { describe, expect, it } from 'vitest';
import { methodsAsText, reportContent } from './reportContent';

const sections = (imageSize = 10) => [
  { heading: 'ANOVA table', tables: [{ columns: ['Source', 'F'], rows: [['Nitrogen', 18.4]] }], images: [] },
  { heading: 'Chart', images: [{ data: 'A'.repeat(imageSize), caption: 'Means' }] },
];

describe('report content kept with a saved result', () => {
  it('keeps the sections, notes and title the module built', () => {
    const content = reportContent(() => ({ title: 'ANOVA', test_applied: 'RBD', filename: 'x', sections: sections(), notes: ['n'] }));
    expect(content.title).toBe('ANOVA');
    expect(content.sections).toHaveLength(2);
    expect(content.sections[1].images).toHaveLength(1);
    expect(content.notes).toEqual(['n']);
    expect(content.filename).toBeUndefined();
  });

  it('drops charts, with a note, when they would make the result too large', () => {
    const content = reportContent(() => ({ title: 'Big', sections: sections(3_100_000) }));
    expect(content.sections[1].images).toEqual([]);
    expect(content.notes.at(-1)).toMatch(/Charts were left out/);
  });

  it('leaves the report out when there is nothing usable', () => {
    expect(reportContent(null)).toBeUndefined();
    expect(reportContent(() => ({ sections: [] }))).toBeUndefined();
    expect(reportContent(() => { throw new Error('file is null'); })).toBeUndefined();
  });

  it('turns the methods text into paragraphs ready to paste', () => {
    const text = methodsAsText({
      preparation: [{ name: 'Kharif cleaning', sentences: ['Duplicate rows were removed.', 'Outliers were flagged.'] }],
      analyses: [{ paragraph: 'Yield was analysed by ANOVA.' }],
      software: 'Analyses were carried out in StatSathi.',
      references: ['Duncan, D. B. (1955).', 'Gomez, K. A. (1984).'],
    });
    expect(text.split('\n\n')).toEqual([
      'Data preparation (Kharif cleaning): Duplicate rows were removed. Outliers were flagged.',
      'Yield was analysed by ANOVA.',
      'Analyses were carried out in StatSathi.',
      '',
      'References',
      'Duncan, D. B. (1955).',
      'Gomez, K. A. (1984).',
    ]);
  });
});
