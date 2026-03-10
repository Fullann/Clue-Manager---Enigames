import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Trash2, QrCode, LogOut, Eye, AlertTriangle, Edit, Printer, Settings } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

export default function AdminDashboard() {
  const [clues, setClues] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const navigate = useNavigate();

  useEffect(() => {
    fetchClues();
  }, []);

  const fetchClues = async () => {
    const res = await fetch("/api/admin/clues");
    if (res.status === 401) {
      navigate("/admin/login");
      return;
    }
    const data = await res.json();
    setClues(data);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this clue?")) return;
    await fetch(`/api/admin/clues/${id}`, { method: "DELETE" });
    fetchClues();
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    navigate("/admin/login");
  };

  const categories = ["All", ...Array.from(new Set(clues.map(c => c.category || "Uncategorized"))).sort()];
  
  const filteredClues = selectedCategory === "All" 
    ? clues 
    : clues.filter(c => (c.category || "Uncategorized") === selectedCategory);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-xl font-semibold">Clue Manager</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              to="/admin/settings"
              className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold">Your Clues</h2>
          <div className="flex gap-3">
            <Link
              to="/admin/print"
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-xl text-sm font-medium transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print All
            </Link>
            <Link
              to="/admin/clues/new"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              Create Clue
            </Link>
          </div>
        </div>

        {clues.length > 0 && categories.length > 2 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white"
                    : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {filteredClues.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              {clues.length === 0 ? "No clues created yet." : `No clues found in category "${selectedCategory}".`}
            </p>
            {clues.length === 0 && (
              <Link
                to="/admin/clues/new"
                className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                Create your first clue
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredClues.map((clue) => (
              <div
                key={clue.id}
                className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-semibold text-lg truncate pr-4" title={clue.title}>
                    {clue.title}
                  </h3>
                  <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-xs rounded-md font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                    {clue.type}
                  </span>
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 flex-grow space-y-1">
                  <p><span className="font-medium">Category:</span> {clue.category || "Uncategorized"}</p>
                  <p><span className="font-medium">Protection:</span> {clue.protection_type === "none" ? "None" : clue.protection_type}</p>
                  <p><span className="font-medium">Theme:</span> <span className="capitalize">{clue.theme || "Default"}</span></p>
                </div>
                <div className="flex items-center gap-4 mb-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1" title="Total Scans">
                    <Eye className="w-4 h-4" />
                    {clue.scan_count || 0}
                  </div>
                  <div className="flex items-center gap-1" title="Failed Unlock Attempts">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    {clue.failed_attempts || 0}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-700">
                  <Link
                    to={`/admin/clues/${clue.id}`}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View Codes
                  </Link>
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/admin/clues/${clue.id}/edit`}
                      className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      title="Edit Clue"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(clue.id)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete Clue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
