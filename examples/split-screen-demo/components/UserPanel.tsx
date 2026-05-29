"use client";

import { useState } from "react";

interface UserPanelProps {
  onJobQueued: () => void;
  addJob: (handlerName: string, data?: any) => void;
}

const UserPanel = ({ onJobQueued, addJob }: UserPanelProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !email) return;

    setIsRegistering(true);
    const startTime = performance.now();

    await new Promise((r) => setTimeout(r, 50));

    addJob("send-welcome-email", { email });
    addJob("generate-thumbnail", { name });
    addJob("sync-to-crm", { name, email });
    addJob("generate-welcome-pdf", { name });

    const endTime = performance.now();
    setResponseTime(Math.round(endTime - startTime));
    setIsRegistering(false);
    setRegistered(true);
    onJobQueued();

    setTimeout(() => {
      setRegistered(false);
      setName("");
      setEmail("");
      setResponseTime(null);
    }, 5000);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-black">
          👤 User Screen
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            What users see
          </span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          This is your application's registration form
        </p>
      </div>

      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="w-full max-w-sm">
          {!registered ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRegistering ? "Registering..." : "Register"}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-4xl">✅</div>
              <h3 className="text-xl font-semibold text-green-700">
                Registration Complete!
              </h3>
              {responseTime && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    Response time: <strong>{responseTime}ms</strong>
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Jobs queued in background: 4
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-400">
                Form resets in 5 seconds...
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 bg-red-50">
        <p className="text-sm text-red-700">
          <strong>❌ Without JetQueue:</strong> User would wait ~8 seconds for
          all emails, thumbnails, and sync to complete.
        </p>
      </div>
    </div>
  );
};

export default UserPanel;
