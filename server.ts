import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import multer from "multer";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";
import speakeasy from "speakeasy";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = 3000;

// Setup SQLite DB
const dbPath = path.join(__dirname, "data.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS clues (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    protection_type TEXT NOT NULL,
    protection_code TEXT,
    theme TEXT DEFAULT 'default',
    theme_bg_image TEXT,
    category TEXT DEFAULT 'Uncategorized',
    scan_count INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Add columns safely if they don't exist (for existing databases)
try { db.exec(`ALTER TABLE clues ADD COLUMN theme TEXT DEFAULT 'default';`); } catch (e) {}
try { db.exec(`ALTER TABLE clues ADD COLUMN theme_bg_image TEXT;`); } catch (e) {}
try { db.exec(`ALTER TABLE clues ADD COLUMN category TEXT DEFAULT 'Uncategorized';`); } catch (e) {}
try { db.exec(`ALTER TABLE clues ADD COLUMN scan_count INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE clues ADD COLUMN failed_attempts INTEGER DEFAULT 0;`); } catch (e) {}

// Initialize default admin password if not set
const adminPasswordHash = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as any;
if (!adminPasswordHash) {
  const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";
  const hash = bcrypt.hashSync(defaultPassword, 10);
  db.prepare("INSERT INTO settings (key, value) VALUES ('admin_password', ?)").run(hash);
}

// Setup file uploads
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'video/mp4', 'video/webm'
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
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

// --- API Routes ---

// Admin Login
app.post("/api/admin/login", loginLimiter, (req, res) => {
  const { password, token: twoFactorToken } = req.body;
  
  const hashRow = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as any;
  if (!hashRow || !bcrypt.compareSync(password, hashRow.value)) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const twoFactorEnabled = db.prepare("SELECT value FROM settings WHERE key = '2fa_enabled'").get() as any;
  if (twoFactorEnabled && twoFactorEnabled.value === 'true') {
    if (!twoFactorToken) {
      return res.json({ require2FA: true });
    }
    const secretRow = db.prepare("SELECT value FROM settings WHERE key = '2fa_secret'").get() as any;
    if (!secretRow || !speakeasy.totp.verify({ secret: secretRow.value, encoding: 'base32', token: twoFactorToken })) {
      return res.status(401).json({ error: "Invalid 2FA code" });
    }
  }

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "1d" });
  res.cookie("admin_token", token, { httpOnly: true, secure: true, sameSite: "none" });
  res.json({ success: true });
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("admin_token", { httpOnly: true, secure: true, sameSite: "none" });
  res.json({ success: true });
});

app.get("/api/admin/check", requireAdmin, (req, res) => {
  res.json({ success: true });
});

// Admin Settings
app.get("/api/admin/settings", requireAdmin, (req, res) => {
  const twoFactorEnabled = db.prepare("SELECT value FROM settings WHERE key = '2fa_enabled'").get() as any;
  res.json({
    twoFactorEnabled: twoFactorEnabled?.value === 'true'
  });
});

app.post("/api/admin/settings/password", requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  const hashRow = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as any;
  if (!hashRow || !bcrypt.compareSync(currentPassword, hashRow.value)) {
    return res.status(401).json({ error: "Invalid current password" });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE settings SET value = ? WHERE key = 'admin_password'").run(newHash);
  res.json({ success: true });
});

app.post("/api/admin/settings/2fa/setup", requireAdmin, (req, res) => {
  const secret = speakeasy.generateSecret({ name: "ClueManager (Admin)" });
  
  // Store secret temporarily or permanently, but mark as not enabled yet
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('2fa_secret_temp', ?)").run(secret.base32);
  
  res.json({ secret: secret.base32, otpauth: secret.otpauth_url });
});

app.post("/api/admin/settings/2fa/verify", requireAdmin, (req, res) => {
  const { token } = req.body;
  const secretRow = db.prepare("SELECT value FROM settings WHERE key = '2fa_secret_temp'").get() as any;
  
  if (!secretRow) {
    return res.status(400).json({ error: "2FA setup not initiated" });
  }

  const verified = speakeasy.totp.verify({
    secret: secretRow.value,
    encoding: 'base32',
    token: token
  });

  if (verified) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('2fa_secret', ?)").run(secretRow.value);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('2fa_enabled', 'true')").run();
    db.prepare("DELETE FROM settings WHERE key = '2fa_secret_temp'").run();
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Invalid 2FA code" });
  }
});

app.post("/api/admin/settings/2fa/disable", requireAdmin, (req, res) => {
  const { password } = req.body;
  
  const hashRow = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get() as any;
  if (!hashRow || !bcrypt.compareSync(password, hashRow.value)) {
    return res.status(401).json({ error: "Invalid password" });
  }

  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('2fa_enabled', 'false')").run();
  db.prepare("DELETE FROM settings WHERE key = '2fa_secret'").run();
  res.json({ success: true });
});

// Admin Clues CRUD
app.get("/api/admin/clues", requireAdmin, (req, res) => {
  const clues = db.prepare("SELECT id, title, type, protection_type, theme, theme_bg_image, category, scan_count, failed_attempts, created_at FROM clues ORDER BY created_at DESC").all();
  res.json(clues);
});

app.get("/api/admin/clues/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const clue = db.prepare("SELECT * FROM clues WHERE id = ?").get(id);
  if (!clue) {
    return res.status(404).json({ error: "Clue not found" });
  }
  res.json(clue);
});

app.put("/api/admin/clues/:id", requireAdmin, upload.fields([{ name: "file", maxCount: 1 }, { name: "bg_image", maxCount: 1 }]), (req, res) => {
  const { id } = req.params;
  const { title, type, protection_type, protection_code, text_content, theme = "default", category = "Uncategorized" } = req.body;
  
  const existingClue = db.prepare("SELECT * FROM clues WHERE id = ?").get(id) as any;
  if (!existingClue) {
    return res.status(404).json({ error: "Clue not found" });
  }

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const file = files?.['file']?.[0];
  const bgImage = files?.['bg_image']?.[0];
  
  let content = existingClue.content;
  if (type === "text") {
    content = text_content || "";
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

  const stmt = db.prepare(`
    UPDATE clues 
    SET title = ?, type = ?, content = ?, protection_type = ?, protection_code = ?, theme = ?, theme_bg_image = ?, category = ?
    WHERE id = ?
  `);
  stmt.run(title, type, content, protection_type, protection_code || null, theme, theme_bg_image, category, id);
  
  res.json({ success: true, id });
});

app.post("/api/admin/clues", requireAdmin, upload.fields([{ name: "file", maxCount: 1 }, { name: "bg_image", maxCount: 1 }]), (req, res) => {
  const { title, type, protection_type, protection_code, text_content, theme = "default", category = "Uncategorized" } = req.body;
  const id = uuidv4();
  
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  const file = files?.['file']?.[0];
  const bgImage = files?.['bg_image']?.[0];
  
  let content = "";
  if (type === "text") {
    content = text_content || "";
  } else if (file) {
    content = `/uploads/${file.filename}`;
  } else {
    return res.status(400).json({ error: "File is required for media types" });
  }

  let theme_bg_image = null;
  if (bgImage) {
    theme_bg_image = `/uploads/${bgImage.filename}`;
  }

  const stmt = db.prepare(`
    INSERT INTO clues (id, title, type, content, protection_type, protection_code, theme, theme_bg_image, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, title, type, content, protection_type, protection_code || null, theme, theme_bg_image, category);
  
  res.json({ success: true, id });
});

app.delete("/api/admin/clues/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const clue = db.prepare("SELECT type, content FROM clues WHERE id = ?").get(id) as any;
  
  if (clue) {
    if (clue.type !== "text" && clue.content.startsWith("/uploads/")) {
      const filePath = path.join(__dirname, clue.content);
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.startsWith(uploadsDir) && fs.existsSync(normalizedPath)) {
        try { fs.unlinkSync(normalizedPath); } catch (e) {}
      }
    }
    db.prepare("DELETE FROM clues WHERE id = ?").run(id);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Clue not found" });
  }
});

// Public Clue Access
app.get("/api/clues/:id/meta", (req, res) => {
  const { id } = req.params;
  const clue = db.prepare("SELECT id, title, type, protection_type, theme, theme_bg_image, scan_count FROM clues WHERE id = ?").get(id) as any;
  if (!clue) {
    return res.status(404).json({ error: "Clue not found" });
  }
  
  // Increment scan count only if not viewed recently (prevents double counting on refresh/strict mode)
  const viewedCookie = `viewed_${id}`;
  if (!req.cookies[viewedCookie]) {
    db.prepare("UPDATE clues SET scan_count = scan_count + 1 WHERE id = ?").run(id);
    res.cookie(viewedCookie, "true", { maxAge: 1000 * 60 * 60 * 24, httpOnly: true, sameSite: "lax" }); // 1 day
  }
  
  res.json(clue);
});

app.post("/api/clues/:id/unlock", unlockLimiter, (req, res) => {
  const { id } = req.params;
  const { code } = req.body;
  
  const clue = db.prepare("SELECT * FROM clues WHERE id = ?").get(id) as any;
  if (!clue) {
    return res.status(404).json({ error: "Clue not found" });
  }
  
  if (clue.protection_type !== "none") {
    if (clue.protection_code !== code) {
      // Increment failed attempts
      db.prepare("UPDATE clues SET failed_attempts = failed_attempts + 1 WHERE id = ?").run(id);
      return res.status(401).json({ error: "Invalid code" });
    }
  }
  
  res.json({
    id: clue.id,
    title: clue.title,
    type: clue.type,
    content: clue.content,
    theme: clue.theme,
    theme_bg_image: clue.theme_bg_image
  });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

startServer();
