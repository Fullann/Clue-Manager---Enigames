import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import { ArrowLeft, Printer } from "lucide-react";

export default function AdminBulkPrint() {
  const [clues, setClues] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Toutes");
  const [format, setFormat] = useState<"qr" | "barcode">("qr");
  const navigate = useNavigate();

  useEffect(() => {
    fetchClues();
  }, []);

  const fetchClues = async () => {
    const res = await fetch("/api/admin/clues");
    if (res.ok) {
      const data = await res.json();
      setClues(data);
    } else {
      navigate("/admin");
    }
  };

  const categories = Array.from(new Set(clues.map(c => c.category || "Uncategorized"))).sort();
  const allCategories = ["Toutes", ...categories];
  const selectedIdsFromUrl = (() => {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("ids");
    if (!raw) return null;
    return raw.split(",").filter(Boolean);
  })();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const categoryFromUrl = params.get("category");
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl);
    }
    const formatFromUrl = params.get("format");
    if (formatFromUrl === "barcode" || formatFromUrl === "qr") {
      setFormat(formatFromUrl);
    }
  }, []);

  const cluesSource = selectedIdsFromUrl?.length
    ? clues.filter((clue) => selectedIdsFromUrl.includes(clue.id))
    : clues;
  const groupedByCategory = cluesSource.reduce<Record<string, any[]>>((acc, clue) => {
    const key = clue.category || "Uncategorized";
    if (!acc[key]) acc[key] = [];
    acc[key].push(clue);
    return acc;
  }, {});
  const sourceCategories = Array.from(new Set(cluesSource.map(c => c.category || "Uncategorized"))).sort();
  const categoriesToPrintSafe = selectedCategory === "Toutes" ? sourceCategories : [selectedCategory];

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0">
      <div className="max-w-5xl mx-auto print:max-w-none print:w-full">
        <div className="flex justify-between items-center mb-8 print:hidden">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au tableau de bord
          </Link>
          <div className="flex items-center gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border border-zinc-300 bg-white text-sm"
            >
              {allCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "qr" | "barcode")}
              className="px-3 py-2 rounded-xl border border-zinc-300 bg-white text-sm"
            >
              <option value="qr">QR Code</option>
              <option value="barcode">Code-barres</option>
            </select>
            <button
              onClick={() => {
                const params = new URLSearchParams(window.location.search);
                params.set("format", format);
                window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
                window.print();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              {selectedCategory === "Toutes" ? "Imprimer toutes les categories" : `Imprimer: ${selectedCategory}`}
            </button>
          </div>
        </div>

        <div className="print:hidden mb-8">
          <h1 className="text-2xl font-bold">Impression des QR codes par categorie</h1>
          <p className="text-zinc-500">Selectionne une categorie et un format (QR/code-barres), puis imprime la page.</p>
        </div>

        {categoriesToPrintSafe.map(category => {
          const categoryClues = groupedByCategory[category] || [];
          return (
            <div key={category} className="mb-12 print:mb-6">
              <h2 className="text-xl font-bold mb-6 pb-2 border-b border-zinc-200 print:text-base print:mb-3 print:border-none">
                {category}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 print:label-sheet">
                {categoryClues.map((clue) => (
                  <div
                    key={clue.id}
                    className="flex flex-col items-center p-3 border rounded-xl break-inside-avoid print:label-item print:border-zinc-400"
                  >
                    <h3 className="font-bold text-center mb-2 text-xs leading-tight line-clamp-2">{clue.title}</h3>
                    {format === "qr" ? (
                      <QRCodeSVG
                        value={`${window.location.origin}/c/${clue.id}`}
                        size={92}
                        level="H"
                        includeMargin={true}
                      />
                    ) : (
                      <Barcode value={clue.id.substring(0, 12)} width={1.2} height={42} fontSize={9} />
                    )}
                    <p className="text-[10px] text-zinc-400 mt-1 font-mono">{clue.id.substring(0, 8)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
