import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import Header from './components/Header';
import Footer from './components/Footer';
import Banner from './components/Banner';
import About from './components/About';
import FAQ from './components/FAQ';
import Privacy from './components/Privacy';
import FileTransfer from './components/FileTransfer';
import Features from './components/Features';
import { FileUpload, TransferStatus } from './types';

const App: React.FC = () => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [status, setStatus] = useState<string>('Initializing...');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);
  const [currentDownloadFileName, setCurrentDownloadFileName] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<string>('home');
  const dataConnectionRef = useRef<Peer.DataConnection | null>(null);
  const fileChunksRef = useRef<{ [key: string]: ArrayBuffer[] }>({});
  const [fileUploads, setFileUploads] = useState<FileUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isConnectionReady, setIsConnectionReady] = useState<boolean>(false);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  useEffect(() => {
    const initPeer = () => {
      const newPeer = new Peer({
        config: {
          iceServers: [
            {
              urls: "",
              username: "",
              credential: "",
            },
          ]
        },
        secure: true,
        host: '0.peerjs.com',
        port: 443,
      });

      newPeer.on('open', (id) => {
        setPeerId(id);
        setStatus('Waiting for connection');
        setIsConnectionReady(false);
        connectToPeerFromUrl(newPeer);
      });

      newPeer.on('connection', (conn) => {
        handleConnection(conn);
      });

      newPeer.on('error', () => {
        setStatus('Processing... Please wait. If it takes too long, try refreshing.');
        setIsConnectionReady(false);
      });

      setPeer(newPeer);
    };

    initPeer();

    return () => {
      if (peer) {
        peer.destroy();
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const checkConnectionStatus = () => {
      const now = Date.now();
      if (isConnectionReady && now - lastHeartbeatRef.current > 5000) {
        setIsConnectionReady(false);
        setStatus('Connection lost');
      }
    };

    const statusCheckInterval = setInterval(checkConnectionStatus, 1000);

    return () => clearInterval(statusCheckInterval);
  }, [isConnectionReady]);

  useEffect(() => {
    const hasActiveTransfers = fileUploads.some(upload => upload.status === 'uploading') ||
        (downloadProgress > 0 && currentDownloadFileName);
    setIsTransferring(hasActiveTransfers);

    if (dataConnectionRef.current?.open) {
      const statusUpdate: TransferStatus = {
        type: 'status',
        isTransferring: hasActiveTransfers
      };
      dataConnectionRef.current.send(statusUpdate);
    }

    if (hasActiveTransfers) {
      setStatus('Transferring');
    } else if (isConnectionReady) {
      setStatus('Connected');
    } else {
      setStatus('Waiting for connection');
    }
  }, [fileUploads, downloadProgress, currentDownloadFileName, isConnectionReady]);

  const handleConnection = (conn: Peer.DataConnection) => {
    dataConnectionRef.current = conn;
    setupDataConnection(conn);
    setStatus('Connected to ' + conn.peer);
    setIsConnectionReady(true);
    conn.send({ type: 'connectionReady' });
    startHeartbeat(conn);
  };

  const setupDataConnection = (conn: Peer.DataConnection) => {
    conn.on('data', (data: any) => {
      if (data.type === 'file') {
        handleReceivedFileChunk(data);
      } else if (data.type === 'progress') {
        setUploadProgress(data.percentage);
      } else if (data.type === 'connectionReady') {
        setIsConnectionReady(true);
        setStatus('Connection ready');
        conn.send({ type: 'connectionReady' });
      } else if (data.type === 'heartbeat') {
        conn.send({ type: 'heartbeatAck' });
      } else if (data.type === 'heartbeatAck') {
        lastHeartbeatRef.current = Date.now();
      } else if (data.type === 'status') {
        if (data.isTransferring) {
          setStatus('Transferring');
        } else if (isConnectionReady) {
          setStatus('Connected');
        }
      }
    });

    conn.on('open', () => {
      setStatus('Connected to ' + conn.peer);
      setIsConnectionReady(true);
      conn.send({ type: 'connectionReady' });
    });

    conn.on('close', () => {
      setStatus('Connection closed');
      dataConnectionRef.current = null;
      setIsConnectionReady(false);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    });

    conn.on('error', () => {
      setStatus('Processing... Please wait. If it takes too long, try refreshing.');
      setIsConnectionReady(false);
    });
  };

  const startHeartbeat = (conn: Peer.DataConnection) => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = window.setInterval(() => {
      if (conn.open) {
        conn.send({ type: 'heartbeat' });
      } else {
        setIsConnectionReady(false);
        setStatus('Connection lost');
        clearInterval(heartbeatIntervalRef.current!);
      }
    }, 2000);
  };

  const connectToPeerFromUrl = (peerInstance: Peer) => {
    const params = new URLSearchParams(window.location.search);
    const peerIdFromUrl = params.get('peerId');
    if (peerIdFromUrl && peerIdFromUrl !== peerId) {
      connectToPeer(peerIdFromUrl, peerInstance);
    }
  };

  const connectToPeer = (targetPeerId: string, peerInstance: Peer = peer!) => {
    if (!peerInstance || !targetPeerId) {
      setStatus('Invalid Peer ID.');
      return;
    }
    setStatus('Connecting to peer...');
    const conn = peerInstance.connect(targetPeerId, { reliable: true });
    conn.on('open', () => {
      handleConnection(conn);
    });
    conn.on('error', () => {
      setStatus('Processing... Please wait. If it takes too long, try refreshing.');
      setIsConnectionReady(false);
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFileUploads = Array.from(e.target.files).map(file => ({
        file,
        progress: 0,
        status: 'pending' as const
      }));
      setFileUploads(newFileUploads);
    }
  };

  const uploadFiles = () => {
    if (!dataConnectionRef.current || !isConnectionReady) {
      alert('Please wait for the connection to be fully established before sending files.');
      return;
    }

    setStatus('Transferring');
    dataConnectionRef.current.send({
      type: 'status',
      isTransferring: true
    });

    fileUploads.forEach((fileUpload, index) => {
      if (fileUpload.status === 'pending') {
        uploadFile(fileUpload.file, index);
      }
    });
  };

  const uploadFile = (file: File, fileIndex: number) => {
    const chunkSize = 16 * 1024;
    const totalChunks = Math.ceil(file.size / chunkSize);
    let offset = 0;

    setFileUploads(prevUploads =>
        prevUploads.map((upload, index) =>
            index === fileIndex ? { ...upload, status: 'uploading' } : upload
        )
    );

    const sendNextChunk = () => {
      if (offset >= file.size) {
        setFileUploads(prevUploads =>
            prevUploads.map((upload, index) =>
                index === fileIndex ? { ...upload, progress: 100, status: 'completed' } : upload
            )
        );

        const hasMoreUploads = fileUploads.some((upload, idx) =>
            idx !== fileIndex && (upload.status === 'pending' || upload.status === 'uploading')
        );

        if (!hasMoreUploads) {
          setTimeout(() => {
            setStatus(isConnectionReady ? 'Connected' : 'Waiting for connection');
          }, 1000);
        }
        return;
      }

      const reader = new FileReader();
      const chunk = file.slice(offset, offset + chunkSize);
      reader.onload = (event) => {
        const fileData = event.target?.result;
        const dataToSend = {
          type: 'file',
          filename: file.name,
          fileData: fileData,
          chunkIndex: Math.floor(offset / chunkSize),
          totalChunks: totalChunks,
          fileIndex: fileIndex
        };
        dataConnectionRef.current?.send(dataToSend);
        const percentage = Math.floor(((offset + chunk.size) / file.size) * 100);
        setFileUploads(prevUploads =>
            prevUploads.map((upload, index) =>
                index === fileIndex ? { ...upload, progress: percentage } : upload
            )
        );
        offset += chunkSize;
        sendNextChunk();
      };
      reader.onerror = (error) => {
        setStatus('File read error: ' + error);
        setFileUploads(prevUploads =>
            prevUploads.map((upload, index) =>
                index === fileIndex ? { ...upload, status: 'error' } : upload
            )
        );
      };
      reader.readAsArrayBuffer(chunk);
    };

    sendNextChunk();
  };

  const handleReceivedFileChunk = (data: any) => {
    const { filename, fileData, chunkIndex, totalChunks } = data;

    if (!fileChunksRef.current[filename]) {
      fileChunksRef.current[filename] = [];
      setStatus('Transferring');
      if (dataConnectionRef.current?.open) {
        dataConnectionRef.current.send({
          type: 'status',
          isTransferring: true
        });
      }
    }

    fileChunksRef.current[filename][chunkIndex] = fileData;
    setCurrentDownloadFileName(filename);
    setDownloadProgress((chunkIndex + 1) / totalChunks * 100);

    if (fileChunksRef.current[filename].length === totalChunks) {
      const file = new Blob(fileChunksRef.current[filename]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);

      setDownloadedFiles(prev => [...prev, filename]);
      delete fileChunksRef.current[filename];

      setTimeout(() => {
        setDownloadProgress(0);
        setCurrentDownloadFileName('');
        if (dataConnectionRef.current?.open) {
          dataConnectionRef.current.send({
            type: 'status',
            isTransferring: true
          });
        }
        setStatus(isConnectionReady ? 'Connected' : 'Waiting for connection');
      }, 1000);
    }
  };

  const getConnectionLink = () => {
    return `${window.location.origin}${window.location.pathname}?peerId=${peerId}`;
  };

  const copyLinkToClipboard = () => {
    navigator.clipboard.writeText(getConnectionLink()).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const resetConnection = () => {
    if (peer) {
      peer.destroy();
    }
    setStatus('Resetting connection...');
    setPeer(null);
    setPeerId('');
    dataConnectionRef.current = null;
    fileChunksRef.current = {};
    setDownloadedFiles([]);
    setFileUploads([]);
    setDownloadProgress(0);
    setCurrentDownloadFileName('');
    setIsConnectionReady(false);

    setTimeout(() => {
      const newPeer = new Peer({
        config: {
          iceServers: [
            {
              urls: "",
              username: "",
              credential: "",
            },
          ]
        },
        secure: true,
        host: '0.peerjs.com',
        port: 443,
      });
      newPeer.on('open', (id) => {
        setPeerId(id);
        setStatus('Waiting for connection');
        connectToPeerFromUrl(newPeer);
      });
      newPeer.on('connection', (conn) => {
        handleConnection(conn);
      });
      newPeer.on('error', (err) => {
        setStatus('Error: ' + err.message);
        setIsConnectionReady(false);
      });
      setPeer(newPeer);
    }, 1000);
  };

  const getDisplayStatus = () => {
    if (isTransferring) {
      return 'Transferring';
    }
    return status;
  };

  const getStatusColor = () => {
    if (isTransferring) {
      return 'bg-blue-500';
    } else if (status === 'Waiting for connection') {
      return 'bg-yellow-500';
    } else if (isConnectionReady) {
      return 'bg-green-500';
    } else {
      return 'bg-red-500';
    }
  };

  const statusClasses = `w-3 h-3 rounded-full mr-2 transition-all duration-300 ease-in-out ${getStatusColor()}`;

  const renderContent = () => {
    switch (currentView) {
      case 'about':
        return <About />;
      case 'faq':
        return <FAQ />;
      case 'privacy':
        return <Privacy />;
      default:
        return (
            <>
              <FileTransfer
                  fileInputRef={fileInputRef}
                  handleFileInputChange={handleFileInputChange}
                  uploadFiles={uploadFiles}
                  fileUploads={fileUploads}
                  isConnectionReady={isConnectionReady}
                  hasDataConnection={!!dataConnectionRef.current}
                  getConnectionLink={getConnectionLink}
                  copyLinkToClipboard={copyLinkToClipboard}
                  linkCopied={linkCopied}
                  status={getDisplayStatus()}
                  statusClasses={statusClasses}
                  resetConnection={resetConnection}
                  downloadProgress={downloadProgress}
                  currentDownloadFileName={currentDownloadFileName}
                  downloadedFiles={downloadedFiles}
              />
              <Banner />
              <Features />
            </>
        );
    }
  };

  return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Header setCurrentView={setCurrentView} />
        <main className="flex-grow container mx-auto px-4 py-8">{renderContent()}</main>
        <Footer />
      </div>
  );
};

export default App;