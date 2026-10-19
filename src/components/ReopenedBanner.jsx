/**
 * Shown above a result that was opened from a project instead of just calculated.
 *
 * A saved result holds the tables, not the dataset, so the module can display it but cannot redraw its charts or
 * change anything until the dataset is loaded again — which is what the button does.
 */
const ReopenedBanner = ({ analysis, onRestore }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
    <p className="font-sans text-[11px] text-indigo-900">
      Opened from project <span className="font-bold">{analysis.projectName}</span>
      {analysis.savedAt ? ` · saved ${new Date(analysis.savedAt).toLocaleDateString()}` : ''}.
      The tables come from the saved result; charts are not stored with it.
    </p>
    {analysis.dataset && (
      <button
        type="button"
        onClick={onRestore}
        className="rounded-lg bg-brand-indigo px-3 py-1.5 font-sans text-[11px] font-bold text-white hover:bg-indigo-700 cursor-pointer"
      >
        Load the dataset &amp; restore settings
      </button>
    )}
  </div>
);

export default ReopenedBanner;
