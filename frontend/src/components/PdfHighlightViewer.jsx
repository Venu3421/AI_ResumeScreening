import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Configure PDF.js worker to use local public worker with fallback
try {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
} catch (_e) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export default function PdfHighlightViewer({
  pdfFile,
  highlights = [],
  pageDimensions = [],
  onHighlightClick = null,
  fileName = 'resume.pdf',
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(720);
  const [numPages, setNumPages] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [showHighlights, setShowHighlights] = useState(true);
  const [activeTypeFilter, setActiveTypeFilter] = useState('all'); // 'all' | 'matched' | 'suggestion' | 'gap'
  const [hoveredHighlight, setHoveredHighlight] = useState(null);
  const [pageNaturalSizes, setPageNaturalSizes] = useState({});
  const [selectedHighlightIdx, setSelectedHighlightIdx] = useState(null);
  const [pdfLoadError, setPdfLoadError] = useState(null);
  const highlightRefs = useRef({});

  // Responsive width tracking
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const measured = containerRef.current.clientWidth;
        if (measured > 100) {
          // Leave room for padding & borders
          setContainerWidth(Math.max(360, measured - 32));
        }
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const onDocumentLoadSuccess = ({ numPages: loadedPages }) => {
    setNumPages(loadedPages);
    setPdfLoadError(null);
  };

  const onDocumentLoadError = (err) => {
    console.error('Failed to load PDF in PdfHighlightViewer:', err);
    setPdfLoadError(err.message || 'Could not load PDF document.');
  };

  const onPageLoadSuccess = (pageIndex, page) => {
    const origWidth = page.originalWidth || page.width;
    const origHeight = page.originalHeight || page.height;
    setPageNaturalSizes((prev) => ({
      ...prev,
      [pageIndex]: { width: origWidth, height: origHeight },
    }));
  };

  // Helper to check category
  const isMatchCategory = (type) => type === 'matched_keyword' || type === 'strength' || type === 'green';
  const isSuggestionCategory = (type) => type === 'suggestion' || type === 'yellow';
  const isGapCategory = (type) => type === 'missing_keyword' || type === 'weakness' || type === 'gap' || type === 'red';

  // Counts for UI badges
  const matchedCount = useMemo(
    () => (highlights || []).filter((h) => isMatchCategory(h.type)).length,
    [highlights],
  );
  const suggestionCount = useMemo(
    () => (highlights || []).filter((h) => isSuggestionCategory(h.type)).length,
    [highlights],
  );
  const gapCount = useMemo(
    () => (highlights || []).filter((h) => isGapCategory(h.type)).length,
    [highlights],
  );

  // Filtered highlights based on toggle & filter category
  const filteredHighlights = useMemo(() => {
    if (!showHighlights || !Array.isArray(highlights)) return [];
    if (activeTypeFilter === 'all') return highlights;
    if (activeTypeFilter === 'matched') return highlights.filter((h) => isMatchCategory(h.type));
    if (activeTypeFilter === 'suggestion') return highlights.filter((h) => isSuggestionCategory(h.type));
    if (activeTypeFilter === 'gap') return highlights.filter((h) => isGapCategory(h.type));
    return highlights;
  }, [highlights, showHighlights, activeTypeFilter]);

  // Group highlights by page index
  const highlightsByPage = useMemo(() => {
    const map = {};
    for (let p = 0; p < (numPages || 1); p++) {
      map[p] = [];
    }
    filteredHighlights.forEach((h, idx) => {
      const pageIdx = typeof h.page === 'number' ? h.page : 0;
      if (!map[pageIdx]) map[pageIdx] = [];
      map[pageIdx].push({ ...h, globalIdx: idx });
    });
    return map;
  }, [filteredHighlights, numPages]);

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(2.0, Math.round((z + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100));
  const handleResetZoom = () => setZoomLevel(1.0);

  // Jump to specific highlight
  const jumpToHighlight = (direction) => {
    if (filteredHighlights.length === 0) return;
    let nextIdx = 0;
    if (selectedHighlightIdx !== null) {
      if (direction === 'next') {
        nextIdx = (selectedHighlightIdx + 1) % filteredHighlights.length;
      } else {
        nextIdx = (selectedHighlightIdx - 1 + filteredHighlights.length) % filteredHighlights.length;
      }
    }
    setSelectedHighlightIdx(nextIdx);
    const target = filteredHighlights[nextIdx];
    if (target) {
      const el = highlightRefs.current[nextIdx];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Render calculated page width
  const renderedPageWidth = useMemo(() => {
    return Math.round(containerWidth * zoomLevel);
  }, [containerWidth, zoomLevel]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col rounded-2xl bg-slate-900/5 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner"
    >
      {/* ================= Enhanced PDF Toolbar ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 text-xs select-none">
        {/* Left: Highlights summary & category filter */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Highlights toggle */}
          <button
            type="button"
            onClick={() => setShowHighlights((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-bold transition-all cursor-pointer ${
              showHighlights
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
            title={showHighlights ? 'Hide coordinate highlights' : 'Show coordinate highlights'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {showHighlights ? 'layers' : 'layers_clear'}
            </span>
            <span>Highlights {showHighlights ? 'ON' : 'OFF'}</span>
          </button>

          {showHighlights && highlights.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setActiveTypeFilter('all')}
                className={`rounded-md px-2 py-1 font-semibold transition-all cursor-pointer ${
                  activeTypeFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All ({highlights.length})
              </button>

              {matchedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter('matched')}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-all cursor-pointer ${
                    activeTypeFilter === 'matched'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  }`}
                  title="Matched Skills & Strengths"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  Strengths ({matchedCount})
                </button>
              )}

              {suggestionCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter('suggestion')}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-all cursor-pointer ${
                    activeTypeFilter === 'suggestion'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  }`}
                  title="Improvement Suggestions & Metrics"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                  Suggestions ({suggestionCount})
                </button>
              )}

              {gapCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTypeFilter('gap')}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold transition-all cursor-pointer ${
                    activeTypeFilter === 'gap'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                  }`}
                  title="Missing Critical Keywords & Gaps"
                >
                  <span className="h-2 w-2 rounded-full bg-rose-400"></span>
                  Gaps ({gapCount})
                </button>
              )}
            </div>
          )}

          {/* Jump to next/prev highlight */}
          {showHighlights && filteredHighlights.length > 0 && (
            <div className="flex items-center gap-1 text-slate-500">
              <button
                type="button"
                onClick={() => jumpToHighlight('prev')}
                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Previous Highlight"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
              </button>
              <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                {selectedHighlightIdx !== null ? selectedHighlightIdx + 1 : 1}/{filteredHighlights.length}
              </span>
              <button
                type="button"
                onClick={() => jumpToHighlight('next')}
                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Next Highlight"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Pages & Zoom Controls */}
        <div className="flex items-center gap-2">
          {numPages && (
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              {numPages} {numPages === 1 ? 'Page' : 'Pages'}
            </span>
          )}

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 0.6}
              className="rounded-md p-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined text-[16px]">remove</span>
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2 py-1 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-primary cursor-pointer"
              title="Reset Zoom"
            >
              {Math.round(zoomLevel * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 2.0}
              className="rounded-md p-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer"
              title="Zoom In"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= PDF Canvas & Highlight Layers Container ================= */}
      <div className="relative min-h-[500px] max-h-[860px] overflow-auto p-4 sm:p-6 flex justify-center bg-slate-100/60 dark:bg-slate-900/40">
        {pdfLoadError ? (
          <div className="m-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
            <span className="material-symbols-outlined text-4xl text-rose-500 mb-2">
              error_outline
            </span>
            <h4 className="text-sm font-bold text-rose-800 dark:text-rose-200">
              Unable to render PDF document
            </h4>
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{pdfLoadError}</p>
          </div>
        ) : !pdfFile ? (
          <div className="m-auto text-center p-8 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-2 text-slate-300">
              description
            </span>
            <p className="text-sm font-semibold">No PDF document loaded</p>
          </div>
        ) : (
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary mb-3"></div>
                <p className="text-xs font-semibold">Rendering PDF & calculating coordinates...</p>
              </div>
            }
            className="flex flex-col items-center gap-6"
          >
            {Array.from(new Array(numPages || 0), (_, pageIdx) => {
              const pageHighlights = highlightsByPage[pageIdx] || [];
              const naturalSize = pageNaturalSizes[pageIdx] || pageDimensions[pageIdx] || {
                width: 612.0,
                height: 792.0,
              };

              // Exact scale factor from PDF points to rendered CSS pixels
              const scale = renderedPageWidth / naturalSize.width;
              const renderedHeight = Math.round(naturalSize.height * scale);

              return (
                <div
                  key={`pdf-page-${pageIdx}`}
                  className="relative shadow-2xl rounded-xl overflow-hidden bg-white border border-slate-200/90 dark:border-slate-700/80 transition-shadow duration-300"
                  style={{
                    width: `${renderedPageWidth}px`,
                    minHeight: `${renderedHeight}px`,
                  }}
                >
                  {/* react-pdf Page Canvas */}
                  <Page
                    pageNumber={pageIdx + 1}
                    width={renderedPageWidth}
                    renderTextLayer={true}
                    renderAnnotationLayer={false}
                    onLoadSuccess={(page) => onPageLoadSuccess(pageIdx, page)}
                    loading={
                      <div
                        className="flex items-center justify-center bg-white text-slate-400 text-xs"
                        style={{ width: `${renderedPageWidth}px`, height: `${renderedHeight}px` }}
                      >
                        Loading Page {pageIdx + 1}...
                      </div>
                    }
                  />

                  {/* ================= Coordinate Highlight Overlays Layer ================= */}
                  {showHighlights && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        width: `${renderedPageWidth}px`,
                        height: `${renderedHeight}px`,
                        mixBlendMode: 'multiply',
                      }}
                    >
                      {pageHighlights.map((hl) => {
                        const [x0, y0, x1, y1] = hl.rect;
                        // Transform PDF point bounding box to CSS pixel coordinates
                        const left = Math.max(0, x0 * scale - 1.5);
                        const top = Math.max(0, y0 * scale - 1.5);
                        const width = Math.max(8, (x1 - x0) * scale + 3.0);
                        const height = Math.max(6, (y1 - y0) * scale + 3.0);

                        const isMatched = isMatchCategory(hl.type);
                        const isSuggestion = isSuggestionCategory(hl.type);
                        const isGap = isGapCategory(hl.type);
                        const isSelected = selectedHighlightIdx === hl.globalIdx;

                        let styleClasses = '';
                        let typeLabel = 'Keyword';
                        let dotColor = 'bg-slate-400';

                        if (isMatched) {
                          typeLabel = 'Matched ATS Skill';
                          dotColor = 'bg-emerald-400';
                          styleClasses = isSelected
                            ? 'bg-emerald-500/50 ring-2 ring-emerald-500 ring-offset-1 border-b-2 border-emerald-600 shadow-md'
                            : 'bg-emerald-400/40 hover:bg-emerald-400/65 border-b-2 border-emerald-500 hover:shadow-xs';
                        } else if (isSuggestion) {
                          typeLabel = 'Optimization Suggestion';
                          dotColor = 'bg-amber-400';
                          styleClasses = isSelected
                            ? 'bg-amber-500/50 ring-2 ring-amber-500 ring-offset-1 border-b-2 border-amber-600 shadow-md'
                            : 'bg-amber-300/45 hover:bg-amber-300/70 border-b-2 border-amber-500 hover:shadow-xs';
                        } else {
                          typeLabel = 'Critical Gap / Missing Skill';
                          dotColor = 'bg-rose-400';
                          styleClasses = isSelected
                            ? 'bg-rose-500/50 ring-2 ring-rose-500 ring-offset-1 border-b-2 border-rose-600 shadow-md'
                            : 'bg-rose-400/40 hover:bg-rose-400/65 border-b-2 border-rose-500 hover:shadow-xs';
                        }

                        return (
                          <div
                            key={`hl-${pageIdx}-${hl.globalIdx}`}
                            ref={(el) => {
                              if (el) highlightRefs.current[hl.globalIdx] = el;
                            }}
                            onClick={() => {
                              setSelectedHighlightIdx(hl.globalIdx);
                              if (onHighlightClick) onHighlightClick(hl);
                            }}
                            onMouseEnter={() => setHoveredHighlight({ ...hl, left, top, typeLabel, dotColor })}
                            onMouseLeave={() => setHoveredHighlight(null)}
                            style={{
                              position: 'absolute',
                              left: `${left}px`,
                              top: `${top}px`,
                              width: `${width}px`,
                              height: `${height}px`,
                            }}
                            className={`pointer-events-auto cursor-pointer rounded-[2px] transition-all duration-150 ${styleClasses}`}
                            title={`${typeLabel}: "${hl.text}"`}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Page index footer badge */}
                  <div className="absolute bottom-2 right-3 z-10 rounded-full bg-slate-900/60 px-2.5 py-0.5 text-[10px] font-mono font-bold text-white/90 backdrop-blur-xs pointer-events-none select-none">
                    Page {pageIdx + 1}
                  </div>
                </div>
              );
            })}
          </Document>
        )}

        {/* Floating Tooltip for Active Hovered Highlight */}
        {hoveredHighlight && (
          <div
            className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white shadow-xl animate-fade-in"
            style={{
              left: `${Math.min(window.innerWidth - 100, Math.max(100, hoveredHighlight.left + 50))}px`,
              top: `${Math.max(10, hoveredHighlight.top - 8)}px`,
            }}
          >
            <div className="flex items-center gap-1.5 font-medium">
              <span className={`h-2 w-2 rounded-full ${hoveredHighlight.dotColor || 'bg-emerald-400'}`} />
              <span className="font-bold text-slate-300">
                {hoveredHighlight.typeLabel || 'Highlight'}:
              </span>
              <span className="text-white font-extrabold">{hoveredHighlight.text}</span>
            </div>
          </div>
        )}
      </div>

      {/* Highlights count footer bar */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <strong className="text-slate-700 dark:text-slate-300">{matchedCount}</strong> Strengths Matched
          </span>
          {suggestionCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <strong className="text-slate-700 dark:text-slate-300">{suggestionCount}</strong> Suggestions
            </span>
          )}
          {gapCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              <strong className="text-slate-700 dark:text-slate-300">{gapCount}</strong> Gaps Identified
            </span>
          )}
        </div>
        <span className="italic text-slate-400">
          Click any highlight or use arrows to navigate keywords
        </span>
      </div>
    </div>
  );
}
