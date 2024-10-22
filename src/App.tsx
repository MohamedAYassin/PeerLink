import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import {Upload, Download, Link, Copy, CheckCircle, RefreshCw, Info, Shield, Lock, Signal} from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import Banner from './components/Banner';
import About from './components/About';
import FAQ from './components/FAQ';
import Privacy from './components/Privacy';

// Interface for file upload object
interface FileUpload {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}

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

  useEffect(() => {
    const initPeer = () => {
      const newPeer = new Peer({
        config: {
          iceServers: [
            {
              urls: "stun:164.92.231.181:3478",
              username: "eautsvf1",
              credential: "KdwR226uw",
            },
            {
              urls: "turn:164.92.231.181:3478",
              username: "eautsvf1",
              credential: "KdwR226uw",
            },
            {
              urls: "turn:164.92.231.181:3478?transport=tcp",
              username: "eautsvf1",
              credential: "KdwR226uw",
            },
            {
              urls: "turn:164.92.231.181:5349",
              username: "eautsvf1",
              credential: "KdwR226uw",
            },
            {
              urls: "turn:164.92.231.181:5349?transport=tcp",
              username: "eautsvf1",
              credential: "KdwR226uw",
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
    };

    initPeer();

    return () => {
      if (peer) {
        peer.destroy();
      }
    };
  }, []);

  const handleConnection = (conn: Peer.DataConnection) => {
    dataConnectionRef.current = conn;
    setupDataConnection(conn);
    setStatus('Connected to ' + conn.peer);
    conn.send({ type: 'connectionReady' });
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
      }
    });

    conn.on('open', () => {
      setStatus('Connected to ' + conn.peer);
      conn.send({ type: 'connectionReady' });
    });

    conn.on('close', () => {
      setStatus('Connection closed');
      dataConnectionRef.current = null;
      setIsConnectionReady(false);
    });

    conn.on('error', (err) => {
      setStatus('Connection error: ' + err.message);
      setIsConnectionReady(false);
    });
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
    conn.on('error', (err) => {
      setStatus('Connection error: ' + err.message);
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

    fileUploads.forEach((fileUpload, index) => {
      if (fileUpload.status === 'pending') {
        uploadFile(fileUpload.file, index);
      }
    });
  };

  const uploadFile = (file: File, fileIndex: number) => {
    const chunkSize = 16 * 1024; // 16KB
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
              urls: "stun:164.92.231.181:3478",
              username: "eautsvf1",
              credential: "KdwR226uw",
            },
            {
              urls: "turn:164.92.231.181:3478",
              username: "eautsvf1",
              credential: "KdwR226uw",
            },
            {
              urls: "turn:164.92.231.181:3478?transport=tcp",
              username: "eautsvf1",
              credential: "KdwR226uw",
            },
            {
              urls: "turn:164.92.231.181:5349",
              username: "eautsvf1",
              credential: "KdwR226uw",
            },
            {
              urls: "turn:164.92.231.181:5349?transport=tcp",
              username: "eautsvf1",
              credential: "KdwR226uw",
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
              <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md mb-8 mx-auto">
                <h1 className="text-4xl font-extrabold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Peer Link</h1>

                <div className="mb-6">
                  <label htmlFor="fileInput" className="block text-sm font-medium text-gray-300 mb-2">
                    Select Files
                  </label>
                  <input
                      type="file"
                      id="fileInput"
                      ref={fileInputRef}
                      onChange={handleFileInputChange}
                      multiple
                      className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
                  />
                </div>

                <button
                    onClick={() => {
                      uploadFiles();
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-md hover:from-blue-600 hover:to-purple-700 transition duration-300 flex items-center justify-center mb-6 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={fileUploads.length === 0 || !dataConnectionRef.current || !isConnectionReady}
                >
                  <Upload className="mr-2" size={18}/>
                  Share Files
                </button>

                <div className="mb-6 p-4 bg-gray-700 rounded-md">
                  <p className="text-sm font-medium text-gray-300 mb-2">Your Connection Link:</p>
                  <div className="flex items-center">
                    <input
                        type="text"
                        value={getConnectionLink()}
                        readOnly
                        className="flex-grow px-3 py-2 border border-gray-600 rounded-l-md bg-gray-800 text-white text-sm focus:outline-none"
                    />
                    <button
                        onClick={copyLinkToClipboard}
                        className="bg-blue-500 text-white px-3 py-2 rounded-r-md hover:bg-blue-600 transition duration-300 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      {linkCopied ? <CheckCircle size={18}/> : <Copy size={18}/>}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Share this link to connect with others</p>
                </div>

                <div className="mb-6 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-300">Status: {status}</p>
                  <button
                      onClick={resetConnection}
                      className="text-blue-400 hover:text-blue-300 focus:outline-none"
                      title="Reset Connection"
                  >
                    <RefreshCw size={18}/>
                  </button>
                </div>

                {fileUploads.map((fileUpload, index) => (
                    <div key={index} className="mb-6">
                      <p className="text-sm font-medium text-gray-300 mb-1">
                        {fileUpload.status === 'uploading' ? 'Uploading: ' : ''}
                        {fileUpload.file.name} ({fileUpload.status})
                      </p>
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div
                            className={`h-2.5 rounded-full transition-all duration-300 ease-in-out ${
                                fileUpload.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'
                            }`}
                            style={{width: `${fileUpload.progress}%`}}
                        ></div>
                      </div>
                    </div>
                ))}

                {(downloadProgress > 0 || currentDownloadFileName) && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-300 mb-1">Downloading: {currentDownloadFileName}</p>
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div
                            className="bg-green-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                            style={{width: `${downloadProgress}%`}}
                        ></div>
                      </div>
                    </div>
                )}

                {downloadedFiles.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-300 mb-2">Downloaded Files:</h3>
                      <ul className="list-disc pl-5">
                        {downloadedFiles.map((file, index) => (
                            <li key={index} className="text-sm text-gray-400">{file}</li>
                        ))}
                      </ul>
                    </div>
                )}
              </div>
              <Banner/>
              <div className="mt-16">
                <h2 className="text-3xl font-bold mb-8 text-center">Why Choose Peer Link?</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-full mb-4">
                      <Lock className="text-white" size={24}/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Secure Transfer</h3>
                    <p className="text-gray-400">Your files are encrypted with DTLS 1.3, ensuring
                      security during transfer.</p>
                  </div>
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <div className="flex items-center justify-center w-12 h-12 bg-green-500 rounded-full mb-4">
                      <Upload className="text-white" size={24}/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Easy to Use</h3>
                    <p className="text-gray-400">Simply select your file, share the link, and start transferring. It's
                      that simple!</p>
                  </div>
                  <div className="bg-gray-800 p-6 rounded-lg">
                    <div className="flex items-center justify-center w-12 h-12 bg-purple-500 rounded-full mb-4">
                      <Signal className="text-white" size={24}/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Seamless Uploads</h3>
                    <p className="text-gray-400 mb-4">Upload multiple files effortlessly and continuously. Whether it's
                      one file or many, our platform supports smooth, uninterrupted transfers.</p>
                  </div>
                </div>
              </div>
            </>
        );
    }
  };

  return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Header setCurrentView={setCurrentView}/>
        <main className="flex-grow container mx-auto px-4 py-8">
          {renderContent()}
        </main>
        <Footer/>
      </div>
  );
};

export default App;