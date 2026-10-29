
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const dotenv = require("dotenv");
const crypto = require("crypto");
const supabase = require("./supabase");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    name: "traceai.sid",
    secret:
      process.env.SESSION_SECRET ||
      "traceai-local-demo-secret-change-before-deployment",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 2 * 60 * 60 * 1000,
    },
  })
);

// Synthetic demo accounts only.
const users = [
  {
    id: "u1",
    username: "investigator1",
    password: "ChangeMe-Investigator-01",
    role: "investigator",
  },
  {
    id: "u2",
    username: "auditor1",
    password: "ChangeMe-Auditor-01",
    role: "auditor",
  },
  {
    id: "u3",
    username: "admin1",
    password: "ChangeMe-Admin-01",
    role: "admin",
  },
];

// Audit events remain in memory for this MVP.
const auditEvents = [];

function normalizeRole(role) {
  return typeof role === "string"
    ? role.trim().toLowerCase()
    : "";
}

function audit(req, action, details = {}) {
  auditEvents.push({
    id: crypto.randomUUID(),
    userId: req.session.user?.id || null,
    username: req.session.user?.username || "anonymous",
    action,
    details,
    timestamp: new Date().toISOString(),
  });
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Please log in first.",
    });
  }

  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({
        error: "Please log in first.",
      });
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      audit(req, "ACCESS_DENIED", {
        path: req.path,
      });

      return res.status(403).json({
        error: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}

// Convert Supabase rows to the frontend case format.
function formatCase(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    status: row.status || "open",
    createdBy: row.created_by || "demo",
    createdAt: row.created_at,
    syntheticDemo: true,
  };
}

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "TraceAI backend is running.",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "TraceAI backend is running.",
  });
});

// Supabase connection test
app.get("/api/db-test", async (req, res) => {
  try {
    const { error } = await supabase
      .from("cases")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Supabase query failed:", error.message);

      return res.status(500).json({
        connected: false,
        message: "Database query failed. Check configuration.",
      });
    }

    res.json({
      connected: true,
      message: "TraceAI database connected successfully.",
    });
  } catch (error) {
    console.error("Supabase error:", error.message);

    res.status(500).json({
      connected: false,
      message: "Could not connect to Supabase.",
    });
  }
});

// Login
app.post("/api/auth/login", (req, res, next) => {
  const { username, password, requestedRole } = req.body || {};

  if (
    typeof username !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      error: "Username and password are required.",
    });
  }

  const normalizedUsername = username.trim();
  const normalizedRequestedRole = normalizeRole(requestedRole);

  const user = users.find(
    (item) =>
      item.username === normalizedUsername &&
      item.password === password &&
      (
        !normalizedRequestedRole ||
        item.role === normalizedRequestedRole
      )
  );

  if (!user) {
    audit(req, "LOGIN_FAILED", {
      username: normalizedUsername,
      requestedRole: normalizedRequestedRole || null,
    });

    return res.status(401).json({
      error: "Invalid username, password, or selected role.",
    });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  req.session.save((err) => {
    if (err) return next(err);

    audit(req, "LOGIN_SUCCESS");

    res.json({
      message: "Login successful.",
      user: req.session.user,
    });
  });
});

// Current user
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    user: req.session.user,
  });
});

// Logout
app.post("/api/auth/logout", requireAuth, (req, res, next) => {
  audit(req, "LOGOUT");

  req.session.destroy((err) => {
    if (err) return next(err);

    res.clearCookie("traceai.sid");

    res.json({
      message: "Logged out successfully.",
    });
  });
});

// List cases from Supabase
app.get("/api/cases", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List cases failed:", error.message);

      return res.status(500).json({
        error: "Could not load cases.",
      });
    }

    audit(req, "CASES_LIST_VIEWED");

    res.json({
      cases: data.map(formatCase),
    });
  } catch (error) {
    console.error("List cases error:", error.message);

    res.status(500).json({
      error: "Could not load cases.",
    });
  }
});

// Create a synthetic demo case in Supabase
app.post(
  "/api/cases",
  requireRole("investigator", "admin"),
  async (req, res) => {
    try {
      const { title, description } = req.body || {};

      if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof description !== "string" ||
        !description.trim()
      ) {
        return res.status(400).json({
          error: "Case title and description are required.",
        });
      }

      const { data, error } = await supabase
        .from("cases")
        .insert({
          title: title.trim(),
          description: description.trim(),
          status: "open",
          created_by: req.session.user.username,
        })
        .select()
        .single();

      if (error) {
        console.error("Create case failed:", error.message);

        return res.status(500).json({
          error: "Could not save case.",
        });
      }

      audit(req, "CASE_CREATED", {
        caseId: data.id,
      });

      res.status(201).json({
        case: formatCase(data),
      });
    } catch (error) {
      console.error("Create case error:", error.message);

      res.status(500).json({
        error: "Could not save case.",
      });
    }
  }
);

// Get one case from Supabase
app.get("/api/cases/:id", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      console.error("Get case failed:", error.message);

      return res.status(500).json({
        error: "Could not load case.",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Case not found.",
      });
    }

    audit(req, "CASE_VIEWED", {
      caseId: data.id,
    });

    res.json({
      case: formatCase(data),
    });
  } catch (error) {
    console.error("Get case error:", error.message);

    res.status(500).json({
      error: "Could not load case.",
    });
  }
});

// Audit logs are currently in memory.
app.get(
  "/api/audit",
  requireRole("auditor", "admin"),
  (req, res) => {
    audit(req, "AUDIT_LOG_VIEWED");

    res.json({
      events: auditEvents,
    });
  }
);

// User list: synthetic demo accounts
app.get("/api/users", requireRole("admin"), (req, res) => {
  res.json({
    users: users.map(({ id, username, role }) => ({
      id,
      username,
      role,
    })),
  });
});

// AI generation disabled until a provider is configured.
app.post(
  "/api/sketch/generate",
  requireRole("investigator", "admin"),
  (req, res) => {
    res.status(503).json({
      error: "AI generation is temporarily disabled.",
    });
  }
);

// Error handler
app.use((err, req, res, next) => {
  console.error("Backend error:", err.message);

  if (res.headersSent) return next(err);

  res.status(500).json({
    error: "An unexpected backend error occurred.",
  });
});

const { generateSketch } = require("./flux");

app.post("/api/sketch/flux", async (req, res) => {
  try {
    const description = req.body?.description;

    if (typeof description !== "string" ||
        description.trim().length < 10 ||
        description.length > 2000) {
      return res.status(400).json({
        error: "Enter a description between 10 and 2000 characters."
      });
    }

    const imageUrl = await generateSketch(description.trim());

    res.json({
      success: true,
      imageUrl,
      disclaimer:
        "AI-generated investigative illustration, not a verified identity."
    });
  } catch (error) {
    console.error("FLUX error:", error.message);
    res.status(502).json({
      error: "Sketch generation failed. Check server logs and API access."
    });
  }
});


app.listen(PORT, () => {
  console.log(
    `TraceAI backend running at http://localhost:${PORT}`
  );
});
