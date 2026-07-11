"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { buttonSecondary } from "@/lib/styles";

export function LogoutButton() {
    const router = useRouter();

    return (
        <button
            className={buttonSecondary}
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
