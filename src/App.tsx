import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { Upload, Download, Link, Copy, CheckCircle, RefreshCw, Info, Shield, Lock } from 'lucide-react';
import Header from './components/Header';
import Footer from './components/Footer';
import Banner from './components/Banner';
import About from './components/About';
import FAQ from './components/FAQ';
import Privacy from './components/Privacy';

const App: React.FC = () => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [status, setStatus] = useState<string>('Initializing...');
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedFiles, setDownloadedFiles] = useState<string[]>([]);
  const [currentUploadFileName, setCurrentUploadFileName] = useState<string>('');
  const [currentDownloadFileName, setCurrentDownloadFileName] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<string>('home');
  const dataConnectionRef = useRef<Peer.DataConnection | null>(null);
  const fileChunksRef = useRef<{ [key: string]: ArrayBuffer[] }>({});

  useEffect(() => {
    const initPeer = () => {
      const newPeer = new Peer({
        config: {
          iceServers: [
            {url:'stun:stun01.sipphone.com'},
            {url:'stun:stun.ekiga.net'},
            {url:'stun:stun.fwdnet.net'},
            {url:'stun:stun.ideasip.com'},
            {url:'stun:stun.iptel.org'},
            {url:'stun:stun.rixtelecom.se'},
            {url:'stun:stun.schlund.de'},
            {url:'stun:stun.l.google.com:19302'},
            {url:'stun:stun1.l.google.com:19302'},
            {url:'stun:stun2.l.google.com:19302'},
            {url:'stun:stun3.l.google.com:19302'},
            {url:'stun:stun4.l.google.com:19302'},
            {url:'stun:stunserver.org'},
            {url:'stun:stun.softjoys.com'},
            {url:'stun:stun.voiparound.com'},
            {url:'stun:stun.voipbuster.com'},
            {url:'stun:stun.voipstunt.com'},
            {url:'stun:stun.voxgratia.org'},
            {url:'stun:stun.xten.com'},
            {
              url: 'turn:numb.viagenie.ca',
              credential: 'muazkh',
              username: 'webrtc@live.com'
            },
            {
              url: 'turn:192.158.29.39:3478?transport=udp',
              credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
              username: '28224511:1379330808'
            },
            {
              url: 'turn:192.158.29.39:3478?transport=tcp',
              credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
              username: '28224511:1379330808'
            }
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
  };

  const setupDataConnection = (conn: Peer.DataConnection) => {
    conn.on('data', (data: any) => {
      if (data.type === 'file') {
        handleReceivedFileChunk(data);
      } else if (data.type === 'progress') {
        setUploadProgress(data.percentage);
      }
    });

    conn.on('open', () => {
      setStatus('Connected to ' + conn.peer);
    });

    conn.on('close', () => {
      setStatus('Connection closed');
      dataConnectionRef.current = null;
    });

    conn.on('error', (err) => {
      setStatus('Connection error: ' + err.message);
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
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileInput(e.target.files[0]);
    }
  };

  const uploadFile = () => {
    if (!fileInput || !dataConnectionRef.current) {
      alert('Please select a file and connect to another peer first.');
      return;
    }

    const chunkSize = 16 * 1024; // 16KB
    const totalChunks = Math.ceil(fileInput.size / chunkSize);
    let offset = 0;
    setCurrentUploadFileName(fileInput.name);
    setUploadProgress(0);

    const sendNextChunk = () => {
      if (offset >= fileInput.size) {
        setUploadProgress(100);
        setTimeout(() => {
          setUploadProgress(0);
          setCurrentUploadFileName('');
        }, 1000);
        return;
      }
      const reader = new FileReader();
      const chunk = fileInput.slice(offset, offset + chunkSize);
      reader.onload = (event) => {
        const fileData = event.target?.result;
        const dataToSend = {
          type: 'file',
          filename: fileInput.name,
          fileData: fileData,
          chunkIndex: Math.floor(offset / chunkSize),
          totalChunks: totalChunks
        };
        dataConnectionRef.current?.send(dataToSend);
        const percentage = Math.floor(((offset + chunk.size) / fileInput.size) * 100);
        setUploadProgress(percentage);
        offset += chunkSize;
        sendNextChunk();
      };
      reader.onerror = (error) => {
        setStatus('File read error: ' + error);
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
    setUploadProgress(0);
    setDownloadProgress(0);
    setCurrentUploadFileName('');
    setCurrentDownloadFileName('');

    setTimeout(() => {
      const newPeer = new Peer({
        config: {
          iceServers: [
            {url:'stun:stun01.sipphone.com'},
            {url:'stun:stun.ekiga.net'},
            {url:'stun:stun.fwdnet.net'},
            {url:'stun:stun.ideasip.com'},
            {url:'stun:stun.iptel.org'},
            {url:'stun:stun.rixtelecom.se'},
            {url:'stun:stun.schlund.de'},
            {url:'stun:stun.l.google.com:19302'},
            {url:'stun:stun1.l.google.com:19302'},
            {url:'stun:stun2.l.google.com:19302'},
            {url:'stun:stun3.l.google.com:19302'},
            {url:'stun:stun4.l.google.com:19302'},
            {url:'stun:stunserver.org'},
            {url:'stun:stun.softjoys.com'},
            {url:'stun:stun.voiparound.com'},
            {url:'stun:stun.voipbuster.com'},
            {url:'stun:stun.voipstunt.com'},
            {url:'stun:stun.voxgratia.org'},
            {url:'stun:stun.xten.com'},
            {
              url: 'turn:numb.viagenie.ca',
              credential: 'muazkh',
              username: 'webrtc@live.com'
            },
            {
              url: 'turn:192.158.29.39:3478?transport=udp',
              credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
              username: '28224511:1379330808'
            },
            {
              url: 'turn:192.158.29.39:3478?transport=tcp',
              credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
              username: '28224511:1379330808'
            }
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
                <h1 className="text-4xl font-extrabold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">Peer
                  Link</h1>

                <div className="mb-6">
                  <label htmlFor="fileInput" className="block text-sm font-medium text-gray-300 mb-2">
                    Select File
                  </label>
                  <input
                      type="file"
                      id="fileInput"
                      onChange={handleFileInputChange}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
                  />
                </div>

                <button
                    onClick={uploadFile}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-4 rounded-md hover:from-blue-600 hover:to-purple-700 transition duration-300 flex items-center justify-center mb-6 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    disabled={!fileInput || !dataConnectionRef.current}
                >
                  <Upload className="mr-2" size={18}/>
                  Share File
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

                {(uploadProgress > 0 || currentUploadFileName) && (
                    <div className="mb-6">
                      <p className="text-sm font-medium text-gray-300 mb-1">Uploading: {currentUploadFileName}</p>
                      <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                            style={{width: `${uploadProgress}%`}}
                        ></div>
                      </div>
                    </div>
                )}

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
                    <p className="text-gray-400">Your files are encrypted end-to-end with DTLS 1.3, ensuring maximum
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
                      <Shield className="text-white" size={24}/>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Privacy First</h3>
                    <p className="text-gray-400">We don't store your files or track your transfers. Your data remains
                      yours.</p>
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