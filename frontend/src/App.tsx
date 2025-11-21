import React, { useState, lazy, Suspense } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import FileTransfer from "./components/FileTransfer";
import { useSession } from "./hooks/useSession";
import { useFileTransfer } from "./hooks/useFileTransfer";
import { config } from "./config/app.config";
import { formatSpeed } from "./utils/performance";

// Lazy load non-critical components
const About = lazy(() => import("./components/About"));
const FAQ = lazy(() => import("./components/FAQ"));
const Privacy = lazy(() => import("./components/Privacy"));
const Features = lazy(() => import("./components/Features"));

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState("home");
  const [showShareModal, setShowShareModal] = useState(true);
  const [modalMode, setModalMode] = useState<"create" | "join">("create");
  const [joinInput, setJoinInput] = useState("");
  const [createInput, setCreateInput] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

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
  const getConnectionLink = () => shareId;

  const copyLinkToClipboard = () => {
    navigator.clipboard.writeText(shareId);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleCreateShare = async () => {
    const result = await createShare(createInput.trim() || undefined);
    if (result.success) {
      setShowShareModal(false);
      setCreateInput("");
    } else {
      alert(result.error || "Error creating share");
    }
  };

  const handleJoinShare = async () => {
    if (!joinInput.trim()) {
      alert("Please enter a share ID");
      return;
    }
    const result = await joinShare(joinInput.trim());
    if (result.success) {
      setShowShareModal(false);
    } else {
      alert(result.error || "Error joining share");
    }
  };

  const handleLeaveShare = async () => {
    await leaveShare();
    resetState();
    setShowShareModal(true);
  };

  // Effect to show modal when disconnected (handled by hook state mostly, but if shareId is cleared externally)
  React.useEffect(() => {
    if (!shareId && !showShareModal) {
      setShowShareModal(true);
    }
  }, [shareId, showShareModal]);

  const renderShareModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-white">PeerLink Share</h2>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setModalMode("create")}
            className={`flex-1 py-2 px-4 rounded ${modalMode === "create"
              ? "bg-blue-500 text-white"
              : "bg-gray-700 text-gray-300"
              }`}
          >
            Create New
          </button>
          <button
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
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded mb-4 text-white"
            />
            <button
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
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded mb-4 text-white"
            />
            <button
              onClick={handleJoinShare}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
              Join Share
            </button>
          </>
        )}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case "about":
        return (
          <Suspense
            fallback={
              <div className="text-center text-gray-400 py-8">Loading...</div>
            }
          >
            <About />
          </Suspense>
        );
      case "faq":
        return (
          <Suspense
            fallback={
              <div className="text-center text-gray-400 py-8">Loading...</div>
            }
          >
            <FAQ />
          </Suspense>
        );
      case "privacy":
        return (
          <Suspense
            fallback={
              <div className="text-center text-gray-400 py-8">Loading...</div>
            }
          >
            <Privacy />
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
              hasDataConnection={connected && shareId !== ""}
              getConnectionLink={getConnectionLink}
              copyLinkToClipboard={copyLinkToClipboard}
              linkCopied={linkCopied}
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
                  <div className="flex items-center space-x-4">
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
                  <div className="flex items-center space-x-3 text-xs text-gray-400">
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

            <Suspense
              fallback={
                <div className="text-center text-gray-400 py-4">Loading...</div>
              }
            >
              <Features />
            </Suspense>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Transfer Failed Error Modals */}
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
            <button
              onClick={() => dismissError(fileId)}
              className="ml-4 text-white hover:text-gray-200 text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>
      ))}

      {/* Retry Indicator Banner */}
      {retryingChunks.size > 0 && (
        <div className="bg-yellow-600 text-white px-4 py-3 text-center text-sm font-medium">
          Retrying {Array.from(retryingChunks.values()).flat().length} chunk(s)...
        </div>
      )}

      {/* Master Node Status (Cluster Mode) */}
      {config.USE_CLUSTER && masterNode && (
        <div className="bg-blue-900 bg-opacity-50 border-b border-blue-700 px-4 py-2">
          <div className="container mx-auto flex items-center justify-between text-sm">
            <div className="flex items-center space-x-3">
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
                Reconnecting to master...
              </span>
            )}
          </div>
        </div>
      )}

      {notifications.disconnect && (
        <div className="bg-red-600 text-white px-4 py-4 text-center text-lg font-semibold animate-pulse">
          Other client disconnected - Share ended
        </div>
      )}
      {notifications.join && (
        <div className="bg-green-600 text-white px-4 py-4 text-center text-lg font-semibold animate-pulse">
          Connection ready - Ready to share files!
        </div>
      )}
      <Header setCurrentView={setCurrentView} />
      <main className="flex-grow container mx-auto px-4 py-8">
        {renderContent()}
      </main>
      {shareId && (
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
      )}
      <Footer />
      {showShareModal && renderShareModal()}
    </div>
  );
};

export default App;
