/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useBrowserSocket } from './hooks/useBrowserSocket';
import { Header } from './components/Header';
import { ChromeExtensionBanner } from './components/ChromeExtensionBanner';
import { NavigationTabs } from './components/NavigationTabs';
import { BrowserControlsBar } from './components/BrowserControlsBar';
import { ChatSection } from './components/ChatSection';
import { RemoteViewport } from './components/RemoteViewport';
import { AudioSessionPanel } from './components/AudioSessionPanel';
import { NavigationTab } from './types';
import { AlertTriangle, RefreshCw, Activity } from 'lucide-react';
import { freezeDetector } from './utils/freezeDetector';

// Lazy load non-critical components
const DiagnosticsPanel = lazy(() =>
  import('./components/DiagnosticsPanel').then((m) => ({ default: m.DiagnosticsPanel }))
);
const SelfTestModal = lazy(() =>
  import('./components/SelfTestModal').then((m) => ({ default: m.SelfTestModal }))
);

export default function App() {
  const { state, wsConnected, sendAction } = useBrowserSocket();
  const [activeTab, setActiveTab] = useState<NavigationTab>('split');
  const [isSelfTestOpen, setIsSelfTestOpen] = useState(false);
  const [testSteps, setTestSteps] = useState<string[]>([]);
  const [testReport, setTestReport] = useState<any | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const autoInitRef = useRef(false);

  // Background auto-initialization: starts once without blocking UI rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!autoInitRef.current && state.browserStatus === 'disconnected') {
        autoInitRef.current = true;
        sendAction({ type: 'openPiAi' });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [state.browserStatus, sendAction]);

  const handleLaunch = () => sendAction({ type: 'launchBrowser' });
  const handleStop = () => sendAction({ type: 'stopBrowser' });
  const handleOpenPi = () => sendAction({ type: 'openPiAi' });
  const handleReload = () => sendAction({ type: 'reloadPiAi' });
  const handleSendMessage = (text: string) => sendAction({ type: 'sendMessage', text });
  const handleClearLogs = () => sendAction({ type: 'clearLogs' });

  const handleMouseClick = (
    browserX: number,
    browserY: number,
    displayX?: number,
    displayY?: number,
    button: 'left' | 'right' | 'middle' = 'left',
    clickCount: number = 1
  ) => {
    sendAction({
      type: 'mouseClick',
      browserX,
      browserY,
      displayX,
      displayY,
      button,
      clickCount,
    });
  };

  const handleWheel = (browserX: number, browserY: number, deltaX: number, deltaY: number) => {
    sendAction({
      type: 'wheel',
      browserX,
      browserY,
      deltaX,
      deltaY,
    });
  };

  const handleKeyPress = (key: string) => sendAction({ type: 'keyPress', key });
  const handleTypeText = (text: string) => sendAction({ type: 'typeText', text });

  const handleTestConnection = () => {
    if (state.browserStatus === 'connected') {
      sendAction({ type: 'reloadPiAi' });
    } else {
      sendAction({ type: 'launchBrowser' });
    }
  };

  const handleSendTest = () => {
    handleSendMessage('مرحبا، من أنت؟');
  };

  const handleRunSelfTest = async () => {
    setIsSelfTestOpen(true);
    setIsTesting(true);
    setTestSteps(['بدء تشغيل الاختبارات الإلزامية...']);
    setTestReport(null);
    setTestError(null);

    try {
      const response = await fetch('/api/browser/test', { method: 'POST' });
      const data = await response.json();
      if (data.steps) {
        setTestSteps(data.steps);
      }
      if (data.report) {
        setTestReport(data.report);
      }
      if (!data.success) {
        setTestError(data.error || 'فشل في أحد الاختبارات.');
      }
    } catch (err: any) {
      setTestError(err.message || 'خطأ في الاتصال بالخادم.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleTabChange = (newTab: NavigationTab) => {
    setActiveTab(newTab);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans" dir="rtl">
      {/* Top Application Header */}
      <Header
        browserStatus={state.browserStatus}
        piAiStatus={state.piAiStatus}
        wsConnected={wsConnected}
        isBusy={state.isBusy}
        busyAction={state.busyAction}
        onLaunch={handleLaunch}
        onStop={handleStop}
        onOpenPi={handleOpenPi}
        onReload={handleReload}
        onRunTest={handleRunSelfTest}
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Real Chrome Extension Download & Installation Section */}
        <ChromeExtensionBanner />

        {/* Error State Banner */}
        {state.diagnostics.lastError && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <strong>تنبيه المتصفح:</strong> {state.diagnostics.lastError}
              </div>
            </div>
            <button
              onClick={handleLaunch}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-800 hover:bg-rose-700 text-white font-medium transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة تشغيل المتصفح</span>
            </button>
          </div>
        )}

        {/* Global Navigation Tabs (5 dedicated views with zero reloads) */}
        <NavigationTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          audioQueueCount={state.audioQueue?.length || 0}
          hasActiveAudio={state.diagnostics.voiceFileReady === 'Ready' || state.diagnostics.voiceFileReady === 'Fetching...'}
          uiFreeze={state.diagnostics.uiFreeze}
        />

        {/* Browser Control Buttons Bar */}
        <BrowserControlsBar
          browserStatus={state.browserStatus}
          piAiStatus={state.piAiStatus}
          isBusy={state.isBusy}
          onLaunch={handleLaunch}
          onStop={handleStop}
          onOpenPi={handleOpenPi}
          onReload={handleReload}
          onTestConnection={handleTestConnection}
          onSendTest={handleSendTest}
          onOpenSelfTestModal={() => setIsSelfTestOpen(true)}
        />

        {/* View Container: Kept persistent across navigation to prevent tearing down Chromium or Screencast */}
        
        {/* Tab 1: Split View (Both Chat + Remote Viewport side by side) */}
        <div className={activeTab === 'split' ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start' : 'hidden'}>
          <div className="lg:col-span-6 h-full">
            <ChatSection
              messages={state.messages}
              piAiStatus={state.piAiStatus}
              isBusy={state.isBusy}
              onSendMessage={handleSendMessage}
              onQuickPrompt={handleSendMessage}
            />
          </div>
          <div className="lg:col-span-6 h-full">
            <RemoteViewport
              browserStatus={state.browserStatus}
              piAiStatus={state.piAiStatus}
              currentUrl={state.currentUrl}
              pageTitle={state.pageTitle}
              screencastActive={state.screencastActive}
              onMouseClick={handleMouseClick}
              onWheel={handleWheel}
              onKeyPress={handleKeyPress}
              onTypeText={handleTypeText}
              onReload={handleReload}
            />
          </div>
        </div>

        {/* Tab 2: Focused Chat View */}
        <div className={activeTab === 'chat' ? 'max-w-4xl mx-auto w-full' : 'hidden'}>
          <ChatSection
            messages={state.messages}
            piAiStatus={state.piAiStatus}
            isBusy={state.isBusy}
            onSendMessage={handleSendMessage}
            onQuickPrompt={handleSendMessage}
          />
        </div>

        {/* Tab 3: Focused Remote Chromium Viewport View */}
        <div className={activeTab === 'viewport' ? 'w-full' : 'hidden'}>
          <RemoteViewport
            browserStatus={state.browserStatus}
            piAiStatus={state.piAiStatus}
            currentUrl={state.currentUrl}
            pageTitle={state.pageTitle}
            screencastActive={state.screencastActive}
            onMouseClick={handleMouseClick}
            onWheel={handleWheel}
            onKeyPress={handleKeyPress}
            onTypeText={handleTypeText}
            onReload={handleReload}
          />
        </div>

        {/* Tab 4: Audio Session Panel */}
        <div className={activeTab === 'audio' ? 'w-full' : 'hidden'}>
          <AudioSessionPanel
            audioQueue={state.audioQueue || []}
            isCaptureActive={state.diagnostics.voiceFileReady === 'Fetching...'}
            lastCapturedDuration={state.diagnostics.audioDuration}
          />
        </div>

        {/* Tab 5: Stability & Diagnostics Panel */}
        <div className={activeTab === 'diagnostics' ? 'w-full' : 'hidden'}>
          <Suspense
            fallback={
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400 animate-spin" />
                <span>جارٍ تحميل لوحة التشخيص...</span>
              </div>
            }
          >
            <DiagnosticsPanel
              diagnostics={state.diagnostics}
              onClearLogs={handleClearLogs}
            />
          </Suspense>
        </div>

        {/* Quick Diagnostics Strip always visible at bottom when in Split view */}
        {activeTab === 'split' && (
          <div className="w-full">
            <Suspense fallback={null}>
              <DiagnosticsPanel
                diagnostics={state.diagnostics}
                onClearLogs={handleClearLogs}
              />
            </Suspense>
          </div>
        )}
      </main>

      {/* Mandatory Self-Test Modal Dialog */}
      {isSelfTestOpen && (
        <Suspense fallback={null}>
          <SelfTestModal
            isOpen={isSelfTestOpen}
            onClose={() => setIsSelfTestOpen(false)}
            isRunning={isTesting}
            onRunTest={handleRunSelfTest}
            testSteps={testSteps}
            testReport={testReport}
            error={testError}
          />
        </Suspense>
      )}
    </div>
  );
}
