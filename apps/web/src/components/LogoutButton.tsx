"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
    const router = useRouter();

    return (
        <button
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            onClick={() =>
                authClient.signOut({
                    fetchOptions: {
                        onSuccess: () => {
                            router.push("/");
                            router.refresh();
                        },
                    },
                })
            }
        >
            Log out
        </button>
    );
}
