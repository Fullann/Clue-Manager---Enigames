import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Lock, Unlock, AlertCircle } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import DOMPurify from "dompurify";

export default function PublicClueView() {
  const { id } = useParams();
  const [meta, setMeta] = useState<any>(null);
  const [content, setContent] = useState<any>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    fetchMeta();
  }, [id]);

  const fetchMeta = async () => {
    try {
      const res = await fetch(`/api/clues/${id}/meta`);
      if (res.ok) {
        const data = await res.json();
        setMeta(data);
        if (data.protection_type === "none") {
          unlockClue("");
        }
      } else {
        setError("Clue not found or unavailable.");
      }
    } catch (err) {
      setError("Failed to load clue.");
    } finally {
      setLoading(false);
    }
  };

  const unlockClue = async (submitCode: string) => {
    setUnlocking(true);
    setError("");
    try {
      const res = await fetch(`/api/clues/${id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: submitCode }),
      });
      if (res.ok) {
        const data = await res.json();
        setContent(data);
      } else {
        const data = await res.json();
        setError(data.error || "Invalid code");
      }
    } catch (err) {
      setError("Failed to unlock clue.");
    } finally {
      setUnlocking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    unlockClue(code);
  };

  const getThemeClasses = () => {
    const theme = content?.theme || meta?.theme || "default";
    const hasBgImage = !!(content?.theme_bg_image || meta?.theme_bg_image);
    
    let baseClasses = "";
    switch (theme) {
      case "pirate":
        baseClasses = "bg-[#f4e4bc] text-[#4a3b2c] font-serif";
        break;
      case "scifi":
        baseClasses = "bg-black text-green-400 font-mono";
        break;
      case "halloween":
        baseClasses = "bg-orange-950 text-orange-200";
        break;
      default:
        baseClasses = "bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100";
        break;
    }
    
    // If there's a custom background image, we might want to ensure text is readable
    // but we'll let the card background handle the readability.
    if (hasBgImage) {
      // Remove background color classes if we have an image, but keep text/font classes
      baseClasses = baseClasses.replace(/bg-\S+/g, "");
    }
    
    return baseClasses;
  };

  const getBackgroundStyle = () => {
    const bgImage = content?.theme_bg_image || meta?.theme_bg_image;
    if (bgImage) {
      return {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      };
    }
    return {};
  };

  const getCardClasses = () => {
    const theme = content?.theme || meta?.theme || "default";
    switch (theme) {
      case "pirate":
        return "bg-[#e8d5a5] border-[#8b5a2b] shadow-xl";
      case "scifi":
        return "bg-zinc-900 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]";
      case "halloween":
        return "bg-orange-900 border-orange-700 shadow-xl";
      default:
        return "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm";
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center relative ${getThemeClasses()}`} style={getBackgroundStyle()}>
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none" style={{ display: (content?.theme_bg_image || meta?.theme_bg_image) ? 'block' : 'none' }}></div>
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <div className="animate-pulse opacity-70 z-10">Loading clue...</div>
      </div>
    );
  }

  if (error && !meta) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 relative ${getThemeClasses()}`} style={getBackgroundStyle()}>
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none" style={{ display: (content?.theme_bg_image || meta?.theme_bg_image) ? 'block' : 'none' }}></div>
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <div className={`p-8 rounded-2xl border text-center max-w-md w-full relative z-10 ${getCardClasses()}`}>
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 relative ${getThemeClasses()}`} style={getBackgroundStyle()}>
        <div className="absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none" style={{ display: (content?.theme_bg_image || meta?.theme_bg_image) ? 'block' : 'none' }}></div>
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        <div className={`max-w-md w-full rounded-2xl border p-8 relative z-10 ${getCardClasses()}`}>
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-black/10 dark:bg-white/10 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 opacity-80" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-center mb-2">
            Protected Clue
          </h2>
          <p className="text-center opacity-80 mb-8">
            This clue requires a {meta.protection_type === "pin" ? "PIN code" : "password"} to view.
          </p>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type={meta.protection_type === "pin" ? "number" : "text"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 text-center text-xl tracking-widest bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-xl focus:ring-2 focus:ring-current focus:outline-none"
                required
                placeholder={meta.protection_type === "pin" ? "----" : "Enter password"}
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}
            <button
              type="submit"
              disabled={unlocking}
              className="w-full py-3 px-4 bg-black/20 hover:bg-black/30 dark:bg-white/20 dark:hover:bg-white/30 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {unlocking ? "Verifying..." : "Unlock Clue"}
              <Unlock className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen py-8 px-4 sm:px-6 lg:px-8 relative ${getThemeClasses()}`} style={getBackgroundStyle()}>
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none" style={{ display: (content?.theme_bg_image || meta?.theme_bg_image) ? 'block' : 'none' }}></div>
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="max-w-2xl mx-auto mt-8 relative z-10">
        <div className={`rounded-3xl border overflow-hidden ${getCardClasses()}`}>
          <div className="p-6 sm:p-8 border-b border-black/10 dark:border-white/10">
            <h1 className="text-2xl sm:text-3xl font-bold text-center">{content.title}</h1>
          </div>
          <div className="p-6 sm:p-8">
            {content.type === "text" && (
              <div 
                className="prose dark:prose-invert max-w-none text-lg leading-relaxed !text-current"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content.content) }}
              />
            )}
            {content.type === "image" && (
              <img
                src={content.content}
                alt={content.title}
                className="w-full h-auto rounded-xl shadow-sm"
              />
            )}
            {content.type === "video" && (
              <video
                src={content.content}
                controls
                className="w-full rounded-xl shadow-sm"
                playsInline
              />
            )}
            {content.type === "audio" && (
              <div className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl flex flex-col items-center">
                <audio src={content.content} controls className="w-full max-w-md" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
