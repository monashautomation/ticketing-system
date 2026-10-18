use std::io::Write;

use serde_json::Value;

/// Render an API result as a table (default) or pretty JSON (`--json`).
/// Tables work on arrays of objects and single objects; anything else
/// falls back to JSON so nothing is ever hidden.
pub fn print_value<W: Write>(out: &mut W, value: &Value, as_json: bool) -> std::io::Result<()> {
    if as_json {
        writeln!(out, "{}", serde_json::to_string_pretty(value).unwrap())?;
        return Ok(());
    }
    match value {
        Value::Array(items) if !items.is_empty() && items.iter().all(Value::is_object) => {
            write_table(out, items)
        }
        Value::Object(obj) => {
            // Ticket detail: render the scalar fields, then messages as a sub-table.
            if obj.get("messages").is_some() && obj.get("incidentNumber").is_some() {
                print_ticket_detail(out, obj)?;
                return Ok(());
            }
            let flat = flatten_scalar(obj);
            if flat.is_empty() {
                writeln!(out, "{}", serde_json::to_string_pretty(value).unwrap())
            } else {
                let rows: Vec<Vec<String>> =
                    flat.iter().map(|(k, v)| vec![k.clone(), v.clone()]).collect();
                write_table_rows(out, &["field".to_string(), "value".to_string()], &rows)
            }
        }
        _ => writeln!(out, "{}", serde_json::to_string_pretty(value).unwrap()),
    }
}

/// Ticket detail view: header fields, then the message thread.
fn print_ticket_detail<W: Write>(
    out: &mut W,
    obj: &serde_json::Map<String, Value>,
) -> std::io::Result<()> {
    let header_cols = [
        "incidentNumber",
        "title",
        "status",
        "priority",
        "type",
        "createdAt",
        "slaDueAt",
    ];
    for c in header_cols {
        if let Some(v) = obj.get(c) {
            if is_scalar(v) {
                writeln!(out, "{c}: {}", cell(Some(v)))?;
            }
        }
    }
    for (k, list) in [("assignees", "assignees"), ("tags", "tags"), ("watchers", "watchers")] {
        if let Some(Value::Array(items)) = obj.get(list) {
            let names: Vec<String> = items.iter().map(|i| cell(Some(i))).collect();
            if !names.is_empty() {
                writeln!(out, "{k}: {}", names.join(", "))?;
            }
        }
    }
    writeln!(out)?;
    if let Some(Value::Array(msgs)) = obj.get("messages") {
        let cols = ["createdAt", "author", "body"];
        let rows: Vec<Vec<String>> = msgs
            .iter()
            .map(|m| {
                let author = m
                    .get("author")
                    .map(|a| cell(Some(a)))
                    .unwrap_or_else(|| "-".into());
                let note = if m.get("isInternalNote").and_then(|b| b.as_bool()) == Some(true) {
                    " [internal]"
                } else {
                    ""
                };
                vec![
                    m.get("createdAt").map(|v| cell(Some(v))).unwrap_or_default(),
                    format!("{author}{note}"),
                    m.get("body").map(|v| cell(Some(v))).unwrap_or_default(),
                ]
            })
            .collect();
        write_table_rows(out, &cols.map(String::from), &rows)?;
    }
    if let Some(Value::Array(atts)) = obj.get("attachments") {
        if !atts.is_empty() {
            writeln!(out)?;
            let names: Vec<String> = atts
                .iter()
                .map(|a| {
                    format!(
                        "{} ({})",
                        a.get("fileName").map(|v| cell(Some(v))).unwrap_or_else(|| "?".into()),
                        a.get("sizeBytes")
                            .and_then(|v| v.as_u64())
                            .map(|b| format!("{} KB", b / 1024))
                            .unwrap_or_else(|| "?".into())
                    )
                })
                .collect();
            writeln!(out, "attachments: {}", names.join(", "))?;
        }
    }
    Ok(())
}

/// Pick display columns: wanted keys first (in wanted order), then any
/// remaining keys the cell renderer can show. Caps at 8 so the table stays readable.
pub fn pick_columns(items: &[Value], wanted: &[&str]) -> Vec<String> {
    let first = match items.first() {
        Some(v) => v,
        None => return Vec::new(),
    };
    let keys: Vec<String> = first
        .as_object()
        .map(|o| o.keys().cloned().collect())
        .unwrap_or_default();
    let mut cols: Vec<String> = wanted
        .iter()
        .filter(|w| keys.iter().any(|k| k == *w))
        .map(|w| w.to_string())
        .collect();
    for k in &keys {
        if cols.len() >= 8 {
            break;
        }
        if cols.iter().any(|c| c == k) || DENY_COLS.contains(&k.as_str()) {
            continue;
        }
        let v = &first[k];
        if is_scalar(v) || renderable_object(v) {
            cols.push(k.clone());
        }
    }
    cols
}

/// Nested objects we can render meaningfully in a cell (like the UI does).
fn renderable_object(v: &Value) -> bool {
    v.as_object().is_some_and(|o| {
        ["name", "email", "id"]
            .iter()
            .any(|k| matches!(o.get(*k), Some(Value::String(_))))
    })
}

fn is_scalar(v: &Value) -> bool {
    matches!(v, Value::String(_) | Value::Number(_) | Value::Bool(_) | Value::Null)
}

fn flatten_scalar(obj: &serde_json::Map<String, Value>) -> Vec<(String, String)> {
    obj.iter()
        .filter(|(_, v)| is_scalar(v) || renderable_object(v))
        .map(|(k, v)| (k.clone(), cell(Some(v))))
        .collect()
}

fn write_table<W: Write>(out: &mut W, items: &[Value]) -> std::io::Result<()> {
    let cols = pick_columns(items, &DEFAULT_COLS);
    let rows: Vec<Vec<String>> = items
        .iter()
        .map(|it| cols.iter().map(|c| cell(it.get(c)).to_string()).collect())
        .collect();
    write_table_rows(out, &cols, &rows)
}

const DEFAULT_COLS: &[&str] = &[
    "incidentNumber",
    "title",
    "status",
    "priority",
    "type",
    "name",
    "preview",
    "createdAt",
];

/// Long/nested fields that never make sense as list-table columns.
const DENY_COLS: &[&str] = &["description", "body", "messages", "attachments", "customFieldValues"];

pub fn write_table_rows<W: Write>(
    out: &mut W,
    cols: &[String],
    rows: &[Vec<String>],
) -> std::io::Result<()> {
    if cols.is_empty() {
        return Ok(());
    }
    let mut widths: Vec<usize> = cols.iter().map(|c| c.len()).collect();
    for r in rows {
        for (i, cell) in r.iter().enumerate() {
            if i < widths.len() {
                widths[i] = widths[i].max(cell.chars().count().min(48));
            }
        }
    }
    let header: Vec<String> =
        cols.iter().enumerate().map(|(i, c)| pad(c, widths[i])).collect();
    writeln!(
        out,
        "{}",
        header.join("  ")
    )?;
    writeln!(
        out,
        "{}",
        widths.iter().map(|w| "-".repeat(*w)).collect::<Vec<_>>().join("  ")
    )?;
    for r in rows {
        let line: Vec<String> = r
            .iter()
            .enumerate()
            .map(|(i, c)| pad(&truncate(c, 48), widths.get(i).copied().unwrap_or(c.len())))
            .collect();
        writeln!(out, "{}", line.join("  "))?;
    }
    writeln!(out, "\n{} row(s)", rows.len())
}

fn pad(s: &str, w: usize) -> String {
    let len = s.chars().count();
    if len >= w {
        s.to_string()
    } else {
        format!("{s}{}", " ".repeat(w - len))
    }
}

fn truncate(s: &str, w: usize) -> String {
    if s.chars().count() <= w {
        s.to_string()
    } else {
        let cut: String = s.chars().take(w.saturating_sub(1)).collect();
        format!("{cut}…")
    }
}

pub fn cell(v: Option<&Value>) -> String {
    match v {
        None | Some(Value::Null) => "-".to_string(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => n.to_string(),
        Some(Value::Object(o)) => {
            // Nested objects: show name, else email, else id — like the UI.
            for k in ["name", "email", "id"] {
                if let Some(Value::String(s)) = o.get(k) {
                    return s.clone();
                }
            }
            "-".to_string()
        }
        Some(Value::Array(_)) => "[…]".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn ticket_rows_prefer_ticket_columns() {
        let items = vec![json!({
            "id": "t1",
            "incidentNumber": "MA-42",
            "title": "Printer jam",
            "status": "open",
            "priority": "high",
            "description": "long text that should not be a column",
            "messages": [],
        })];
        let cols = pick_columns(&items, &DEFAULT_COLS);
        assert_eq!(cols[0], "incidentNumber");
        assert_eq!(cols[1], "title");
        assert!(!cols.contains(&"description".to_string()));
    }

    #[test]
    fn cell_renders_nested_by_name() {
        assert_eq!(cell(Some(&json!({"name": "Keenan"}))), "Keenan");
        assert_eq!(cell(Some(&json!([1, 2]))), "[…]");
        assert_eq!(cell(None), "-");
    }

    #[test]
    fn table_renders_rows() {
        let mut out = Vec::new();
        let items = vec![
            json!({"incidentNumber": "MA-1", "title": "a"}),
            json!({"incidentNumber": "MA-2", "title": "b"}),
        ];
        print_value(&mut out, &Value::Array(items), false).unwrap();
        let s = String::from_utf8(out).unwrap();
        assert!(s.contains("MA-1"));
        assert!(s.contains("2 row(s)"));
    }
}
