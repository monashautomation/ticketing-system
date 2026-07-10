import { headers } from "next/headers";
import { auth } from "./auth";
import { env } from "./env";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { extractProviderGroups, resolveSessionRole } from "./role";

const AUTHENTIK_PROVIDER_ID = "authentik";

export async function getCurrentSession() {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session) return null;

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
        ...session,
        user: {
            ...session.user,
            role: resolvedRole,
        },
        providerInfo: {
            providerId: AUTHENTIK_PROVIDER_ID,
            groups: providerGroups,
            adminGroups: env.adminGroups,
            resolvedRole,
        },
    };
}

export async function requireSession() {
    const session = await getCurrentSession();
    if (!session) throw new UnauthorizedError();
    return session;
}

export async function requireAdmin() {
    const session = await requireSession();
    if (session.user.role !== "admin") throw new ForbiddenError();
    return session;
}
