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
  res.json(clue);
}));

app.put("/api/admin/clues/:id", requireAdmin, upload.fields([{ name: "file", maxCount: 1 }, { name: "bg_image", maxCount: 1 }]), asyncHandler(async (req, res) => {
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

app.post("/api/admin/clues", requireAdmin, upload.fields([{ name: "file", maxCount: 1 }, { name: "bg_image", maxCount: 1 }]), asyncHandler(async (req, res) => {
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
  
  res.json(clue);
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
  
  res.json({
    id: clue.id,
    title: clue.title,
    type: clue.type,
    content: clue.content,
    theme: clue.theme,
    theme_bg_image: clue.theme_bg_image
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
