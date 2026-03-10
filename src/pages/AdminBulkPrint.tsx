import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Printer } from "lucide-react";

export default function AdminBulkPrint() {
  const [clues, setClues] = useState<any[]>([]);
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

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0">
      <div className="max-w-5xl mx-auto print:max-w-none print:w-full">
        <div className="flex justify-between items-center mb-8 print:hidden">
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print All QR Codes
          </button>
        </div>

        <div className="print:hidden mb-8">
          <h1 className="text-2xl font-bold">Bulk Print QR Codes</h1>
          <p className="text-zinc-500">Print this page to get all your QR codes on A4 paper.</p>
        </div>

        {categories.map(category => {
          const categoryClues = clues.filter(c => (c.category || "Uncategorized") === category);
          return (
            <div key={category} className="mb-12 print:mb-8">
              <h2 className="text-xl font-bold mb-6 pb-2 border-b border-zinc-200 print:text-lg print:mb-4">{category}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8 print:grid-cols-4 print:gap-4">
                {categoryClues.map((clue) => (
                  <div key={clue.id} className="flex flex-col items-center p-4 border rounded-xl break-inside-avoid print:border-zinc-300 print:shadow-none">
                    <h3 className="font-bold text-center mb-2 text-sm line-clamp-2">{clue.title}</h3>
                    <QRCodeSVG
                      value={`${window.location.origin}/c/${clue.id}`}
                      size={120}
                      level="H"
                      includeMargin={true}
                    />
                    <p className="text-xs text-zinc-400 mt-2 font-mono">{clue.id.substring(0, 8)}</p>
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
