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
        setError("Indice introuvable ou indisponible.");
      }
    } catch (err) {
      setError("Impossible de charger l'indice.");
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
        setError(data.error || "Code invalide");
      }
    } catch (err) {
      setError("Impossible de débloquer l'indice.");
    } finally {
      setUnlocking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    unlockClue(code);
  };

  const getThemeClasses = () => {
    const customTheme = content?.theme_config || meta?.theme_config;
    if (customTheme) {
      return "";
    }
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
    const customTheme = content?.theme_config || meta?.theme_config;
    if (customTheme) {
      return {
        backgroundColor: customTheme.pageBgColor,
        color: customTheme.pageTextColor,
      };
    }
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
    const customTheme = content?.theme_config || meta?.theme_config;
    if (customTheme) return "";
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
        <div className="animate-pulse opacity-70 z-10">Chargement de l'indice...</div>
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
          <h2 className="text-xl font-semibold mb-2">Erreur</h2>
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
        <div
          className={`max-w-md w-full rounded-2xl border p-8 relative z-10 ${getCardClasses()}`}
          style={
            meta?.theme_config
              ? {
                  backgroundColor: meta.theme_config.cardBgColor,
                  borderColor: meta.theme_config.cardBorderColor,
                  color: meta.theme_config.pageTextColor,
                }
              : undefined
          }
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-black/10 dark:bg-white/10 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 opacity-80" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-center mb-2">
            Indice protégé
          </h2>
          <p className="text-center opacity-80 mb-8">
            Cet indice nécessite un {meta.protection_type === "pin" ? "code PIN" : "mot de passe"}.
          </p>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type={meta.protection_type === "pin" ? "number" : "text"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-3 text-center text-xl tracking-widest bg-black/5 dark:bg-white/5 border border-black/20 dark:border-white/20 rounded-xl focus:ring-2 focus:ring-current focus:outline-none"
                required
                placeholder={meta.protection_type === "pin" ? "----" : "Saisir le mot de passe"}
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}
            <button
              type="submit"
              disabled={unlocking}
              className="w-full py-3 px-4 bg-black/20 hover:bg-black/30 dark:bg-white/20 dark:hover:bg-white/30 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {unlocking ? "Vérification..." : "Déverrouiller l'indice"}
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
      <div className="w-full max-w-6xl mx-auto mt-4 sm:mt-8 relative z-10">
        <div
          className={`rounded-3xl border overflow-hidden ${getCardClasses()}`}
          style={
            content?.theme_config
              ? {
                  backgroundColor: content.theme_config.cardBgColor,
                  borderColor: content.theme_config.cardBorderColor,
                  color: content.theme_config.pageTextColor,
                }
              : undefined
          }
        >
          <div className="p-6 sm:p-8 border-b border-black/10 dark:border-white/10">
            <h1 className="text-2xl sm:text-3xl font-bold text-center">{content.title}</h1>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">
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
            {content.type === "grid" && (
              <div
                className="grid grid-cols-6 gap-2 sm:gap-3 lg:gap-4 w-full"
                style={{ gridAutoRows: "clamp(56px, 10vw, 120px)" }}
              >
                {(JSON.parse(content.content || "[]") as any[])
                  .sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1))
                  .map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg sm:rounded-xl border border-black/10 dark:border-white/20 bg-black/5 dark:bg-white/5 p-2 sm:p-3 overflow-hidden"
                    style={{
                      gridColumn: `${(item.col || 0) + 1} / span ${item.colSpan || 1}`,
                      gridRow: `${(item.row || 0) + 1} / span ${item.rowSpan || 1}`,
                      zIndex: item.zIndex || 1,
                    }}
                  >
                    {item.type === "text" && <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{item.text}</div>}
                    {item.type === "image" && <img src={item.content} alt="" className="w-full h-full object-cover rounded-md sm:rounded-lg" />}
                    {item.type === "video" && (
                      <video src={item.content} controls className="w-full h-full object-cover rounded-md sm:rounded-lg" playsInline />
                    )}
                    {item.type === "audio" && (
                      <div className="h-full flex items-center">
                        <audio src={item.content} controls className="w-full" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
