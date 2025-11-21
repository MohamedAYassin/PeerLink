import React from 'react';
import { Shield, Eye, Server } from 'lucide-react';

const Privacy: React.FC = () => {
  return (
      <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Privacy Policy</h2>
          <p className="text-lg mb-8 text-gray-300">
              At Peer Link, we take your privacy seriously. Our service is designed with a "privacy-first" approach,
              ensuring that your data remains under your control at all times.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="bg-gray-800 p-6 rounded-lg">
                  <Shield className="text-green-400 mb-4" size={48}/>
                  <h3 className="text-xl font-semibold mb-2">DTLS 1.3 Encryption</h3>
                  <p className="text-gray-400">All file transfers are encrypted using DTLS 1.3, ensuring that
                      only the intended recipient can access the files.</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                  <Eye className="text-blue-400 mb-4" size={48}/>
                  <h3 className="text-xl font-semibold mb-2">No Data Collection</h3>
                  <p className="text-gray-400">We do not collect or store any personal information or transferred files.
                      Your data remains completely private.</p>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                  <Server className="text-purple-400 mb-4" size={48}/>
                  <h3 className="text-xl font-semibold mb-2">No Server Storage</h3>
                  <p className="text-gray-400">Files are transferred directly between peers. We never store your files
                      on our servers, not even temporarily.</p>
              </div>
          </div>
          <h3 className="text-2xl font-bold mb-4">Information We Don't Collect</h3>
          <ul className="list-disc pl-6 mb-8 text-gray-300">
              <li>Personal identification information</li>
              <li>File contents or metadata</li>
              <li>IP addresses</li>
              <li>Browser or device information</li>
              <li>Usage statistics</li>
          </ul>
          <h3 className="text-2xl font-bold mb-4">Third-Party Services</h3>
          <p className="text-lg mb-8 text-gray-300">
              We use WebRTC for peer-to-peer connections, utilizing our own STUN/TURN servers to establish connections. These servers only assist in creating the connection and do not have access to the content of your transfers.
          </p>
          <h3 className="text-2xl font-bold mb-4">Changes to This Policy</h3>
          <p className="text-lg mb-8 text-gray-300">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new
              Privacy Policy on this page.
          </p>
          <h3 className="text-2xl font-bold mb-4">Contact Us</h3>
          <p className="text-lg text-gray-300">
              If you have any questions about this site, please contact us at&nbsp;
              <a href="mailto:contact@peerlink.app" className="text-blue-500 underline">contact@peerlink.app</a>.
          </p>

      </div>
  );
};

export default Privacy;

