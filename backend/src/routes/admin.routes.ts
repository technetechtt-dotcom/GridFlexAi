import { Router } from "express";

import {
  getApiCredentials,
  getBillingAccounts,
  getClients,
  getNodes,
  getSites,
  patchApiCredential,
  patchBillingAccount,
  patchClient,
  patchNode,
  patchSite,
  postApiCredential,
  postBillingAccount,
  postClient,
  postSite,
  removeApiCredential,
  removeBillingAccount,
  removeClient,
  removeSite } from
"../controllers/admin.controller.js";
import {
  getAdminMetricsHandler,
  getAdminNodesOverviewHandler,
  getAdminPlatformOverviewHandler,
  getAdminUsersHandler,
  getAuditLogsHandler,
  postAdminClearForecastCacheHandler,
  postAdminTestNotificationHandler,
  patchAdminUserRoleHandler
} from "../controllers/admin-monitoring.controller.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  adminNodeUpdateBodySchema,
  adminUserRoleUpdateBodySchema,
  apiCredentialBodySchema,
  apiCredentialUpdateBodySchema,
  billingAccountBodySchema,
  billingAccountUpdateBodySchema,
  clientBodySchema,
  clientUpdateBodySchema,
  siteBodySchema,
  siteUpdateBodySchema } from
"../schemas/request.schemas.js";

const router = Router();

router.use(authenticate, authorizeRoles("admin", "developer"));

router.get("/overview", getAdminPlatformOverviewHandler);
router.get("/users", getAdminUsersHandler);
router.patch("/users/:id/role", validateRequest({ body: adminUserRoleUpdateBodySchema }), patchAdminUserRoleHandler);
router.get("/nodes", getAdminNodesOverviewHandler);
router.get("/metrics", getAdminMetricsHandler);
router.get("/logs", getAuditLogsHandler);
router.post("/actions/clear-forecast-cache", postAdminClearForecastCacheHandler);
router.post("/actions/test-notification", postAdminTestNotificationHandler);

router.get("/clients", getClients);
router.post("/clients", validateRequest({ body: clientBodySchema }), postClient);
router.patch("/clients/:id", validateRequest({ body: clientUpdateBodySchema }), patchClient);
router.delete("/clients/:id", removeClient);

router.get("/sites", getSites);
router.post("/sites", validateRequest({ body: siteBodySchema }), postSite);
router.patch("/sites/:id", validateRequest({ body: siteUpdateBodySchema }), patchSite);
router.delete("/sites/:id", removeSite);

router.get("/nodes-managed", getNodes);
router.patch("/nodes/:id", validateRequest({ body: adminNodeUpdateBodySchema }), patchNode);

router.get("/api-credentials", getApiCredentials);
router.post("/api-credentials", validateRequest({ body: apiCredentialBodySchema }), postApiCredential);
router.patch("/api-credentials/:id", validateRequest({ body: apiCredentialUpdateBodySchema }), patchApiCredential);
router.delete("/api-credentials/:id", removeApiCredential);

router.get("/billing-accounts", getBillingAccounts);
router.post("/billing-accounts", validateRequest({ body: billingAccountBodySchema }), postBillingAccount);
router.patch("/billing-accounts/:id", validateRequest({ body: billingAccountUpdateBodySchema }), patchBillingAccount);
router.delete("/billing-accounts/:id", removeBillingAccount);

export default router;
