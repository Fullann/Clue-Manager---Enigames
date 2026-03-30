import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus, Trash2, QrCode, LogOut, Eye, AlertTriangle, Edit, Printer, Settings } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

export default function AdminDashboard() {
  const [clues, setClues] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [existingBulkCategory, setExistingBulkCategory] = useState<string>("");
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [bulkLoading, setBulkLoading] = useState(false);
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
    if (!confirm("Voulez-vous vraiment supprimer cet indice ?")) return;
    await fetch(`/api/admin/clues/${id}`, { method: "DELETE" });
    fetchClues();
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    navigate("/admin/login");
  };

  const toggleSelection = (id: string) => {
    if (!selectionMode) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllInView = () => {
    const ids = filteredClues.map((c) => c.id);
    setSelectedIds(ids);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const applyBulkCategory = async () => {
    const targetCategory = bulkCategory.trim() || existingBulkCategory;
    if (!selectedIds.length || !targetCategory) return;
    setBulkLoading(true);
    const res = await fetch("/api/admin/clues/bulk-category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, category: targetCategory }),
    });
    setBulkLoading(false);
    if (res.ok) {
      setSelectedIds([]);
      setBulkCategory("");
      setExistingBulkCategory("");
      fetchClues();
    } else {
      alert("Impossible de regrouper les indices.");
    }
  };

  const deleteSelection = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`Supprimer ${selectedIds.length} indice(s) ?`)) return;
    const res = await fetch("/api/admin/clues/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    if (res.ok) {
      setSelectedIds([]);
      fetchClues();
    } else {
      alert("Impossible de supprimer la selection.");
    }
  };

  const printSelection = () => {
    if (!selectedIds.length) return;
    navigate(`/admin/print?ids=${encodeURIComponent(selectedIds.join(","))}`);
  };

  const categories = ["Tous", ...Array.from(new Set(clues.map(c => c.category || "Uncategorized"))).sort()];
  
  const filteredClues = selectedCategory === "Tous" 
    ? clues 
    : clues.filter(c => (c.category || "Uncategorized") === selectedCategory);
  const groupedClues = filteredClues.reduce<Record<string, any[]>>((acc, clue) => {
    const key = clue.category || "Uncategorized";
    if (!acc[key]) acc[key] = [];
    acc[key].push(clue);
    return acc;
  }, {});
  const groupedCategoryNames = Object.keys(groupedClues).sort();

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
              Parametres
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Deconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold">Vos indices</h2>
          <div className="flex gap-3">
            <Link
              to={selectedCategory === "Tous" ? "/admin/print" : `/admin/print?category=${encodeURIComponent(selectedCategory)}`}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-xl text-sm font-medium transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              {selectedCategory === "Tous" ? "Tout imprimer" : `Imprimer: ${selectedCategory}`}
            </Link>
            <Link
              to="/admin/clues/new"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              Creer un indice
            </Link>
            <button
              type="button"
              onClick={() => {
                setSelectionMode((prev) => !prev);
                setSelectedIds([]);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                selectionMode
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
              }`}
            >
              {selectionMode ? "Quitter selection" : "Mode selection"}
            </button>
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

        {selectionMode && filteredClues.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-600 dark:text-zinc-300">
              {selectedIds.length} indice(s) selectionne(s)
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={selectAllInView}
                className="px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600"
              >
                Tout selectionner
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600"
              >
                Vider
              </button>
              <input
                type="text"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                placeholder="Nouvelle categorie"
                className="px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 bg-transparent"
              />
              <select
                value={existingBulkCategory}
                onChange={(e) => setExistingBulkCategory(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 bg-transparent"
              >
                <option value="">Categorie existante</option>
                {categories.filter((c) => c !== "Tous").map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedIds.length || (!(bulkCategory.trim() || existingBulkCategory)) || bulkLoading}
                onClick={applyBulkCategory}
                className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              >
                {bulkLoading ? "Application..." : "Regrouper"}
              </button>
              <button
                type="button"
                disabled={!selectedIds.length}
                onClick={printSelection}
                className="px-3 py-1.5 text-xs rounded-lg bg-zinc-700 text-white disabled:opacity-50"
              >
                Imprimer selection
              </button>
              <button
                type="button"
                disabled={!selectedIds.length}
                onClick={deleteSelection}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white disabled:opacity-50"
              >
                Supprimer selection
              </button>
            </div>
          </div>
        )}

        {filteredClues.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">
              {clues.length === 0 ? "Aucun indice cree pour le moment." : `Aucun indice trouve dans la categorie "${selectedCategory}".`}
            </p>
            {clues.length === 0 && (
              <Link
                to="/admin/clues/new"
                className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                Creer votre premier indice
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {groupedCategoryNames.map((categoryName) => (
              <section key={categoryName} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{categoryName}</h3>
                  <Link
                    to={`/admin/print?category=${encodeURIComponent(categoryName)}`}
                    className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimer cette categorie
                  </Link>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {groupedClues[categoryName].map((clue) => (
                    <div
                      key={clue.id}
                      className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 flex flex-col"
                    >
                      {selectionMode && (
                      <div className="mb-3">
                        <label className="inline-flex items-center gap-2 text-xs text-zinc-500">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(clue.id)}
                            onChange={() => toggleSelection(clue.id)}
                          />
                          Selectionner
                        </label>
                      </div>
                      )}
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-semibold text-lg truncate pr-4" title={clue.title}>
                          {clue.title}
                        </h3>
                        <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-xs rounded-md font-medium uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                          {clue.type}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 flex-grow space-y-1">
                        <p><span className="font-medium">Categorie :</span> {clue.category || "Uncategorized"}</p>
                        <p><span className="font-medium">Protection :</span> {clue.protection_type === "none" ? "Aucune" : clue.protection_type}</p>
                        <p><span className="font-medium">Theme :</span> <span className="capitalize">{clue.theme || "Defaut"}</span></p>
                      </div>
                      <div className="flex items-center gap-4 mb-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-1" title="Total scans">
                          <Eye className="w-4 h-4" />
                          {clue.scan_count || 0}
                        </div>
                        <div className="flex items-center gap-1" title="Tentatives echouees">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          {clue.failed_attempts || 0}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-700">
                        <Link
                          to={`/admin/clues/${clue.id}`}
                          className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Voir les codes
                        </Link>
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/admin/clues/${clue.id}/edit`}
                            className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="Modifier l'indice"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(clue.id)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Supprimer l'indice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
