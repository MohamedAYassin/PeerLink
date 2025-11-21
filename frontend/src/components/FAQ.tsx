import React from 'react';

const FAQ: React.FC = () => {
  const faqs = [
    {
      question: "How secure is Peer Link?",
      answer: "Peer Link uses industry-standard DTLS 1.3 encryption for all transfers. Your files are encrypted end-to-end, meaning they are transferred directly between peers and are never stored on our servers."
    },
    {
      question: "Is there a file size limit?",
      answer: "There is no hard limit on file sizes. Our streaming technology allows for handling large files efficiently. However, transfer speed and stability may depend on your available device memory and internet connection."
    },
    {
      question: "Do I need to create an account?",
      answer: "No account is required. Peer Link is designed for instant, anonymous file sharing. Just open the site, select your files, and share the link."
    },
    {
      question: "How long does the link last?",
      answer: "Links are valid only while the transfer session is active. Once you close the tab or the transfer is complete and you disconnect, the link expires immediately. We do not store any data."
    },
    {
      question: "Does it work on mobile?",
      answer: "Yes! Peer Link is fully responsive and works on any modern mobile browser that supports WebRTC (which is most of them)."
    },
    {
      question: "What if my connection drops?",
      answer: "If the connection is interrupted, the transfer may pause. Our new cluster architecture improves connection reliability, but if a complete disconnect occurs, you may need to restart the transfer."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
      <div className="space-y-8">
        {faqs.map((faq, index) => (
          <div key={index} className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-2">{faq.question}</h3>
            <p className="text-gray-300">{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FAQ;

