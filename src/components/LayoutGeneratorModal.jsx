import React, { useState, useRef, useEffect } from 'react';
import { X, Grid, Download, RefreshCw } from 'lucide-react';

const LayoutGeneratorModal = ({ isOpen, onClose }) => {
  // Parameters
  const [designType, setDesignType] = useState('rbd_oneway');
  const [replications, setReplications] = useState(3);
  const [treatments, setTreatments] = useState(4); // For 1-factor or Factor A levels
  const [factorB, setFactorB] = useState(3); // For 2-factor / split-plot
  const [factorC, setFactorC] = useState(2); // For sub-sub plot

  // Visual Customizations
  const [showChannels, setShowChannels] = useState(true);
  const [bundsStyle, setBundsStyle] = useState('thick'); // 'none', 'thin', 'thick'
  const [fontStyle, setFontStyle] = useState('sans-serif'); // 'sans-serif', 'serif', 'mono'
  const [colorStyle, setColorStyle] = useState('sunset'); // 'sunset', 'emerald', 'ocean', 'grey', 'nocolor'

  // Generated layout state
  const [layoutGrid, setLayoutGrid] = useState(null);
  const svgRef = useRef(null);

  // Helper to shuffle an array
  const shuffle = (array) => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // Generate randomized Latin Square
  const generateLatinSquare = (t) => {
    let base = Array.from({ length: t }, (_, i) => i);
    let square = [];
    for (let r = 0; r < t; r++) {
      let row = [];
      for (let c = 0; c < t; c++) {
        row.push(`T${base[(r + c) % t] + 1}`);
      }
      square.push(row);
    }
    // Randomize rows and columns to randomize square
    let rowIndices = shuffle(Array.from({ length: t }, (_, i) => i));
    let colIndices = shuffle(Array.from({ length: t }, (_, i) => i));
    
    let randomizedSquare = [];
    for (let r = 0; r < t; r++) {
      let row = [];
      for (let c = 0; c < t; c++) {
        row.push(square[rowIndices[r]][colIndices[c]]);
      }
      randomizedSquare.push(row);
    }
    return randomizedSquare;
  };

  // Generate Layout
  const generateLayout = () => {
    if (designType === 'crd_oneway') {
      const total = treatments * replications;
      const list = [];
      for (let t = 1; t <= treatments; t++) {
        for (let r = 1; r <= replications; r++) {
          list.push(`T${t} (R${r})`);
        }
      }
      const shuffled = shuffle(list);
      // Arrange in grid
      const cols = Math.ceil(Math.sqrt(total));
      const grid = [];
      for (let i = 0; i < shuffled.length; i += cols) {
        grid.push(shuffled.slice(i, i + cols));
      }
      setLayoutGrid({ type: 'crd', grid });
    } 
    else if (designType === 'crd_twoway') {
      const total = treatments * factorB * replications;
      const list = [];
      for (let a = 1; a <= treatments; a++) {
        for (let b = 1; b <= factorB; b++) {
          for (let r = 1; r <= replications; r++) {
            list.push(`A${a}B${b} (R${r})`);
          }
        }
      }
      const shuffled = shuffle(list);
      const cols = Math.ceil(Math.sqrt(total));
      const grid = [];
      for (let i = 0; i < shuffled.length; i += cols) {
        grid.push(shuffled.slice(i, i + cols));
      }
      setLayoutGrid({ type: 'crd', grid });
    } 
    else if (designType === 'rbd_oneway') {
      // blocks horizontally, plots stacked vertically
      const blocksList = [];
      for (let r = 1; r <= replications; r++) {
        const treats = Array.from({ length: treatments }, (_, idx) => `T${idx + 1}`);
        const shuffled = shuffle(treats);
        blocksList.push({ blockNum: r, plots: shuffled });
      }
      setLayoutGrid({ type: 'rbd', blocks: blocksList });
    } 
    else if (designType === 'rbd_twoway') {
      const blocksList = [];
      for (let r = 1; r <= replications; r++) {
        const treats = [];
        for (let a = 1; a <= treatments; a++) {
          for (let b = 1; b <= factorB; b++) {
            treats.push(`A${a}B${b}`);
          }
        }
        const shuffled = shuffle(treats);
        blocksList.push({ blockNum: r, plots: shuffled });
      }
      setLayoutGrid({ type: 'rbd', blocks: blocksList });
    } 
    else if (designType === 'lsd') {
      const square = generateLatinSquare(treatments);
      setLayoutGrid({ type: 'lsd', square });
    } 
    else if (designType === 'splitplot') {
      const blocksList = [];
      for (let r = 1; r <= replications; r++) {
        const mainTreats = Array.from({ length: treatments }, (_, idx) => `A${idx + 1}`);
        const shuffledMain = shuffle(mainTreats);
        
        const mainPlots = shuffledMain.map(mainName => {
          const subTreats = Array.from({ length: factorB }, (_, idx) => `B${idx + 1}`);
          const shuffledSub = shuffle(subTreats);
          return { mainName, subplots: shuffledSub };
        });
        blocksList.push({ blockNum: r, mainPlots });
      }
      setLayoutGrid({ type: 'splitplot', blocks: blocksList });
    } 
    else if (designType === 'subsubplot') {
      const blocksList = [];
      for (let r = 1; r <= replications; r++) {
        const mainTreats = Array.from({ length: treatments }, (_, idx) => `A${idx + 1}`);
        const shuffledMain = shuffle(mainTreats);
        
        const mainPlots = shuffledMain.map(mainName => {
          const subTreats = Array.from({ length: factorB }, (_, idx) => `B${idx + 1}`);
          const shuffledSub = shuffle(subTreats);
          
          const subplots = shuffledSub.map(subName => {
            const subSubTreats = Array.from({ length: factorC }, (_, idx) => `C${idx + 1}`);
            const shuffledSubSub = shuffle(subSubTreats);
            return { subName, subSubplots: shuffledSubSub };
          });
          
          return { mainName, subplots };
        });
        blocksList.push({ blockNum: r, mainPlots });
      }
      setLayoutGrid({ type: 'subsubplot', blocks: blocksList });
    }
  };

  useEffect(() => {
    generateLayout();
  }, [designType, replications, treatments, factorB, factorC]);

  // Handle download SVG
  const downloadSVG = () => {
    if (!svgRef.current) return;
    const svgContent = svgRef.current.outerHTML;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `StatSathi_Field_Layout_${designType}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle download PNG
  const downloadPNG = () => {
    if (!svgRef.current) return;
    
    // Get SVG string with XML namespace if not present
    let svgString = new XMLSerializer().serializeToString(svgRef.current);
    if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
      svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      // Parse viewBox for width and height
      const viewBox = svgRef.current.getAttribute('viewBox');
      const [, , w, h] = viewBox.split(' ').map(Number);
      
      const canvas = document.createElement('canvas');
      const scale = 3; // 3x scaling for high-resolution print quality
      canvas.width = w * scale;
      canvas.height = h * scale;
      
      const ctx = canvas.getContext('2d');
      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw SVG onto canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Trigger download
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `StatSathi_Field_Layout_${designType}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // Color mapping functions based on chosen color palette and treatment index
  const getCellColor = (label) => {
    if (colorStyle === 'nocolor') return '#ffffff';
    
    // Parse treatment index to assign consistent colors
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % 8;

    const palettes = {
      sunset: [
        '#EEF2FF', '#E0E7FF', '#C7D2FE', '#A5B4FC', 
        '#FFF7ED', '#FFEDD5', '#FED7AA', '#FDBA74'
      ],
      emerald: [
        '#ECFDF5', '#D1FAE5', '#A7F3D0', '#6EE7B7', 
        '#F0FDF4', '#DCFCE7', '#BBF7D0', '#86EFAC'
      ],
      ocean: [
        '#F0F9FF', '#E0F2FE', '#BAE6FD', '#7DD3FC',
        '#ECFEFF', '#CFFAFE', '#A5F3FC', '#67E8F9'
      ],
      grey: [
        '#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1',
        '#F4F4F5', '#E4E4E7', '#D4D4D8', '#C4C4C7'
      ],
      pastel: [
        '#FFDFD3', '#FEC8D8', '#D4F0F2', '#D9E4DD',
        '#E8D7FF', '#FCE1E4', '#EAF2D7', '#FFE8D6'
      ],
      forest: [
        '#E2ECE9', '#DFEBE0', '#C3E2C2', '#A3C9A8',
        '#E8F5E9', '#C8E6C9', '#A5D6A7', '#81C784'
      ]
    };

    return palettes[colorStyle][idx];
  };

  const getFontFamily = () => {
    if (fontStyle === 'serif') return 'Georgia, Cambria, "Times New Roman", Times, serif';
    if (fontStyle === 'mono') return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    return 'Inter, system-ui, -apple-system, sans-serif';
  };

  const getBundWidth = () => {
    if (bundsStyle === 'none') return 0;
    if (bundsStyle === 'thin') return 1;
    return 2;
  };

  const getBundColor = () => {
    if (colorStyle === 'nocolor') return '#000000';
    return '#475569'; // Slate Bunds
  };

  // Dimensions of plots inside SVG
  const plotW = 90;
  const plotH = 40;
  const channelGap = showChannels ? 20 : 6;
  const outerMargin = 20;

  // Renders the specific SVG graphics according to designType and layoutGrid
  const renderSVGLayout = () => {
    if (!layoutGrid) return null;

    let svgWidth = 720;
    let svgHeight = 360;
    let contents = [];

    const borderStyle = {
      stroke: getBundColor(),
      strokeWidth: getBundWidth()
    };

    const textStyle = {
      fontFamily: getFontFamily(),
      fontSize: '10px',
      fontWeight: 'bold',
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fill: '#1E293B' // Slate text
    };

    const blockLabelStyle = {
      fontFamily: getFontFamily(),
      fontSize: '11px',
      fontWeight: 'extrabold',
      textAnchor: 'middle',
      fill: colorStyle === 'nocolor' ? '#000000' : '#4F46E5'
    };

    if (layoutGrid.type === 'rbd') {
      const r = replications;
      const t = layoutGrid.blocks[0].plots.length;
      
      svgWidth = outerMargin * 2 + r * plotW + (r - 1) * channelGap;
      svgHeight = outerMargin * 2 + t * plotH + 30; // 30px for block label

      layoutGrid.blocks.forEach((block, bIdx) => {
        const x = outerMargin + bIdx * (plotW + channelGap);
        
        // Draw Block label at top
        contents.push(
          <text key={`bl-${bIdx}`} x={x + plotW / 2} y={outerMargin + 12} {...blockLabelStyle}>
            BLOCK {block.blockNum}
          </text>
        );

        // Draw Plots
        block.plots.forEach((plotName, pIdx) => {
          const y = outerMargin + 25 + pIdx * plotH;
          const fillColor = getCellColor(plotName);

          contents.push(
            <g key={`plot-${bIdx}-${pIdx}`}>
              <rect x={x} y={y} width={plotW} height={plotH} fill={fillColor} {...borderStyle} />
              <text x={x + plotW / 2} y={y + plotH / 2} {...textStyle} fill={colorStyle === 'nocolor' ? '#000000' : '#1E293B'}>
                {plotName}
              </text>
            </g>
          );
        });

        // Draw vertical channel if showChannels is toggled
        if (showChannels && bIdx < r - 1) {
          contents.push(
            <rect
              key={`chan-${bIdx}`}
              x={x + plotW}
              y={outerMargin + 25}
              width={channelGap}
              height={t * plotH}
              fill="#E0F2FE"
              opacity="0.6"
              stroke="#BAE6FD"
              strokeDasharray="2,2"
            />
          );
        }
      });
    }
    else if (layoutGrid.type === 'crd') {
      const rows = layoutGrid.grid.length;
      const cols = layoutGrid.grid[0].length;
      
      svgWidth = outerMargin * 2 + cols * plotW + (cols - 1) * channelGap;
      svgHeight = outerMargin * 2 + rows * plotH + 20;

      // Draw Top Title
      contents.push(
        <text key="crd-t" x={svgWidth / 2} y={outerMargin + 10} {...blockLabelStyle}>
          COMPLETELY RANDOMIZED LAYOUT GRID
        </text>
      );

      layoutGrid.grid.forEach((row, rIdx) => {
        row.forEach((cellName, cIdx) => {
          const x = outerMargin + cIdx * (plotW + channelGap);
          const y = outerMargin + 20 + rIdx * plotH;
          const fillColor = getCellColor(cellName);

          contents.push(
            <g key={`crd-${rIdx}-${cIdx}`}>
              <rect x={x} y={y} width={plotW} height={plotH} fill={fillColor} {...borderStyle} />
              <text x={x + plotW / 2} y={y + plotH / 2} {...textStyle} fill={colorStyle === 'nocolor' ? '#000000' : '#1E293B'}>
                {cellName}
              </text>
            </g>
          );
        });

        // Horizontal channels
        if (showChannels && rIdx < rows - 1) {
          contents.push(
            <rect
              key={`crd-hchan-${rIdx}`}
              x={outerMargin}
              y={outerMargin + 20 + (rIdx + 1) * plotH - channelGap/4}
              width={cols * plotW + (cols - 1) * channelGap}
              height={channelGap/2}
              fill="#E0F2FE"
              opacity="0.6"
              stroke="#BAE6FD"
              strokeDasharray="2,2"
            />
          );
        }
      });
    }
    else if (layoutGrid.type === 'lsd') {
      const t = layoutGrid.square.length;
      svgWidth = outerMargin * 2 + t * plotW + (t - 1) * channelGap;
      svgHeight = outerMargin * 2 + t * plotH + 25;

      contents.push(
        <text key="lsd-t" x={svgWidth / 2} y={outerMargin + 10} {...blockLabelStyle}>
          LATIN SQUARE DESIGN GRID ({t}x{t})
        </text>
      );

      layoutGrid.square.forEach((row, rIdx) => {
        row.forEach((cellName, cIdx) => {
          const x = outerMargin + cIdx * (plotW + channelGap);
          const y = outerMargin + 20 + rIdx * plotH;
          const fillColor = getCellColor(cellName);

          contents.push(
            <g key={`lsd-${rIdx}-${cIdx}`}>
              <rect x={x} y={y} width={plotW} height={plotH} fill={fillColor} {...borderStyle} />
              <text x={x + plotW / 2} y={y + plotH / 2} {...textStyle} fill={colorStyle === 'nocolor' ? '#000000' : '#1E293B'}>
                {cellName}
              </text>
            </g>
          );
        });
      });
    }
    else if (layoutGrid.type === 'splitplot') {
      const r = replications;
      const a = treatments;
      const b = factorB;
      
      const mainPlotW = plotW * 1.1;
      const subPlotH = plotH * 0.8;
      const mainPlotH = subPlotH * b;
      
      svgWidth = outerMargin * 2 + r * mainPlotW + (r - 1) * channelGap;
      svgHeight = outerMargin * 2 + a * mainPlotH + 30;

      layoutGrid.blocks.forEach((block, bIdx) => {
        const x = outerMargin + bIdx * (mainPlotW + channelGap);
        
        contents.push(
          <text key={`sbl-${bIdx}`} x={x + mainPlotW / 2} y={outerMargin + 12} {...blockLabelStyle}>
            BLOCK {block.blockNum}
          </text>
        );

        block.mainPlots.forEach((mainPlot, mIdx) => {
          const yMain = outerMargin + 25 + mIdx * mainPlotH;

          // Draw Main Plot Border (Factor A)
          contents.push(
            <rect
              key={`m-border-${bIdx}-${mIdx}`}
              x={x}
              y={yMain}
              width={mainPlotW}
              height={mainPlotH}
              fill="none"
              stroke="#64748B"
              strokeWidth={2}
              strokeDasharray="4,4"
            />
          );

          // Draw Subplots nested vertically
          mainPlot.subplots.forEach((subName, sIdx) => {
            const ySub = yMain + sIdx * subPlotH;
            const label = `${mainPlot.mainName}${subName}`;
            const fillColor = getCellColor(label);

            contents.push(
              <g key={`sub-${bIdx}-${mIdx}-${sIdx}`}>
                <rect x={x + 3} y={ySub + 2} width={mainPlotW - 6} height={subPlotH - 4} fill={fillColor} {...borderStyle} />
                <text x={x + mainPlotW / 2} y={ySub + subPlotH / 2} {...textStyle} fontSize="9px" fill={colorStyle === 'nocolor' ? '#000000' : '#1E293B'}>
                  {label}
                </text>
              </g>
            );
          });
        });

        // Vertical channels
        if (showChannels && bIdx < r - 1) {
          contents.push(
            <rect
              key={`sp-chan-${bIdx}`}
              x={x + mainPlotW}
              y={outerMargin + 25}
              width={channelGap}
              height={a * mainPlotH}
              fill="#E0F2FE"
              opacity="0.6"
              stroke="#BAE6FD"
              strokeDasharray="2,2"
            />
          );
        }
      });
    }
    else if (layoutGrid.type === 'subsubplot') {
      const r = replications;
      const a = treatments;
      const b = factorB;
      const c = factorC;
      
      const subSubH = plotH * 0.7;
      const subPlotH = subSubH * c;
      const mainPlotH = subPlotH * b;
      const mainPlotW = plotW * 1.2;
      
      svgWidth = outerMargin * 2 + r * mainPlotW + (r - 1) * channelGap;
      svgHeight = outerMargin * 2 + a * mainPlotH + 30;

      layoutGrid.blocks.forEach((block, bIdx) => {
        const x = outerMargin + bIdx * (mainPlotW + channelGap);
        
        contents.push(
          <text key={`ssbl-${bIdx}`} x={x + mainPlotW / 2} y={outerMargin + 12} {...blockLabelStyle}>
            BLOCK {block.blockNum}
          </text>
        );

        block.mainPlots.forEach((mainPlot, mIdx) => {
          const yMain = outerMargin + 25 + mIdx * mainPlotH;

          // Draw Main Plot
          contents.push(
            <rect
              key={`m-border-${bIdx}-${mIdx}`}
              x={x}
              y={yMain}
              width={mainPlotW}
              height={mainPlotH}
              fill="none"
              stroke="#0f172a"
              strokeWidth={2}
            />
          );

          // Draw Subplots (Factor B)
          mainPlot.subplots.forEach((subplot, sIdx) => {
            const ySub = yMain + sIdx * subPlotH;

            contents.push(
              <rect
                key={`s-border-${bIdx}-${mIdx}-${sIdx}`}
                x={x + 2}
                y={ySub + 2}
                width={mainPlotW - 4}
                height={subPlotH - 4}
                fill="none"
                stroke="#64748B"
                strokeWidth={1.5}
                strokeDasharray="2,2"
              />
            );

            // Draw Sub-Sub plots (Factor C) nested
            subplot.subSubplots.forEach((subSubName, ssIdx) => {
              const ySubSub = ySub + ssIdx * subSubH;
              const label = `${mainPlot.mainName}${subplot.subName}${subSubName}`;
              const fillColor = getCellColor(label);

              contents.push(
                <g key={`subsub-${bIdx}-${mIdx}-${sIdx}-${ssIdx}`}>
                  <rect x={x + 4} y={ySubSub + 4} width={mainPlotW - 8} height={subSubH - 8} fill={fillColor} {...borderStyle} />
                  <text x={x + mainPlotW / 2} y={ySubSub + subSubH / 2} {...textStyle} fontSize="8px" fill={colorStyle === 'nocolor' ? '#000000' : '#1E293B'}>
                    {label}
                  </text>
                </g>
              );
            });
          });
        });

        // Vertical channels
        if (showChannels && bIdx < r - 1) {
          contents.push(
            <rect
              key={`ssp-chan-${bIdx}`}
              x={x + mainPlotW}
              y={outerMargin + 25}
              width={channelGap}
              height={a * mainPlotH}
              fill="#E0F2FE"
              opacity="0.6"
              stroke="#BAE6FD"
              strokeDasharray="2,2"
            />
          );
        }
      });
    }

    return (
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ background: '#ffffff', border: colorStyle === 'nocolor' ? '1px solid #000' : 'none' }}
      >
        {contents}
      </svg>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex h-full max-h-[680px] w-full max-w-5xl flex-col rounded-3xl border border-slate-100 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-brand-indigo">
              <Grid className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-800">
                Crop Field Layout Grid Generator
              </h2>
              <p className="font-sans text-xs text-slate-400">
                Design randomized layouts for standard agronomic experiment designs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Settings Left Column */}
          <div className="w-full md:w-80 border-r border-slate-100 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
            {/* Design Type */}
            <div className="space-y-1.5">
              <label className="font-sans text-xs font-bold text-slate-500">Experimental Design</label>
              <select
                value={designType}
                onChange={(e) => setDesignType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
              >
                <option value="crd_oneway">CRD: One Factor</option>
                <option value="crd_twoway">CRD: Two Factor</option>
                <option value="rbd_oneway">RBD: One Factor</option>
                <option value="rbd_twoway">RBD: Two Factor</option>
                <option value="lsd">Latin Square Design (LSD)</option>
                <option value="splitplot">Split-Plot Design</option>
                <option value="subsubplot">Sub-Sub Plot Design</option>
              </select>
            </div>

            {/* Replications block count */}
            {designType !== 'lsd' && (
              <div className="space-y-1.5">
                <label className="font-sans text-xs font-bold text-slate-500 block">
                  {designType.includes('crd') ? 'Replications / Plots per Treatment' : 'Replication Blocks'}
                </label>
                <input
                  type="number"
                  min="2"
                  value={replications}
                  onChange={(e) => setReplications(Math.max(2, parseInt(e.target.value) || 2))}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                />
              </div>
            )}

            {/* Treatments / Factor A levels */}
            <div className="space-y-1.5">
              <label className="font-sans text-xs font-bold text-slate-500 block">
                {designType === 'lsd' ? 'Treatments / Matrix size' : 'Factor A / Treatments'}
              </label>
              <input
                type="number"
                min="2"
                value={treatments}
                onChange={(e) => setTreatments(Math.max(2, parseInt(e.target.value) || 2))}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
              />
            </div>

            {/* Factor B levels */}
            {(designType.includes('twoway') || designType.includes('split') || designType === 'subsubplot') && (
              <div className="space-y-1.5">
                <label className="font-sans text-xs font-bold text-slate-500 block">Factor B Levels</label>
                <input
                  type="number"
                  min="2"
                  value={factorB}
                  onChange={(e) => setFactorB(Math.max(2, parseInt(e.target.value) || 2))}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                />
              </div>
            )}

            {/* Factor C levels */}
            {designType === 'subsubplot' && (
              <div className="space-y-1.5">
                <label className="font-sans text-xs font-bold text-slate-500 block">Factor C Levels</label>
                <input
                  type="number"
                  min="2"
                  value={factorC}
                  onChange={(e) => setFactorC(Math.max(2, parseInt(e.target.value) || 2))}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 font-sans text-xs outline-hidden focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10 transition-all"
                />
              </div>
            )}

            <hr className="border-slate-100" />

            {/* Toggle options */}
            <div className="space-y-3">
              <label className="font-sans text-xs font-bold text-slate-500 block">Visual Layout Options</label>
              
              {/* Irrigation Channel */}
              <label className="flex items-center justify-between cursor-pointer font-sans text-xs text-slate-700">
                <span>Add Irrigation Channels</span>
                <input
                  type="checkbox"
                  checked={showChannels}
                  onChange={(e) => setShowChannels(e.target.checked)}
                  className="rounded-md border-slate-300 text-brand-indigo focus:ring-brand-indigo h-4 w-4 cursor-pointer"
                />
              </label>

              {/* Bunds style select */}
              <div className="space-y-1">
                <span className="font-sans text-xs text-slate-700 block">Borders / Bunds style</span>
                <select
                  value={bundsStyle}
                  onChange={(e) => setBundsStyle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 font-sans text-xs outline-hidden focus:border-brand-indigo"
                >
                  <option value="none">No Soil Bunds</option>
                  <option value="thin">Thin Bunds (1px)</option>
                  <option value="thick">Thick Bunds (2px)</option>
                </select>
              </div>

              {/* Fonts select */}
              <div className="space-y-1">
                <span className="font-sans text-xs text-slate-700 block">Font style</span>
                <select
                  value={fontStyle}
                  onChange={(e) => setFontStyle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 font-sans text-xs outline-hidden focus:border-brand-indigo"
                >
                  <option value="sans-serif">Academic Sans (Inter)</option>
                  <option value="serif">Academic Serif (Georgia)</option>
                  <option value="mono">Scientific Monospace (Courier)</option>
                </select>
              </div>

              {/* Color style select */}
              <div className="space-y-1">
                <span className="font-sans text-xs text-slate-700 block">Color Palette</span>
                <select
                  value={colorStyle}
                  onChange={(e) => setColorStyle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 font-sans text-xs outline-hidden focus:border-brand-indigo"
                >
                  <option value="sunset">Sunset Orange & Indigo</option>
                  <option value="emerald">Vibrant Emerald Crops</option>
                  <option value="ocean">Deep Ocean Blue</option>
                  <option value="grey">Subtle Academic Grey</option>
                  <option value="pastel">Soft Pastel Rainbow</option>
                  <option value="forest">Earthy Forest & Olive</option>
                  <option value="nocolor">Plain (No Color / B&W Outline)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SVG Map Area Right Column */}
          <div className="flex-1 overflow-auto p-6 flex flex-col justify-between bg-slate-50/20">
            {/* Toolbar */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-xs font-bold text-slate-600">Generated Field Map Preview</h3>
              <div className="flex space-x-2">
                <button
                  onClick={generateLayout}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 text-[10px] font-bold flex items-center space-x-1 cursor-pointer"
                  title="Reshuffle Randomization"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Reshuffle</span>
                </button>
                <button
                  onClick={downloadSVG}
                  className="rounded-xl bg-brand-indigo px-3 py-1.5 text-white hover:bg-indigo-700 text-[10px] font-bold flex items-center space-x-1 shadow-xs cursor-pointer"
                  title="Download Scale-invariant Vector Graphic"
                >
                  <Download className="h-3 w-3" />
                  <span>Download SVG</span>
                </button>
                <button
                  onClick={downloadPNG}
                  className="rounded-xl bg-brand-orange px-3 py-1.5 text-white hover:bg-orange-600 text-[10px] font-bold flex items-center space-x-1 shadow-xs cursor-pointer"
                  title="Download High-Resolution PNG Image"
                >
                  <Download className="h-3 w-3" />
                  <span>Download PNG</span>
                </button>
              </div>
            </div>

            {/* SVG Render Container */}
            <div className="flex-1 flex justify-center items-center rounded-2xl border border-slate-100 bg-white p-4 shadow-sm min-h-[300px] max-h-[420px] overflow-hidden">
              {renderSVGLayout()}
            </div>

            {/* Info notice */}
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100/50 p-3 text-[10px] text-slate-400 font-sans leading-relaxed">
              <strong>Randomization rule:</strong> Agronomic layout plots are randomized independently for each block to protect against spatial gradients. The "Plain (No Color)" option is pre-formatted for grayscale publications.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LayoutGeneratorModal;
