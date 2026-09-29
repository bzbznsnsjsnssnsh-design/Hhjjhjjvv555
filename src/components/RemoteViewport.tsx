import React, { useRef, useState, useEffect, useCallback } from 'react';
import { BrowserStatus, PiAiStatus } from '../types';
import { subscribeScreencastFrame } from '../hooks/useBrowserSocket';
import { 
  Monitor, 
  MousePointer, 
  ShieldAlert, 
  Maximize2, 
  Keyboard, 
  Info, 
  Crosshair, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Sliders
} from 'lucide-react';

interface RemoteViewportProps {
  screencastFrame?: string | null;
  browserStatus: BrowserStatus;
  piAiStatus: PiAiStatus;
  currentUrl: string;
  pageTitle: string;
  screencastActive: boolean;
  onMouseClick: (
    browserX: number, 
    browserY: number, 
    displayX?: number, 
    displayY?: number, 
    button?: 'left' | 'right' | 'middle', 
    clickCount?: number
  ) => void;
  onWheel: (browserX: number, browserY: number, deltaX: number, deltaY: number) => void;
  onKeyPress: (key: string) => void;
  onTypeText: (text: string) => void;
  onReload: () => void;
}

interface ClickDebugInfo {
  displayX: number;
  displayY: number;
  browserX: number;
  browserY: number;
  scaleX: number;
  scaleY: number;
  elementX: number;
  elementY: number;
}

export const RemoteViewport: React.FC<RemoteViewportProps> = ({
  screencastFrame: externalFrame,
  browserStatus,
  piAiStatus,
  currentUrl,
  pageTitle,
  screencastActive,
  onMouseClick,
  onWheel,
  onKeyPress,
  onTypeText,
  onReload,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  const [screencastFrame, setScreencastFrame] = useState<string | null>(externalFrame || null);

  useEffect(() => {
    return subscribeScreencastFrame((frame) => {
      setScreencastFrame(frame);
    });
  }, []);
  
  const [clickDebug, setClickDebug] = useState<ClickDebugInfo | null>(null);
  const [showDebugOverlay, setShowDebugOverlay] = useState(true);
  const [directInput, setDirectInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentScale, setCurrentScale] = useState<{ scaleX: number; scaleY: number; renderedWidth: number; renderedHeight: number }>({
    scaleX: 1,
    scaleY: 1,
    renderedWidth: 1280,
    renderedHeight: 800,
  });

  // Calculate true rendered image bounds inside the container taking letterboxing/pillarboxing into account
  const getRenderedImageBounds = useCallback(() => {
    if (!imageRef.current) return null;
    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    
    // Virtual browser dimensions
    const browserWidth = 1280;
    const browserHeight = 800;
    const naturalRatio = browserWidth / browserHeight; // 1.6
    const elementRatio = rect.width / rect.height;

    let renderedWidth = rect.width;
    let renderedHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elementRatio > naturalRatio) {
      // Pillarbox (empty bars on left/right)
      renderedWidth = rect.height * naturalRatio;
      offsetX = (rect.width - renderedWidth) / 2;
    } else {
      // Letterbox (empty bars on top/bottom)
      renderedHeight = rect.width / naturalRatio;
      offsetY = (rect.height - renderedHeight) / 2;
    }

    const scaleX = browserWidth / renderedWidth;
    const scaleY = browserHeight / renderedHeight;

    return {
      rect,
      left: rect.left + offsetX,
      top: rect.top + offsetY,
      width: renderedWidth,
      height: renderedHeight,
      scaleX,
      scaleY,
    };
  }, []);

  // Update scale stats on resize or fullscreen toggle (bounds only change on geometry changes)
  useEffect(() => {
    const updateStats = () => {
      const bounds = getRenderedImageBounds();
      if (bounds) {
        const newW = Math.round(bounds.width);
        const newH = Math.round(bounds.height);
        setCurrentScale((prev) => {
          if (
            prev.renderedWidth === newW &&
            prev.renderedHeight === newH &&
            Math.abs(prev.scaleX - bounds.scaleX) < 0.001 &&
            Math.abs(prev.scaleY - bounds.scaleY) < 0.001
          ) {
            return prev;
          }
          return {
            scaleX: bounds.scaleX,
            scaleY: bounds.scaleY,
            renderedWidth: newW,
            renderedHeight: newH,
          };
        });
      }
    };

    updateStats();
    window.addEventListener('resize', updateStats);
    return () => window.removeEventListener('resize', updateStats);
  }, [getRenderedImageBounds, isFullscreen]);

  // Convert client click to exact Chromium viewport coordinates
  const handleMouseInteraction = (
    e: React.MouseEvent<HTMLDivElement>, 
    button: 'left' | 'right' | 'middle' = 'left',
    clickCount: number = 1
  ) => {
    if (browserStatus !== 'connected') return;
    const bounds = getRenderedImageBounds();
    if (!bounds) return;

    const displayX = e.clientX - bounds.left;
    const displayY = e.clientY - bounds.top;

    // Check if within the image content (ignore outer padding)
    if (displayX < 0 || displayX > bounds.width || displayY < 0 || displayY > bounds.height) {
      return;
    }

    const browserX = Math.max(0, Math.min(1280, Math.round(displayX * bounds.scaleX)));
    const browserY = Math.max(0, Math.min(800, Math.round(displayY * bounds.scaleY)));

    // Element-relative for visual pointer
    if (containerRef.current) {
      const cRect = containerRef.current.getBoundingClientRect();
      setClickDebug({
        displayX: Math.round(displayX),
        displayY: Math.round(displayY),
        browserX,
        browserY,
        scaleX: bounds.scaleX,
        scaleY: bounds.scaleY,
        elementX: e.clientX - cRect.left,
        elementY: e.clientY - cRect.top,
      });

      // Auto-hide indicator after 2.5s
      setTimeout(() => {
        setClickDebug(null);
      }, 2500);
    }

    onMouseClick(browserX, browserY, Math.round(displayX), Math.round(displayY), button, clickCount);
  };

  // Wheel / Scroll event handling
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (browserStatus !== 'connected') return;
    const bounds = getRenderedImageBounds();
    if (!bounds) return;

    const displayX = e.clientX - bounds.left;
    const displayY = e.clientY - bounds.top;

    const browserX = Math.max(0, Math.min(1280, Math.round(displayX * bounds.scaleX)));
    const browserY = Math.max(0, Math.min(800, Math.round(displayY * bounds.scaleY)));

    onWheel(browserX, browserY, e.deltaX, e.deltaY);
  };

  const handleDirectTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directInput.trim()) return;
    onTypeText(directInput);
    setDirectInput('');
  };

  return (
    <div
      className={`flex flex-col bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl bg-slate-950' : 'h-full'
      }`}
    >
      {/* Viewport Header */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-teal-400" />
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>
                {screencastFrame ? 'Chromium Viewer: Live (بث حي مباشر)' : 'Chromium Viewer: Connecting... (جارٍ الاتصال)'}
              </span>
              {screencastFrame && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="بث حي نشط"></span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono truncate max-w-sm">
              {currentUrl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDebugOverlay(!showDebugOverlay)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-colors ${
              showDebugOverlay
                ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="تفعيل/تعطيل مؤشر إحداثيات النقر (Debug)"
          >
            <Crosshair className="w-3 h-3" />
            <span>إحداثيات النقر</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1"
            title="تكبير / تصغير"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CAPTCHA / Login Notice Overlay Banner */}
      {piAiStatus === 'waiting_captcha_login' && (
        <div className="bg-amber-950/90 border-b border-amber-800/80 px-4 py-2 text-amber-200 text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>مطلوب تدخل المستخدم:</strong> تم اكتشاف Cloudflare Turnstile أو CAPTCHA أو تسجيل الدخول. اضغط مباشرة على الشاشة أدناه لإكمال التحقق!
            </span>
          </div>
          <button
            onClick={onReload}
            className="px-2.5 py-1 bg-amber-800 hover:bg-amber-700 text-white rounded font-medium text-[11px] transition-colors"
          >
            إعادة فحص
          </button>
        </div>
      )}

      {/* Screen Frame Container with Accurate Coordinate Mapping */}
      <div
        ref={containerRef}
        onClick={(e) => handleMouseInteraction(e, 'left', 1)}
        onDoubleClick={(e) => handleMouseInteraction(e, 'left', 2)}
        onContextMenu={(e) => {
          e.preventDefault();
          handleMouseInteraction(e, 'right', 1);
        }}
        onWheel={handleWheel}
        className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden cursor-crosshair min-h-[340px] select-none"
      >
        {screencastFrame ? (
          <img
            ref={imageRef}
            src={screencastFrame}
            alt="Real Chromium Live Screencast Viewport"
            className="w-full h-full object-contain pointer-events-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-8 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
              <Monitor className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-slate-300">
                {browserStatus === 'connected'
                  ? 'بانتظار وصول الإطار الأول من Chromium...'
                  : 'متصفح Chromium غير متصل حالياً'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                عند تشغيل المتصفح، يتم التقاط إطارات الشاشة لحظياً عبر DevTools Protocol وبثها هنا مع دعم كامل للنقر والتمرير والتفاعل الحقيقي.
              </p>
            </div>
          </div>
        )}

        {/* Live Click Debug Overlay & Ripple Indicator */}
        {clickDebug && (
          <>
            {/* Visual Ring Indicator */}
            <span
              className="absolute w-6 h-6 rounded-full border-2 border-emerald-400 bg-emerald-400/30 animate-ping pointer-events-none z-10"
              style={{
                left: `${clickDebug.elementX - 12}px`,
                top: `${clickDebug.elementY - 12}px`,
              }}
            />
            {/* Static Crosshair Dot */}
            <span
              className="absolute w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-200 pointer-events-none z-10"
              style={{
                left: `${clickDebug.elementX - 4}px`,
                top: `${clickDebug.elementY - 4}px`,
              }}
            />
            {/* Floating Coordinate Tag */}
            {showDebugOverlay && (
              <div
                className="absolute z-20 pointer-events-none bg-slate-900/95 border border-emerald-500/60 text-white rounded-lg p-2 text-[10px] font-mono shadow-xl backdrop-blur space-y-0.5"
                style={{
                  left: `${Math.min(clickDebug.elementX + 12, (containerRef.current?.clientWidth || 600) - 170)}px`,
                  top: `${Math.max(10, clickDebug.elementY - 60)}px`,
                }}
              >
                <div className="text-emerald-400 font-bold flex items-center gap-1">
                  <MousePointer className="w-3 h-3" />
                  <span>Mapped Click:</span>
                </div>
                <div>Display: ({clickDebug.displayX}, {clickDebug.displayY})</div>
                <div className="text-sky-300 font-bold">Browser: ({clickDebug.browserX}, {clickDebug.browserY})</div>
                <div className="text-slate-400">Scale: {clickDebug.scaleX.toFixed(3)} / {clickDebug.scaleY.toFixed(3)}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Coordinate Scale Stats Bar (Live Diagnostics) */}
      <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span>Browser: <strong className="text-slate-200">1280×800</strong></span>
          <span>Screencast: <strong className="text-slate-200">1280×800</strong></span>
          <span>DPR: <strong className="text-slate-200">{window.devicePixelRatio || 1}</strong></span>
          <span>Displayed: <strong className="text-slate-200">{currentScale.renderedWidth}×{currentScale.renderedHeight}</strong></span>
          <span>Scale: <strong className="text-emerald-400">{currentScale.scaleX.toFixed(3)} / {currentScale.scaleY.toFixed(3)}</strong></span>
        </div>
        <div className="text-slate-500">
          Left Click • Double Click • Right Click • Wheel Scroll
        </div>
      </div>

      {/* Direct Interactive Control Toolbar (Keyboard & Navigation Keys) */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <form onSubmit={handleDirectTextSubmit} className="flex-1 flex items-center gap-2 w-full">
          <Keyboard className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={directInput}
            onChange={(e) => setDirectInput(e.target.value)}
            placeholder="إرسال نص مباشر إلى العنصر المحدد في Chromium..."
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-teal-500 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!directInput.trim()}
            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors disabled:opacity-40"
          >
            كتابة
          </button>
        </form>

        {/* Essential Navigation & Editing Keys */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onKeyPress('Enter')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px]"
            title="إرسال مفتاح Enter"
          >
            Enter ↵
          </button>
          <button
            onClick={() => onKeyPress('Backspace')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px]"
            title="إرسال مفتاح Backspace"
          >
            ⌫
          </button>
          <button
            onClick={() => onKeyPress('Tab')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px]"
            title="إرسال مفتاح Tab"
          >
            Tab
          </button>
          <button
            onClick={() => onKeyPress('Escape')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px]"
            title="إرسال مفتاح Escape"
          >
            Esc
          </button>
          <div className="h-4 w-px bg-slate-800 mx-0.5"></div>
          <button
            onClick={() => onKeyPress('ArrowUp')}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Arrow Up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onKeyPress('ArrowDown')}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Arrow Down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transparent Environment Notice */}
      <div className="px-3 py-2 bg-slate-950 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
        <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
        <p className="leading-normal">
          <strong>نظام Coordinate Mapping دقيق:</strong> يتم تحويل إحداثيات النقر المعروضة displayX/Y إلى أبعاد Chromium الحقيقية 1280×800 بدقة رياضية، وإرسالها عبر بروتوكول DevTools Protocol (Input.dispatchMouseEvent) كتسلسل حقيقي (mouseMoved ← mousePressed ← mouseReleased) مع دعم كامل للتمرير (Scroll Wheel).
        </p>
      </div>
    </div>
  );
};
