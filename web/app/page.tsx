import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-12 px-4">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold mb-4">TechRP Manager Dashboard</h1>
          <p className="text-gray-600 mb-8">Welcome to the manager dashboard</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Start Training Card */}
            <Link
              href="/training"
              className="block p-6 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-blue-900 mb-2">
                    Start Training
                  </h2>
                  <p className="text-blue-700">
                    Begin a new voice AI roleplay training session
                  </p>
                </div>
                <div className="text-4xl">🎯</div>
              </div>
            </Link>

            {/* View Sessions Card */}
            <Link
              href="/sessions"
              className="block p-6 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-green-900 mb-2">
                    View Sessions
                  </h2>
                  <p className="text-green-700">
                    Review past training sessions and transcripts
                  </p>
                </div>
                <div className="text-4xl">📊</div>
              </div>
            </Link>

            {/* Playbooks Card */}
            <Link
              href="/playbooks"
              className="block p-6 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 hover:border-purple-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-purple-900 mb-2">
                    Playbooks
                  </h2>
                  <p className="text-purple-700">
                    Create and manage training playbooks
                  </p>
                </div>
                <div className="text-4xl">📘</div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}



