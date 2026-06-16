import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import {
  X, Table, AlertCircle, Info, Trash2, Copy, ArrowUp, ArrowDown,
  ArrowLeft, ArrowRight, Download, Undo2, Pencil, CheckSquare, Square,
  Columns, Rows3, Plus, Save
} from 'lucide-react';

const DatasetViewerModal = ({ isOpen, onClose, file, onSave }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [error, setError] = useState(null);

  // Selection state
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectedCols, setSelectedCols] = useState(new Set());

  // Editing state
  const [editingCell, setEditingCell] = useState(null); // { rowIdx, colName }
  const [editValue, setEditValue] = useState('');

  // Undo history
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState(null);

  // Toolbar mode
  const [mode, setMode] = useState('row'); // 'row' | 'col'

  const editInputRef = useRef(null);
  const [isModified, setIsModified] = useState(false);

  useEffect(() => {
    if (isOpen && file) {
      fetchPreview();
      setSelectedRows(new Set());
      setSelectedCols(new Set());
      setEditingCell(null);
      setHistory([]);
      setToast(null);
      setContextMenu(null);
      setMode('row');
    }
  }, [isOpen, file]);

  useEffect(() => {
    if (editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    if (contextMenu) window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const pushHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-30), { columns: [...columns], data: data.map(r => ({ ...r })) }]);
    setIsModified(true);
  }, [columns, data]);

  // ── BUILD FILE FROM EDITS ─────────────────────────────────
  const buildFileFromEdits = () => {
    if (data.length === 0 || columns.length === 0) return null;
    let csv = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';
    data.forEach(row => {
      csv += columns.map(c => {
        const v = row[c];
        if (v === null || v === undefined) return '';
        return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',') + '\n';
    });
    const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'dataset';
    const newFile = new File([csv], `${baseName}_edited.csv`, { type: 'text/csv' });
    return newFile;
  };

  const handleSaveAndApply = () => {
    const newFile = buildFileFromEdits();
    if (!newFile) return;
    if (onSave) {
      onSave(newFile);
      showToast('Changes applied — re-run analysis to see updated results', 'info');
      setIsModified(false);
    } else {
      showToast('Save not available in this context', 'warn');
    }
  };

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    setColumns([]);
    setData([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/analyze/preview`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.detail || "Failed to fetch dataset preview.");

      setColumns(resData.columns || []);
      setData(resData.data || []);
      setTotalRows(resData.total_rows || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── ROW OPERATIONS ──────────────────────────────────────────
  const toggleRowSelect = (idx) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const selectAllRows = () => {
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(data.map((_, i) => i)));
    }
  };

  const deleteSelectedRows = () => {
    if (selectedRows.size === 0) return showToast('Select rows first', 'warn');
    pushHistory();
    setData(prev => prev.filter((_, i) => !selectedRows.has(i)));
    setSelectedRows(new Set());
    showToast(`${selectedRows.size} row(s) deleted`);
  };

  const copySelectedRows = () => {
    if (selectedRows.size === 0) return showToast('Select rows first', 'warn');
    pushHistory();
    const sorted = [...selectedRows].sort((a, b) => a - b);
    const copies = sorted.map(i => ({ ...data[i] }));
    // insert copies after the last selected index
    const insertAt = sorted[sorted.length - 1] + 1;
    const newData = [...data];
    newData.splice(insertAt, 0, ...copies);
    setData(newData);
    setSelectedRows(new Set());
    showToast(`${copies.length} row(s) duplicated`);
  };

  const moveSelectedRows = (direction) => {
    if (selectedRows.size === 0) return showToast('Select rows first', 'warn');
    const sorted = [...selectedRows].sort((a, b) => a - b);
    if (direction === 'up' && sorted[0] === 0) return;
    if (direction === 'down' && sorted[sorted.length - 1] === data.length - 1) return;
    pushHistory();
    const newData = [...data];
    const newSelected = new Set();
    if (direction === 'up') {
      for (const idx of sorted) {
        [newData[idx - 1], newData[idx]] = [newData[idx], newData[idx - 1]];
        newSelected.add(idx - 1);
      }
    } else {
      for (const idx of [...sorted].reverse()) {
        [newData[idx + 1], newData[idx]] = [newData[idx], newData[idx + 1]];
        newSelected.add(idx + 1);
      }
    }
    setData(newData);
    setSelectedRows(newSelected);
  };

  const addRowBelow = () => {
    pushHistory();
    const emptyRow = {};
    columns.forEach(c => emptyRow[c] = null);
    if (selectedRows.size > 0) {
      const maxIdx = Math.max(...selectedRows);
      const newData = [...data];
      newData.splice(maxIdx + 1, 0, emptyRow);
      setData(newData);
    } else {
      setData([...data, emptyRow]);
    }
    setSelectedRows(new Set());
    showToast('New row added');
  };

  // ── COLUMN OPERATIONS ───────────────────────────────────────
  const toggleColSelect = (col) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      next.has(col) ? next.delete(col) : next.add(col);
      return next;
    });
  };

  const selectAllCols = () => {
    if (selectedCols.size === columns.length) {
      setSelectedCols(new Set());
    } else {
      setSelectedCols(new Set(columns));
    }
  };

  const deleteSelectedCols = () => {
    if (selectedCols.size === 0) return showToast('Select columns first', 'warn');
    pushHistory();
    const remaining = columns.filter(c => !selectedCols.has(c));
    setColumns(remaining);
    setData(prev => prev.map(row => {
      const newRow = {};
      remaining.forEach(c => newRow[c] = row[c]);
      return newRow;
    }));
    setSelectedCols(new Set());
    showToast(`${selectedCols.size} column(s) deleted`);
  };

  const copySelectedCols = () => {
    if (selectedCols.size === 0) return showToast('Select columns first', 'warn');
    pushHistory();
    const newCols = [...columns];
    const newData = data.map(row => ({ ...row }));
    selectedCols.forEach(col => {
      let copyName = `${col}_copy`;
      let i = 2;
      while (newCols.includes(copyName)) { copyName = `${col}_copy${i++}`; }
      const colIdx = newCols.indexOf(col);
      newCols.splice(colIdx + 1, 0, copyName);
      newData.forEach(row => { row[copyName] = row[col]; });
    });
    setColumns(newCols);
    setData(newData);
    setSelectedCols(new Set());
    showToast('Column(s) duplicated');
  };

  const moveSelectedCols = (direction) => {
    if (selectedCols.size !== 1) return showToast('Select exactly 1 column to move', 'warn');
    const col = [...selectedCols][0];
    const idx = columns.indexOf(col);
    if (direction === 'left' && idx === 0) return;
    if (direction === 'right' && idx === columns.length - 1) return;
    pushHistory();
    const newCols = [...columns];
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    [newCols[idx], newCols[swapIdx]] = [newCols[swapIdx], newCols[idx]];
    setColumns(newCols);
  };

  const addColumn = () => {
    pushHistory();
    let name = 'new_column';
    let i = 2;
    while (columns.includes(name)) { name = `new_column_${i++}`; }
    if (selectedCols.size > 0) {
      const lastCol = [...selectedCols].pop();
      const idx = columns.indexOf(lastCol);
      const newCols = [...columns];
      newCols.splice(idx + 1, 0, name);
      setColumns(newCols);
    } else {
      setColumns([...columns, name]);
    }
    setData(prev => prev.map(row => ({ ...row, [name]: null })));
    setSelectedCols(new Set());
    showToast('New column added');
  };

  // ── CELL EDITING ────────────────────────────────────────────
  const startEdit = (rowIdx, colName) => {
    const val = data[rowIdx][colName];
    setEditValue(val === null || val === undefined ? '' : String(val));
    setEditingCell({ rowIdx, colName });
  };

  const commitEdit = () => {
    if (!editingCell) return;
    pushHistory();
    const { rowIdx, colName } = editingCell;
    const newData = [...data];
    const parsed = editValue === '' ? null : isNaN(Number(editValue)) ? editValue : Number(editValue);
    newData[rowIdx] = { ...newData[rowIdx], [colName]: parsed };
    setData(newData);
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') cancelEdit();
    if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      // Move to next cell
      const { rowIdx, colName } = editingCell;
      const colIdx = columns.indexOf(colName);
      if (e.shiftKey) {
        if (colIdx > 0) startEdit(rowIdx, columns[colIdx - 1]);
        else if (rowIdx > 0) startEdit(rowIdx - 1, columns[columns.length - 1]);
      } else {
        if (colIdx < columns.length - 1) startEdit(rowIdx, columns[colIdx + 1]);
        else if (rowIdx < data.length - 1) startEdit(rowIdx + 1, columns[0]);
      }
    }
  };

  // ── UNDO ────────────────────────────────────────────────────
  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setColumns(prev.columns);
    setData(prev.data);
    setHistory(h => h.slice(0, -1));
    setSelectedRows(new Set());
    setSelectedCols(new Set());
    showToast('Undone');
  };

  // ── EXPORT ──────────────────────────────────────────────────
  const exportCSV = () => {
    if (data.length === 0 || columns.length === 0) return;
    let csv = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';
    data.forEach(row => {
      csv += columns.map(c => {
        const v = row[c];
        if (v === null || v === undefined) return '';
        return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = file ? file.name.replace(/\.[^/.]+$/, '') : 'dataset';
    a.download = `${baseName}_edited.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Edited CSV downloaded');
  };

  // ── CONTEXT MENU ────────────────────────────────────────────
  const handleRowContextMenu = (e, idx) => {
    e.preventDefault();
    if (!selectedRows.has(idx)) {
      setSelectedRows(new Set([idx]));
    }
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'row' });
  };

  const handleColContextMenu = (e, col) => {
    e.preventDefault();
    if (!selectedCols.has(col)) {
      setSelectedCols(new Set([col]));
    }
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'col' });
  };

  if (!isOpen) return null;

  const isAllRowsSelected = data.length > 0 && selectedRows.size === data.length;
  const isAllColsSelected = columns.length > 0 && selectedCols.size === columns.length;
  const hasRowSelection = selectedRows.size > 0;
  const hasColSelection = selectedCols.size > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[700px] w-full max-w-6xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-brand-orange">
              <Table className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-slate-800">
                Data Editor: {file ? file.name : 'N/A'}
              </h3>
              <p className="font-sans text-[10px] text-slate-400 mt-0.5">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : ''} • {data.length} rows × {columns.length} cols
                {data.length < totalRows && <span className="text-amber-500"> (showing {data.length} of {totalRows})</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Toolbar ── */}
        {!loading && !error && data.length > 0 && (
          <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 flex-wrap">
            {/* Mode Toggle */}
            <div className="flex items-center bg-white rounded-lg border border-slate-200 p-0.5 mr-1">
              <button
                onClick={() => setMode('row')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 font-sans text-[10px] font-bold transition-all ${
                  mode === 'row' ? 'bg-brand-indigo text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Rows3 className="h-3 w-3" /> Rows
              </button>
              <button
                onClick={() => setMode('col')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 font-sans text-[10px] font-bold transition-all ${
                  mode === 'col' ? 'bg-brand-indigo text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Columns className="h-3 w-3" /> Columns
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 mx-0.5" />

            {mode === 'row' ? (
              <>
                <ToolbarBtn
                  icon={isAllRowsSelected ? CheckSquare : Square}
                  label={isAllRowsSelected ? 'Deselect All' : 'Select All'}
                  onClick={selectAllRows}
                />
                <ToolbarBtn icon={Trash2} label="Delete" onClick={deleteSelectedRows} disabled={!hasRowSelection} danger />
                <ToolbarBtn icon={Copy} label="Duplicate" onClick={copySelectedRows} disabled={!hasRowSelection} />
                <ToolbarBtn icon={ArrowUp} label="Move Up" onClick={() => moveSelectedRows('up')} disabled={!hasRowSelection} />
                <ToolbarBtn icon={ArrowDown} label="Move Down" onClick={() => moveSelectedRows('down')} disabled={!hasRowSelection} />
                <ToolbarBtn icon={Plus} label="Add Row" onClick={addRowBelow} accent />
              </>
            ) : (
              <>
                <ToolbarBtn
                  icon={isAllColsSelected ? CheckSquare : Square}
                  label={isAllColsSelected ? 'Deselect All' : 'Select All'}
                  onClick={selectAllCols}
                />
                <ToolbarBtn icon={Trash2} label="Delete" onClick={deleteSelectedCols} disabled={!hasColSelection} danger />
                <ToolbarBtn icon={Copy} label="Duplicate" onClick={copySelectedCols} disabled={!hasColSelection} />
                <ToolbarBtn icon={ArrowLeft} label="Move Left" onClick={() => moveSelectedCols('left')} disabled={selectedCols.size !== 1} />
                <ToolbarBtn icon={ArrowRight} label="Move Right" onClick={() => moveSelectedCols('right')} disabled={selectedCols.size !== 1} />
                <ToolbarBtn icon={Plus} label="Add Column" onClick={addColumn} accent />
              </>
            )}

            <div className="h-5 w-px bg-slate-200 mx-0.5" />

            <ToolbarBtn icon={Undo2} label="Undo" onClick={undo} disabled={history.length === 0} />
            <ToolbarBtn icon={Download} label="Export CSV" onClick={exportCSV} accent />

            {/* Selection info badge */}
            {(hasRowSelection || hasColSelection) && (
              <span className="ml-auto font-sans text-[10px] font-semibold text-brand-indigo bg-indigo-50 rounded-lg px-2.5 py-1 border border-indigo-100">
                {hasRowSelection && `${selectedRows.size} row(s)`}
                {hasRowSelection && hasColSelection && ' · '}
                {hasColSelection && `${selectedCols.size} col(s)`}
                {' selected'}
              </span>
            )}
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-auto p-4 bg-slate-50/30">
          {error && (
            <div className="flex items-start space-x-2 rounded-2xl bg-rose-50 p-4 text-rose-800 border border-rose-100">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
              <span className="font-sans text-xs font-medium leading-normal">{error}</span>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
              <p className="font-sans text-xs font-medium text-slate-600 animate-pulse">Parsing data records...</p>
            </div>
          )}

          {!loading && !error && data.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Info className="h-8 w-8 text-slate-300 mb-2" />
              <p className="font-sans text-xs text-slate-400 font-semibold">No data records found in this file.</p>
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <div className="flex-1 overflow-auto border border-slate-200/60 rounded-2xl bg-white shadow-xs">
              <table className="w-full border-collapse font-sans text-xs text-left min-w-max">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr className="text-slate-500 font-bold">
                    {/* Row checkbox column header */}
                    <th className="py-2 px-2 text-center w-10 border-r border-slate-100">
                      <button
                        onClick={selectAllRows}
                        className="p-0.5 rounded hover:bg-slate-100 transition-colors"
                        title="Select all rows"
                      >
                        {isAllRowsSelected
                          ? <CheckSquare className="h-3.5 w-3.5 text-brand-indigo" />
                          : <Square className="h-3.5 w-3.5 text-slate-400" />
                        }
                      </button>
                    </th>
                    <th className="py-2 px-3 text-center w-12 border-r border-slate-100 font-sans text-[10px] text-slate-400">#</th>
                    {columns.map(col => (
                      <th
                        key={col}
                        className={`py-2 px-3 border-r border-slate-100 font-sans cursor-pointer select-none transition-colors group ${
                          selectedCols.has(col) ? 'bg-indigo-50 text-brand-indigo' : 'hover:bg-slate-100'
                        }`}
                        onClick={() => toggleColSelect(col)}
                        onContextMenu={(e) => handleColContextMenu(e, col)}
                        title="Click to select column"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`${selectedCols.has(col) ? 'text-brand-indigo' : 'text-slate-300'} transition-colors`}>
                            {selectedCols.has(col) ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3 opacity-0 group-hover:opacity-100" />}
                          </span>
                          <span className="truncate max-w-[140px]">{col}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => {
                    const isRowSel = selectedRows.has(idx);
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-slate-100/50 transition-colors ${
                          isRowSel
                            ? 'bg-indigo-50/60 hover:bg-indigo-50'
                            : idx % 2 === 0 ? 'bg-white hover:bg-slate-50/50' : 'bg-slate-50/10 hover:bg-slate-50/50'
                        }`}
                        onContextMenu={(e) => handleRowContextMenu(e, idx)}
                      >
                        {/* Row checkbox */}
                        <td className="py-1.5 px-2 text-center border-r border-slate-100/30">
                          <button
                            onClick={() => toggleRowSelect(idx)}
                            className="p-0.5 rounded hover:bg-slate-100 transition-colors"
                          >
                            {isRowSel
                              ? <CheckSquare className="h-3.5 w-3.5 text-brand-indigo" />
                              : <Square className="h-3.5 w-3.5 text-slate-300" />
                            }
                          </button>
                        </td>
                        {/* Row number */}
                        <td className="py-1.5 px-3 text-center text-slate-400 bg-slate-50/20 border-r border-slate-100/30 font-sans text-[10px] font-medium">
                          {idx + 1}
                        </td>
                        {/* Data cells */}
                        {columns.map(col => {
                          const isEditing = editingCell && editingCell.rowIdx === idx && editingCell.colName === col;
                          const isColSel = selectedCols.has(col);
                          return (
                            <td
                              key={col}
                              className={`py-1.5 px-3 border-r border-slate-100/30 font-sans max-w-[200px] relative group cursor-text ${
                                isColSel ? 'bg-indigo-50/30' : ''
                              }`}
                              onDoubleClick={() => startEdit(idx, col)}
                            >
                              {isEditing ? (
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={commitEdit}
                                  onKeyDown={handleEditKeyDown}
                                  className="w-full bg-white border border-brand-indigo rounded px-1.5 py-0.5 text-xs text-slate-800 outline-none ring-2 ring-brand-indigo/20 font-sans"
                                  style={{ minWidth: '60px' }}
                                />
                              ) : (
                                <div className="flex items-center">
                                  <span className="truncate">
                                    {row[col] === null || row[col] === undefined
                                      ? <span className="text-slate-300 italic text-[10px]">null</span>
                                      : String(row[col])}
                                  </span>
                                  <Pencil className="h-2.5 w-2.5 text-slate-300 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 bg-slate-50/50">
          <p className="font-sans text-[10px] text-slate-400">
            <Pencil className="h-3 w-3 inline-block mr-1 -mt-px text-slate-300" />
            Double-click any cell to edit • Right-click rows/columns for quick actions
          </p>
          <div className="flex items-center gap-2">
            {isModified && onSave && (
              <button
                onClick={handleSaveAndApply}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 font-sans text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors animate-fade-in"
              >
                <Save className="h-3.5 w-3.5" />
                Save & Apply Changes
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div
          className="fixed z-[200] bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 min-w-[170px] animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.type === 'row' ? (
            <>
              <ContextMenuItem icon={Trash2} label="Delete selected row(s)" onClick={() => { deleteSelectedRows(); setContextMenu(null); }} danger />
              <ContextMenuItem icon={Copy} label="Duplicate selected row(s)" onClick={() => { copySelectedRows(); setContextMenu(null); }} />
              <ContextMenuItem icon={ArrowUp} label="Move up" onClick={() => { moveSelectedRows('up'); setContextMenu(null); }} />
              <ContextMenuItem icon={ArrowDown} label="Move down" onClick={() => { moveSelectedRows('down'); setContextMenu(null); }} />
              <ContextMenuItem icon={Plus} label="Insert row below" onClick={() => { addRowBelow(); setContextMenu(null); }} />
            </>
          ) : (
            <>
              <ContextMenuItem icon={Trash2} label="Delete selected column(s)" onClick={() => { deleteSelectedCols(); setContextMenu(null); }} danger />
              <ContextMenuItem icon={Copy} label="Duplicate selected column(s)" onClick={() => { copySelectedCols(); setContextMenu(null); }} />
              <ContextMenuItem icon={ArrowLeft} label="Move left" onClick={() => { moveSelectedCols('left'); setContextMenu(null); }} />
              <ContextMenuItem icon={ArrowRight} label="Move right" onClick={() => { moveSelectedCols('right'); setContextMenu(null); }} />
              <ContextMenuItem icon={Plus} label="Insert column" onClick={() => { addColumn(); setContextMenu(null); }} />
            </>
          )}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-5 py-2.5 rounded-xl font-sans text-xs font-bold shadow-lg animate-fade-in ${
          toast.type === 'warn' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

/* ── Toolbar Button Component ── */
const ToolbarBtn = ({ icon: Icon, label, onClick, disabled, danger, accent }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={label}
    className={`flex items-center gap-1 rounded-lg px-2 py-1.5 font-sans text-[10px] font-bold transition-all ${
      disabled
        ? 'text-slate-300 cursor-not-allowed'
        : danger
        ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
        : accent
        ? 'text-brand-indigo hover:bg-indigo-50'
        : 'text-slate-600 hover:bg-white hover:text-slate-800 hover:shadow-sm'
    }`}
  >
    <Icon className="h-3.5 w-3.5" />
    <span className="hidden sm:inline">{label}</span>
  </button>
);

/* ── Context Menu Item Component ── */
const ContextMenuItem = ({ icon: Icon, label, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-4 py-2 font-sans text-xs transition-colors ${
      danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'
    }`}
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
  </button>
);

export default DatasetViewerModal;
