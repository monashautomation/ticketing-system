import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import { getCurrentSession } from "@/lib/session";
import { listTicketsForUser } from "@/server/tickets";
import { AppHeader } from "@/components/AppHeader";
import { NewTicketForm } from "@/components/NewTicketForm";
import { mutedText, page, pageHeader, pageNarrow, pageTitle } from "@/lib/styles";
import { StatusPill } from "@/lib/ticketStatus";

export default async function DashboardPage() {
    const session = await getCurrentSession();

    if (!session) {
        return (
            <>
                <AppHeader />
                <main className={`${pageNarrow} flex flex-col items-center gap-4 text-center`}>
                    <h1 className="text-2xl font-semibold tracking-tight text-text">
                        Support Tickets
                    </h1>
                    <p className={mutedText}>Sign in to view or open a ticket.</p>
                </main>
            </>
        );
    }

    const tickets = await listTicketsForUser(session.user.id);

    return (
        <>
            <AppHeader />
            <main className={page}>
                <div className={pageHeader}>
                    <h1 className={pageTitle}>Your Tickets</h1>
                </div>

                <NewTicketForm />

                <ul className="mt-8 divide-y divide-border">
                    {tickets.map((ticket, index) => (
                        <li
                            key={ticket.id}
                            className="animate-fade-in-up py-4"
                            style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                        >
                            <Link
                                href={`/t/${ticket.id}`}
                                className="group flex items-center justify-between gap-4 rounded-md px-2 -mx-2 transition-all hover:translate-x-0.5 hover:bg-panel"
                            >
                                <div>
                                    <p className="font-medium text-text">{ticket.title}</p>
                                    <p className={mutedText}>
                                        {ticket.createdBy.name}
                                        {ticket.assignees.length > 0
                                            ? ` · assigned to ${ticket.assignees.map((a) => a.name).join(", ")}`
                                            : ""}
                                    </p>
                                    {ticket.tags.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {ticket.tags.map((tag) => (
                                                <span
                                                    key={tag.id}
                                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                                                    style={{ backgroundColor: tag.color }}
                                                >
                                                    {tag.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <StatusPill status={ticket.status} />
                                    <ChevronRight className="h-4 w-4 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
                                </div>
                            </Link>
                        </li>
                    ))}
                    {tickets.length === 0 && (
                        <div className="flex flex-col items-center gap-2 py-12 text-center">
                            <Inbox className="h-8 w-8 text-text-tertiary" />
                            <p className={mutedText}>No tickets yet.</p>
                        </div>
                    )}
                </ul>
            </main>
        </>
    );
}
