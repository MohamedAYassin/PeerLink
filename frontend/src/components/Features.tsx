import React from 'react';
import { Lock, Upload, Signal } from 'lucide-react';

const Features: React.FC = () => {
  return (
    <div className="mt-16">
      <h2 className="text-3xl font-bold mb-8 text-center">Why Choose Peer Link?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-full mb-4">
            <Lock className="text-white" size={24} />
          </div>
          <h3 className="text-xl font-semibold mb-2">Secure Transfer</h3>
          <p className="text-gray-400">
            Your files are encrypted with DTLS 1.3, ensuring security during transfer.
          </p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center justify-center w-12 h-12 bg-green-500 rounded-full mb-4">
            <Upload className="text-white" size={24} />
          </div>
          <h3 className="text-xl font-semibold mb-2">Easy to Use</h3>
          <p className="text-gray-400">
            Simply select your file, share the link, and start transferring. It's that simple!
          </p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center justify-center w-12 h-12 bg-purple-500 rounded-full mb-4">
            <Signal className="text-white" size={24} />
          </div>
          <h3 className="text-xl font-semibold mb-2">Seamless Uploads</h3>
          <p className="text-gray-400 mb-4">
            Upload multiple files effortlessly and continuously. Whether it's one file or many,
            our platform supports smooth, uninterrupted transfers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Features;

