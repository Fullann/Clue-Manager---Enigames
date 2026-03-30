import express from "express";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import multer from "multer";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import mysql, { Pool, RowDataPacket } from "mysql2/promise";
import bcrypt from "bcrypt";
import speakeasy from "speakeasy";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

let db: Pool;

type SettingRow = RowDataPacket & { value: string };
type ClueRow = RowDataPacket & {
  id: string;
  title: string;
  type: string;
  content: string;
  protection_type: string;
  protection_code: string | null;
  theme: string;
  theme_bg_image: string | null;
  category: string;
  scan_count: number;
  failed_attempts: number;
  created_at: string;
};

type GridItemInput = {
  id: string;
  type: "text" | "image" | "video" | "audio";
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  zIndex?: number;
  text?: string;
  content?: string;
  fileIndex?: number;
};

type CustomTheme = {
  id: string;
  name: string;
  pageBgColor: string;
  pageTextColor: string;
  cardBgColor: string;
  cardBorderColor: string;
};

async function selectOne<T extends RowDataPacket>(query: string, params: any[] = []): Promise<T | null> {
  const [rows] = await db.query<T[]>(query, params);
  return rows[0] ?? null;
}

async function selectAll<T extends RowDataPacket>(query: string, params: any[] = []): Promise<T[]> {
  const [rows] = await db.query<T[]>(query, params);
  return rows;
}

async function execute(query: string, params: any[] = []) {
  await db.execute(query, params);
}

async function getCustomThemes(): Promise<CustomTheme[]> {
  const row = await selectOne<SettingRow>("SELECT `value` FROM settings WHERE `key` = 'custom_themes'");
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveCustomThemes(themes: CustomTheme[]) {
  await execute(
    "INSERT INTO settings (`key`, `value`) VALUES ('custom_themes', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
    [JSON.stringify(themes)]
  );
}

async function resolveThemeConfig(theme: string): Promise<CustomTheme | null> {
  if (!theme.startsWith("custom:")) return null;
  const customId = theme.replace("custom:", "");
  const themes = await getCustomThemes();
  return themes.find((item) => item.id === customId) || null;
}

function normalizeGridItems(rawItems: unknown): GridItemInput[] {
  if (!Array.isArray(rawItems)) {
    throw new Error("Invalid grid payload");
  }

  return rawItems.map((item) => {
    const typedItem = item as GridItemInput;
    if (!typedItem?.id || !typedItem?.type) {
      throw new Error("Each grid item must contain id and type");
    }
    if (!["text", "image", "video", "audio"].includes(typedItem.type)) {
      throw new Error("Unsupported grid item type");
    }

    const row = Number(typedItem.row);
    const col = Number(typedItem.col);
    const rowSpan = Math.max(1, Number(typedItem.rowSpan || 1));
    const colSpan = Math.max(1, Number(typedItem.colSpan || 1));
    const zIndex = Math.max(1, Number(typedItem.zIndex || 1));

    return {
      id: String(typedItem.id),
      type: typedItem.type,
      row: Number.isFinite(row) ? row : 0,
      col: Number.isFinite(col) ? col : 0,
      rowSpan: Number.isFinite(rowSpan) ? rowSpan : 1,
      colSpan: Number.isFinite(colSpan) ? colSpan : 1,
      zIndex: Number.isFinite(zIndex) ? zIndex : 1,
      text: typedItem.text ? String(typedItem.text) : undefined,
      content: typedItem.content ? String(typedItem.content) : undefined,
      fileIndex: typedItem.fileIndex !== undefined ? Number(typedItem.fileIndex) : undefined,
    };
  });
}

function buildGridContent(gridItemsRaw: string | undefined, files: Express.Multer.File[] | undefined): string {
  if (!gridItemsRaw) {
    throw new Error("Missing grid_items payload");
  }

  const parsed = JSON.parse(gridItemsRaw);
  const items = normalizeGridItems(parsed);
  const uploadedFiles = files || [];

  const resolvedItems = items.map((item) => {
    if (item.type === "text") {
      return { ...item, content: undefined, fileIndex: undefined };
    }

    if (typeof item.fileIndex === "number") {
      const uploaded = uploadedFiles[item.fileIndex];
      if (!uploaded) {
        throw new Error(`Missing uploaded file for item ${item.id}`);
      }
      return {
        ...item,
        content: `/uploads/${uploaded.filename}`,
        fileIndex: undefined,
      };
    }

    if (item.content?.startsWith("/uploads/")) {
      return { ...item, fileIndex: undefined };
    }

    throw new Error(`Missing media file for item ${item.id}`);
  });

  return JSON.stringify(resolvedItems);
}

async function initializeDatabase() {
  db = mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER || "",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  await execute(`
    CREATE TABLE IF NOT EXISTS clues (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      protection_type VARCHAR(50) NOT NULL,
      protection_code VARCHAR(255) NULL,
      theme VARCHAR(100) NOT NULL DEFAULT 'default',
      theme_bg_image TEXT NULL,
      category VARCHAR(255) NOT NULL DEFAULT 'Uncategorized',
      scan_count INT NOT NULL DEFAULT 0,
      failed_attempts INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(191) PRIMARY KEY,
      \`value\` TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const adminPasswordHash = await selectOne<SettingRow>("SELECT `value` FROM settings WHERE `key` = 'admin_password'");
  if (!adminPasswordHash) {
    const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";
    const hash = bcrypt.hashSync(defaultPassword, 10);
    await execute("INSERT INTO settings (`key`, `value`) VALUES ('admin_password', ?)", [hash]);
  }
}

// Setup file uploads
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const isAllowed =
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("audio/") ||
    file.mimetype.startsWith("video/");

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, audio, and video are allowed.'));
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(uploadsDir));

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key-for-admin";

// Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: "Too many login attempts, please try again after 15 minutes" },
  validate: { xForwardedForHeader: false, forwardedHeader: false }
});

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 unlock attempts per windowMs
  message: { error: "Too many unlock attempts, please try again later" },
  validate: { xForwardedForHeader: false, forwardedHeader: false }
});

// Admin Auth Middleware
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const asyncHandler = (
  handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>
) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

// --- API Routes ---

// Admin Login
app.post("/api/admin/login", loginLimiter, asyncHandler(async (req, res) => {
  const { password, token: twoFactorToken } = req.body;
  
  const hashRow = await selectOne<SettingRow>("SELECT `value` FROM settings WHERE `key` = 'admin_password'");
  if (!hashRow || !bcrypt.compareSync(password, hashRow.value)) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const twoFactorEnabled = await selectOne<SettingRow>("SELECT `value` FROM settings WHERE `key` = '2fa_enabled'");
  if (twoFactorEnabled && twoFactorEnabled.value === 'true') {
    if (!twoFactorToken) {
      return res.json({ require2FA: true });
    }
    const secretRow = await selectOne<SettingRow>("SELECT `value` FROM settings WHERE `key` = '2fa_secret'");
    if (!secretRow || !speakeasy.totp.verify({ secret: secretRow.value, encoding: 'base32', token: twoFactorToken })) {
      return res.status(401).json({ error: "Invalid 2FA code" });
    }
  }

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "1d" });
  res.cookie("admin_token", token, { httpOnly: true, secure: true, sameSite: "none" });
  res.json({ success: true });
}));

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("admin_token", { httpOnly: true, secure: true, sameSite: "none" });
  res.json({ success: true });
});

app.get("/api/admin/check", requireAdmin, (req, res) => {
  res.json({ success: true });
});

app.get("/api/admin/themes", requireAdmin, asyncHandler(async (req, res) => {
  const themes = await getCustomThemes();
  res.json(themes);
}));

app.post("/api/admin/themes", requireAdmin, asyncHandler(async (req, res) => {
  const { name, pageBgColor, pageTextColor, cardBgColor, cardBorderColor } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Theme name is required" });
  }
  const nextTheme: CustomTheme = {
    id: uuidv4(),
    name: String(name).trim(),
    pageBgColor: String(pageBgColor || "#111827"),
    pageTextColor: String(pageTextColor || "#f9fafb"),
    cardBgColor: String(cardBgColor || "#1f2937"),
    cardBorderColor: String(cardBorderColor || "#374151"),
  };
  const themes = await getCustomThemes();
  themes.push(nextTheme);
  await saveCustomThemes(themes);
  res.json({ success: true, theme: nextTheme });
}));

app.delete("/api/admin/themes/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const themes = await getCustomThemes();
  const nextThemes = themes.filter((item) => item.id !== id);
  await saveCustomThemes(nextThemes);
  res.json({ success: true });
}));

// Admin Settings
app.get("/api/admin/settings", requireAdmin, asyncHandler(async (req, res) => {
  const twoFactorEnabled = await selectOne<SettingRow>("SELECT `value` FROM settings WHERE `key` = '2fa_enabled'");
  res.json({
    twoFactorEnabled: twoFactorEnabled?.value === 'true'
  });
}));

app.post("/api/admin/settings/password", requireAdmin, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  const hashRow = await selectOne<SettingRow>("SELECT `value` FROM settings WHERE `key` = 'admin_password'");
  if (!hashRow || !bcrypt.compareSync(currentPassword, hashRow.value)) {
    return res.status(401).json({ error: "Invalid current password" });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  await execute("UPDATE settings SET `value` = ? WHERE `key` = 'admin_password'", [newHash]);
  res.json({ success: true });
}));

app.post("/api/admin/settings/2fa/setup", requireAdmin, asyncHandler(async (req, res) => {
  const secret = speakeasy.generateSecret({ name: "ClueManager (Admin)" });
  
  // Store secret temporarily or permanently, but mark as not enabled yet
  await execute("INSERT INTO settings (`key`, `value`) VALUES ('2fa_secret_temp', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)", [secret.base32]);
  
  res.json({ secret: secret.base32, otpauth: secret.otpauth_url });
}));

app.post("/api/admin/settings/2fa/verify", requireAdmin, asyncHandler(async (req, res) => {
  const { token } = req.body;
  const secretRow = await selectOne<SettingRow>("SELECT `value` FROM settings WHERE `key` = '2fa_secret_temp'");
  
  if (!secretRow) {
    return res.status(400).json({ error: "2FA setup not initiated" });
  }

  const verified = speakeasy.totp.verify({
    secret: secretRow.value,
    encoding: 'base32',
    token: token
  });

  if (verified) {
    await execute("INSERT INTO settings (`key`, `value`) VALUES ('2fa_secret', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)", [secretRow.value]);
    await execute("INSERT INTO settings (`key`, `value`) VALUES ('2fa_enabled', 'true') ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
    await execute("DELETE FROM settings WHERE `key` = '2fa_secret_temp'");
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid 2FA code" });
  }
}));

app.post("/api/admin/settings/2fa/disable", requireAdmin, asyncHandler(async (req, res) => {
  const { password } = req.body;
  
  const hashRow = await selectOne<SettingRow>("SELECT `value` FROM settings WHERE `key` = 'admin_password'");
  if (!hashRow || !bcrypt.compareSync(password, hashRow.value)) {
    return res.status(401).json({ error: "Invalid password" });
  }

  await execute("INSERT INTO settings (`key`, `value`) VALUES ('2fa_enabled', 'false') ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
  await execute("DELETE FROM settings WHERE `key` = '2fa_secret'");
  res.json({ success: true });
}));

// Admin Clues CRUD
app.get("/api/admin/clues", requireAdmin, asyncHandler(async (req, res) => {
  const clues = await selectAll<ClueRow>("SELECT id, title, type, protection_type, theme, theme_bg_image, category, scan_count, failed_attempts, created_at FROM clues ORDER BY created_at DESC");
  res.json(clues);
}));

app.get("/api/admin/clues/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const clue = await selectOne<ClueRow>("SELECT * FROM clues WHERE id = ?", [id]);
  if (!clue) {
    return res.status(404).json({ error: "Clue not found" });
  }
  const theme_config = await resolveThemeConfig(clue.theme);
  res.json({ ...clue, theme_config });
}));

app.post("/api/admin/clues/bulk-category", requireAdmin, asyncHandler(async (req, res) => {
  const { ids, category } = req.body as { ids?: string[]; category?: string };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids is required" });
  }
  if (!category || !String(category).trim()) {
    return res.status(400).json({ error: "category is required" });
  }

  const placeholders = ids.map(() => "?").join(", ");
  await execute(
    `UPDATE clues SET category = ? WHERE id IN (${placeholders})`,
    [String(category).trim(), ...ids]
  );
  res.json({ success: true, updated: ids.length });
}));

app.post("/api/admin/clues/bulk-delete", requireAdmin, asyncHandler(async (req, res) => {
  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids is required" });
  }
  const placeholders = ids.map(() => "?").join(", ");
  await execute(`DELETE FROM clues WHERE id IN (${placeholders})`, ids);
  res.json({ success: true, deleted: ids.length });
}));

app.put("/api/admin/clues/:id", requireAdmin, upload.fields([{ name: "file", maxCount: 1 }, { name: "bg_image", maxCount: 1 }, { name: "item_files", maxCount: 30 }]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, type, protection_type, protection_code, text_content, theme = "default", category = "Uncategorized" } = req.body;
  
  const existingClue = await selectOne<ClueRow>("SELECT * FROM clues WHERE id = ?", [id]);
  if (!existingClue) {
    return res.status(404).json({ error: "Clue not found" });
  }

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const file = files?.['file']?.[0];
  const bgImage = files?.['bg_image']?.[0];
  
  let content = existingClue.content;
  if (type === "text") {
    content = text_content || "";
  } else if (type === "grid") {
    content = buildGridContent(req.body.grid_items, files?.["item_files"]);
  } else if (file) {
    // Delete old file if it was a media type
    if (existingClue.type !== "text" && existingClue.content.startsWith("/uploads/")) {
      const oldPath = path.join(__dirname, existingClue.content);
      const normalizedPath = path.normalize(oldPath);
      if (normalizedPath.startsWith(uploadsDir) && fs.existsSync(normalizedPath)) {
        try { fs.unlinkSync(normalizedPath); } catch(e) {}
      }
    }
    content = `/uploads/${file.filename}`;
  }

  let theme_bg_image = existingClue.theme_bg_image;
  if (bgImage) {
    if (existingClue.theme_bg_image && existingClue.theme_bg_image.startsWith("/uploads/")) {
      const oldBgPath = path.join(__dirname, existingClue.theme_bg_image);
      const normalizedBgPath = path.normalize(oldBgPath);
      if (normalizedBgPath.startsWith(uploadsDir) && fs.existsSync(normalizedBgPath)) {
        try { fs.unlinkSync(normalizedBgPath); } catch(e) {}
      }
    }
    theme_bg_image = `/uploads/${bgImage.filename}`;
  }

  await execute(`
    UPDATE clues 
    SET title = ?, type = ?, content = ?, protection_type = ?, protection_code = ?, theme = ?, theme_bg_image = ?, category = ?
    WHERE id = ?
  `, [title, type, content, protection_type, protection_code || null, theme, theme_bg_image, category, id]);
  
  res.json({ success: true, id });
}));

app.post("/api/admin/clues", requireAdmin, upload.fields([{ name: "file", maxCount: 1 }, { name: "bg_image", maxCount: 1 }, { name: "item_files", maxCount: 30 }]), asyncHandler(async (req, res) => {
  const { title, type, protection_type, protection_code, text_content, theme = "default", category = "Uncategorized" } = req.body;
  const id = uuidv4();
  
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const file = files?.['file']?.[0];
  const bgImage = files?.['bg_image']?.[0];
  
  let content = "";
  if (type === "text") {
    content = text_content || "";
  } else if (type === "grid") {
    content = buildGridContent(req.body.grid_items, files?.["item_files"]);
  } else if (file) {
    content = `/uploads/${file.filename}`;
  } else {
    return res.status(400).json({ error: "File is required for media types" });
  }

  let theme_bg_image = null;
  if (bgImage) {
    theme_bg_image = `/uploads/${bgImage.filename}`;
  }

  await execute(`
    INSERT INTO clues (id, title, type, content, protection_type, protection_code, theme, theme_bg_image, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, title, type, content, protection_type, protection_code || null, theme, theme_bg_image, category]);
  
  res.json({ success: true, id });
}));

app.delete("/api/admin/clues/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const clue = await selectOne<RowDataPacket & { type: string; content: string }>("SELECT type, content FROM clues WHERE id = ?", [id]);
  
  if (clue) {
    if (clue.type !== "text" && clue.content.startsWith("/uploads/")) {
      const filePath = path.join(__dirname, clue.content);
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.startsWith(uploadsDir) && fs.existsSync(normalizedPath)) {
        try { fs.unlinkSync(normalizedPath); } catch (e) {}
      }
    }
    await execute("DELETE FROM clues WHERE id = ?", [id]);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Clue not found" });
  }
}));

// Public Clue Access
app.get("/api/clues/:id/meta", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const clue = await selectOne<RowDataPacket & { id: string; title: string; type: string; protection_type: string; theme: string; theme_bg_image: string | null; scan_count: number }>("SELECT id, title, type, protection_type, theme, theme_bg_image, scan_count FROM clues WHERE id = ?", [id]);
  if (!clue) {
    return res.status(404).json({ error: "Clue not found" });
  }
  
  // Increment scan count only if not viewed recently (prevents double counting on refresh/strict mode)
  const viewedCookie = `viewed_${id}`;
  if (!req.cookies[viewedCookie]) {
    await execute("UPDATE clues SET scan_count = scan_count + 1 WHERE id = ?", [id]);
    res.cookie(viewedCookie, "true", { maxAge: 1000 * 60 * 60 * 24, httpOnly: true, sameSite: "lax" }); // 1 day
  }
  
  const theme_config = await resolveThemeConfig(clue.theme);
  res.json({ ...clue, theme_config });
}));

app.post("/api/clues/:id/unlock", unlockLimiter, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code } = req.body;
  
  const clue = await selectOne<ClueRow>("SELECT * FROM clues WHERE id = ?", [id]);
  if (!clue) {
    return res.status(404).json({ error: "Clue not found" });
  }
  
  if (clue.protection_type !== "none") {
    if (clue.protection_code !== code) {
      // Increment failed attempts
      await execute("UPDATE clues SET failed_attempts = failed_attempts + 1 WHERE id = ?", [id]);
      return res.status(401).json({ error: "Invalid code" });
    }
  }
  
  const theme_config = await resolveThemeConfig(clue.theme);
  res.json({
    id: clue.id,
    title: clue.title,
    type: clue.type,
    content: clue.content,
    theme: clue.theme,
    theme_bg_image: clue.theme_bg_image,
    theme_config
  });
}));

async function startServer() {
  await initializeDatabase();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unexpected server error:", err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: "Internal server error" });
});

startServer();
