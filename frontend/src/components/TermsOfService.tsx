import React from 'react';
import { Shield, AlertTriangle, FileText, Users } from 'lucide-react';

const TermsOfService: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 text-center">Terms of Service</h2>
      <p className="text-lg mb-8 text-gray-300">
        By using Peer Link, you agree to the following terms and conditions. Please read them carefully.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="bg-gray-800 p-6 rounded-lg">
          <Shield className="text-green-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold mb-2">Acceptance of Terms</h3>
          <p className="text-gray-400">By accessing or using Peer Link, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <AlertTriangle className="text-yellow-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold mb-2">Prohibited Use</h3>
          <p className="text-gray-400">You agree not to use Peer Link to share, distribute, or transmit any illegal, harmful, abusive, or malicious content, including malware, copyrighted material without permission, or any content that violates applicable laws.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <FileText className="text-blue-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold mb-2">Service Provided "As Is"</h3>
          <p className="text-gray-400">Peer Link is provided on an "as is" and "as available" basis. We make no warranties regarding the reliability, availability, or security of the service.</p>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg">
          <Users className="text-purple-400 mb-4" size={48} />
          <h3 className="text-xl font-semibold mb-2">User Responsibility</h3>
          <p className="text-gray-400">You are solely responsible for the files you share and any consequences arising from sharing them. Peer Link acts only as a conduit for direct peer-to-peer transfers.</p>
        </div>
      </div>

      <h3 className="text-2xl font-bold mb-4">Acceptable Use</h3>
      <p className="text-lg mb-4 text-gray-300">You agree to use Peer Link only for lawful purposes and in a way that does not infringe the rights of others. Prohibited activities include:</p>
      <ul className="list-disc pl-6 mb-8 text-gray-300 space-y-2">
        <li>Distributing malware, viruses, or other harmful software</li>
        <li>Sharing copyrighted material without authorization</li>
        <li>Harassing, threatening, or abusing others</li>
        <li>Impersonating any person or entity</li>
        <li>Attempting to disrupt or compromise the service</li>
        <li>Using the service for any illegal activity</li>
      </ul>

      <h3 className="text-2xl font-bold mb-4">No Data Storage</h3>
      <p className="text-lg mb-8 text-gray-300">
        Peer Link facilitates direct peer-to-peer file transfers. We do not store, cache, or retain any files transferred through our service. We have no knowledge of or control over the content being transferred.
      </p>

      <h3 className="text-2xl font-bold mb-4">Limitation of Liability</h3>
      <p className="text-lg mb-8 text-gray-300">
        Peer Link and its operators shall not be liable for any damages arising from the use or inability to use the service, including but not limited to data loss, privacy breaches, or any other damages.
      </p>

      <h3 className="text-2xl font-bold mb-4">Changes to Terms</h3>
      <p className="text-lg mb-8 text-gray-300">
        We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.
      </p>

      <h3 className="text-2xl font-bold mb-4">Contact</h3>
      <p className="text-lg text-gray-300">
        If you have any questions about these terms, please contact us at&nbsp;
        <a href="mailto:mohamed@yassin.dev" className="text-blue-500 underline">mohamed@yassin.dev</a>.
      </p>
    </div>
  );
};

export default TermsOfService;
