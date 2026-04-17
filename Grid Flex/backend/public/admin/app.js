const state = {
  token: localStorage.getItem("gridflex_admin_token") ?? null,
  clients: [],
  sites: [],
  nodes: [],
  credentials: []
};

const loginCard = document.getElementById("login-card");
const dashboardSection = document.getElementById("dashboard-section");
const statusMessage = document.getElementById("status-message");

const refreshBtn = document.getElementById("refresh-btn");
const logoutBtn = document.getElementById("logout-btn");

const loginForm = document.getElementById("login-form");
const clientForm = document.getElementById("client-form");
const siteForm = document.getElementById("site-form");
const credentialForm = document.getElementById("credential-form");

const siteClientSelect = document.getElementById("site-client");
const credentialClientSelect = document.getElementById("credential-client");
const credentialSiteSelect = document.getElementById("credential-site");

const kpiUsers = document.getElementById("kpi-users");
const kpiSessions = document.getElementById("kpi-sessions");
const kpiNodes = document.getElementById("kpi-nodes");
const kpiReadings = document.getElementById("kpi-readings");
const kpiAlerts = document.getElementById("kpi-alerts");

const clientsList = document.getElementById("clients-list");
const sitesList = document.getElementById("sites-list");
const nodesList = document.getElementById("nodes-list");
const credentialsList = document.getElementById("credentials-list");

const showStatus = (message) => {
  statusMessage.textContent = message;
  statusMessage.classList.remove("hidden");
};

const clearStatus = () => {
  statusMessage.textContent = "";
  statusMessage.classList.add("hidden");
};

const setAuthenticatedView = (authed) => {
  loginCard.classList.toggle("hidden", authed);
  dashboardSection.classList.toggle("hidden", !authed);
};

const api = async (path, options = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {})
  };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message ?? `Request failed (${response.status})`);
  }
  return payload;
};

const repopulateSelects = () => {
  siteClientSelect.innerHTML = `<option value="">Select client</option>${state.clients
    .map((client) => `<option value="${client.id}">${client.name}</option>`)
    .join("")}`;

  credentialClientSelect.innerHTML = `<option value="">No client scope</option>${state.clients
    .map((client) => `<option value="${client.id}">${client.name}</option>`)
    .join("")}`;

  credentialSiteSelect.innerHTML = `<option value="">No site scope</option>${state.sites
    .map((site) => `<option value="${site.id}">${site.name}</option>`)
    .join("")}`;
};

const renderClients = () => {
  clientsList.innerHTML = state.clients
    .map(
      (client) => `
        <article class="list-item">
          <div>
            <h4>${client.name}</h4>
            <p>${client.slug} • ${client.siteCount} sites</p>
          </div>
          <div class="item-actions">
            <button class="tiny-btn danger" data-delete-client="${client.id}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");
};

const renderSites = () => {
  sitesList.innerHTML = state.sites
    .map(
      (site) => `
        <article class="list-item">
          <div>
            <h4>${site.name}</h4>
            <p>${site.code} • ${site.client.name} • ${site.nodeCount} nodes</p>
          </div>
          <div class="item-actions">
            <button class="tiny-btn danger" data-delete-site="${site.id}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");
};

const renderNodes = () => {
  nodesList.innerHTML = state.nodes
    .map((node) => {
      const siteOptions = [`<option value="">Unassigned</option>`]
        .concat(
          state.sites.map(
            (site) => `<option value="${site.id}" ${node.siteId === site.id ? "selected" : ""}>${site.name}</option>`
          )
        )
        .join("");

      return `
        <article class="list-item">
          <div>
            <h4>${node.name}</h4>
            <p>${node.location} • ${node.status}</p>
          </div>
          <div class="item-actions">
            <select data-node-site="${node.id}">${siteOptions}</select>
            <select data-node-status="${node.id}">
              <option value="online" ${node.status === "online" ? "selected" : ""}>online</option>
              <option value="offline" ${node.status === "offline" ? "selected" : ""}>offline</option>
            </select>
            <button class="tiny-btn" data-save-node="${node.id}">Save</button>
          </div>
        </article>
      `;
    })
    .join("");
};

const renderCredentials = () => {
  credentialsList.innerHTML = state.credentials
    .map(
      (credential) => `
        <article class="list-item">
          <div>
            <h4>${credential.name}</h4>
            <p>${credential.provider} • ••••${credential.keyLast4}${credential.site ? ` • ${credential.site.name}` : credential.client ? ` • ${credential.client.name}` : ""}</p>
          </div>
          <div class="item-actions">
            <button class="tiny-btn danger" data-delete-credential="${credential.id}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");
};

const renderKpis = (summary) => {
  kpiUsers.textContent = String(summary.overview.usersTotal);
  kpiSessions.textContent = String(summary.overview.activeSessions);
  kpiNodes.textContent = `${summary.overview.nodesOnline}/${summary.overview.nodesTotal}`;
  kpiReadings.textContent = String(summary.overview.readings24h);
  kpiAlerts.textContent = String(summary.alerts.offlineNodes + summary.alerts.staleNodes);
};

const loadDashboard = async () => {
  try {
    clearStatus();
    const [summary, clients, sites, nodes, credentials] = await Promise.all([
      api("/api/dashboard/admin"),
      api("/api/admin/clients"),
      api("/api/admin/sites"),
      api("/api/admin/nodes"),
      api("/api/admin/api-credentials")
    ]);

    state.clients = clients.data ?? [];
    state.sites = sites.data ?? [];
    state.nodes = nodes.data ?? [];
    state.credentials = credentials.data ?? [];

    renderKpis(summary.data);
    repopulateSelects();
    renderClients();
    renderSites();
    renderNodes();
    renderCredentials();
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Failed to load admin dashboard.");
  }
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  try {
    clearStatus();
    const payload = await api("/api/auth/login", {
      method: "POST",
      body: { email, password },
      headers: {}
    });
    state.token = payload.token;
    localStorage.setItem("gridflex_admin_token", payload.token);
    setAuthenticatedView(true);
    await loadDashboard();
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Login failed.");
  }
});

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("client-name").value.trim();
  const slug = document.getElementById("client-slug").value.trim();
  const contactEmail = document.getElementById("client-email").value.trim();
  if (!name || !slug) return;

  try {
    await api("/api/admin/clients", {
      method: "POST",
      body: { name, slug, contactEmail: contactEmail || undefined, status: "active" }
    });
    clientForm.reset();
    await loadDashboard();
    showStatus("Client created.");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Failed to create client.");
  }
});

siteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const clientId = siteClientSelect.value;
  const name = document.getElementById("site-name").value.trim();
  const code = document.getElementById("site-code").value.trim();
  const location = document.getElementById("site-location").value.trim();
  if (!clientId || !name || !code || !location) return;

  try {
    await api("/api/admin/sites", {
      method: "POST",
      body: { clientId, name, code, location, timezone: "UTC" }
    });
    siteForm.reset();
    await loadDashboard();
    showStatus("Site created.");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Failed to create site.");
  }
});

credentialForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const provider = document.getElementById("credential-provider").value;
  const name = document.getElementById("credential-name").value.trim();
  const apiKey = document.getElementById("credential-key").value.trim();
  const clientId = credentialClientSelect.value;
  const siteId = credentialSiteSelect.value;
  if (!name || !apiKey) return;

  try {
    await api("/api/admin/api-credentials", {
      method: "POST",
      body: {
        provider,
        name,
        apiKey,
        clientId: clientId || undefined,
        siteId: siteId || undefined
      }
    });
    credentialForm.reset();
    await loadDashboard();
    showStatus("API credential created (metadata only).");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Failed to create credential.");
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const deleteClientId = target.dataset.deleteClient;
  if (deleteClientId) {
    await api(`/api/admin/clients/${deleteClientId}`, { method: "DELETE" });
    await loadDashboard();
    showStatus("Client deleted.");
    return;
  }

  const deleteSiteId = target.dataset.deleteSite;
  if (deleteSiteId) {
    await api(`/api/admin/sites/${deleteSiteId}`, { method: "DELETE" });
    await loadDashboard();
    showStatus("Site deleted.");
    return;
  }

  const deleteCredentialId = target.dataset.deleteCredential;
  if (deleteCredentialId) {
    await api(`/api/admin/api-credentials/${deleteCredentialId}`, { method: "DELETE" });
    await loadDashboard();
    showStatus("Credential deleted.");
    return;
  }

  const saveNodeId = target.dataset.saveNode;
  if (saveNodeId) {
    const siteSelect = document.querySelector(`[data-node-site="${saveNodeId}"]`);
    const statusSelect = document.querySelector(`[data-node-status="${saveNodeId}"]`);
    const siteId = siteSelect instanceof HTMLSelectElement ? siteSelect.value : "";
    const status = statusSelect instanceof HTMLSelectElement ? statusSelect.value : "offline";

    await api(`/api/admin/nodes/${saveNodeId}`, {
      method: "PATCH",
      body: {
        siteId: siteId || null,
        status
      }
    });
    await loadDashboard();
    showStatus("Node updated.");
  }
});

refreshBtn.addEventListener("click", () => {
  void loadDashboard();
});

logoutBtn.addEventListener("click", () => {
  state.token = null;
  localStorage.removeItem("gridflex_admin_token");
  setAuthenticatedView(false);
  clearStatus();
});

const init = async () => {
  if (!state.token) {
    setAuthenticatedView(false);
    return;
  }
  setAuthenticatedView(true);
  await loadDashboard();
};

void init();
