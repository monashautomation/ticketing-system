mod api;
mod config;
mod output;

use std::process::ExitCode;

use clap::{Parser, Subcommand, ValueEnum};
use serde_json::{json, Value};

use api::{body, ids, query, Client};
use config::{config_path, load_config, normalize_url, resolve, save_config, Config};

/// maticket — Monash Automation ticketing system CLI.
///
/// Read AND write: GETs work with any token; POST/PATCH/DELETE need a
/// read-write token (create one at /api-tokens in the web UI, or with
/// `maticket tokens create --read-write`).
#[derive(Parser)]
#[command(name = "maticket", version, about, long_about = None)]
struct Cli {
    /// Server URL (e.g. tickets.monashautomation.com)
    #[arg(short = 'u', long = "url", global = true)]
    url: Option<String>,
    /// API token (matk_…, from /api-tokens in the web UI)
    #[arg(short = 't', long = "token", global = true)]
    token: Option<String>,
    /// Config file path (default: ~/.config/maticket/config.json)
    #[arg(long = "config", global = true)]
    config: Option<String>,
    /// Emit raw JSON instead of tables
    #[arg(long = "json", global = true)]
    json: bool,

    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Authenticate against a ticketing server
    Auth {
        #[command(subcommand)]
        action: Option<AuthAction>,
        /// Server URL (shorthand for `maticket auth login -u … -t …`)
        #[arg(short = 'u', long = "url")]
        url: Option<String>,
        /// API token
        #[arg(short = 't', long = "token")]
        token: Option<String>,
    },
    /// Who am I on the server (and what can my token do)
    Whoami,
    /// Tickets
    Tickets {
        #[command(subcommand)]
        action: TicketsAction,
    },
    /// Ticket messages (comment on a ticket)
    Messages {
        #[command(subcommand)]
        action: MessagesAction,
    },
    /// Attachments (upload to a ticket)
    Attachments {
        #[command(subcommand)]
        action: AttachmentsAction,
    },
    /// Tags
    Tags {
        #[command(subcommand)]
        action: TagsAction,
    },
    /// Ticket groups (teams)
    Groups,
    /// Users (admin)
    Users {
        #[command(subcommand)]
        action: UsersAction,
    },
    /// Your notifications
    Notifications {
        #[command(subcommand)]
        action: NotificationsAction,
    },
    /// API tokens: create, list, revoke (for the CLI itself)
    Tokens {
        #[command(subcommand)]
        action: TokensAction,
    },
    /// Call any endpoint directly: maticket call GET /api/tickets
    Call {
        /// HTTP method (GET, POST, PATCH, DELETE)
        method: String,
        /// API path, e.g. /api/tickets
        path: String,
        /// JSON body (for POST/PATCH)
        body: Option<String>,
    },
}

#[derive(Clone, Debug, Subcommand)]
enum AuthAction {
    /// Save url + token to the config file
    Login {
        #[arg(long)]
        url: String,
        #[arg(long)]
        token: String,
    },
    /// Show the saved session
    Status,
    /// Remove the saved token
    Logout,
}

#[derive(Debug, Subcommand)]
enum TicketsAction {
    /// List my tickets (or the admin queue with --all)
    List {
        /// Query the admin queue instead of my tickets (admin, read-only ok)
        #[arg(long)]
        all: bool,
        #[arg(long, value_enum)]
        status: Option<Status>,
        #[arg(long, value_enum)]
        priority: Option<Priority>,
        #[arg(long, value_enum)]
        r#type: Option<Type>,
        #[arg(long)]
        assignee: Option<String>,
        #[arg(long)]
        tag: Option<String>,
        #[arg(long)]
        overdue_only: bool,
        /// Full-text search (title/description/messages/OCR'd attachments)
        #[arg(long, short = 'f')]
        search: Option<String>,
    },
    /// Get one ticket with its message thread
    Get { id: String },
    /// Create a ticket
    Create {
        #[arg(long)]
        title: String,
        #[arg(short = 'd', long, default_value = "")]
        description: String,
        #[arg(long, value_enum)]
        priority: Option<Priority>,
        #[arg(long, value_enum)]
        r#type: Option<Type>,
        /// Ticket group id (omit = "unsure", routed to admins)
        #[arg(long)]
        group: Option<String>,
        #[arg(long)]
        assignee: Option<String>,
        #[arg(long)]
        cc: Option<String>,
    },
    /// Update a ticket (status, priority, assignees, tags, …)
    Update {
        id: String,
        #[arg(long, value_enum)]
        status: Option<Status>,
        #[arg(long, value_enum)]
        priority: Option<Priority>,
        #[arg(long, value_enum)]
        r#type: Option<Type>,
        #[arg(long)]
        title: Option<String>,
        #[arg(long)]
        assignee: Option<String>,
        #[arg(long)]
        tag: Option<String>,
        #[arg(long)]
        watcher: Option<String>,
        #[arg(long)]
        resolution: Option<String>,
        #[arg(long, value_enum)]
        close_reason: Option<CloseReason>,
    },
    /// Close a ticket (shortcut for update --status closed)
    Close {
        id: String,
        #[arg(long, value_enum, default_value = "other")]
        reason: CloseReason,
        #[arg(long)]
        resolution: Option<String>,
    },
    /// Reopen a closed/resolved ticket (update --status open)
    Reopen { id: String },
    /// Create a share link for a ticket
    Share { id: String },
}

#[derive(Debug, Clone, ValueEnum)]
enum Status {
    Open,
    Pending,
    Escalated,
    #[value(name = "in_progress")]
    InProgress,
    Resolved,
    Closed,
}

#[derive(Debug, Clone, ValueEnum)]
enum Priority {
    Low,
    Normal,
    High,
    Urgent,
}

#[derive(Debug, Clone, ValueEnum)]
enum Type {
    Bug,
    Suggestion,
    Improvement,
    Feature,
    Question,
    Other,
}

#[derive(Debug, Clone, ValueEnum)]
enum CloseReason {
    #[value(name = "not_planned")]
    NotPlanned,
    Duplicate,
    #[value(name = "wont_fix")]
    WontFix,
    Other,
}

#[derive(Debug, Subcommand)]
enum MessagesAction {
    /// Add a comment to a ticket
    Add {
        ticket: String,
        /// Message body (or use --file for multi-line)
        #[arg(short = 'm', long)]
        message: Option<String>,
        /// Read the message body from a file
        #[arg(long)]
        file: Option<String>,
        /// Admin-only internal note (hidden from the requester)
        #[arg(long)]
        internal: bool,
    },
}

#[derive(Debug, Subcommand)]
enum AttachmentsAction {
    /// Upload a file to a ticket (registers it and PUTs the bytes to storage)
    Upload {
        ticket: String,
        /// Local file path
        #[arg(short = 'f', long)]
        file: String,
    },
}

#[derive(Debug, Subcommand)]
enum TagsAction {
    /// List tags
    List,
    /// Create a tag (admin, read-write token)
    Create {
        name: String,
        #[arg(long, default_value = "#6b7280")]
        color: String,
    },
    /// Delete a tag (admin, read-write token)
    Delete { id: String },
}

#[derive(Debug, Subcommand)]
enum UsersAction {
    /// List users (admin)
    List {
        #[arg(long, value_enum)]
        role: Option<Role>,
    },
    /// Assignee roster (admins + members of --group)
    Assignable {
        #[arg(long)]
        group: Option<String>,
        #[arg(long, short = 'f')]
        query: Option<String>,
    },
}

#[derive(Debug, Clone, ValueEnum)]
enum Role {
    User,
    Admin,
}

#[derive(Debug, Subcommand)]
#[allow(non_camel_case_types)] // Read_all -> `read-all` on the CLI, matching maims style
enum NotificationsAction {
    /// List my notifications
    List,
    /// Mark one notification read
    Read { id: String },
    /// Mark all my notifications read
    Read_all,
}

#[derive(Debug, Subcommand)]
enum TokensAction {
    /// List your API tokens (never the secret)
    List,
    /// Create a new API token (plaintext shown once)
    Create {
        /// Human name for the token, e.g. "laptop CLI"
        #[arg(short = 'n', long)]
        name: String,
        /// Grant write access (default is read-only)
        #[arg(long)]
        read_write: bool,
        /// Lifetime in days (1-365). Omit for no expiry.
        #[arg(long)]
        expires_in_days: Option<u32>,
    },
    /// Revoke an API token by id
    Revoke { id: String },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    let cfg_file = config_path(cli.config.as_deref());
    let file = cfg_file.as_ref().map(load_config).unwrap_or_default();

    match &cli.command {
        Command::Auth { action, url, token } => do_auth(
            cfg_file.as_ref(),
            action.as_ref(),
            url.as_deref(),
            token.as_deref(),
            cli.json,
        ),
        Command::Call { method, path, body } => run_call(&cli, &file, method, path, body.as_deref()),
        Command::Tokens { action } => run_tokens(&cli, &file, action),
        Command::Attachments { action } => run_upload(&cli, &file, action),
        other => {
            let (method, path, payload) = match build_request(other) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("error: {e}");
                    return ExitCode::from(1);
                }
            };
            run_request(&cli, &file, &method, &path, payload.as_ref())
        }
    }
}

fn do_auth(
    cfg_file: Option<&std::path::PathBuf>,
    action: Option<&AuthAction>,
    url: Option<&str>,
    token: Option<&str>,
    as_json: bool,
) -> ExitCode {
    let path = match cfg_file {
        Some(p) => p.to_path_buf(),
        None => {
            eprintln!("error: could not determine config path (is $HOME set?)");
            return ExitCode::from(1);
        }
    };
    // `maticket auth -u … -t …` is shorthand for `maticket auth login`.
    let action = match action {
        Some(a) => a.clone(),
        None => match (url, token) {
            (Some(u), Some(t)) => AuthAction::Login {
                url: u.to_string(),
                token: t.to_string(),
            },
            _ => AuthAction::Status,
        },
    };
    match action {
        AuthAction::Login { url, token } => {
            let normalized = match normalize_url(&url) {
                Some(u) => u,
                None => {
                    eprintln!("error: invalid URL: {url}");
                    return ExitCode::from(1);
                }
            };
            if token.trim().is_empty() {
                eprintln!("error: token is empty");
                return ExitCode::from(1);
            }
            if !token.trim().starts_with("matk_") {
                eprintln!("warning: token does not look like a ticketing API token (expected matk_…)");
            }
            let cfg = Config {
                url: normalized.clone(),
                token: token.trim().to_string(),
            };
            if let Err(e) = save_config(&path, &cfg) {
                eprintln!("error: could not write {}: {e}", path.display());
                return ExitCode::from(1);
            }
            if as_json {
                println!(
                    "{}",
                    json!({"ok": true, "url": normalized, "config": path.display().to_string()})
                );
            } else {
                println!("saved session for {normalized} → {}", path.display());
                println!("token stored (0600). verify with: maticket whoami");
            }
            ExitCode::SUCCESS
        }
        AuthAction::Status => {
            let cfg = load_config(&path);
            if as_json {
                println!(
                    "{}",
                    json!({"config": path.display().to_string(), "url": cfg.url, "token": mask(&cfg.token)})
                );
            } else if cfg.url.is_empty() {
                println!("not authenticated — run: maticket auth login -u <url> -t <token>");
            } else {
                println!("config:  {}", path.display());
                println!("url:     {}", cfg.url);
                println!("token:   {}", mask(&cfg.token));
            }
            ExitCode::SUCCESS
        }
        AuthAction::Logout => {
            let mut cfg = load_config(&path);
            cfg.token = String::new();
            if let Err(e) = save_config(&path, &cfg) {
                eprintln!("error: could not write {}: {e}", path.display());
                return ExitCode::from(1);
            }
            println!("token removed from {}", path.display());
            ExitCode::SUCCESS
        }
    }
}

fn mask(token: &str) -> String {
    if token.is_empty() {
        return "(none)".to_string();
    }
    let chars: Vec<char> = token.chars().collect();
    if chars.len() <= 8 {
        return "••••".to_string();
    }
    let head: String = chars[..4].iter().collect();
    let tail: String = chars[chars.len() - 4..].iter().collect();
    format!("{head}…{tail}")
}

fn client_for(cli: &Cli, file: &Config) -> Result<Client, ExitCode> {
    let (url, token) = match resolve(cli.url.as_deref(), cli.token.as_deref(), file) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("error: {e}");
            return Err(ExitCode::from(2));
        }
    };
    Ok(Client::new(url, token))
}

fn print_ok(cli: &Cli, v: Value) -> ExitCode {
    if let Err(e) = output::print_value(&mut std::io::stdout(), &v, cli.json) {
        eprintln!("error writing output: {e}");
        return ExitCode::from(1);
    }
    ExitCode::SUCCESS
}

fn report(e: api::ApiError) -> ExitCode {
    match e {
        api::ApiError::Unauthorized(m) => {
            eprintln!("error: {m}");
            ExitCode::from(2)
        }
        api::ApiError::Forbidden(m) => {
            eprintln!("error: {m}");
            eprintln!("hint: this token is read-only or lacks the role — create a read-write token at /api-tokens");
            ExitCode::from(2)
        }
        other => {
            eprintln!("error: {other}");
            ExitCode::from(1)
        }
    }
}

fn run_request(
    cli: &Cli,
    file: &Config,
    method: &str,
    path: &str,
    payload: Option<&Value>,
) -> ExitCode {
    let client = match client_for(cli, file) {
        Ok(c) => c,
        Err(code) => return code,
    };
    let result = match method {
        "GET" => client.get(path),
        "POST" => client.post(path, Some(payload.unwrap_or(&json!({})))),
        "PATCH" => client.patch(path, Some(payload.unwrap_or(&json!({})))),
        "DELETE" => client.delete(path),
        m => {
            eprintln!("error: unsupported method {m}");
            return ExitCode::from(1);
        }
    };
    match result {
        Ok(v) => print_ok(cli, v),
        Err(e) => report(e),
    }
}

fn run_call(cli: &Cli, file: &Config, method: &str, path: &str, raw_body: Option<&str>) -> ExitCode {
    let method = method.to_uppercase();
    if !path.starts_with("/api/") {
        eprintln!("error: path must start with /api/");
        return ExitCode::from(1);
    }
    let payload: Option<Value> = match raw_body {
        Some(s) => match serde_json::from_str(s) {
            Ok(v) => Some(v),
            Err(e) => {
                eprintln!("error: body is not valid JSON: {e}");
                return ExitCode::from(1);
            }
        },
        None => None,
    };
    run_request(cli, file, &method, path, payload.as_ref())
}

fn run_tokens(cli: &Cli, file: &Config, action: &TokensAction) -> ExitCode {
    let client = match client_for(cli, file) {
        Ok(c) => c,
        Err(code) => return code,
    };
    if !client.has_token() {
        eprintln!("error: token management needs a session — run `maticket auth login -u <url> -t <token>`");
        return ExitCode::from(2);
    }
    match action {
        TokensAction::List => match client.get("/api/api-tokens") {
            Ok(v) => print_ok(cli, v),
            Err(e) => report(e),
        },
        TokensAction::Create { name, read_write, expires_in_days } => {
            if name.trim().is_empty() {
                eprintln!("error: token name is empty");
                return ExitCode::from(1);
            }
            if let Some(d) = expires_in_days {
                if *d == 0 || *d > 365 {
                    eprintln!("error: --expires-in-days must be between 1 and 365");
                    return ExitCode::from(1);
                }
            }
            let mut input = json!({"name": name, "readOnly": !read_write});
            if let Some(d) = expires_in_days {
                input["expiresInDays"] = json!(d);
            }
            match client.post("/api/api-tokens", Some(&input)) {
                Ok(v) => {
                    let secret = v.get("token").and_then(|t| t.as_str()).unwrap_or("");
                    if cli.json {
                        println!("{}", serde_json::to_string_pretty(&v).unwrap());
                    } else {
                        println!("token created — copy it now, it is shown only once:");
                        println!();
                        println!("  {secret}");
                        println!();
                        println!("auth with:");
                        println!("  maticket auth login -u <url> -t {secret}");
                    }
                    ExitCode::SUCCESS
                }
                Err(e) => report(e),
            }
        }
        TokensAction::Revoke { id } => match client.delete(&format!("/api/api-tokens/{id}")) {
            Ok(_) => {
                println!("token revoked");
                ExitCode::SUCCESS
            }
            Err(e) => report(e),
        },
    }
}

/// Two-leg upload: register the attachment (API), then PUT the bytes to the
/// presigned storage URL.
fn run_upload(cli: &Cli, file: &Config, action: &AttachmentsAction) -> ExitCode {
    let AttachmentsAction::Upload { ticket, file: path } = action;
    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("error: could not read {path}: {e}");
            return ExitCode::from(1);
        }
    };
    if bytes.is_empty() {
        eprintln!("error: {path} is empty");
        return ExitCode::from(1);
    }
    if bytes.len() as u64 > 25 * 1024 * 1024 {
        eprintln!("error: {path} exceeds the 25MB attachment cap");
        return ExitCode::from(1);
    }
    let name = std::path::Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    let mime = guess_mime(&name);

    let client = match client_for(cli, file) {
        Ok(c) => c,
        Err(code) => return code,
    };
    let registered = match client.post(
        &format!("/api/tickets/{ticket}/attachments"),
        Some(&json!({"fileName": name, "mimeType": mime, "sizeBytes": bytes.len()})),
    ) {
        Ok(v) => v,
        Err(e) => return report(e),
    };
    let upload_url = registered.get("uploadUrl").and_then(|u| u.as_str());
    let Some(upload_url) = upload_url else {
        eprintln!("error: server did not return an uploadUrl");
        return ExitCode::from(1);
    };
    if let Err(e) = Client::put_file(upload_url, &bytes, &mime) {
        eprintln!("error: attachment registered but the byte upload failed: {e}");
        return ExitCode::from(1);
    }
    if cli.json {
        println!("{}", serde_json::to_string_pretty(&registered).unwrap());
    } else {
        let id = registered
            .get("attachment")
            .and_then(|a| a.get("id"))
            .and_then(|i| i.as_str())
            .unwrap_or("?");
        println!("uploaded {name} ({} KB) → attachment {id}", bytes.len() / 1024);
    }
    ExitCode::SUCCESS
}

/// Map a subcommand to (method, path, optional JSON body).
fn build_request(cmd: &Command) -> Result<(String, String, Option<Value>), String> {
    Ok(match cmd {
        Command::Whoami => ("GET".into(), "/api/whoami".into(), None),
        Command::Groups => ("GET".into(), "/api/ticket-groups".into(), None),
        Command::Tokens { .. } => return Err("tokens are handled separately".into()),

        Command::Tickets { action } => match action {
            TicketsAction::List { all, status, priority, r#type, assignee, tag, overdue_only, search } => {
                if *all {
                    let q = query(&[
                        ("status", status.as_ref().map(snake)),
                        ("priority", priority.as_ref().map(snake)),
                        ("type", r#type.as_ref().map(snake)),
                        ("assigneeId", assignee.clone()),
                        ("tagId", tag.clone()),
                        ("overdueOnly", overdue_only.then(|| "true".to_string())),
                        ("search", search.clone()),
                    ]);
                    ("GET".into(), format!("/api/admin/tickets{q}"), None)
                } else {
                    if status.is_some() || priority.is_some() || r#type.is_some() || assignee.is_some() || tag.is_some() || *overdue_only || search.is_some() {
                        return Err("filters need --all (admin queue); plain `tickets list` shows your tickets".into());
                    }
                    ("GET".into(), "/api/tickets".into(), None)
                }
            }
            TicketsAction::Get { id } => ("GET".into(), format!("/api/tickets/{id}"), None),
            TicketsAction::Create { title, description, priority, r#type, group, assignee, cc } => {
                if title.trim().len() < 3 {
                    return Err("title must be at least 3 characters".into());
                }
                let b = body(vec![
                    ("title", Some(json!(title))),
                    ("description", (!description.is_empty()).then(|| json!(description))),
                    ("priority", priority.as_ref().map(|p| json!(snake(p)))),
                    ("type", r#type.as_ref().map(|t| json!(snake(t)))),
                    ("groupId", group.as_ref().map(|g| json!(g))),
                    ("assigneeIds", ids(assignee)),
                    ("ccUserIds", ids(cc)),
                ]);
                ("POST".into(), "/api/tickets".into(), Some(b))
            }
            TicketsAction::Update { id, status, priority, r#type, title, assignee, tag, watcher, resolution, close_reason } => {
                let b = body(vec![
                    ("status", status.as_ref().map(|s| json!(snake(s)))),
                    ("priority", priority.as_ref().map(|p| json!(snake(p)))),
                    ("type", r#type.as_ref().map(|t| json!(snake(t)))),
                    ("title", title.as_ref().map(|t| json!(t))),
                    ("assigneeIds", ids(assignee)),
                    ("tagIds", ids(tag)),
                    ("watcherIds", ids(watcher)),
                    ("resolutionMessage", resolution.as_ref().map(|r| json!(r))),
                    ("closeReason", close_reason.as_ref().map(|c| json!(snake(c)))),
                ]);
                if b.as_object().map(|o| o.is_empty()).unwrap_or(false) {
                    return Err("nothing to update — pass at least one field flag".into());
                }
                ("PATCH".into(), format!("/api/tickets/{id}"), Some(b))
            }
            TicketsAction::Close { id, reason, resolution } => {
                let mut b = json!({"status": "closed", "closeReason": snake(reason)});
                if let Some(r) = resolution {
                    b["resolutionMessage"] = json!(r);
                }
                ("PATCH".into(), format!("/api/tickets/{id}"), Some(b))
            }
            TicketsAction::Reopen { id } => (
                "PATCH".into(),
                format!("/api/tickets/{id}"),
                Some(json!({"status": "open"})),
            ),
            TicketsAction::Share { id } => ("POST".into(), format!("/api/tickets/{id}/share"), None),
        },

        Command::Messages { action } => match action {
            MessagesAction::Add { ticket, message, file, internal } => {
                let text = match (message, file) {
                    (Some(m), _) => m.clone(),
                    (None, Some(f)) => std::fs::read_to_string(f)
                        .map_err(|e| format!("could not read {f}: {e}"))?,
                    (None, None) => return Err("message needs -m <text> or --file <path>".into()),
                };
                if text.trim().is_empty() {
                    return Err("message body is empty".into());
                }
                (
                    "POST".into(),
                    format!("/api/tickets/{ticket}/messages"),
                    Some(json!({"body": text, "isInternalNote": *internal})),
                )
            }
        },

        Command::Attachments { .. } => return Err("uploads are handled separately".into()),

        Command::Tags { action } => match action {
            TagsAction::List => ("GET".into(), "/api/tags".into(), None),
            TagsAction::Create { name, color } => (
                "POST".into(),
                "/api/tags".into(),
                Some(json!({"name": name, "color": color})),
            ),
            TagsAction::Delete { id } => ("DELETE".into(), format!("/api/tags/{id}"), None),
        },

        Command::Users { action } => match action {
            UsersAction::List { role } => {
                let q = query(&[("role", role.as_ref().map(snake))]);
                ("GET".into(), format!("/api/users{q}"), None)
            }
            UsersAction::Assignable { group, query: q } => {
                let qs = query(&[("groupId", group.clone()), ("q", q.clone())]);
                ("GET".into(), format!("/api/users/cc-candidates{qs}"), None)
            }
        },

        Command::Notifications { action } => match action {
            NotificationsAction::List => ("GET".into(), "/api/notifications".into(), None),
            NotificationsAction::Read { id } => {
                ("POST".into(), format!("/api/notifications/{id}/read"), None)
            }
            NotificationsAction::Read_all => {
                ("POST".into(), "/api/notifications/mark-all-read".into(), None)
            }
        },

        // Handled in main() before reaching here.
        Command::Auth { .. } | Command::Call { .. } => return Err("handled separately".into()),
    })
}

/// Best-effort MIME type from a file extension (the API validates this loosely).
fn guess_mime(name: &str) -> String {
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "pdf" => "application/pdf",
        "txt" | "log" => "text/plain",
        "csv" => "text/csv",
        "zip" => "application/zip",
        "json" => "application/json",
        _ => "application/octet-stream",
    }
    .to_string()
}

/// Render an enum variant back to its server-side spelling.
fn snake<T: clap::ValueEnum>(v: &T) -> String {
    clap::ValueEnum::to_possible_value(v)
        .map(|p| p.get_name().to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(args: &[&str]) -> Cli {
        Cli::try_parse_from(args).expect("parse failed")
    }

    #[test]
    fn auth_shorthand_parses() {
        let cli = parse(&["maticket", "auth", "-u", "tickets.test", "-t", "matk_x"]);
        match cli.command {
            Command::Auth { action, url, token } => {
                assert!(action.is_none());
                assert_eq!(url.as_deref(), Some("tickets.test"));
                assert_eq!(token.as_deref(), Some("matk_x"));
            }
            other => panic!("expected Auth, got {other:?}"),
        }
    }

    #[test]
    fn tickets_list_all_maps_filters() {
        let cli = parse(&[
            "maticket", "tickets", "list", "--all", "--status", "in_progress",
            "--priority", "urgent", "-f", "printer", "--overdue-only",
        ]);
        let (method, path, body) = build_request(&cli.command).unwrap();
        assert_eq!(method, "GET");
        assert!(path.starts_with("/api/admin/tickets?"));
        assert!(path.contains("status=in_progress"));
        assert!(path.contains("priority=urgent"));
        assert!(path.contains("search=printer"));
        assert!(path.contains("overdueOnly=true"));
        assert!(body.is_none());
    }

    #[test]
    fn tickets_list_mine_has_no_filters() {
        let cli = parse(&["maticket", "tickets", "list"]);
        let (method, path, _) = build_request(&cli.command).unwrap();
        assert_eq!((method.as_str(), path.as_str()), ("GET", "/api/tickets"));
    }

    #[test]
    fn tickets_list_filters_without_all_error() {
        let cli = parse(&["maticket", "tickets", "list", "--status", "open"]);
        assert!(build_request(&cli.command).is_err());
    }

    #[test]
    fn tickets_create_maps_body() {
        let cli = parse(&[
            "maticket", "tickets", "create", "--title", "Broken drill", "-d", "it died",
            "--priority", "high", "--type", "bug", "--group", "g1", "--assignee", "u1,u2",
        ]);
        let (method, path, Some(b)) = build_request(&cli.command).unwrap() else {
            panic!("expected body");
        };
        assert_eq!((method.as_str(), path.as_str()), ("POST", "/api/tickets"));
        assert_eq!(b["title"], json!("Broken drill"));
        assert_eq!(b["priority"], json!("high"));
        assert_eq!(b["type"], json!("bug"));
        assert_eq!(b["groupId"], json!("g1"));
        assert_eq!(b["assigneeIds"], json!(["u1", "u2"]));
    }

    #[test]
    fn tickets_create_rejects_short_title() {
        let cli = parse(&["maticket", "tickets", "create", "--title", "x"]);
        assert!(build_request(&cli.command).is_err());
    }

    #[test]
    fn tickets_close_sets_status_and_reason() {
        let cli = parse(&["maticket", "tickets", "close", "t1", "--reason", "wont_fix"]);
        let (method, path, Some(b)) = build_request(&cli.command).unwrap() else {
            panic!("expected body");
        };
        assert_eq!((method.as_str(), path.as_str()), ("PATCH", "/api/tickets/t1"));
        assert_eq!(b["status"], json!("closed"));
        assert_eq!(b["closeReason"], json!("wont_fix"));
    }

    #[test]
    fn tickets_update_requires_a_field() {
        let cli = parse(&["maticket", "tickets", "update", "t1"]);
        assert!(build_request(&cli.command).is_err());
    }

    #[test]
    fn tickets_update_maps_fields() {
        let cli = parse(&[
            "maticket", "tickets", "update", "t1", "--status", "resolved",
            "--tag", "a,b", "--resolution", "fixed it",
        ]);
        let (_, _, Some(b)) = build_request(&cli.command).unwrap() else {
            panic!("expected body");
        };
        assert_eq!(b["status"], json!("resolved"));
        assert_eq!(b["tagIds"], json!(["a", "b"]));
        assert_eq!(b["resolutionMessage"], json!("fixed it"));
    }

    #[test]
    fn messages_add_requires_text() {
        let cli = parse(&["maticket", "messages", "add", "t1"]);
        assert!(build_request(&cli.command).is_err());
    }

    #[test]
    fn messages_add_maps_internal() {
        let cli = parse(&["maticket", "messages", "add", "t1", "-m", "hello", "--internal"]);
        let (method, path, Some(b)) = build_request(&cli.command).unwrap() else {
            panic!("expected body");
        };
        assert_eq!((method.as_str(), path.as_str()), ("POST", "/api/tickets/t1/messages"));
        assert_eq!(b["body"], json!("hello"));
        assert_eq!(b["isInternalNote"], json!(true));
    }

    #[test]
    fn attachments_upload_is_handled_separately() {
        let cli = parse(&["maticket", "attachments", "upload", "t1", "-f", "x.txt"]);
        assert!(build_request(&cli.command).is_err());
    }

    #[test]
    fn notifications_read_maps() {
        let cli = parse(&["maticket", "notifications", "read", "n1"]);
        let (method, path, _) = build_request(&cli.command).unwrap();
        assert_eq!((method.as_str(), path.as_str()), ("POST", "/api/notifications/n1/read"));
    }

    #[test]
    fn users_assignable_maps_params() {
        let cli = parse(&["maticket", "users", "assignable", "--group", "g1", "-f", "kee"]);
        let (method, path, _) = build_request(&cli.command).unwrap();
        assert_eq!(method, "GET");
        assert!(path.starts_with("/api/users/cc-candidates?"));
        assert!(path.contains("groupId=g1"));
        assert!(path.contains("q=kee"));
    }

    #[test]
    fn tokens_create_parses_read_write() {
        let cli = parse(&["maticket", "tokens", "create", "-n", "laptop", "--read-write", "--expires-in-days", "30"]);
        match cli.command {
            Command::Tokens { action: TokensAction::Create { name, read_write, expires_in_days } } => {
                assert_eq!(name, "laptop");
                assert!(read_write);
                assert_eq!(expires_in_days, Some(30));
            }
            other => panic!("expected Tokens create, got {other:?}"),
        }
    }

    #[test]
    fn call_validates_path_prefix() {
        let cli = parse(&["maticket", "call", "GET", "/tickets"]);
        // run_call checks the prefix at runtime; parse must still succeed.
        match cli.command {
            Command::Call { method, path, .. } => {
                assert_eq!(method, "GET");
                assert_eq!(path, "/tickets");
            }
            other => panic!("expected Call, got {other:?}"),
        }
    }

    #[test]
    fn global_flags_parse() {
        let cli = parse(&["maticket", "--json", "-u", "x.test", "-t", "t", "whoami"]);
        assert!(cli.json);
        assert_eq!(cli.url.as_deref(), Some("x.test"));
        assert_eq!(cli.token.as_deref(), Some("t"));
    }

    #[test]
    fn mask_hides_middle() {
        assert_eq!(mask(""), "(none)");
        assert_eq!(mask("short"), "••••");
        assert_eq!(mask("abcdefghij"), "abcd…ghij");
    }

    #[test]
    fn guess_mime_known_extensions() {
        assert_eq!(guess_mime("photo.JPG"), "image/jpeg");
        assert_eq!(guess_mime("a.pdf"), "application/pdf");
        assert_eq!(guess_mime("weird"), "application/octet-stream");
    }
}
