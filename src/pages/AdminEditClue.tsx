import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Upload, Type, Image as ImageIcon, Video, Music, LayoutGrid } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import ReactQuill from "react-quill-new";
import GridComposer, { GridComposerItem } from "../components/GridComposer";
import "react-quill-new/dist/quill.snow.css";

export default function AdminEditClue() {
  const { id } = useParams();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Uncategorized");
  const [type, setType] = useState("text");
  const [textContent, setTextContent] = useState("");
  const [gridItems, setGridItems] = useState<GridComposerItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [protectionType, setProtectionType] = useState("none");
  const [protectionCode, setProtectionCode] = useState("");
  const [theme, setTheme] = useState("default");
  const [customThemes, setCustomThemes] = useState<any[]>([]);
  const [newThemeName, setNewThemeName] = useState("");
  const [themePageBg, setThemePageBg] = useState("#111827");
  const [themePageText, setThemePageText] = useState("#f9fafb");
  const [themeCardBg, setThemeCardBg] = useState("#1f2937");
  const [themeCardBorder, setThemeCardBorder] = useState("#374151");
  const [showThemeSection, setShowThemeSection] = useState(false);
  const [bgImage, setBgImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentContent, setCurrentContent] = useState("");
  const [currentBg, setCurrentBg] = useState("");
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchClue();
    fetch("/api/admin/themes")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCustomThemes(Array.isArray(data) ? data : []))
      .catch(() => setCustomThemes([]));
  }, [id]);

  const fetchClue = async () => {
    try {
      const res = await fetch(`/api/admin/clues/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title);
        setCategory(data.category || "Uncategorized");
        setType(data.type);
        if (data.type === "text") {
          setTextContent(data.content);
        } else if (data.type === "grid") {
          try {
            const parsed = JSON.parse(data.content);
            setGridItems(parsed);
          } catch {
            setGridItems([]);
          }
        } else {
          setCurrentContent(data.content);
        }
        setProtectionType(data.protection_type);
        setProtectionCode(data.protection_code || "");
        setTheme(data.theme || "default");
        setCurrentBg(data.theme_bg_image || "");
      } else {
        navigate("/admin");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("category", category);
    formData.append("type", type);
    formData.append("theme", theme);
    formData.append("protection_type", protectionType);
    if (protectionType !== "none") {
      formData.append("protection_code", protectionCode);
    }
    
    if (type === "text") {
      formData.append("text_content", textContent);
    } else if (type === "grid") {
      if (!gridItems.length) {
        setError("Ajoute au moins un élément dans la grille.");
        setLoading(false);
        return;
      }
      const mediaItems = gridItems.filter((item) => item.type !== "text");
      const payload = gridItems.map((item) => ({
        id: item.id,
        type: item.type,
        row: item.row,
        col: item.col,
        rowSpan: item.rowSpan,
        colSpan: item.colSpan,
        zIndex: item.zIndex || 1,
        text: item.text || "",
        content: item.content,
        fileIndex:
          item.type !== "text" && item.file
            ? mediaItems.filter((mediaItem) => mediaItem.file).findIndex((mediaItem) => mediaItem.id === item.id)
            : undefined,
      }));
      formData.append("grid_items", JSON.stringify(payload));
      mediaItems.forEach((item) => {
        if (item.file) formData.append("item_files", item.file);
      });
    } else {
      if (file) {
        formData.append("file", file);
      }
    }

    if (bgImage) {
      formData.append("bg_image", bgImage);
    }

    try {
      const res = await fetch(`/api/admin/clues/${id}`, {
        method: "PUT",
        body: formData,
      });

      if (res.ok) {
        navigate(`/admin/clues/${id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Impossible de mettre à jour l'indice");
      }
    } catch (err) {
      setError("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: "text", label: "Texte", icon: Type },
    { id: "image", label: "Image", icon: ImageIcon },
    { id: "video", label: "Video", icon: Video },
    { id: "audio", label: "Audio", icon: Music },
    { id: "grid", label: "Grille", icon: LayoutGrid },
  ];

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'clean']
    ],
  };

  const createCustomTheme = async () => {
    if (!newThemeName.trim()) return;
    const res = await fetch("/api/admin/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newThemeName,
        pageBgColor: themePageBg,
        pageTextColor: themePageText,
        cardBgColor: themeCardBg,
        cardBorderColor: themeCardBorder,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setCustomThemes((prev) => [...prev, data.theme]);
    setTheme(`custom:${data.theme.id}`);
    setNewThemeName("");
  };

  if (initialLoading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 py-8 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-3xl mx-auto mt-8">
        <Link
          to={`/admin/clues/${id}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux détails
        </Link>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-8">Modifier l'indice</h2>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Titre de l'indice
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                  placeholder="Ex: La clé cachée"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Catégorie / événement
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Ex: Team Building 2026"
                />
              </div>
            </div>

            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                Type de contenu
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {types.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id)}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        type === t.id
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      <Icon className="w-6 h-6 mb-2" />
                      <span className="text-sm font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Input */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {type === "text" ? "Contenu texte" : type === "grid" ? "Composition en grille" : "Téléverser un fichier"}
              </label>
              {type === "text" ? (
                <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700">
                  <ReactQuill
                    theme="snow"
                    value={textContent}
                    onChange={setTextContent}
                    modules={quillModules}
                    className="h-48 pb-10"
                    placeholder="Saisis le texte de l'indice..."
                  />
                </div>
              ) : type === "grid" ? (
                <GridComposer items={gridItems} setItems={setGridItems} />
              ) : (
                <div className="mt-1 flex flex-col items-center justify-center px-6 pt-5 pb-6 border-2 border-zinc-300 dark:border-zinc-700 border-dashed rounded-xl bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-zinc-400" />
                    <div className="flex text-sm text-zinc-600 dark:text-zinc-400 justify-center">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white dark:bg-zinc-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1"
                      >
                        <span>Téléverser un nouveau fichier</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          accept={
                            type === "image"
                              ? "image/*"
                              : type === "video"
                              ? "video/*"
                              : "audio/*"
                          }
                        />
                      </label>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">
                      {file ? file.name : (currentContent ? "Laisser vide pour garder le fichier actuel" : `Choisir un fichier ${type}`)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Selection */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setShowThemeSection((prev) => !prev)}
                className="w-full text-left px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {showThemeSection ? "Masquer le thème visuel" : "Afficher le thème visuel"}
                </span>
              </button>

              {showThemeSection && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                    Thème visuel
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    {[
                      { id: "default", label: "Défaut" },
                      { id: "pirate", label: "Pirate" },
                      { id: "scifi", label: "Sci-Fi" },
                      { id: "halloween", label: "Halloween" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          theme === t.id
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                    {customThemes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(`custom:${t.id}`)}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                          theme === `custom:${t.id}`
                            ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 mb-6">
                    <p className="text-sm font-medium">Creer un theme personnalise</p>
                    <input
                      type="text"
                      value={newThemeName}
                      onChange={(e) => setNewThemeName(e.target.value)}
                      placeholder="Nom du theme"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-transparent text-sm"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <label className="text-xs">Fond page<input type="color" value={themePageBg} onChange={(e) => setThemePageBg(e.target.value)} className="w-full h-9 mt-1" /></label>
                      <label className="text-xs">Texte page<input type="color" value={themePageText} onChange={(e) => setThemePageText(e.target.value)} className="w-full h-9 mt-1" /></label>
                      <label className="text-xs">Fond carte<input type="color" value={themeCardBg} onChange={(e) => setThemeCardBg(e.target.value)} className="w-full h-9 mt-1" /></label>
                      <label className="text-xs">Bord carte<input type="color" value={themeCardBorder} onChange={(e) => setThemeCardBorder(e.target.value)} className="w-full h-9 mt-1" /></label>
                    </div>
                    <button
                      type="button"
                      onClick={createCustomTheme}
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm"
                    >
                      Enregistrer le theme
                    </button>
                  </div>

                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Image de fond personnalisée (optionnel)
                  </label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-zinc-300 dark:border-zinc-700 border-dashed rounded-xl bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                    <div className="space-y-1 text-center">
                      <ImageIcon className="mx-auto h-12 w-12 text-zinc-400" />
                      <div className="flex text-sm text-zinc-600 dark:text-zinc-400 justify-center">
                        <label
                          htmlFor="bg-upload"
                          className="relative cursor-pointer bg-white dark:bg-zinc-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1"
                        >
                          <span>Téléverser un nouveau fond</span>
                          <input
                            id="bg-upload"
                            name="bg-upload"
                            type="file"
                            className="sr-only"
                            onChange={(e) => setBgImage(e.target.files?.[0] || null)}
                            accept="image/*"
                          />
                        </label>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">
                        {bgImage ? bgImage.name : (currentBg ? "Laisser vide pour garder le fond actuel" : "Choisir une image pour remplacer le fond du thème")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Protection */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-700">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                Protection d'accès
              </label>
              <div className="space-y-4">
                <div className="flex gap-4">
                  {["none", "pin", "password"].map((pt) => (
                    <label key={pt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={pt}
                        checked={protectionType === pt}
                        onChange={(e) => setProtectionType(e.target.value)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm capitalize">{pt}</span>
                    </label>
                  ))}
                </div>

                {protectionType !== "none" && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      {protectionType === "pin" ? "Code PIN" : "Mot de passe"}
                    </label>
                    <input
                      type={protectionType === "pin" ? "number" : "text"}
                      value={protectionCode}
                      onChange={(e) => setProtectionCode(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                      placeholder={`Saisir ${protectionType}...`}
                    />
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                {loading ? "Enregistrement..." : "Enregistrer les modifications"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
