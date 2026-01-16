"use client";

export default function VADashboard() {
  return (
    <main className="animate-in fade-in duration-500">
      {/* 1. Header (Now using global h1 rule) */}
      <div className="mb-8">
        <h1>Va Dashboard</h1>
      </div>

      {/* 2. First Row: 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((num) => (
          <div
            key={num}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-50">
              <h3>Dash Card {num}</h3>
            </div>
            <div className="p-6 min-h-32 flex items-center justify-center text-gray-300 italic text-sm">
              Content placeholder
            </div>
          </div>
        ))}
      </div>

      {/* 3. Second Row: 2 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {[4, 5].map((num) => (
          <div
            key={num}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-50">
              <h3>Dash Card {num}</h3>
            </div>
            <div className="p-6 min-h-48 flex items-center justify-center text-gray-300 italic text-sm">
              Extended content placeholder
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
