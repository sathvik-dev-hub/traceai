
/*
  TraceAI FRONTEND PROTOTYPE

  Backend:
  http://localhost:5000

  Role names in the frontend remain:
  Investigator, Auditor, Admin.

  NOTE:
  AI generation and other features require their corresponding
  backend endpoints to be implemented.
*/

const API_BASE_URL = "http://localhost:5000";

const ROLE_DEMO_ACCOUNTS = {
  Investigator: {
    username: "investigator1",
    password: "ChangeMe-Investigator-01"
  },
  Auditor: {
    username: "auditor1",
    password: "ChangeMe-Auditor-01"
  },
  Admin: {
    username: "admin1",
    password: "ChangeMe-Admin-01"
  }
};

const SAMPLE_CASES = [
  {
    id: "CASE-DEMO-001",
    title: "Witness description case",
    status: "In progress",
    date: "2026-10-01",
    description:
      "Fictional case used to demonstrate the investigator workflow."
  },
  {
    id: "CASE-DEMO-002",
    title: "Public record review",
    status: "Under review",
    date: "2026-10-10",
    description:
      "Fictional case used to demonstrate case review."
  }
];

const $ = (id) => document.getElementById(id);

let selectedRole = "";
let currentUser = null;
let currentSketchData = null;

const UI_ROLE_NAMES = {
  investigator: "Investigator",
  auditor: "Auditor",
  admin: "Admin"
};

document.querySelectorAll("[data-role]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedRole = button.dataset.role;

    $("rolesSection").hidden = true;
    $("loginPanel").hidden = false;
    $("dashboard").hidden = true;

    $("loginTitle").textContent = `${selectedRole} login`;
    $("loginDescription").textContent =
      `Sign in to access the ${selectedRole.toLowerCase()} workspace.`;

    $("loginMessage").textContent = "";
    $("loginForm").reset();

    $("loginPanel").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
});

$("backToRoles").addEventListener("click", () => {
  $("loginPanel").hidden = true;
  $("rolesSection").hidden = false;

  $("rolesSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

$("homeLink").addEventListener("click", (event) => {
  event.preventDefault();
  logout();
});

$("logoutButton").addEventListener("click", logout);

async function logout() {
  try {
    if (API_BASE_URL && currentUser) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include"
      });
    }
  } catch (error) {
    console.error("Logout request failed:", error);
  }

  currentUser = null;
  currentSketchData = null;

  $("dashboard").hidden = true;
  $("loginPanel").hidden = true;
  $("rolesSection").hidden = false;
  $("chargeSheets").hidden = false;
  $("landing").hidden = false;

  $("rolesSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = $("username").value.trim();
  const password = $("password").value;

  $("loginMessage").textContent = "Checking credentials…";

  if (API_BASE_URL) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            username,
            password,
            requestedRole: selectedRole
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Sign-in failed.");
      }

      if (!data.user || !data.user.role) {
        throw new Error("The server returned an invalid user record.");
      }

      // Compare role names without case sensitivity.
      const backendRole = String(data.user.role).toLowerCase();
      const requestedRole = String(selectedRole).toLowerCase();

      if (backendRole !== requestedRole) {
        throw new Error(
          "Your account does not have the selected role."
        );
      }

      // Preserve the exact role names expected by the existing UI.
      currentUser = {
        ...data.user,
        role: UI_ROLE_NAMES[backendRole] || data.user.role,
        name: data.user.name || data.user.username
      };

      showDashboard();
      return;
    } catch (error) {
      $("loginMessage").textContent =
        error.message || "Unable to connect to the backend.";
      return;
    }
  }

  // Local-only prototype login.
  const demo = ROLE_DEMO_ACCOUNTS[selectedRole];

  if (
    demo &&
    username === demo.username &&
    password === demo.password
  ) {
    currentUser = {
      username,
      role: selectedRole,
      name: selectedRole
    };

    showDashboard();
  } else {
    $("loginMessage").textContent =
      "Credentials did not match this role.";
  }
});

function showDashboard() {
  $("landing").hidden = true;
  $("rolesSection").hidden = true;
  $("loginPanel").hidden = true;
  $("chargeSheets").hidden = true;
  $("dashboard").hidden = false;

  $("dashboardTitle").textContent =
    `${currentUser.role} Dashboard`;

  $("dashboardSubtitle").textContent =
    `Signed in as ${currentUser.name || currentUser.username} · Role: ${currentUser.role}`;

  renderStats();
  renderRoleWorkspace();

  $("dashboard").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderStats() {
  const stats = {
    Investigator: [
      ["Workspace", "Sketch studio"],
      ["Case records", "Connected"],
      ["AI service", "Backend required"]
    ],

    Auditor: [
      ["Audit events", "Connected"],
      ["Case records", "Connected"],
      ["Integrity", "Backend required"]
    ],

    Admin: [
      ["Staff management", "Connected"],
      ["Roles", "3"],
      ["Database", "Backend required"]
    ]
  };

  $("dashboardStats").replaceChildren();

  (stats[currentUser.role] || []).forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "stat-card";

    const span = document.createElement("span");
    span.textContent = label;

    const strong = document.createElement("strong");
    strong.textContent = value;

    card.append(span, strong);
    $("dashboardStats").appendChild(card);
  });
}

function renderRoleWorkspace() {
  const root = $("dashboardContent");
  root.replaceChildren();

  if (currentUser.role === "Investigator") {
    renderInvestigator(root);
  } else if (currentUser.role === "Auditor") {
    renderAuditor(root);
  } else if (currentUser.role === "Admin") {
    renderAdmin(root);
  }
}

function createCard(title, description, fullWidth = false) {
  const card = document.createElement("section");

  card.className =
    "panel-card" + (fullWidth ? " full-width" : "");

  const heading = document.createElement("h3");
  heading.textContent = title;

  const paragraph = document.createElement("p");
  paragraph.textContent = description;

  card.append(heading, paragraph);
  return card;
}

function createButton(text, callback) {
  const button = document.createElement("button");

  button.className = "primary-button";
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", callback);

  return button;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }

  return data;
}

function renderInvestigator(root) {
  const grid = document.createElement("div");
  grid.className = "panel-grid";

  const descriptionCard = createCard(
    "Witness description",
    "Enter only information authorized for this synthetic demonstration case."
  );

  const descriptionLabel = document.createElement("label");
  descriptionLabel.textContent = "Case reference";

  const caseInput = document.createElement("input");
  caseInput.placeholder = "Enter assigned case reference";

  const textLabel = document.createElement("label");
  textLabel.textContent = "Facial description";
  textLabel.style.marginTop = "14px";

  const description = document.createElement("textarea");
  description.rows = 7;
  description.placeholder =
    "Describe observable features: face shape, hair, eyebrows, eyes, nose, mouth, facial hair, and distinctive visible features.";

  const descriptionHelp = document.createElement("p");
  descriptionHelp.className = "muted";
  descriptionHelp.style.marginTop = "8px";
  descriptionHelp.textContent =
    "Record observations without guessing identity or guilt.";

  descriptionCard.append(
    descriptionLabel,
    caseInput,
    textLabel,
    description,
    descriptionHelp
  );

  const voiceCard = createCard(
    "Voice description",
    "Dictate a description using your browser's speech recognition."
  );

  const voiceStatus = document.createElement("p");
  voiceStatus.className = "output-message";
  voiceStatus.textContent = "Microphone permission may be required.";

  const voiceButton = createButton("🎙 Start voice input", () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      voiceStatus.textContent =
        "Speech recognition is not supported in this browser.";
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    voiceStatus.textContent = "Listening…";

    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript;

      description.value =
        `${description.value} ${spoken}`.trim();

      voiceStatus.textContent =
        "Transcription added. Please verify it.";
    };

    recognition.onerror = (event) => {
      voiceStatus.textContent =
        `Voice input error: ${event.error}. You can type instead.`;
    };

    recognition.onend = () => {
      if (voiceStatus.textContent === "Listening…") {
        voiceStatus.textContent = "Voice input ended.";
      }
    };

    recognition.start();
  });

  voiceCard.append(voiceButton, voiceStatus);

  const sketchCard = createCard(
    "AI facial sketch studio",
    "The backend must connect to a supported image-generation API.",
    true
  );

  const promptLabel = document.createElement("label");
  promptLabel.textContent = "Generation style";

  const styleSelect = document.createElement("select");

  [
    ["forensic", "Monochrome forensic pencil sketch"],
    ["front", "Front-facing portrait sketch"],
    ["profile", "Side-profile pencil sketch"]
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    styleSelect.appendChild(option);
  });

  const preview = document.createElement("div");
  preview.className = "sketch-preview";
  preview.id = "sketchPreview";

  const placeholder = document.createElement("div");
  placeholder.className = "sketch-placeholder";

  const placeholderTitle = document.createElement("strong");
  placeholderTitle.textContent = "Sketch preview";

  const placeholderText = document.createElement("p");
  placeholderText.textContent =
    "A sketch will appear here after image generation is implemented.";

  placeholder.append(placeholderTitle, placeholderText);
  preview.appendChild(placeholder);

  const sketchMessage = document.createElement("p");
  sketchMessage.className = "output-message";
  sketchMessage.id = "sketchMessage";

  const actions = document.createElement("div");
  actions.className = "sketch-actions";

  actions.append(
    createButton("Generate AI sketch", async () => {
      const caseRef = caseInput.value.trim();
      const witnessDescription = description.value.trim();

      if (!caseRef || !witnessDescription) {
        sketchMessage.textContent =
          "Enter a case reference and facial description first.";
        return;
      }

      sketchMessage.textContent = "Requesting sketch generation…";

      try {
        // Matches the current backend route.
        const data = await apiRequest("/api/sketch/generate", {
          method: "POST",
          body: JSON.stringify({
            caseReference: caseRef,
            description: witnessDescription,
            style: styleSelect.value
          })
        });

        if (!data.imageUrl) {
          throw new Error(
            data.message ||
            "Image generation is not implemented by the current backend."
          );
        }

        preview.replaceChildren();

        const image = document.createElement("img");
        image.src = data.imageUrl;
        image.alt = "AI-generated investigative sketch";
        preview.appendChild(image);

        currentSketchData = {
          caseReference: caseRef,
          description: witnessDescription,
          imageUrl: data.imageUrl,
          createdAt: new Date().toISOString()
        };

        sketchMessage.textContent =
          "AI-generated investigative lead, not verified identity evidence.";
      } catch (error) {
        sketchMessage.textContent = error.message;
      }
    }),

    createButton("Clear fields", () => {
      caseInput.value = "";
      description.value = "";
      sketchMessage.textContent = "";
      currentSketchData = null;

      preview.replaceChildren();

      const placeholder = document.createElement("div");
      placeholder.className = "sketch-placeholder";
      placeholder.textContent = "Sketch preview";

      preview.appendChild(placeholder);
    })
  );

  sketchCard.append(
    promptLabel,
    styleSelect,
    preview,
    actions,
    sketchMessage
  );

  const refineCard = createCard(
    "Sketch refinement",
    "Refinement requires a backend endpoint and an image-editing service."
  );

  const refineInput = document.createElement("textarea");
  refineInput.rows = 3;
  refineInput.placeholder =
    "Describe a requested adjustment.";

  const refineMessage = document.createElement("p");
  refineMessage.className = "output-message";

  const refineButton = createButton(
    "Submit refinement",
    async () => {
      if (!currentSketchData) {
        refineMessage.textContent =
          "Generate or load a sketch first.";
        return;
      }

      if (!refineInput.value.trim()) {
        refineMessage.textContent =
          "Enter a refinement request first.";
        return;
      }

      try {
        refineMessage.textContent = "Submitting refinement…";

        const data = await apiRequest("/api/sketches/refine", {
          method: "POST",
          body: JSON.stringify({
            caseReference: currentSketchData.caseReference,
            imageUrl: currentSketchData.imageUrl,
            refinement: refineInput.value.trim()
          })
        });

        if (!data.imageUrl) {
          throw new Error("The backend did not return a refined image.");
        }

        currentSketchData.imageUrl = data.imageUrl;

        preview.replaceChildren();

        const image = document.createElement("img");
        image.src = data.imageUrl;
        image.alt = "Refined AI investigative sketch";

        preview.appendChild(image);
        refineMessage.textContent = "Refinement completed.";
      } catch (error) {
        refineMessage.textContent = error.message;
      }
    }
  );

  refineCard.append(refineInput, refineButton, refineMessage);

  const saveCard = createCard(
    "Case sketch record",
    "Save sketch metadata through an implemented backend endpoint."
  );

  const saveMessage = document.createElement("p");
  saveMessage.className = "output-message";

  const saveButton = createButton(
    "Save sketch record",
    async () => {
      if (!currentSketchData) {
        saveMessage.textContent = "Generate a sketch first.";
        return;
      }

      try {
        await apiRequest("/api/sketches", {
          method: "POST",
          body: JSON.stringify(currentSketchData)
        });

        saveMessage.textContent = "Sketch record saved.";
      } catch (error) {
        saveMessage.textContent = error.message;
      }
    }
  );

  saveCard.append(saveButton, saveMessage);

  grid.append(
    descriptionCard,
    voiceCard,
    sketchCard,
    refineCard,
    saveCard
  );

  root.appendChild(grid);
}

function renderAuditor(root) {
  const grid = document.createElement("div");
  grid.className = "panel-grid";

  const reviewCard = createCard(
    "Case record review",
    "Sample records below are fictional demonstration data."
  );

  const reviewList = document.createElement("ul");
  reviewList.className = "data-list";

  SAMPLE_CASES.forEach((record) => {
    const li = document.createElement("li");
    li.textContent = `${record.id} — ${record.title}`;

    const small = document.createElement("small");
    small.textContent = `${record.status} · ${record.date}`;

    li.appendChild(small);
    reviewList.appendChild(li);
  });

  reviewCard.appendChild(reviewList);

  const auditCard = createCard(
    "Access audit events",
    "Load audit events recorded by the backend."
  );

  const auditMessage = document.createElement("p");
  auditMessage.className = "output-message";
  auditMessage.textContent = "No server events loaded yet.";

  const auditList = document.createElement("ul");
  auditList.className = "data-list";

  const refreshButton = createButton(
    "Load server audit events",
    async () => {
      try {
        auditMessage.textContent = "Loading audit events…";

        // Matches the current backend route.
        const data = await apiRequest("/api/audit");

        auditList.replaceChildren();

        (data.events || []).forEach((event) => {
          const li = document.createElement("li");
          li.textContent =
            `${event.action || "Access event"} — ${event.timestamp || event.createdAt || ""}`;
          auditList.appendChild(li);
        });

        auditMessage.textContent =
          `${(data.events || []).length} audit event(s) loaded.`;
      } catch (error) {
        auditMessage.textContent = error.message;
      }
    }
  );

  auditCard.append(refreshButton, auditMessage, auditList);

  grid.append(reviewCard, auditCard);
  root.appendChild(grid);
}

function renderAdmin(root) {
  const grid = document.createElement("div");
  grid.className = "panel-grid";

  const staffCard = createCard(
    "Staff account and role management",
    "Staff creation requires the corresponding backend endpoint.",
    true
  );

  const form = document.createElement("form");
  form.className = "inline-form";

  const usernameWrap = document.createElement("div");

  const usernameLabel = document.createElement("label");
  usernameLabel.textContent = "Staff username";

  const usernameInput = document.createElement("input");
  usernameInput.required = true;
  usernameInput.placeholder = "Enter staff username";

  usernameWrap.append(usernameLabel, usernameInput);

  const roleWrap = document.createElement("div");

  const roleLabel = document.createElement("label");
  roleLabel.textContent = "Assigned role";

  const roleSelect = document.createElement("select");

  ["Investigator", "Auditor", "Admin"].forEach((role) => {
    const option = document.createElement("option");
    option.value = role;
    option.textContent = role;
    roleSelect.appendChild(option);
  });

  roleWrap.append(roleLabel, roleSelect);

  const passwordWrap = document.createElement("div");
  passwordWrap.className = "full-width";

  const passwordLabel = document.createElement("label");
  passwordLabel.textContent = "Initial password";

  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.autocomplete = "new-password";
  passwordInput.required = true;
  passwordInput.minLength = 12;
  passwordInput.placeholder = "Set a temporary password (12+ characters)";

  passwordWrap.append(passwordLabel, passwordInput);

  const message = document.createElement("p");
  message.className = "output-message full-width";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary-button";
  submit.textContent = "Create staff account";

  form.append(
    usernameWrap,
    roleWrap,
    passwordWrap,
    submit,
    message
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username: usernameInput.value.trim(),
          role: roleSelect.value,
          temporaryPassword: passwordInput.value
        })
      });

      message.textContent = "Staff account created.";
      form.reset();
    } catch (error) {
      message.textContent = error.message;
    }
  });

  staffCard.appendChild(form);

  const permissionsCard = createCard(
    "Role responsibilities",
    "The backend must enforce permissions on every protected API."
  );

  const permissionList = document.createElement("ul");
  permissionList.className = "data-list";

  [
    "Investigator — create descriptions and request sketches for authorized cases.",
    "Auditor — review authorized case records and audit events.",
    "Admin — manage staff accounts and role assignments."
  ].forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    permissionList.appendChild(li);
  });

  permissionsCard.appendChild(permissionList);

  grid.append(staffCard, permissionsCard);
  root.appendChild(grid);
}

$("caseSearchForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const reference = $("caseReference").value.trim();
  const message = $("caseSearchMessage");
  const result = $("publicCaseResult");

  message.textContent = "";
  result.hidden = true;

  if (!reference) {
    message.textContent = "Enter a case reference.";
    return;
  }

  try {
    const data = await apiRequest(
      `/api/public/cases?reference=${encodeURIComponent(reference)}`
    );

    result.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = data.title || "Case record";

    const ref = document.createElement("p");
    ref.textContent = `Reference: ${data.reference || reference}`;

    const summary = document.createElement("p");
    summary.textContent =
      data.publicSummary || "No public summary is available.";

    result.append(heading, ref, summary);
    result.hidden = false;
  } catch (error) {
    // Display local synthetic cases only when the public API is unavailable.
    const record = SAMPLE_CASES.find(
      (item) => item.id.toLowerCase() === reference.toLowerCase()
    );

    if (!record) {
      message.textContent =
        `${error.message} No matching local demonstration record was found.`;
      return;
    }

    result.replaceChildren();

    const heading = document.createElement("h4");
    heading.textContent = record.title;

    const ref = document.createElement("p");
    ref.textContent =
      `Reference: ${record.id} · ${record.status} · ${record.date}`;

    const summary = document.createElement("p");
    summary.textContent = record.description;

    result.append(heading, ref, summary);
    result.hidden = false;
  }
});
