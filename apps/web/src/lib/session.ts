import { headers } from "next/headers";
import { auth } from "./auth";
import { env } from "./env";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { extractProviderGroups, resolveSessionRole } from "./role";
import { bearerFromHeaders, verifyApiToken } from "@/server/apiTokens";

const AUTHENTIK_PROVIDER_ID = "authentik";

/**
 * Session shape shared by browser sessions and CLI/API bearer-token sessions.
 * `viaApiToken` marks a token session; `readOnly` tokens may call GET endpoints
 * only (enforced by requireWritableSession in write routes).
 */
export interface ResolvedSession {
    user: { id: string; name: string; email: string; role: "user" | "admin" };
    viaApiToken: boolean;
    tokenReadOnly: boolean;
    providerInfo?: {
        providerId: string;
        groups: string[];
        adminGroups: string[];
        resolvedRole: "user" | "admin";
    };
}

export async function getCurrentSession(): Promise<ResolvedSession | null> {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session) return bearerSession(requestHeaders);

    let providerGroups: string[] = [];
    let resolvedRole = session.user.role;

    try {
        const accounts = await auth.api.listUserAccounts({
            headers: requestHeaders,
        });
        const authentikAccount = accounts.find(
            (account) => account.providerId === AUTHENTIK_PROVIDER_ID,
        );

        if (authentikAccount) {
            const accountInfo = await auth.api.accountInfo({
                query: {
                    accountId: authentikAccount.accountId,
                    providerId: AUTHENTIK_PROVIDER_ID,
                },
                headers: requestHeaders,
            });

            providerGroups = extractProviderGroups(accountInfo?.data);
            resolvedRole = resolveSessionRole(
                accountInfo?.data,
                env.adminGroups,
            );
        }
    } catch {
        providerGroups = [];
    }

    return {
        user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role: resolvedRole as 'user' | 'admin',
        },
        viaApiToken: false,
        tokenReadOnly: false,
        providerInfo: {
            providerId: AUTHENTIK_PROVIDER_ID,
            groups: providerGroups,
            adminGroups: env.adminGroups,
            resolvedRole: resolvedRole as 'user' | 'admin',
        },
    };
}

/**
 * Bearer-token fallback for the maticket CLI: `Authorization: Bearer matk_…`.
 * The token's owner row carries the role (kept in sync from Authentik by
 * authentikSync), so authorization is identical to a browser session except
 * for the read-only flag.
 */
async function bearerSession(requestHeaders: Headers): Promise<ResolvedSession | null> {
    const bearer = bearerFromHeaders(requestHeaders);
    if (!bearer) return null;
    const verified = await verifyApiToken(bearer);
    if (!verified) return null;
    return {
        user: {
            id: verified.owner.id,
            name: verified.owner.name,
            email: verified.owner.email,
            role: verified.owner.role,
        },
        viaApiToken: true,
        tokenReadOnly: verified.readOnly,
    };
}

export async function requireSession() {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();
    return session;
}

/**
 * Like requireSession, but rejects read-only API tokens — call this from every
 * write route (POST/PATCH/PUT/DELETE) so a read-only CLI token cannot mutate.
 */
export async function requireWritableSession() {
    const session = await requireSession();
    if (session.viaApiToken && session.tokenReadOnly) {
        throw new ForbiddenError('This API token is read-only');
    }
    return session;
}

export async function requireAdmin() {
    const session = await requireSession();
    if (session.user.role !== "admin") throw new ForbiddenError();
    return session;
}

/** requireAdmin + read-only-token rejection, for admin-scoped write routes. */
export async function requireWritableAdmin() {
    const session = await requireAdmin();
    if (session.viaApiToken && session.tokenReadOnly) {
        throw new ForbiddenError('This API token is read-only');
    }
    return session;
}
