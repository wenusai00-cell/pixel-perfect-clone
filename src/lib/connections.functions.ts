import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TOOL_CATALOG } from "./employee-tools";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

/** Returns permissions already saved for this employee. */
export const getEmployeePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ employee_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("employee_permissions")
      .select("permission_key, granted, connection_id")
      .eq("employee_id", data.employee_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return {
      permissions: (rows ?? []).map((r: any) => ({
        key: r.permission_key as string,
        granted: !!r.granted,
        connectionId: (r.connection_id as string | null) ?? null,
      })),
    };
  });

/** Start an App User OAuth flow for a given tool key (catalog key). */
export const startToolOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        employee_id: z.string().uuid(),
        tool_key: z.string().min(1),
        target_origin: z.string().url(),
        return_url: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const tool = TOOL_CATALOG[data.tool_key];
    if (!tool) throw new Error("Unknown tool");

    const clientIdEnv =
      tool.connectorId === "google_maps"
        ? "GOOGLE_MAPS_APP_USER_CONNECTOR_CLIENT_ID"
        : "GOOGLE_APP_USER_CONNECTOR_CLIENT_ID";
    const connectorClientId = process.env[clientIdEnv];
    if (!connectorClientId) {
      throw new Error(
        `This integration isn't set up yet. Ask the workspace admin to add ${clientIdEnv}.`,
      );
    }

    const { authorizeAppUserOAuth } = await import(
      "@/integrations/lovable/appUserConnector"
    );

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: tool.connectorId,
      appUserId: `${context.userId}:${data.employee_id}`,
      connectorClientId,
      returnUrl: data.return_url,
      responseMode: "web_message",
      webMessageTargetOrigin: data.target_origin,
      credentialsConfiguration: tool.scopes.length ? { scopes: tool.scopes } : undefined,
    });

    return { authorizationUrl };
  });

/** Save the connection_id for a tool against this employee. */
export const saveToolConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        employee_id: z.string().uuid(),
        tool_key: z.string().min(1),
        connection_id: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Try update first
    const { data: existing } = await supabase
      .from("employee_permissions")
      .select("id")
      .eq("employee_id", data.employee_id)
      .eq("user_id", userId)
      .eq("permission_key", data.tool_key)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("employee_permissions")
        .update({
          granted: true,
          granted_at: new Date().toISOString(),
          connection_id: data.connection_id,
        } as any)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("employee_permissions").insert({
        user_id: userId,
        employee_id: data.employee_id,
        permission_key: data.tool_key,
        granted: true,
        granted_at: new Date().toISOString(),
        connection_id: data.connection_id,
      } as any);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
