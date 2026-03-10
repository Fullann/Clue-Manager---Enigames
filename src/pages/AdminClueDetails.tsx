import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";
import { ArrowLeft, Download, Printer, Eye, AlertTriangle, Edit } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

export default function AdminClueDetails() {
  const { id } = useParams();
  const [clue, setClue] = useState<any>(null);
  const [showBarcode, setShowBarcode] = useState(false);
  const navigate = useNavigate();
  const qrRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetchClue();
  }, [id]);

  const fetchClue = async () => {
    const res = await fetch(`/api/admin/clues/${id}`);
    if (res.ok) {
      const data = await res.json();
      setClue(data);
    } else {
      navigate("/admin");
    }
  };

  const clueUrl = `${window.location.origin}/c/${id}`;

  const downloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `clue-${id}-qr.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!clue) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 py-8 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4 print:hidden">
        <ThemeToggle />
      </div>
      <div className="max-w-3xl mx-auto mt-8">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors print:hidden"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 shadow-sm">
          <div className="flex justify-between items-start mb-8 print:hidden">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{clue.title}</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-2">
                Type: <span className="uppercase">{clue.type}</span> | Protection:{" "}
                <span className="capitalize">{clue.protection_type}</span> | Theme:{" "}
                <span className="capitalize">{clue.theme || "Default"}</span>
              </p>
              <div className="flex items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                <div className="flex items-center gap-1.5" title="Total Scans">
                  <Eye className="w-4 h-4 text-indigo-500" />
                  {clue.scan_count || 0} Scans
                </div>
                <div className="flex items-center gap-1.5" title="Failed Unlock Attempts">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  {clue.failed_attempts || 0} Failed Attempts
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                to={`/admin/clues/${id}/edit`}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl text-sm font-medium transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Link>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-xl text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 max-w-md mx-auto">
            <h3 className="text-lg font-medium mb-2">
              {showBarcode ? "Barcode" : "QR Code"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 text-center print:hidden">
              Double-click the code to switch format
            </p>
            <div 
              className="bg-white p-4 rounded-xl shadow-sm mb-6 cursor-pointer select-none overflow-hidden max-w-full flex justify-center transition-transform hover:scale-[1.02]"
              onDoubleClick={() => setShowBarcode(!showBarcode)}
              title="Double-click to toggle format"
            >
              {showBarcode ? (
                <Barcode value={id.substring(0, 12)} width={2} height={100} displayValue={true} />
              ) : (
                <QRCodeSVG
                  value={clueUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                  ref={qrRef}
                />
              )}
            </div>
            {!showBarcode && (
              <div className="flex gap-3 print:hidden">
                <button
                  onClick={downloadQR}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PNG
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm font-medium transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print QR
                </button>
              </div>
            )}
            {showBarcode && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center print:hidden">
                Barcodes have limited data capacity. Use the QR code for direct URL scanning.
              </p>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700 print:hidden">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Direct URL
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={clueUrl}
                className="flex-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm text-zinc-600 dark:text-zinc-400"
              />
              <button
                onClick={() => navigator.clipboard.writeText(clueUrl)}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-xl text-sm font-medium transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
