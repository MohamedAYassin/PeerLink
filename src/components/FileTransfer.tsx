import React, { useEffect } from 'react';
import { Upload, Copy, CheckCircle, RefreshCw } from 'lucide-react';
import { FileUpload } from '../types';

interface FileTransferProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadFiles: () => void;
  fileUploads: FileUpload[];
  isConnectionReady: boolean;
  hasDataConnection: boolean;
  getConnectionLink: () => string;
  copyLinkToClipboard: () => void;
  linkCopied: boolean;
  status: string;
  statusClasses: string;
  resetConnection: () => void;
  downloadProgress: number;
  currentDownloadFileName: string;
  downloadedFiles: string[];
}

const FileTransfer: React.FC<FileTransferProps> = ({
                                                     fileInputRef,
                                                     handleFileInputChange,
                                                     uploadFiles,
                                                     fileUploads,
                                                     isConnectionReady,
                                                     hasDataConnection,
                                                     getConnectionLink,
                                                     copyLinkToClipboard,
                                                     linkCopied,
                                                     status,
                                                     statusClasses,
                                                     resetConnection,
                                                     downloadProgress,
                                                     currentDownloadFileName,
                                                     downloadedFiles,
                                                   }) => {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://secureaddisplay.com/au/";
    script.async = true;
    script.onload = () => console.log('Ad script loaded');
    script.onerror = () => console.error('Ad script load failed');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script); // Clean up on unmount
    };
  }, []);

  return (
      <div className="flex flex-col md:flex-row justify-between gap-8 max-w-7xl mx-auto px-4">
        {/* Left Banner - Desktop Only */}
        <div className="hidden md:block w-64">
          <ins
              className="CANDisplayAD"
              data-ad-unit="1149202320241101T06422843F97EAD5C93487FA5416DF08994A980"
              style={{ display: 'block' }}
          ></ins>
        </div>

        {/* Main File Transfer Component */}
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
          <h1 className="text-4xl font-extrabold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Peer Link
          </h1>

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
              disabled={fileUploads.length === 0 || !hasDataConnection || !isConnectionReady}
          >
            <Upload className="mr-2" size={18} />
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
                {linkCopied ? <CheckCircle size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Share this link to connect with others</p>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center">
              <div className={statusClasses}></div>
              <p className="text-sm font-medium text-gray-300 transition-all duration-300 ease-in-out">
                Status: {status}
              </p>
            </div>
            <button
                onClick={resetConnection}
                className="text-blue-400 hover:text-blue-300 focus:outline-none"
                title="Reset Connection"
            >
              <RefreshCw size={18} />
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
                      style={{ width: `${fileUpload.progress}%` }}
                  ></div>
                </div>
              </div>
          ))}

          {(downloadProgress > 0 || currentDownloadFileName) && (
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-300 mb-1">
                  Downloading: {currentDownloadFileName}
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div
                      className="bg-green-600 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                      style={{ width: `${downloadProgress}%` }}
                  ></div>
                </div>
              </div>
          )}

          {downloadedFiles.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">Downloaded Files:</h3>
                <ul className="list-disc pl-5">
                  {downloadedFiles.map((file, index) => (
                      <li key={index} className="text-sm text-gray-400">
                        {file}
                      </li>
                  ))}
                </ul>
              </div>
          )}
        </div>

        {/* Right Banner - Desktop Only */}
        <div className="hidden md:block w-64">
          <ins
              className="CANDisplayAD"
              data-ad-unit="1149202320241101T0641019908C8A2423B07341A295228A1604B7D09B"
              style={{ display: 'block' }}
          ></ins>
        </div>

        {/* Mobile Banner - Only visible on mobile */}
        <div className="md:hidden w-full">
          <ins
              className="CANDisplayAD"
              data-ad-unit="1149202320241101T06352217083C7C35B7F984543ABBD9897BF4BD53C"
              style={{ display: 'block' }}
          ></ins>
        </div>
      </div>
  );
};

export default FileTransfer;
