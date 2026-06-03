import React, { useReducer, lazy, Suspense } from "react";
import { Lock, Upload, Signal } from "lucide-react";
import Header from "./components/Header";
import FileTransfer from "./components/FileTransfer";
import { useSession } from "./hooks/useSession";
import { useFileTransfer } from "./hooks/useFileTransfer";
import { config } from "./config/app.config";
import { formatSpeed } from "./utils/performance";

const About = lazy(() => import("./components/About"));
import Faq from "./components/FAQ";
const Privacy = lazy(() => import("./components/Privacy"));
const TermsOfService = lazy(() => import("./components/TermsOfService"));

const FEATURES = [
  { icon: Lock, bg: "bg-blue-500", title: "Secure Transfer", desc: "Your files are encrypted with DTLS 1.3, ensuring security during transfer." },
  { icon: Upload, bg: "bg-green-500", title: "Easy to Use", desc: "Simply select your file, share the link, and start transferring. It's that simple!" },
  { icon: Signal, bg: "bg-purple-500", title: "Seamless Uploads", desc: "Upload multiple files effortlessly and continuously. Whether it's one file or many, our platform supports smooth, uninterrupted transfers." },
];

const ShareModalContent: React.FC<{
  modalMode: "create" | "join";
  createInput: string;
  joinInput: string;
  onSetModalMode: (mode: "create" | "join") => void;
  onSetCreateInput: (v: string) => void;
  onSetJoinInput: (v: string) => void;
  handleCreateShare: () => void;
  handleJoinShare: () => void;
  onNavigateToTos: () => void;
}> = ({ modalMode, createInput, joinInput, onSetModalMode: setModalMode, onSetCreateInput: setCreateInput, onSetJoinInput: setJoinInput, handleCreateShare, handleJoinShare, onNavigateToTos }) => (
  <div className="fixed inset-0 bg-gray-950 bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
      <h2 className="text-2xl font-bold mb-6 text-white">PeerLink Share</h2>

      <div className="flex gap-2 mb-6">
        <button type="button"
          onClick={() => setModalMode("create")}
          className={`flex-1 py-2 px-4 rounded ${modalMode === "create"
            ? "bg-blue-500 text-white"
            : "bg-gray-700 text-gray-300"
            }`}
        >
          Create New
        </button>
        <button type="button"
          onClick={() => setModalMode("join")}
          className={`flex-1 py-2 px-4 rounded ${modalMode === "join"
            ? "bg-blue-500 text-white"
            : "bg-gray-700 text-gray-300"
            }`}
        >
          Join Existing
        </button>
      </div>

      {modalMode === "create" ? (
        <>
          <p className="text-gray-400 mb-4">Create a new share session</p>
          <input
            type="text"
            placeholder="Enter custom session link (optional)"
            value={createInput}
            onChange={(e) => setCreateInput(e.target.value)}
            aria-label="Custom session link"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded mb-4 text-white"
          />
          <button type="button"
            onClick={handleCreateShare}
            className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
          >
            Create Share
          </button>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Enter share ID"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            aria-label="Share ID"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded mb-4 text-white"
          />
          <button type="button"
            onClick={handleJoinShare}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            Join Share
          </button>
        </>
      )}
      <p className="text-xs text-gray-500 mt-4 text-center">
        By using Peer Link, you agree to our{" "}
        <button type="button" onClick={onNavigateToTos} className="text-blue-400 hover:text-blue-300 underline bg-transparent border-none p-0 cursor-pointer inline">
          Terms of Service
        </button>.
      </p>
    </div>
  </div>
);

type AppState = {
  currentView: string;
  showShareModal: boolean;
  modalMode: "create" | "join";
  joinInput: string;
  createInput: string;
  linkCopied: boolean;
};

type AppAction =
  | { type: "SET_VIEW"; view: string }
  | { type: "SET_SHOW_MODAL"; show: boolean }
  | { type: "SET_MODAL_MODE"; mode: "create" | "join" }
  | { type: "SET_JOIN_INPUT"; input: string }
  | { type: "SET_CREATE_INPUT"; input: string }
  | { type: "SET_LINK_COPIED"; copied: boolean };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_VIEW": return { ...state, currentView: action.view };
    case "SET_SHOW_MODAL": return { ...state, showShareModal: action.show };
    case "SET_MODAL_MODE": return { ...state, modalMode: action.mode };
    case "SET_JOIN_INPUT": return { ...state, joinInput: action.input };
    case "SET_CREATE_INPUT": return { ...state, createInput: action.input };
    case "SET_LINK_COPIED": return { ...state, linkCopied: action.copied };
    default: return state;
  }
}

const TopBars: React.FC<{
  failedUploads: Map<string, { reason: string; failedChunks: number[] }>;
  dismissError: (fileId: string) => void;
  retryingChunks: Map<string, number[]>;
  masterNode: { masterId?: string; isMe?: boolean; nodeId?: string } | null;
  masterNodeFailed: boolean;
  notifications: { join: boolean };
}> = ({ failedUploads, dismissError, retryingChunks, masterNode, masterNodeFailed, notifications }) => (
  <>
    {Array.from(failedUploads.entries()).map(([fileId, error]) => (
      <div key={fileId} className="fixed top-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-md">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Transfer Failed</h3>
            <p className="text-sm mb-2">{error.reason}</p>
            <p className="text-xs opacity-90">
              Failed chunks: {error.failedChunks.slice(0, 5).join(', ')}
              {error.failedChunks.length > 5 && ` +${error.failedChunks.length - 5} more`}
            </p>
          </div>
          <button type="button"
            onClick={() => dismissError(fileId)}
            className="ml-4 text-white hover:text-gray-200 text-xl font-bold"
          >
            ×
          </button>
        </div>
      </div>
    ))}

    {retryingChunks.size > 0 && (
      <div className="bg-yellow-600 text-white px-4 py-3 text-center text-sm font-medium">
        Retrying {Array.from(retryingChunks.values()).flat().length} chunk(s)...
      </div>
    )}

    {config.USE_CLUSTER && masterNode && (
      <div className="bg-blue-900 bg-opacity-50 border-b border-blue-700 px-4 py-2">
        <div className="container mx-auto flex items-center justify-between text-sm">
          <div className="flex items-center gap-3">
            <span className="text-blue-300">Master Node:</span>
            <span className="font-mono text-blue-100">
              {masterNode.masterId?.substring(0, 12)}...
            </span>
            {masterNode.isMe && (
              <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs font-bold">
                YOU
              </span>
            )}
          </div>
          {masterNodeFailed && (
            <span className="text-red-400 animate-pulse">
              Reconnecting to master…
            </span>
          )}
        </div>
      </div>
    )}

    {notifications.join && (
      <div className="bg-green-600 text-white p-4 text-center text-lg font-semibold animate-pulse">
        Connection ready - Ready to share files!
      </div>
    )}
  </>
);

const ShareIdBar: React.FC<{
  shareId: string;
  connectedClients: number;
  connectedNode: string;
  backendFeatures: { redis: boolean };
  clusterStats: { nodes?: { active: number; total: number } } | null;
}> = ({ shareId, connectedClients, connectedNode, backendFeatures, clusterStats }) => (
  <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-center text-sm text-gray-400">
    Share ID: <span className="font-mono text-blue-400">{shareId}</span> |
    Clients: {connectedClients}/2
    {backendFeatures.redis && (
      <span className="ml-3 text-green-400">Redis Sessions</span>
    )}
    {connectedNode && (
      <span className="ml-3 text-purple-400">
        Node:{" "}
        {connectedNode.replace("http://", "").replace("https://", "")}
        {config.USE_CLUSTER && (
          <span className="text-yellow-400"> (Cluster Mode)</span>
        )}
      </span>
    )}
    {clusterStats && (
      <span className="ml-3 text-blue-300">
        Nodes: {clusterStats.nodes?.active || 0}/
        {clusterStats.nodes?.total || 0}
      </span>
    )}
  </div>
);

const App: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, {
    currentView: "home",
    showShareModal: true,
    modalMode: "create" as const,
    joinInput: "",
    createInput: "",
    linkCopied: false,
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Use Custom Hooks
  const {
    socket,
    clientId,
    connected,
    status,
    shareId,
    connectedClients,
    connectedNode,
    backendFeatures,
    clusterStats,
    notifications,
    masterNode,
    masterNodeFailed,
    createShare,
    joinShare,
    leaveShare,
  } = useSession();

  const {
    fileUploads,
    downloadProgress,
    currentDownloadFileName,
    downloadedFiles,
    uploadSpeed,
    downloadSpeed,
    handleFilesSelected,
    initiateUploads,
    useCompression,
    resetState,
    failedUploads,
    retryingChunks,
    dismissError
  } = useFileTransfer(socket, clientId, shareId);

  // Derived state/actions
  const getConnectionLink = React.useCallback(() => shareId, [shareId]);

  const copyLinkToClipboard = React.useCallback(() => {
    navigator.clipboard.writeText(shareId);
    dispatch({ type: "SET_LINK_COPIED", copied: true });
    setTimeout(() => dispatch({ type: "SET_LINK_COPIED", copied: false }), 2000);
  }, [shareId]);

  const handleCreateShare = async () => {
    const result = await createShare(state.createInput.trim() || undefined);
    if (result.success) {
      dispatch({ type: "SET_SHOW_MODAL", show: false });
      dispatch({ type: "SET_CREATE_INPUT", input: "" });
    } else {
      alert(result.error || "Error creating share");
    }
  };

  const handleJoinShare = async () => {
    if (!state.joinInput.trim()) {
      alert("Please enter a share ID");
      return;
    }
    const result = await joinShare(state.joinInput.trim());
    if (result.success) {
      dispatch({ type: "SET_SHOW_MODAL", show: false });
    } else {
      alert(result.error || "Error joining share");
    }
  };

  const handleLeaveShare = React.useCallback(async () => {
    await leaveShare();
    resetState();
    dispatch({ type: "SET_SHOW_MODAL", show: true });
  }, [leaveShare, resetState]);

  // Effect to show modal when disconnected (handled by hook state mostly, but if shareId is cleared externally)
  // No longer needed as handleLeaveShare and the socket disconnect flow handle this

  const content = React.useMemo(() => {
    switch (state.currentView) {
      case "about":
        return (
          <Suspense
            fallback={
              <div className="text-center text-gray-400 py-8">Loading…</div>
            }
          >
            <About />
          </Suspense>
        );
      case "faq":
        return <Faq />;
      case "privacy":
        return (
          <Suspense
            fallback={
              <div className="text-center text-gray-400 py-8">Loading…</div>
            }
          >
            <Privacy />
          </Suspense>
        );
      case "tos":
        return (
          <Suspense
            fallback={
              <div className="text-center text-gray-400 py-8">Loading…</div>
            }
          >
            <TermsOfService />
          </Suspense>
        );
      default:
        return (
          <>
            {/* Debug Info Banner */}
            {connected && (
              <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded-lg p-3 mb-4">
                <div className="text-sm text-yellow-200">
                  <strong>Debug Info:</strong> Connected to {connectedNode} |
                  Client ID: <span className="font-mono">{clientId}</span> |
                  Share: <span className="font-mono">{shareId || "None"}</span>{" "}
                  | Clients: {connectedClients}/2
                  {config.USE_CLUSTER && (
                    <span className="text-green-300">
                      {" "}
                      | CLUSTER MODE ENABLED
                    </span>
                  )}
                </div>
              </div>
            )}

            <FileTransfer
              fileInputRef={fileInputRef}
              handleFileInputChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleFilesSelected(e.target.files)
              }
              uploadFiles={initiateUploads}
              fileUploads={fileUploads}
              isConnectionReady={connected && shareId !== ""}
              getConnectionLink={getConnectionLink}
              copyLinkToClipboard={copyLinkToClipboard}
              linkCopied={state.linkCopied}
              status={status}
              statusClasses={`w-3 h-3 rounded-full mr-2 transition-all duration-300 ease-in-out ${connected ? "bg-green-500" : "bg-red-500"
                }`}
              resetConnection={handleLeaveShare}
              downloadProgress={downloadProgress}
              currentDownloadFileName={currentDownloadFileName}
              downloadedFiles={downloadedFiles}
              shareId={shareId}
              connectedClients={connectedClients}
            />

            {/* Performance metrics display */}
            {(uploadSpeed > 0 || downloadSpeed > 0) && (
              <div className="bg-blue-900 bg-opacity-30 rounded-lg p-4 mb-4 border border-blue-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {uploadSpeed > 0 && (
                      <div className="text-sm">
                        <span className="text-gray-400">Upload: </span>
                        <span className="text-blue-400 font-mono">
                          {formatSpeed(uploadSpeed)}
                        </span>
                      </div>
                    )}
                    {downloadSpeed > 0 && (
                      <div className="text-sm">
                        <span className="text-gray-400">Download: </span>
                        <span className="text-green-400 font-mono">
                          {formatSpeed(downloadSpeed)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {useCompression && (
                      <span className="bg-green-900 bg-opacity-50 px-2 py-1 rounded">
                        WASM Gzip
                      </span>
                    )}
                    {backendFeatures.nativeAddon && (
                      <span className="bg-orange-900 bg-opacity-50 px-2 py-1 rounded">
                        Native I/O
                      </span>
                    )}
                    {backendFeatures.redis && (
                      <span className="bg-red-900 bg-opacity-50 px-2 py-1 rounded">
                        Redis
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-16">
              <h2 className="text-3xl font-bold mb-8 text-center">Why Choose Peer Link?</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {FEATURES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.title} className="bg-gray-800 p-6 rounded-lg">
                      <div className={`flex items-center justify-center w-12 h-12 ${f.bg} rounded-full mb-4`}>
                        <Icon className="text-white" size={24} />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                      <p className="text-gray-400">{f.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        );
    }
  }, [state.currentView, connected, connectedNode, clientId, shareId, connectedClients, fileInputRef, handleFilesSelected, initiateUploads, fileUploads, getConnectionLink, copyLinkToClipboard, state.linkCopied, status, handleLeaveShare, downloadProgress, currentDownloadFileName, downloadedFiles, uploadSpeed, downloadSpeed, useCompression, backendFeatures]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <TopBars
        failedUploads={failedUploads}
        dismissError={dismissError}
        retryingChunks={retryingChunks}
        masterNode={masterNode}
        masterNodeFailed={masterNodeFailed}
        notifications={notifications}
      />
      <Header setCurrentView={(view: string) => { dispatch({ type: "SET_VIEW", view }); if (view === "home" && !shareId) dispatch({ type: "SET_SHOW_MODAL", show: true }); }} />
      <main className="flex-grow container mx-auto px-4 py-8">
        {content}
      </main>
      {shareId && (
        <ShareIdBar
          shareId={shareId}
          connectedClients={connectedClients}
          connectedNode={connectedNode}
          backendFeatures={backendFeatures}
          clusterStats={clusterStats}
        />
      )}
      <footer className="bg-gray-800 text-gray-300 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p>&copy; 2026 Peer Link. All rights reserved.</p>
            <p className="mt-4 md:mt-0">
              Made by <a href="https://yassin.dev" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">Mohamed</a>
            </p>
          </div>
        </div>
      </footer>
      {state.showShareModal && <ShareModalContent
        modalMode={state.modalMode}
        createInput={state.createInput}
        joinInput={state.joinInput}
        onSetModalMode={(mode) => dispatch({ type: "SET_MODAL_MODE", mode })}
        onSetCreateInput={(input) => dispatch({ type: "SET_CREATE_INPUT", input })}
        onSetJoinInput={(input) => dispatch({ type: "SET_JOIN_INPUT", input })}
        handleCreateShare={handleCreateShare}
        handleJoinShare={handleJoinShare}
        onNavigateToTos={() => { dispatch({ type: "SET_VIEW", view: "tos" }); dispatch({ type: "SET_SHOW_MODAL", show: false }); }}
      />}
    </div>
  );
};

export default App;
