import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Upload, Type, Image as ImageIcon, Video, Music } from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

export default function AdminCreateClue() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Uncategorized");
  const [type, setType] = useState("text");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [protectionType, setProtectionType] = useState("none");
  const [protectionCode, setProtectionCode] = useState("");
  const [theme, setTheme] = useState("default");
  const [bgImage, setBgImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    } else {
      if (!file) {
        setError("Please select a file.");
        setLoading(false);
        return;
      }
      formData.append("file", file);
    }

    if (bgImage) {
      formData.append("bg_image", bgImage);
    }

    try {
      const res = await fetch("/api/admin/clues", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        navigate(`/admin/clues/${data.id}`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create clue");
      }
    } catch (err) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: "text", label: "Text", icon: Type },
    { id: "image", label: "Image", icon: ImageIcon },
    { id: "video", label: "Video", icon: Video },
    { id: "audio", label: "Audio", icon: Music },
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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 py-8 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-3xl mx-auto mt-8">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-8 shadow-sm">
          <h2 className="text-2xl font-semibold mb-8">Create New Clue</h2>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Clue Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                  placeholder="e.g., The Hidden Key"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Category / Event
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Team Building 2026"
                />
              </div>
            </div>

            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                Content Type
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
                {type === "text" ? "Text Content" : "Upload File"}
              </label>
              {type === "text" ? (
                <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700">
                  <ReactQuill
                    theme="snow"
                    value={textContent}
                    onChange={setTextContent}
                    modules={quillModules}
                    className="h-48 pb-10"
                    placeholder="Enter the clue text here..."
                  />
                </div>
              ) : (
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-zinc-300 dark:border-zinc-700 border-dashed rounded-xl bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-zinc-400" />
                    <div className="flex text-sm text-zinc-600 dark:text-zinc-400 justify-center">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white dark:bg-zinc-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1"
                      >
                        <span>Upload a file</span>
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
                          required
                        />
                      </label>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500">
                      {file ? file.name : `Select ${type} file`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Selection */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-700">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                Visual Theme
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { id: "default", label: "Default" },
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
              </div>

              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Custom Background Image (Optional)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-zinc-300 dark:border-zinc-700 border-dashed rounded-xl bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <div className="space-y-1 text-center">
                  <ImageIcon className="mx-auto h-12 w-12 text-zinc-400" />
                  <div className="flex text-sm text-zinc-600 dark:text-zinc-400 justify-center">
                    <label
                      htmlFor="bg-upload"
                      className="relative cursor-pointer bg-white dark:bg-zinc-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1"
                    >
                      <span>Upload background</span>
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
                    {bgImage ? bgImage.name : "Select an image to override the theme background"}
                  </p>
                </div>
              </div>
            </div>

            {/* Protection */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-700">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                Access Protection
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
                      {protectionType === "pin" ? "PIN Code" : "Password"}
                    </label>
                    <input
                      type={protectionType === "pin" ? "number" : "text"}
                      value={protectionCode}
                      onChange={(e) => setProtectionCode(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                      placeholder={`Enter ${protectionType}...`}
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
                {loading ? "Creating..." : "Create Clue"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
